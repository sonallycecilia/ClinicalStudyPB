import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import App from '../App';
import type { UserRole } from '../types';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: mockUseAuth,
}));

const request = vi.fn();
const options = [{ id: 'study-1', title: 'Estudo em recrutamento' }];
const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
function session(role: UserRole = 'Coordenador') {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', name: 'Ana Silva', role, status: 'Ativo' },
    loading: false, request, logout: vi.fn(),
  });
}
beforeEach(() => {
  window.history.replaceState({}, '', '/coordenador/candidatos/novo');
  request.mockReset().mockResolvedValue(jsonResponse(options));
  session();
});
afterEach(cleanup);

describe('página e rotas de cadastro de candidato no App', () => {
  it('carrega estudos reais pela consulta autorizada, preserva o layout e mantém o cadastro sem persistência bloqueado', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Candidatos e participantes.*Cadastrar candidato/ }).textContent).toContain('>');
    const menu = screen.getByRole('navigation', { name: 'Menu do perfil Coordenador' });
    expect(menu.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/coordenador/candidatos');
    expect(screen.getByRole('link', { name: 'ClinicalStudyPB início' })).toBeTruthy();
    expect(screen.queryByText('O envio do cadastro estará disponível após a integração com o sistema.')).toBeNull();
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.disabled).toBe(false);
    expect(study.required).toBe(true);
    fireEvent.change(study, { target: { value: 'study-1' } });
    expect(study.value).toBe('study-1');
    expect(screen.queryByLabelText('Pessoa cadastrada (opcional)')).toBeNull();
    const button = screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('candidate-integration-hint');
    fireEvent.click(button);
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.blur(screen.getByLabelText(/Nome completo/));
    expect(screen.getByText('Informe o nome completo do candidato.')).toBeTruthy();
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });
    expect(screen.queryByText('Candidato cadastrado com sucesso.')).toBeNull();
  });

  it('abre o modal a partir da listagem e cancela sem navegar ou criar registros', () => {
    window.history.replaceState({}, '', '/coordenador/candidatos');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    expect(screen.getByRole('dialog', { name: 'Cadastrar candidato' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Pessoa não salva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Lista de candidatos e participantes' })).toBeTruthy();
    expect(screen.queryByText('Pessoa não salva')).toBeNull();
    expect(request).toHaveBeenCalledOnce();
    expect((request.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('retorna à listagem pelo cabeçalho', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Candidatos e participantes', current: false }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
  });

  it('mantém o seletor indisponível enquanto carrega a consulta', () => {
    request.mockReturnValue(new Promise<Response>(() => {}));
    render(<App />);
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.disabled).toBe(true);
    expect(study.getAttribute('aria-busy')).toBe('true');
    expect(document.getElementById('candidate-study-hint')?.textContent).toBe('Carregando estudos…');
  });

  it('informa quando a consulta não retorna estudos disponíveis', async () => {
    request.mockResolvedValue(jsonResponse([]));
    render(<App />);
    await screen.findByText('Nenhum estudo disponível para associação.');
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.disabled).toBe(true);
    expect(study.options).toHaveLength(1);
  });

  it.each(['rede', 'HTTP'])('apresenta erro de consulta sem oferecer dados substitutos: %s', async (failure) => {
    if (failure === 'rede') request.mockRejectedValue(new Error('Falha de conexão'));
    else request.mockResolvedValue(jsonResponse({ message: 'Falha interna' }, 500));
    render(<App />);
    await screen.findByRole('alert');
    expect(screen.getByText('Não foi possível carregar os estudos. Tente novamente mais tarde.')).toBeTruthy();
    const study = screen.getByLabelText(/^Estudo/) as HTMLSelectElement;
    expect(study.disabled).toBe(true);
    expect(study.options).toHaveLength(1);
    expect(screen.queryByText('Estudo em recrutamento')).toBeNull();
  });

  it.each(['Administrador', 'Pesquisador'] as const)('nega acesso direto para %s', (role) => {
    session(role);
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('redireciona usuário sem sessão ao login', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  });
});
