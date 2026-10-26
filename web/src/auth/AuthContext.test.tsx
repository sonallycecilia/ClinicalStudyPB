import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const researcher = {
  id: 'd8d77e38-f240-4a1d-a17f-b0e918a548f3', name: 'Marina Costa',
  email: 'marina.costa@clinicalstudypb.test', phone: '(83) 99999-0000',
  role: 'Pesquisador', status: 'Ativo', createdAt: '2026-10-01T12:00:00.000Z',
};

function TestConsumer() {
  const { user, loading, login, logout, request } = useAuth();
  return <div>
    <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
    <span data-testid="user">{user?.email ?? 'sem sessão'}</span>
    <button onClick={() => void login(researcher.email, 'Demo123!').catch((error: Error) => { document.querySelector('[data-testid="error"]')!.textContent = error.message; })}>login</button>
    <button onClick={() => void logout().catch((error: Error) => { document.querySelector('[data-testid="error"]')!.textContent = error.message; })}>logout</button>
    <button onClick={() => void request('/private').catch(() => undefined)}>request-401</button>
    <span data-testid="error" />
  </div>;
}

function mount() {
  return render(<AuthProvider><TestConsumer /></AuthProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AuthContext — integração de sessão com a API', () => {
  it('valida um token persistido consultando /auth/me', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'valid-token' }));
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => researcher } as Response);
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer valid-token' },
    }));
  });

  it('faz login apenas quando a API valida as credenciais e depois revoga a sessão no logout', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ accessToken: 'new-token', user: researcher }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ message: 'Sessão encerrada com sucesso.' }) } as Response);
    mount();
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));
    expect(JSON.parse(localStorage.getItem('clinicalstudy.session') ?? '{}').accessToken).toBe('new-token');
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('sem sessão'));
    const logoutCall = vi.mocked(fetch).mock.calls.at(-1);
    expect(logoutCall?.[0]).toBe('http://localhost:3000/auth/logout');
    expect(logoutCall?.[1]?.method).toBe('POST');
    expect(new Headers(logoutCall?.[1]?.headers).get('Authorization')).toBe('Bearer new-token');
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
  });

  it('não cria sessão local quando a API está indisponível', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('error').textContent).toContain('Não foi possível conectar à API'));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('sem sessão');
  });

  it('limpa a sessão quando uma requisição autenticada recebe 401', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'expired-token' }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Sessão expirada' }) } as Response);
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));
    fireEvent.click(screen.getByText('request-401'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('sem sessão'));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
  });
});
