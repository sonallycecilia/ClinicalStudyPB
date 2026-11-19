import { describe, expect, it, jest } from '@jest/globals';
import { participantVisitsService, visitsForScope } from '../participantVisitsApi';
import { visits } from '../../../tests/fixtures/visits';
import { calendarCells, localDateKey } from '../../components/VisitDatePicker';

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
  it('ordena próximas em ordem crescente e inclui agendamentos vencidos (E10)', () => {
    const overdue = { ...visits[0], id: 'overdue', scheduledAt: '2020-01-01T12:00:00Z' };
    expect(visitsForScope([visits[1], visits[0], overdue], 'upcoming').map(visit => visit.id)).toEqual(['overdue', '1', '2']);
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
