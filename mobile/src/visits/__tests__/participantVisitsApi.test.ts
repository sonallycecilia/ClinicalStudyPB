import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { participantVisitsService, visitsForScope } from '../participantVisitsApi';
import { visits } from '../../../tests/fixtures/visits';
import { calendarCells, localDateKey } from '../../components/VisitDatePicker';

const now = Date.parse('2026-11-22T12:00:00.000Z');
beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(now); });
afterEach(() => { jest.restoreAllMocks(); });

describe('RF18 — contrato e isolamento', () => {
  it.each(['upcoming', 'history'] as const)('consulta apenas E10 com scope=%s, sem identificadores de terceiros', async scope => {
    const data = visitsForScope(visits, scope).map(({ code, location, preparation, ...visit }) => visit);
    const client = { get: jest.fn<() => Promise<unknown>>().mockResolvedValue(data) };
    await expect(participantVisitsService.listForAuthenticatedParticipant(scope, client)).resolves.toEqual(data);
    expect(client.get.mock.calls).toEqual([[`/me/visits?scope=${scope}`]]);
  });
  it.each(['upcoming', 'history'] as const)('aceita lista vazia em %s', async scope => {
    await expect(participantVisitsService.listForAuthenticatedParticipant(scope, { get: async () => [] })).resolves.toEqual([]);
  });
  it.each([null, {}, { data: visits }, [{ ...visits[0], status: 'Inválido' }],
    [{ ...visits[0], scheduledAt: 'inválida' }], [{ ...visits[0], plannedVisitOrder: '1' }]])('recusa resposta fora de E10: %j', async data => {
    await expect(participantVisitsService.listForAuthenticatedParticipant('upcoming', { get: async () => data })).rejects.toThrow('formato inválido');
  });
  it('ordena próximas em ordem crescente e exclui agendamentos passados ou no instante atual (E10)', () => {
    const overdue = { ...visits[0], id: 'overdue', scheduledAt: '2020-01-01T12:00:00Z' };
    const earlierToday = { ...visits[0], id: 'earlier', scheduledAt: new Date(now - 1).toISOString() };
    const atNow = { ...visits[0], id: 'now', scheduledAt: new Date(now).toISOString() };
    const laterToday = { ...visits[0], id: 'later', scheduledAt: new Date(now + 1).toISOString() };
    expect(visitsForScope([visits[1], atNow, visits[0], overdue, earlierToday, laterToday, visits[2]], 'upcoming')
      .map(visit => visit.id)).toEqual(['later', '1', '2']);
    expect(visitsForScope([overdue, earlierToday, atNow], 'history')).toEqual([]);
  });
  it('compara e ordena os instantes com fuso sem truncar para a data civil', () => {
    jest.mocked(Date.now).mockReturnValue(Date.parse('2026-11-22T00:30:00Z'));
    const future = { ...visits[0], id: 'future', scheduledAt: '2026-11-21T22:00:00-03:00' };
    const later = { ...visits[0], id: 'later', scheduledAt: '2026-11-22T00:00:00-02:00' };
    const past = { ...visits[0], id: 'past', scheduledAt: '2026-11-22T02:00:00+02:00' };
    expect(visitsForScope([later, past, future], 'upcoming').map(visit => visit.id)).toEqual(['future', 'later']);
    expect(visitsForScope([{ ...future, status: 'Realizada' }, { ...later, status: 'Ausente' }], 'history')
      .map(visit => visit.id)).toEqual(['later', 'future']);
  });
  it('inclui canceladas no histórico e ordena por data decrescente', () => {
    const history = visitsForScope(visits, 'history');
    expect(history.map(visit => visit.id)).toEqual(['3', '5', '4']);
    expect(history.map(visit => visit.status)).toEqual(['Realizada', 'Cancelada', 'Ausente']);
  });
});

describe('calendário nativo', () => {
  it('representa fevereiro bissexto, alinhado ao dia da semana', () => {
    const cells = calendarCells(2028, 1);
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells.indexOf(1)).toBe(new Date(2028, 1, 1).getDay());
    expect(cells.length % 7).toBe(0);
  });
  it('preserva a data local em vez de converter para UTC', () => {
    expect(localDateKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});
