import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout, initials } from './AppLayout';
import type { WebUser } from '../types';

const { mockUseAuth, mockLogout } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockLogout: vi.fn(),
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

function mount() {
  return render(
    <MemoryRouter initialEntries={['/estudos']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/estudos" element={<p>Conteúdo da página</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ user: researcher, logout: mockLogout });
});

afterEach(cleanup);

describe('AppLayout', () => {
  it('mostra o perfil, os links autorizados e o conteúdo da rota', () => {
    mount();

    expect(screen.getByText('Marina Costa')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Menu do perfil Pesquisador' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Estudos clínicos/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Candidatos e participantes/ })).toBeNull();
    expect(screen.getByText('Conteúdo da página')).toBeTruthy();
  });

  it('recolhe e expande a barra lateral mantendo os estados acessíveis', () => {
    mount();
    const control = screen.getByRole('button', { name: 'Recolher menu lateral' });

    fireEvent.click(control);
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.app-shell')?.classList.contains('sidebar-collapsed')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu lateral' }));
    expect(screen.getByRole('button', { name: 'Recolher menu lateral' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('mostra erro de logout, mantém a sessão para nova tentativa e finaliza no sucesso', async () => {
    mockLogout.mockRejectedValueOnce(new Error('falha temporária'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível encerrar a sessão. Tente novamente.');
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();

    mockLogout.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('desabilita o logout enquanto a solicitação está pendente', async () => {
    let resolve!: () => void;
    mockLogout.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    const logoutButton = screen.getByRole('button', { name: 'Sair da conta' }) as HTMLButtonElement;
    expect(logoutButton.disabled).toBe(true);
    expect(logoutButton.textContent).toContain('Saindo…');
    resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeTruthy());
  });

  it('não renderiza o layout sem usuário e calcula iniciais de nomes vazios ou compostos', () => {
    mockUseAuth.mockReturnValue({ user: null, logout: mockLogout });
    const { container } = mount();

    expect(container.firstChild).toBeNull();
    expect(initials(' marina   costa silva ')).toBe('MC');
    expect(initials('')).toBe('');
  });
});
