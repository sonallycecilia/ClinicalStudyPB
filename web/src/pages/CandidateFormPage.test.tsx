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
function session(role: UserRole = 'Coordenador') {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', name: 'Ana Silva', role, status: 'Ativo' },
    loading: false, request, logout: vi.fn(),
  });
}
beforeEach(() => {
  window.history.replaceState({}, '', '/coordenador/candidatos/novo');
  request.mockReset();
  session();
});
afterEach(cleanup);

describe('página e rotas de cadastro de candidato no App', () => {
  it('preserva o layout e desabilita o envio enquanto não há persistência', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Candidatos e participantes.*Cadastrar candidato/ }).textContent).toContain('>');
    const menu = screen.getByRole('navigation', { name: 'Menu do perfil Coordenador' });
    expect(menu.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe('/coordenador/candidatos');
    expect(screen.getByRole('link', { name: 'ClinicalStudyPB início' })).toBeTruthy();
    expect(screen.getByText('O envio do cadastro estará disponível após a integração com o sistema.')).toBeTruthy();
    expect((screen.getByLabelText(/^Estudo/) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByLabelText('Pessoa cadastrada (opcional)')).toBeNull();
    expect(screen.getByText('Não foi possível carregar os estudos disponíveis para vinculação.')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe('candidate-integration-hint');
    fireEvent.click(button);
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.blur(screen.getByLabelText(/Nome completo/));
    expect(screen.getByText('Informe o nome completo do candidato.')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByText('Candidato cadastrado com sucesso.')).toBeNull();
  });

  it('navega da listagem para o formulário e cancela sem criar registros', () => {
    window.history.replaceState({}, '', '/coordenador/candidatos');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    expect(window.location.pathname).toBe('/coordenador/candidatos/novo');
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Pessoa não salva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
    expect(screen.getByRole('heading', { name: 'Lista de candidatos e participantes' })).toBeTruthy();
    expect(screen.queryByText('Pessoa não salva')).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('retorna à listagem pelo cabeçalho', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Candidatos e participantes', current: false }));
    expect(window.location.pathname).toBe('/coordenador/candidatos');
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
