import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { consentTerm } from '../../consent/consentTerm';
import { completeFirstAccess } from '../../../tests/fixtures/completeFirstAccess';

jest.mock('expo-secure-store');
jest.setTimeout(30000);
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
const user = { id: 'participant', name: 'Bianca Oliveira', email: 'bianca@example.test', phone: '', role: 'Participante', status: 'Ativo', createdAt: '2026-11-01T00:00:00.000Z' };
const previousUrl = process.env.EXPO_PUBLIC_API_URL;
function response(data: unknown) { return { ok: true, status: 200, json: async () => data } as Response; }

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
  fetchMock.mockReset().mockImplementation(async url => response(String(url).endsWith('/auth/me') ? user : []));
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue('saved-token');
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});

describe('Termo de consentimento — primeiro acesso', () => {
  it('bloqueia o dashboard e os links diretos até o aceite e a ação Continuar', async () => {
    const app = await renderRouter('./src/app', { initialUrl: '/visitas/1' });
    await waitFor(() => expect(app.getPathname()).toBe('/primeiro-acesso'));
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { router.push('/perfil'); });
    expect(app.getPathname()).toBe('/primeiro-acesso');
    await completeFirstAccess();
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(await screen.findByText('Olá, Bianca')).toBeTruthy();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:3000/auth/me', 'http://localhost:3000/me/studies',
    ]);
  });

  it('exibe o texto completo, exige concordância e permite voltar sem registrar aceite', async () => {
    const app = await renderRouter('./src/app', { initialUrl: '/termo-consentimento' });
    await fireEvent.press(await screen.findByRole('button', { name: /Visualizar termo de consentimento/ }));
    expect(await screen.findByText(consentTerm.title)).toBeTruthy();
    for (const section of consentTerm.sections) expect(screen.getByText(section.title)).toBeTruthy();
    expect(screen.getByText('Versão 1.0 | Novembro de 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar aceite' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Confirmar aceite' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar sem aceitar' }));
    expect(app.getPathname()).toBe('/primeiro-acesso');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: /Visualizar termo de consentimento/ }));
    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retorna ao primeiro acesso após confirmar e mostra o termo aceito para releitura', async () => {
    const app = await renderRouter('./src/app', { initialUrl: '/termo-consentimento' });
    await fireEvent.press(await screen.findByRole('button', { name: /Visualizar termo de consentimento/ }));
    await fireEvent.press(await screen.findByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar aceite' }));
    await waitFor(() => expect(app.getPathname()).toBe('/primeiro-acesso'));
    expect(screen.getByText('Lido e aceito')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: /Termo de consentimento/ }));
    expect(screen.getByText('Termo de consentimento aceito')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar aceite' })).toBeNull();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Voltar' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
  });

  it('mantém o logout real no primeiro acesso', async () => {
    const app = await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(app.getPathname()).toBe('/login'));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/auth/logout') && options?.method === 'POST')).toBe(true);
  });

  it('protege as telas de primeiro acesso e termo sem autenticação', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    for (const path of ['/primeiro-acesso', '/termo-consentimento']) {
      const app = await renderRouter('./src/app', { initialUrl: path });
      await waitFor(() => expect(app.getPathname()).toBe('/login'));
      expect(screen.queryByText(consentTerm.title)).toBeNull();
      await app.unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
