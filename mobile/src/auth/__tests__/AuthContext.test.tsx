import { act, renderHook, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../AuthContext';
import { tokenStorage } from '../tokenStorage';
import { StrictMode, type ReactNode } from 'react';

jest.mock('expo-secure-store');
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: 'localhost:8081' } } }));
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
const user = { id: 'participant', name: 'Bianca Oliveira', email: 'bianca.oliveira@clinicalstudypb.test', phone: '', role: 'Participante', status: 'Ativo', createdAt: '2026-11-01T00:00:00.000Z' };
const session = { accessToken: 'test-token', user };
const read = jest.mocked(SecureStore.getItemAsync);
const save = jest.mocked(SecureStore.setItemAsync);
const remove = jest.mocked(SecureStore.deleteItemAsync);
let saved: string | null;
function response(status: number, data: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function setup() { return renderHook(useAuth, { wrapper: AuthProvider }); }
async function loggedIn() {
  fetchMock.mockResolvedValueOnce(response(201, session));
  const hook = await setup();
  await act(() => hook.result.current.login(user.email, 'Demo123!'));
  return hook;
}

beforeEach(async () => {
  fetchMock.mockReset();
  saved = null;
  read.mockReset().mockImplementation(async () => saved);
  save.mockReset().mockImplementation(async (_key, value) => { saved = value; });
  remove.mockReset().mockImplementation(async () => { saved = null; });
  await tokenStorage.clear();
  jest.clearAllMocks();
});

describe('Sessão mobile', () => {
  it('não duplica /me quando os efeitos são reiniciados em StrictMode', async () => {
    saved = 'old-token';
    fetchMock.mockResolvedValueOnce(response(200, user));
    const { result } = await renderHook(useAuth, { wrapper: ({ children }: { children: ReactNode }) => <StrictMode><AuthProvider>{children}</AuthProvider></StrictMode> });
    expect(result.current.status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('inicia sem token, sem consultar a API', async () => {
    const { result } = await setup();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persiste somente o token após login de Participante ativo e restaura ao reiniciar o provider', async () => {
    const hook = await loggedIn();
    expect(hook.result.current.status).toBe('authenticated');
    expect(save).toHaveBeenCalledWith('clinicalstudypb.accessToken', 'test-token', expect.any(Object));
    expect(save).toHaveBeenCalledTimes(1);
    await hook.unmount();
    fetchMock.mockResolvedValueOnce(response(200, user));
    const next = await setup();
    expect(next.result.current.status).toBe('authenticated');
    expect(next.result.current.user).toEqual(user);
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:3000/auth/me', expect.objectContaining({
      method: 'GET', body: undefined, headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });

  it.each(['Administrador', 'Coordenador', 'Pesquisador'])('recusa login de %s e tenta revogar sem persistir', async role => {
    fetchMock.mockResolvedValueOnce(response(201, { ...session, user: { ...user, role } })).mockResolvedValueOnce(response(201));
    const { result } = await setup();
    await act(async () => {
      await expect(result.current.login(user.email, 'Demo123!')).rejects.toThrow('destinado ao perfil Participante');
    });
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:3000/auth/logout', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  });

  it('recusa login de conta inativa', async () => {
    fetchMock.mockResolvedValueOnce(response(201, { ...session, user: { ...user, status: 'Inativo' } })).mockResolvedValueOnce(response(201));
    const { result } = await setup();
    await act(async () => { await expect(result.current.login(user.email, 'Demo123!')).rejects.toThrow('inativa'); });
    expect(result.current.user).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['expirado', 'inválido', 'revogado'])('descarta token %s quando /me responde 401', async () => {
    saved = 'old-token';
    fetchMock.mockResolvedValueOnce(response(401));
    const { result } = await setup();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.message).toMatch(/Entre novamente/);
    expect(saved).toBeNull();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['inativa', { ...user, status: 'Inativo' }],
    ['perfil alterado', { ...user, role: 'Pesquisador' }],
    ['resposta envelopada indevidamente', { user }],
    ['resposta incompleta', { ...user, status: undefined }],
    ['resposta inválida', null],
  ])('bloqueia e apaga sessão com %s', async (_label, data) => {
    saved = 'old-token';
    fetchMock.mockResolvedValueOnce(response(200, data)).mockResolvedValueOnce(response(201));
    const { result } = await setup();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(saved).toBeNull();
  });

  it.each([403, 404])('trata conta indisponível (%s)', async status => {
    saved = 'old-token';
    fetchMock.mockResolvedValueOnce(response(status));
    const { result } = await setup();
    expect(result.current.message).toMatch(/conta está indisponível/);
    expect(result.current.status).toBe('unauthenticated');
    expect(saved).toBeNull();
  });

  it.each(['rede', 'timeout', '5xx', 'leitura da resposta'])('preserva token e bloqueia acesso em falha de %s; permite nova tentativa', async failure => {
    saved = 'old-token';
    if (failure === '5xx') fetchMock.mockResolvedValueOnce(response(503));
    else if (failure === 'leitura da resposta') fetchMock.mockResolvedValueOnce({ ...response(200), json: async () => { throw new TypeError('connection lost'); } } as Response);
    else fetchMock.mockRejectedValueOnce(new Error(failure === 'timeout' ? 'AbortError' : 'offline'));
    const { result } = await setup();
    expect(result.current.status).toBe('validation-error');
    expect(result.current.message).toBe('Não foi possível verificar sua sessão');
    expect(result.current.user).toBeNull();
    expect(saved).toBe('old-token');
    expect(remove).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(response(200, user));
    await act(() => result.current.retry());
    expect(result.current.status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('não duplica a verificação em curso e ignora resposta de /me depois do logout', async () => {
    saved = 'old-token';
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(201));
    const { result } = await setup();
    expect(result.current.status).toBe('verifying');
    expect(result.current.user).toBeNull();
    await act(async () => { await Promise.all([result.current.retry(), result.current.retry()]); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => result.current.logout());
    await act(async () => { pending.resolve(response(200, user)); });
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(saved).toBeNull();
  });

  it('ignora leitura do armazenamento que termina depois de sair', async () => {
    const pending = deferred<string | null>();
    read.mockReturnValueOnce(pending.promise);
    const { result } = await setup();
    let logout!: Promise<void>;
    await act(async () => { logout = result.current.logout(); });
    expect(result.current.user).toBeNull();
    await act(async () => { pending.resolve('old-token'); await logout; });
    expect(result.current.status).toBe('unauthenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revoga login atrasado após logout sem salvar token', async () => {
    const pending = deferred<Response>();
    const { result } = await setup();
    fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(201));
    let login!: Promise<void>;
    await act(async () => { login = result.current.login(user.email, 'Demo123!'); });
    await act(() => result.current.logout());
    await act(async () => { pending.resolve(response(201, session)); await login; });
    expect(result.current.status).toBe('unauthenticated');
    expect(save).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('apaga gravação que estava em curso quando o logout começou', async () => {
    const pending = deferred<void>();
    save.mockImplementationOnce(async (_key, value) => { await pending.promise; saved = value; });
    fetchMock.mockResolvedValueOnce(response(201, session)).mockResolvedValueOnce(response(201));
    const { result } = await setup();
    let login!: Promise<void>;
    await act(async () => { login = result.current.login(user.email, 'Demo123!'); });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    let logout!: Promise<void>;
    await act(async () => { logout = result.current.logout(); });
    await act(async () => { pending.resolve(); await Promise.all([login, logout]); });
    expect(saved).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it.each([201, 401, 503])('encerra localmente o logout mesmo com resposta HTTP %s', async status => {
    const { result } = await loggedIn();
    fetchMock.mockResolvedValueOnce(response(status));
    await act(() => result.current.logout());
    expect(result.current.status).toBe('unauthenticated');
    expect(saved).toBeNull();
    if (status !== 201) expect(result.current.message).toMatch(/poderá permanecer ativa até expirar/);
  });

  it('bloqueia imediatamente durante logout sem rede e não restaura no próximo provider', async () => {
    const hook = await loggedIn();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(() => hook.result.current.logout());
    expect(hook.result.current.message).toMatch(/poderá permanecer ativa até expirar/);
    expect(hook.result.current.user).toBeNull();
    await hook.unmount();
    const next = await setup();
    expect(next.result.current.status).toBe('unauthenticated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('permite sair durante erro de validação', async () => {
    saved = 'old-token';
    fetchMock.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    const { result } = await setup();
    await act(() => result.current.logout());
    expect(result.current.status).toBe('unauthenticated');
    expect(saved).toBeNull();
  });

  it('trata erro de leitura sem liberar acesso e permite tentar novamente', async () => {
    read.mockRejectedValueOnce(new Error('keychain locked'));
    const { result } = await setup();
    expect(result.current.status).toBe('validation-error');
    expect(result.current.message).toMatch(/armazenamento seguro/);
    await act(() => result.current.retry());
    expect(result.current.status).toBe('unauthenticated');
  });

  it('não libera acesso se salvar falhar e tenta revogar o token emitido', async () => {
    save.mockRejectedValueOnce(new Error('keychain locked'));
    fetchMock.mockResolvedValueOnce(response(201, session)).mockResolvedValueOnce(response(201));
    const { result } = await setup();
    await act(async () => { await expect(result.current.login(user.email, 'Demo123!')).rejects.toThrow('salvar a sessão com segurança'); });
    expect(result.current.user).toBeNull();
    expect(saved).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('inutiliza a chave se a exclusão falhar', async () => {
    const { result } = await loggedIn();
    remove.mockRejectedValueOnce(new Error('delete failed'));
    fetchMock.mockResolvedValueOnce(response(201));
    await act(() => result.current.logout());
    expect(saved).toBe('');
    expect(result.current.status).toBe('unauthenticated');
  });

  it('mantém bloqueio se exclusão e sobrescrita falharem e repete limpeza sem restaurar', async () => {
    const { result } = await loggedIn();
    remove.mockRejectedValueOnce(new Error('delete failed'));
    save.mockRejectedValueOnce(new Error('write failed'));
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.logout());
    expect(result.current.status).toBe('validation-error');
    expect(result.current.user).toBeNull();
    expect(result.current.message).toMatch(/remover a sessão/);
    await act(() => result.current.retry());
    expect(result.current.status).toBe('unauthenticated');
    expect(saved).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
