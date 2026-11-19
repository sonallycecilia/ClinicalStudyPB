import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { participantVisitsService, type Visit, visitsForScope } from '../../visits/participantVisitsApi';
import { HttpError } from '../../api/http';
import { visits } from '../../../tests/fixtures/visits';

jest.mock('../../visits/participantVisitsApi', () => ({
  ...jest.requireActual<typeof import('../../visits/participantVisitsApi')>('../../visits/participantVisitsApi'),
  participantVisitsService: { listForAuthenticatedParticipant: jest.fn() },
}));
const listMock = jest.mocked(participantVisitsService.listForAuthenticatedParticipant);

jest.mock('expo-secure-store');
jest.setTimeout(30000);
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
const user = { id: 'participant', name: 'Bianca Oliveira', email: 'bianca.oliveira@clinicalstudypb.test', phone: '', role: 'Participante', status: 'Ativo', createdAt: '2026-11-01T00:00:00.000Z' };
const previousUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
  fetchMock.mockReset();
  listMock.mockReset().mockRejectedValue(new HttpError(404));
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
});
afterEach(() => {
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = previousUrl;
});


async function openVisits() {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('saved-token');
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => user } as Response);
  const app = await renderRouter('./src/app', { initialUrl: '/' });
  await waitFor(() => expect(app.getPathname()).toBe('/'));
  await fireEvent.press(screen.getByRole('tab', { name: 'Visitas' }));
  await waitFor(() => expect(app.getPathname()).toBe('/visitas'));
  return app;
}

describe('Visitas — navegação autenticada', () => {
  it('protege links diretos de lista, detalhes, ações e perfil sem sessão', async () => {
    for (const path of ['/visitas', '/visitas/1', '/visitas/1/reagendar', '/perfil']) {
      const app = await renderRouter('./src/app', { initialUrl: path });
      await waitFor(() => expect(app.getPathname()).toBe('/login'));
      expect(screen.queryByText('Visita A')).toBeNull();
      await app.unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra indisponibilidade sem dados fictícios para o participante autenticado', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('saved-token');
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => user } as Response);
    const app = await renderRouter('./src/app', { initialUrl: '/visitas' });
    await waitFor(() => expect(app.getPathname()).toBe('/'));
    await fireEvent.press(screen.getByRole('tab', { name: 'Visitas' }));
    await waitFor(() => expect(app.getPathname()).toBe('/visitas'));
    expect(await screen.findByText(/O recurso solicitado não foi encontrado/)).toBeTruthy();
    expect(screen.queryByText('Visita A')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('navega por detalhes, confirmação, reagendamento, calendário e histórico sem enviar operações', async () => {
    listMock.mockImplementation(async scope => visitsForScope(visits, scope));
    const app = await openVisits();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver detalhes de Visita A' }));
    await waitFor(() => expect(app.getPathname()).toBe('/visitas/1'));
    expect(screen.getByText('Código TEST-1')).toBeTruthy();
    expect(screen.getByText('INSTRUÇÕES DE PREPARO')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar presença' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar presença' }));
    expect(screen.getByText('Funcionalidade em desenvolvimento. Nenhuma solicitação foi enviada.')).toBeTruthy();
    expect(screen.queryByText('Presença confirmada')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar aos detalhes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Solicitar reagendamento' }));
    await waitFor(() => expect(app.getPathname()).toBe('/visitas/1/reagendar'));
    expect(screen.getByText(/A visita atual permanece válida/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Preferência de nova data/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));
    const nextMonth = new Date();
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    await fireEvent.press(screen.getByRole('button', { name: `Selecionar ${nextMonth.toLocaleDateString('pt-BR')}` }));
    await fireEvent.press(screen.getByRole('button', { name: 'Período, Selecione' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Manhã' }));
    await fireEvent.changeText(screen.getByLabelText('Motivo opcional'), 'Preferência de horário para transporte.');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitação' }));
    expect(screen.getByText('Funcionalidade em desenvolvimento. Nenhuma solicitação foi enviada.')).toBeTruthy();
    expect(screen.queryByText('Reagendamento solicitado')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar aos detalhes' }));
    expect(screen.getByText('Agendada')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para visitas' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByText('Ausente')).toBeTruthy();
    expect(screen.getByText('Cancelada')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver detalhes de Visita D' }));
    expect(screen.queryByRole('button', { name: 'Confirmar presença' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Solicitar reagendamento' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/me");
  });

  it('mostra os dois escopos vazios, permite repetir erros e recupera sem dados locais', async () => {
    let resolve!: (value: Visit[]) => void;
    listMock.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await openVisits();
    expect(screen.getByLabelText('Carregando visitas')).toBeTruthy();
    await act(async () => { resolve([]); });
    expect(await screen.findByText('Você não tem próximas visitas agendadas.')).toBeTruthy();
    listMock.mockResolvedValueOnce([]);
    await fireEvent.press(screen.getByRole('tab', { name: 'Histórico' }));
    expect(await screen.findByText('Seu histórico de comparecimento ainda está vazio.')).toBeTruthy();
    listMock.mockRejectedValueOnce(new Error('Falha no serviço.'));
    await fireEvent.press(screen.getByRole('tab', { name: 'Próximas visitas' }));
    expect(await screen.findByText('Falha no serviço.')).toBeTruthy();
    listMock.mockResolvedValueOnce(visitsForScope(visits, 'upcoming'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Visita A')).toBeTruthy();
  });

  it('trata uma visita inexistente sem mostrar dados de outra visita', async () => {
    listMock.mockResolvedValue(visitsForScope(visits, 'upcoming'));
    await openVisits();
    await act(async () => { router.push('/visitas/inexistente'); });
    expect(await screen.findByText('Visita não encontrada nesta agenda.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar presença' })).toBeNull();
  });

  it('preserva detalhes quando E10 não fornece código, local ou instruções de preparo', async () => {
    listMock.mockResolvedValue([{ ...visits[0], code: undefined, location: undefined, preparation: undefined }]);
    await openVisits();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver detalhes de Visita A' }));
    expect(await screen.findByText('Visita 01')).toBeTruthy();
    expect(screen.getByText('Local a informar')).toBeTruthy();
    expect(screen.queryByText('Código TEST-1')).toBeNull();
    expect(screen.queryByText('INSTRUÇÕES DE PREPARO')).toBeNull();
    expect(screen.queryByText(/Chegue com 15 minutos/)).toBeNull();
  });
});
