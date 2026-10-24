import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from '../types';

const key = 'clinicalstudy.session';
const user: User = { id: 'db-user', name: 'Pessoa Teste', email: 'pessoa@example.test', phone: '83999990000', role: 'Participante', status: 'Ativo', createdAt: '2026-10-24T00:00:00.000Z' };
const fetchMock = vi.fn<typeof fetch>();
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
function Probe() {
  const auth = useAuth();
  return <>
    <p>{auth.loading ? 'validando' : auth.user?.role ?? 'sem sessão'}</p>
    <button onClick={() => void auth.login(user.email, 'Senha123!').catch(() => {})}>entrar</button>
    <button onClick={() => void auth.logout().catch(() => {})}>sair</button>
    <button onClick={() => void auth.request('/users')}>consultar</button>
  </>;
}
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('sessão conectada à API', () => {
  it('valida a sessão restaurada antes de confiar no perfil do navegador', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'token', user: { ...user, role: 'Administrador' } }));
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('validando')).toBeTruthy();
    expect(screen.queryByText('Administrador')).toBeNull();
    await act(async () => { resolve(json(user)); });
    expect(screen.getByText('Participante')).toBeTruthy();
  });
  it('remove sessão revogada ao restaurar', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'revogado' }));
    fetchMock.mockResolvedValue(json({}, 401));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('sem sessão')).toBeTruthy());
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('não autentica com contas locais quando a API está indisponível', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<AuthProvider><Probe /></AuthProvider>);
    fireEvent.click(screen.getByText('entrar'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('sem sessão')).toBeTruthy();
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('envia logout à API antes de remover a sessão local', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'token' }));
    fetchMock.mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json({}));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('Participante');
    fireEvent.click(screen.getByText('sair'));
    await screen.findByText('sem sessão');
    const [url, options] = fetchMock.mock.calls[1]!;
    expect(url).toContain('/auth/logout');
    expect(options?.method).toBe('POST');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer token');
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('permite repetir logout se a API falhar, sem anunciar encerramento', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'token' }));
    fetchMock.mockResolvedValueOnce(json(user)).mockRejectedValueOnce(new Error('offline'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('Participante');
    fireEvent.click(screen.getByText('sair'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Participante')).toBeTruthy();
    expect(localStorage.getItem(key)).not.toBeNull();
  });
  it('limpa a sessão quando uma operação privada recebe 401', async () => {
    localStorage.setItem(key, JSON.stringify({ accessToken: 'token' }));
    fetchMock.mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json({}, 401));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('Participante');
    fireEvent.click(screen.getByText('consultar'));
    await screen.findByText('sem sessão');
    expect(localStorage.getItem(key)).toBeNull();
  });
});
