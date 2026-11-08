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
  it('carrega estudos pela consulta autorizada, preserva o layout e valida antes de enviar', async () => {
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
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(button);
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByRole('alert').textContent).toBe('Informe o nome completo do candidato.');
    fireEvent.blur(screen.getByLabelText(/Nome completo/));
    expect(screen.getByText('Informe o nome completo do candidato.')).toBeTruthy();
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });
    expect(screen.queryByText('Candidato cadastrado com sucesso.')).toBeNull();
  });

  it('abre o modal a partir da listagem e cancela sem navegar ou criar registros', async () => {
    window.history.replaceState({}, '', '/coordenador/candidatos');
    render(<App />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    expect(screen.getByRole('dialog', { name: 'Cadastrar candidato' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Pessoa não salva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Lista de candidatos e participantes' })).toBeTruthy();
    expect(screen.queryByText('Pessoa não salva')).toBeNull();
    expect(request).toHaveBeenCalledTimes(3);
    expect((request.mock.calls[2][1] as RequestInit).signal?.aborted).toBe(true);
    expect((request.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(false);
  });

  it('cadastra pela página e consulta o estudo correspondente ao voltar à listagem', async () => {
    window.history.replaceState({}, '', '/coordenador/candidatos/novo?studyId=study-1');
    const candidate = { id: 'candidate-1', studyId: 'study-1', name: 'Ana Silva', email: 'ana@example.com', status: 'Novo', registeredAt: '2026-11-07T14:00:00Z' };
    request.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/studies/disponiveis-recrutamento') return jsonResponse(options);
      return jsonResponse(init?.method === 'POST' ? candidate : [candidate], init?.method === 'POST' ? 201 : 200);
    });
    render(<App />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana Silva' } });
    fireEvent.change(screen.getByLabelText(/^Estudo/), { target: { value: 'study-1' } });
    fireEvent.change(screen.getByLabelText('E-mail (opcional)'), { target: { value: 'ana@example.com' } });
    fireEvent.submit(screen.getByRole('form'));
    await screen.findByText('Candidato cadastrado com sucesso!');
    expect(request).toHaveBeenCalledWith('/studies/study-1/candidates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ana Silva', email: 'ana@example.com' }),
    });
    expect(screen.queryByRole('button', { name: 'Voltar à listagem' })).toBeNull();
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    await screen.findByRole('row', { name: /Ana Silva/ });
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).value).toBe('study-1');
    expect(request).toHaveBeenCalledWith('/studies/study-1/candidates', { signal: expect.any(AbortSignal) });
  });

  it('retorna à listagem pelo cabeçalho', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Candidatos e participantes', current: false }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
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
