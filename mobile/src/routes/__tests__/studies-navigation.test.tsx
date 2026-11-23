import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { studies } from '../../../tests/fixtures/studies';
import { completeFirstAccess } from '../../../tests/fixtures/completeFirstAccess';

jest.mock('expo-secure-store');
jest.setTimeout(30000);
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
const user = { id: 'participant', name: 'Bianca Oliveira', email: 'bianca@example.test', phone: '', role: 'Participante', status: 'Ativo', createdAt: '2026-11-01T00:00:00.000Z' };
const previousUrl = process.env.EXPO_PUBLIC_API_URL;
let studyResponses: (Response | Promise<Response>)[];
function response(status: number, data: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
  studyResponses = [];
  fetchMock.mockReset().mockImplementation(async url => {
    if (String(url).endsWith('/auth/me')) return response(200, user);
    if (String(url).endsWith('/me/studies')) return studyResponses.shift() ?? response(200, studies);
    return response(201);
  });
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue('saved-token');
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});
async function openStudies() {
  const app = await renderRouter('./src/app', { initialUrl: '/' });
  await completeFirstAccess();
  await screen.findByRole('button', { name: 'Ver detalhes de Qualidade do sono' });
  return app;
}
async function openDetails() {
  const app = await openStudies();
  await fireEvent.press(screen.getByRole('button', { name: 'Ver detalhes de Qualidade do sono' }));
  await waitFor(() => expect(app.getPathname()).toBe('/estudos/study-1'));
  return app;
}

describe('RF17 — detalhes dos estudos autenticados', () => {
  it('abre os detalhes de E09, mostra somente campos disponíveis e volta sem mudar as abas', async () => {
    const app = await openDetails();
    expect(await screen.findByText('DETALHES DO ESTUDO')).toBeTruthy();
    expect(screen.getByText('EST-001')).toBeTruthy();
    expect(screen.getByText('Marina Costa')).toBeTruthy();
    expect(screen.getByText(studies[0].study.objective)).toBeTruthy();
    expect(screen.getByText('01 Abr 2026')).toBeTruthy();
    expect(screen.getByText('28 Nov 2026')).toBeTruthy();
    for (const label of ['ÁREA DE PESQUISA', 'FASE', 'PROTOCOLO', 'CENTRO RESPONSÁVEL']) expect(screen.queryByText(label)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Estudos' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: 'Visitas' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Perfil' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar aos meus estudos' }));
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(screen.getByRole('button', { name: 'Ver detalhes de Qualidade do sono' })).toBeTruthy();
    const queries = fetchMock.mock.calls.filter(([url]) => String(url).includes('/me/studies'));
    expect(queries).toHaveLength(2);
    for (const [url, options] of queries) {
      expect(url).toBe('http://localhost:3000/me/studies');
      expect(options?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer saved-token' }));
    }
  });

  it('mantém retirada como prévia local na lista e nos detalhes, sem enviar operações', async () => {
    await openStudies();
    const calls = fetchMock.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Solicitar retirada do estudo' }));
    expect(screen.getByText('Funcionalidade em desenvolvimento. Nenhuma solicitação foi enviada.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver detalhes de Qualidade do sono' }));
    await screen.findByText('DETALHES DO ESTUDO');
    const detailCalls = fetchMock.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Solicitar retirada do estudo' }));
    expect(screen.getByText('Funcionalidade em desenvolvimento. Nenhuma solicitação foi enviada.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(detailCalls);
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });

  it('protege o link de detalhes sem sessão', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const app = await renderRouter('./src/app', { initialUrl: '/estudos/study-1' });
    await waitFor(() => expect(app.getPathname()).toBe('/login'));
    expect(screen.queryByText('Qualidade do sono')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não revela estudo fora das próprias participações', async () => {
    const app = await openStudies();
    await act(async () => { router.push('/estudos/foreign-id'); });
    await waitFor(() => expect(app.getPathname()).toBe('/estudos/foreign-id'));
    expect(await screen.findByText('Estudo não encontrado entre as suas participações.')).toBeTruthy();
    expect(screen.queryByText('EST-001')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Solicitar retirada do estudo' })).toBeNull();
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/studies/'))).toBe(true);
  });

  it('apresenta carregamento e lista vazia nos detalhes sem conservar o estudo da lista', async () => {
    let resolve!: (value: Response) => void;
    studyResponses.push(response(200, studies), new Promise(done => { resolve = done; }));
    await openDetails();
    expect(screen.getByLabelText('Carregando estudos')).toBeTruthy();
    await act(async () => { resolve(response(200, [])); });
    expect(await screen.findByText('Estudo não encontrado entre as suas participações.')).toBeTruthy();
    expect(screen.queryByText('EST-001')).toBeNull();
  });

  it('repete E09 após erro dos detalhes e recupera os dados', async () => {
    studyResponses.push(response(200, studies), response(503));
    await openDetails();
    expect(await screen.findByText('Não foi possível carregar os dados. Tente novamente.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('EST-001')).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/me/studies'))).toHaveLength(3);
  });

  it('remove os detalhes e retorna ao login quando E09 recebe 401', async () => {
    studyResponses.push(response(200, studies), response(401));
    const app = await openStudies();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver detalhes de Qualidade do sono' }));
    await waitFor(() => expect(app.getPathname()).toBe('/login'));
    expect(screen.queryByText('Qualidade do sono')).toBeNull();
    expect(screen.queryByText('Marina Costa')).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });
});
