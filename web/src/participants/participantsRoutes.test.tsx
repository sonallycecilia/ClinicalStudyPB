import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebUser } from '../types';
import App from '../App';

const { session, mockRequest } = vi.hoisted(() => ({ session: { user: null as WebUser | null, loading: false }, mockRequest: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ ...session, login: vi.fn(), logout: vi.fn(), request: mockRequest }),
}));

const base = { id: 'u1', name: 'Marcos Dias', email: 'm@x.test', phone: '83999990000', status: 'Ativo', createdAt: '2026-10-01T12:00:00.000Z' } as const;
const user = (role: WebUser['role']): WebUser => ({ ...base, role });

beforeEach(() => {
  session.user = null; session.loading = false;
  mockRequest.mockReset().mockResolvedValue(new Response('[]', { status: 200 }));
  window.history.replaceState({}, '', '/coordenador/participantes');
});
afterEach(cleanup);

describe('Rota /coordenador/participantes — navegação e permissões', () => {
  it('abre a tela para o Coordenador e exibe o item no menu', async () => {
    session.user = user('Coordenador');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Participantes incluídos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Participantes incluídos/ }).getAttribute('href')).toBe('/coordenador/participantes');
  });

  it.each(['Pesquisador', 'Administrador'] as const)('bloqueia %s com mensagem clara de acesso não autorizado', async (role) => {
    session.user = user(role);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
    expect(screen.getByText('Seu perfil não tem permissão para acessar esta página.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Participantes incluídos' })).toBeNull();
    expect(mockRequest).not.toHaveBeenCalledWith(expect.stringContaining('/participants'), expect.anything());
  });

  it('redireciona para login sem sessão', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  });

  it('mantém o menu do Coordenador com as áreas existentes', async () => {
    session.user = user('Coordenador');
    render(<App />);
    await screen.findByRole('heading', { name: 'Participantes incluídos' });
    for (const label of ['Painel do coordenador', 'Candidatos e participantes', 'Visitas e avaliações', 'Reagendamentos', 'Relatórios']) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}$`) })).toBeTruthy();
    }
  });
});
