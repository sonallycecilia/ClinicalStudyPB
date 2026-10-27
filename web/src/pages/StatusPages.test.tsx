import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { WebUser } from '../types';
import { ForbiddenPage, NotFoundPage } from './StatusPages';

const { mockLogout, mockUseAuth } = vi.hoisted(() => ({
  mockLogout: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: mockUseAuth,
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

function renderRoutes(element: ReactNode, initialEntry: { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/403" element={element} />
        <Route path="/404" element={element} />
        <Route path="/login" element={<p>Página de login</p>} />
        <Route path="/estudos" element={<p>Área do pesquisador</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mockLogout.mockReset();
});

describe('StatusPages', () => {
  it('mostra acesso negado e retorna para a área do perfil', () => {
    mockUseAuth.mockReturnValue({ user: researcher, logout: mockLogout });
    renderRoutes(<ForbiddenPage />, { pathname: '/403' });

    expect(screen.getByRole('heading', { name: 'Acesso não permitido' })).toBeTruthy();
    expect(screen.getByText('Seu perfil não tem permissão para acessar esta página.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para minha área' }));

    expect(screen.getByText('Área do pesquisador')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('encerra sessão se o perfil não possui área web e volta ao login', () => {
    const participant = { ...researcher, role: 'Participante' };
    mockUseAuth.mockReturnValue({ user: participant, logout: mockLogout });
    renderRoutes(<ForbiddenPage />, { pathname: '/403', state: { home: '/403' } });
    mockLogout.mockResolvedValue(undefined);

    expect(screen.getByText('Ainda não há uma tela definida para este perfil neste protótipo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao login' }));

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(screen.getByText('Página de login')).toBeTruthy();
  });

  it('mostra página não encontrada e oferece retorno à área inicial', () => {
    mockUseAuth.mockReturnValue({ user: researcher, logout: mockLogout });
    renderRoutes(<NotFoundPage />, { pathname: '/404' });

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao início' }));

    expect(screen.getByText('Área do pesquisador')).toBeTruthy();
  });
});
