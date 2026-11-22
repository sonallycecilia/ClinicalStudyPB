import { act, renderHook } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../AuthContext';
import { HttpError, SessionChangedError } from '../../api/http';
import { participantStudiesService } from '../../studies/participantStudiesApi';
import { participantVisitsService } from '../../visits/participantVisitsApi';
import { studies } from '../../../tests/fixtures/studies';
import { visits } from '../../../tests/fixtures/visits';

jest.mock('expo-secure-store');
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: 'localhost:8081' } } }));
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
const user = { id: 'participant-1', name: 'Bianca Oliveira', email: 'bianca@example.test', phone: '', role: 'Participante', status: 'Ativo', createdAt: '2026-11-01T00:00:00.000Z' };
const previousUrl = process.env.EXPO_PUBLIC_API_URL;
function response(status: number, data: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function loggedIn() {
  const hook = await renderHook(useAuth, { wrapper: AuthProvider });
  fetchMock.mockResolvedValueOnce(response(201, { accessToken: 'token-1', user }));
  await act(() => hook.result.current.login(user.email, 'password'));
  return hook;
}
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/base///';
  fetchMock.mockReset();
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});

describe('Consultas com a sessão real do AuthContext', () => {
  it('consulta E09/E10 com o token restaurado e validado por /auth/me', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('restored-token');
    fetchMock.mockResolvedValueOnce(response(200, user));
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    expect(result.current.status).toBe('authenticated');
    fetchMock.mockResolvedValueOnce(response(200, studies)).mockResolvedValueOnce(response(200, []));
    await expect(participantStudiesService.listForAuthenticatedParticipant(result.current.client!)).resolves.toEqual(studies);
    await expect(participantVisitsService.listForAuthenticatedParticipant('history', result.current.client!)).resolves.toEqual([]);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'https://api.example.test/base/auth/me',
      'https://api.example.test/base/me/studies',
      'https://api.example.test/base/me/visits?scope=history',
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer restored-token' }));
    }
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('envia o Bearer existente em E09/E10 e reutiliza a URL sem persistir ou reler o token', async () => {
    const { result } = await loggedIn();
    const client = result.current.client!;
    const visit = { ...visits[0], code: undefined, location: undefined, preparation: undefined };
    fetchMock.mockResolvedValueOnce(response(200, studies)).mockResolvedValueOnce(response(200, [visit])).mockResolvedValueOnce(response(200, []));
    await expect(participantStudiesService.listForAuthenticatedParticipant(client)).resolves.toEqual(studies);
    await expect(participantVisitsService.listForAuthenticatedParticipant('upcoming', client)).resolves.toEqual([visit]);
    await expect(participantVisitsService.listForAuthenticatedParticipant('history', client)).resolves.toEqual([]);
    expect(fetchMock.mock.calls.slice(1).map(call => call[0])).toEqual([
      'https://api.example.test/base/me/studies',
      'https://api.example.test/base/me/visits?scope=upcoming',
      'https://api.example.test/base/me/visits?scope=history',
    ]);
    for (const [, options] of fetchMock.mock.calls.slice(1)) {
      expect(options).toEqual(expect.objectContaining({ method: 'GET', body: undefined, headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) }));
    }
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(Object.keys(client)).toEqual(['get']);
    expect(result.current).not.toHaveProperty('accessToken');
  });

  it.each([
    ['/me/studies', 401], ['/me/visits?scope=upcoming', 401],
    ['/me/studies', 403], ['/me/visits?scope=history', 403],
  ] as const)('limpa a sessão de %s em %s conforme a matriz de acesso', async (path, status) => {
    const { result } = await loggedIn();
    const client = result.current.client!;
    fetchMock.mockResolvedValueOnce(response(status, { message: 'sensitive detail' }));
    await act(async () => { await expect(client.get(path)).rejects.toMatchObject({ status }); });
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(result.current.client).toBeNull();
    expect(result.current.message).toContain(status === 401 ? 'Entre novamente' : 'Acesso não autorizado');
    expect(result.current.message).not.toContain('sensitive');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls.length;
    await expect(client.get(path)).rejects.toBeInstanceOf(SessionChangedError);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it.each([404, 500, 503, 'rede'] as const)('preserva sessão em %s, oculta detalhes do servidor e permite repetir a consulta', async failure => {
    const { result } = await loggedIn();
    const client = result.current.client!;
    if (failure === 'rede') fetchMock.mockRejectedValueOnce(new TypeError('sensitive server detail'));
    else fetchMock.mockResolvedValueOnce(response(failure, { message: 'sensitive server detail' }));
    const request = participantStudiesService.listForAuthenticatedParticipant(client);
    await expect(request).rejects.toThrow(failure === 404 ? 'não foi encontrado' : failure === 'rede' ? 'conectar ao servidor' : 'Tente novamente');
    await expect(request).rejects.not.toThrow('sensitive');
    if (failure !== 'rede') await expect(request).rejects.toBeInstanceOf(HttpError);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.client).toBe(client);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(response(200, studies));
    await expect(participantStudiesService.listForAuthenticatedParticipant(client)).resolves.toEqual(studies);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('preserva token em timeout da consulta e permite tentar novamente', async () => {
    const { result } = await loggedIn();
    jest.useFakeTimers();
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const assertion = expect(result.current.client!.get('/me/visits?scope=history')).rejects.toThrow('conectar ao servidor');
    await jest.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(result.current.status).toBe('authenticated');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(response(200, []));
    await expect(result.current.client!.get('/me/visits?scope=history')).resolves.toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['sucesso', '401', 'rede'] as const)('descarta %s pendente após logout e novo login, sem afetar a nova sessão', async outcome => {
    const { result } = await loggedIn();
    const oldClient = result.current.client!;
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const assertion = expect(oldClient.get('/me/studies')).rejects.toBeInstanceOf(SessionChangedError);
    fetchMock.mockResolvedValueOnce(response(201));
    await act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    fetchMock.mockResolvedValueOnce(response(201, { accessToken: 'token-2', user: { ...user, id: 'participant-2' } }));
    await act(() => result.current.login('other@example.test', 'password'));
    if (outcome === 'rede') pending.reject(new Error('offline'));
    else pending.resolve(response(outcome === '401' ? 401 : 200, studies));
    await assertion;
    expect(result.current.status).toBe('authenticated');
    expect(result.current.user?.id).toBe('participant-2');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls.length;
    await expect(oldClient.get('/me/studies')).rejects.toBeInstanceOf(SessionChangedError);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    fetchMock.mockResolvedValueOnce(response(200, []));
    await expect(result.current.client!.get('/me/studies')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.test/base/me/studies', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-2' }) }));
  });

  it('limpa apenas uma vez quando consultas concorrentes recebem 401', async () => {
    const { result } = await loggedIn();
    const client = result.current.client!;
    const first = deferred<Response>();
    const second = deferred<Response>();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const requests = Promise.allSettled([client.get('/me/studies'), client.get('/me/visits?scope=upcoming')]);
    await act(async () => { first.resolve(response(401)); second.resolve(response(401)); await requests; });
    expect(result.current.status).toBe('unauthenticated');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });
});
