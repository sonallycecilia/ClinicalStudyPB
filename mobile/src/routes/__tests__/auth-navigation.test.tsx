import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store');
// A primeira montagem inclui os navegadores e as telas reais do aplicativo.
jest.setTimeout(30000);
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
const user = { id: 'participant', name: 'Bianca Oliveira', email: 'bianca.oliveira@clinicalstudypb.test', phone: '', role: 'Participante', status: 'Ativo', createdAt: '2026-11-01T00:00:00.000Z' };
function response(status: number, data: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
const previousUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
  fetchMock.mockReset();
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue('saved-token');
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});

describe('Rotas protegidas', () => {
  it('exibe somente carregamento enquanto consulta o armazenamento', async () => {
    let resolve!: (token: string | null) => void;
    jest.mocked(SecureStore.getItemAsync).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const app = await renderRouter('./src/app', { initialUrl: '/' });
    expect(app.getPathname()).toBe('/session');
    expect(screen.getByLabelText('Verificando sessão')).toBeTruthy();
    expect(screen.queryByText('Bem-vindo de volta')).toBeNull();
    await act(async () => { resolve(null); });
    await waitFor(() => expect(app.getPathname()).toBe('/login'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mantém login e home bloqueados até /me validar a sessão', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const app = await renderRouter('./src/app', { initialUrl: '/' });
    expect(app.getPathname()).toBe('/session');
    expect(screen.getByLabelText('Verificando sessão')).toBeTruthy();
    expect(screen.queryByText('Bem-vindo de volta')).toBeNull();
    expect(screen.queryByText('Olá, Bianca')).toBeNull();
    await act(async () => { resolve(response(200, user)); });
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(screen.getByText('Olá, Bianca')).toBeTruthy();
  });

  it('oferece nova tentativa após erro de rede e remove rota protegida após logout', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const app = await renderRouter('./src/app', { initialUrl: '/' });
    expect(app.getPathname()).toBe('/session');
    expect(screen.getByText('Não foi possível verificar sua sessão')).toBeTruthy();
    expect(screen.queryByText('Bem-vindo de volta')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();
    fetchMock.mockResolvedValueOnce(response(200, user));
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    fetchMock.mockResolvedValueOnce(response(201));
    await fireEvent.press(screen.getByRole('tab', { name: 'Perfil' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(app.getPathname()).toBe('/login'));
    expect(screen.queryByText('Olá, Bianca')).toBeNull();
    expect(app.getRouterState()?.routes.map(route => route.name)).not.toContain('index');
  });

  it('envia sessão inválida ao login com solicitação de nova autenticação', async () => {
    fetchMock.mockResolvedValueOnce(response(401));
    const app = await renderRouter('./src/app', { initialUrl: '/' });
    expect(app.getPathname()).toBe('/login');
    expect(screen.getByText(/Entre novamente/)).toBeTruthy();
    expect(screen.queryByText('Olá, Bianca')).toBeNull();
  });


});
