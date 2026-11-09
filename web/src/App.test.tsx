import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebUser } from './types';
import App from './App';

const { mockSession, mockRequest } = vi.hoisted(() => ({
  mockSession: { user: null as WebUser | null, loading: false },
  mockRequest: vi.fn(),
}));

vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ ...mockSession, login: vi.fn(), logout: vi.fn(), request: mockRequest }),
}));

const researcher: WebUser = {
  id: 'researcher-id',
  name: 'Marina Costa',
  email: 'marina@example.test',
  phone: '83999990000',
  role: 'Pesquisador',
  status: 'Ativo',
  createdAt: '2026-10-01T12:00:00.000Z',
};

beforeEach(() => {
  mockSession.user = null;
  mockSession.loading = false;
  mockRequest.mockReset().mockResolvedValue(new Response('[]', { status: 200 }));
  window.history.replaceState({}, '', '/');
});

afterEach(cleanup);

describe('App — roteamento e proteção', () => {
  it('redireciona a página inicial para login sem sessão', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  });

  it('informa enquanto valida a sessão antes de liberar as rotas', () => {
    mockSession.loading = true;
    render(<App />);

    expect(screen.getByRole('status').textContent).toBe('Validando sessão…');
    expect(screen.queryByRole('heading', { name: 'Acesse sua conta' })).toBeNull();
  });

  it('encaminha o usuário autenticado da página inicial para sua área', async () => {
    mockSession.user = researcher;
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Estudos clínicos' })).toBeTruthy();
  });

  it('encaminha uma rota protegida para login quando não há sessão', async () => {
    window.history.replaceState({}, '', '/estudos');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  });

  it('redireciona para acesso negado quando o perfil não pode abrir a rota', async () => {
    mockSession.user = researcher;
    window.history.replaceState({}, '', '/usuarios');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /acesso não permitido/i })).toBeTruthy();
  });

  it('exibe página não encontrada para uma rota inexistente', () => {
    window.history.replaceState({}, '', '/rota-inexistente');
    render(<App />);

    expect(screen.getByRole('heading', { name: /página não encontrada/i })).toBeTruthy();
  });
});
