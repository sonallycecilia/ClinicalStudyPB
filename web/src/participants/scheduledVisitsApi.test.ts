import { describe, expect, it, vi } from 'vitest';
import { isScheduledVisit, scheduledVisitsApi } from './scheduledVisitsApi';
import { toSaoPauloOffset, todayInSaoPaulo } from './apiErrors';

const visit = { id: 'v1', studyId: 's1', participationId: 'p1', participantName: 'Ana', plannedVisitId: 'pv1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1,
  scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Agendada', realizedAt: null, observation: null, createdAt: '2026-11-16T13:20:41.512Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('scheduledVisitsApi', () => {
  it('lista por participação e descarta registros de outro estudo ou participação', async () => {
    const request = vi.fn().mockResolvedValue(json([visit, { ...visit, id: 'v2', participationId: 'outro' }, { ...visit, id: 'v3', studyId: 's2' }]));
    const result = await scheduledVisitsApi.list(request, 's1', 'p1');
    expect(request).toHaveBeenCalledWith('/studies/s1/scheduled-visits?participationId=p1', undefined);
    expect(result.map((item) => item.id)).toEqual(['v1']);
  });

  it('agenda enviando somente os campos do contrato e o participationId escolhido', async () => {
    const request = vi.fn().mockResolvedValue(json(visit, 201));
    await scheduledVisitsApi.create(request, 's1', { participationId: 'p1', plannedVisitId: 'pv1', scheduledAt: '2026-11-24T09:00:00-03:00', observation: '  ' });
    expect(request.mock.calls[0][0]).toBe('/studies/s1/scheduled-visits');
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ participationId: 'p1', plannedVisitId: 'pv1', scheduledAt: '2026-11-24T09:00:00-03:00' });
  });

  it('recusa sucesso de outra participação', async () => {
    await expect(scheduledVisitsApi.create(vi.fn().mockResolvedValue(json({ ...visit, participationId: 'outro' }, 201)), 's1', { participationId: 'p1', plannedVisitId: 'pv1', scheduledAt: 'x' })).rejects.toThrow(/inválidos/);
  });

  it.each([[400, { message: 'Somente participantes ativos podem ter visitas agendadas.', code: 'PARTICIPATION_NOT_ACTIVE' }, /ativos/],
    [409, { message: 'Esta visita prevista já está agendada ou realizada para o participante.', code: 'VISIT_ALREADY_SCHEDULED' }, /já está agendada/],
    [403, {}, /permissão/], [404, {}, /não encontrado/]])('traduz HTTP %s no agendamento', async (status, body, message) => {
    await expect(scheduledVisitsApi.create(vi.fn().mockResolvedValue(json(body, status)), 's1', { participationId: 'p1', plannedVisitId: 'pv1', scheduledAt: 'x' }))
      .rejects.toMatchObject({ message: expect.stringMatching(message), status });
  });

  it('exige realizedAt somente para Realizada ao atualizar a situação', async () => {
    const request = vi.fn().mockResolvedValue(json({ ...visit, status: 'Realizada' }));
    await scheduledVisitsApi.updateStatus(request, 's1', 'v1', { status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z' });
    expect(request.mock.calls[0][0]).toBe('/studies/s1/scheduled-visits/v1/status');
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z' });
    const cancel = vi.fn().mockResolvedValue(json({ ...visit, status: 'Cancelada' }));
    await scheduledVisitsApi.updateStatus(cancel, 's1', 'v1', { status: 'Cancelada', realizedAt: 'ignorado' });
    expect(JSON.parse(cancel.mock.calls[0][1].body)).toEqual({ status: 'Cancelada' });
  });

  it('valida o formato da visita', () => {
    expect(isScheduledVisit(visit)).toBe(true);
    expect(isScheduledVisit({ ...visit, status: 'X' })).toBe(false);
    expect(isScheduledVisit({ ...visit, plannedVisitOrder: '1' })).toBe(false);
  });
});

describe('helpers de data', () => {
  it('converte datetime-local para o offset de São Paulo', () => {
    expect(toSaoPauloOffset('2026-11-24T09:00')).toBe('2026-11-24T09:00:00-03:00');
    expect(toSaoPauloOffset('2026-11-24T09:00:30')).toBe('2026-11-24T09:00:30-03:00');
  });
  it('usa a data civil de São Paulo, não a de UTC', () => {
    expect(todayInSaoPaulo(new Date('2026-11-21T01:30:00Z'))).toBe('2026-11-20');
    expect(todayInSaoPaulo(new Date('2026-11-21T12:00:00Z'))).toBe('2026-11-21');
  });
});
