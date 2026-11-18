import { describe, expect, it, jest } from '@jest/globals';
import { participantVisitsService, visitsForScope } from '../participantVisitsApi';
import { visits } from '../../../tests/fixtures/visits';
import { calendarCells, localDateKey } from '../../components/VisitDatePicker';

describe('RF18 — contrato e isolamento', () => {
  it('não consulta endpoints RF06 nem oferece mocks no serviço real', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    try {
      await expect(participantVisitsService.listForAuthenticatedParticipant('upcoming')).rejects.toThrow('S3-BE-07');
      await expect(participantVisitsService.listForAuthenticatedParticipant('history')).rejects.toThrow('S3-BE-07');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
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
