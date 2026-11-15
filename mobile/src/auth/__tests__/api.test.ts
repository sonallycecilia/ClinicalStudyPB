import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { authRequest } from '../api';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: 'localhost:8081' } } }));
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

afterEach(() => { jest.useRealTimers(); fetchMock.mockReset(); });

describe('API de autenticação', () => {
  it('mantém o timeout ativo durante a leitura da resposta', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(async (_url, options) => ({
      ok: true, status: 200,
      json: () => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      }),
    }) as Response);
    const assertion = expect(authRequest('me', undefined, 'test-token')).rejects.toThrow('Não foi possível conectar ao servidor');
    await jest.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('distingue JSON malformado de interrupção da conexão', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('invalid json'); } } as unknown as Response);
    await expect(authRequest('me', undefined, 'test-token')).resolves.toEqual({ ok: true, status: 200, data: null });
  });

  it('cancela requisição após 15 segundos e informa falha de conexão', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
    }));
    const request = authRequest('me', undefined, 'test-token');
    const assertion = expect(request).rejects.toThrow('Não foi possível conectar ao servidor');
    await jest.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
