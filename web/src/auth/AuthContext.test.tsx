import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
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
    <button onClick={() => void request('/forbidden').then((response) => { document.querySelector('[data-testid="response"]')!.textContent = String(response.status); })}>request-403</button>
    <span data-testid="error" />
    <span data-testid="response" />
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

  it('ignora token de demonstração e sessão armazenada inválida', () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'demo.legacy-token' }));
    const { unmount } = mount();
    expect(screen.getByTestId('loading').textContent).toBe('ready');
    expect(fetch).not.toHaveBeenCalled();

    unmount();
    localStorage.setItem('clinicalstudy.session', '{');
    mount();
    expect(screen.getByTestId('user').textContent).toBe('sem sessão');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'E-mail ou senha inválidos.'],
    [503, 'Não foi possível entrar. Tente novamente.'],
  ])('apresenta mensagem adequada quando o login retorna HTTP %i', async (status, message) => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status, json: async () => ({}) } as Response);
    mount();
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe(message));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
  });

  it('recusa perfil Participante na Web, tenta revogar o token e não salva sessão local', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true, status: 201,
        json: async () => ({ accessToken: 'participant-token', user: { ...researcher, role: 'Participante' } }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) } as Response);
    mount();
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Este perfil não tem acesso à interface Web.'));
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe('http://localhost:3000/auth/logout');
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('sem sessão');
  });

  it('não persiste sessão de Participante mesmo se a tentativa de revogação falhar', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true, status: 201,
        json: async () => ({ accessToken: 'participant-token', user: { ...researcher, role: 'Participante' } }),
      } as Response)
      .mockRejectedValueOnce(new Error('offline'));
    mount();
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Este perfil não tem acesso à interface Web.'));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('sem sessão');
  });

  it('encerra uma sessão restaurada quando a API retorna perfil Participante', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'participant-token' }));
    vi.mocked(fetch).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ...researcher, role: 'Participante' }),
    } as Response);
    mount();

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('sem sessão'));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('preserva a sessão ao receber 403 quando a revalidação confirma o perfil Web', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'valid-token' }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response);
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));

    fireEvent.click(screen.getByText('request-403'));
    await waitFor(() => expect(screen.getByTestId('response').textContent).toBe('403'));
    expect(screen.getByTestId('user').textContent).toBe(researcher.email);
    expect(localStorage.getItem('clinicalstudy.session')).not.toBeNull();
  });

  it('remove a sessão se a revalidação após 403 retornar um perfil não Web', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'valid-token' }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ ...researcher, role: 'Participante' }),
      } as Response);
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));

    fireEvent.click(screen.getByText('request-403'));
    await waitFor(() => expect(screen.getByTestId('response').textContent).toBe('403'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('sem sessão'));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
  });

  it('devolve o 403 original e preserva a sessão se a revalidação falhar por rede', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'valid-token' }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response)
      .mockRejectedValueOnce(new Error('offline'));
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));

    fireEvent.click(screen.getByText('request-403'));
    await waitFor(() => expect(screen.getByTestId('response').textContent).toBe('403'));
    expect(screen.getByTestId('user').textContent).toBe(researcher.email);
    expect(localStorage.getItem('clinicalstudy.session')).not.toBeNull();
  });

  it('limpa a sessão quando a revalidação após 403 confirma token expirado', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'expired-token' }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response);
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));

    fireEvent.click(screen.getByText('request-403'));
    await waitFor(() => expect(screen.getByTestId('response').textContent).toBe('403'));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('sem sessão'));
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
  });

  it('mantém a sessão quando a revogação falha para permitir nova tentativa', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'valid-token' }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => researcher } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);
    mount();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));

    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Não foi possível encerrar a sessão. Tente novamente.'));
    expect(screen.getByTestId('user').textContent).toBe(researcher.email);
    expect(localStorage.getItem('clinicalstudy.session')).not.toBeNull();
  });

  it('sincroniza uma nova sessão após evento de armazenamento entre abas', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => researcher } as Response);
    mount();
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'other-tab-token' }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'clinicalstudy.session' })));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe(researcher.email));
    const [url, options] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:3000/auth/me');
    expect(new Headers(options?.headers).get('Authorization')).toContain('other-tab-token');
  });

  it('lança erro explícito quando useAuth é chamado fora do provedor', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow('useAuth deve ser utilizado dentro de AuthProvider.');
    consoleError.mockRestore();
  });
});
