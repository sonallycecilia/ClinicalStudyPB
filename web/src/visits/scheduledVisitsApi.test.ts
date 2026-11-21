import { describe, expect, it, vi } from 'vitest';
import {
  formatScheduledAt, localDateTimeToIso, saoPauloDay, scheduledVisitsApi, ScheduledVisitsApiError,
  SCHEDULE_CONNECTION_ERROR, SCHEDULE_INVALID_RESPONSE, SCHEDULE_UNEXPECTED_ERROR,
  type CreateScheduledVisitInput, type IncludedParticipant, type ScheduledVisit,
} from './scheduledVisitsApi';

const studyId = 'study-1';
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);

const participant: IncludedParticipant = {
  participationId: 'participation-1', candidateId: 'candidate-1', studyId, name: 'Bianca Oliveira',
  participationStatus: 'Ativo', includedAt: '2026-11-06', withdrawnAt: null, withdrawalReason: null,
};
const input: CreateScheduledVisitInput = {
  participationId: 'participation-1', plannedVisitId: 'planned-1', scheduledAt: '2026-11-24T12:00:00.000Z', observation: '  Trazer exames.  ',
};
const created: ScheduledVisit = {
  id: 'scheduled-1', studyId, participationId: 'participation-1', participantName: 'Bianca Oliveira',
  plannedVisitId: 'planned-1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1,
  scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Agendada', realizedAt: null,
  observation: 'Trazer exames.', createdAt: '2026-11-16T13:20:41.512Z',
};

async function rejection(promise: Promise<unknown>): Promise<ScheduledVisitsApiError> {
  const error = await promise.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ScheduledVisitsApiError);
  return error as ScheduledVisitsApiError;
}

describe('scheduledVisitsApi.listActiveParticipants', () => {
  it('consulta E01 filtrando participações ativas e descarta registros de outro estudo', async () => {
    const request = vi.fn().mockResolvedValue(reply(200, [
      participant,
      { ...participant, participationId: 'other', studyId: 'study-2' },
      { ...participant, participationId: 'withdrawn', participationStatus: 'Retirado', withdrawnAt: '2026-11-10', withdrawalReason: 'Mudança' },
    ]));
    const signal = new AbortController().signal;
    await expect(scheduledVisitsApi.listActiveParticipants(request, studyId, signal)).resolves.toEqual([participant]);
    expect(request).toHaveBeenCalledWith('/studies/study-1/participants?status=Ativo', { signal });
  });

  it('recusa listagem com formato inválido', async () => {
    const request = vi.fn().mockResolvedValue(reply(200, [{ ...participant, includedAt: '06/11/2026' }]));
    expect((await rejection(scheduledVisitsApi.listActiveParticipants(request, studyId))).message).toMatch(/listagem de participantes inválida/);
  });

  it('exibe a mensagem do servidor em 403 e a mensagem de sessão em 401', async () => {
    const forbidden = 'O Coordenador só pode consultar participantes de estudos em recrutamento, execução ou encerrados.';
    const request = vi.fn()
      .mockResolvedValueOnce(reply(403, { statusCode: 403, message: forbidden }))
      .mockResolvedValueOnce(reply(401, { statusCode: 401, message: 'Unauthorized' }));
    expect((await rejection(scheduledVisitsApi.listActiveParticipants(request, studyId))).message).toBe(forbidden);
    expect((await rejection(scheduledVisitsApi.listActiveParticipants(request, studyId))).message).toMatch(/sessão expirou/);
  });
});

describe('scheduledVisitsApi.schedule', () => {
  it('envia somente os campos do contrato, com observação aparada, e retorna o agendamento persistido', async () => {
    const request = vi.fn().mockResolvedValue(reply(201, created));
    await expect(scheduledVisitsApi.schedule(request, studyId, input)).resolves.toEqual(created);
    const [path, init] = request.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/studies/study-1/scheduled-visits');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      participationId: 'participation-1', plannedVisitId: 'planned-1', scheduledAt: '2026-11-24T12:00:00.000Z', observation: 'Trazer exames.',
    });
  });

  it('omite observação vazia', async () => {
    const request = vi.fn().mockResolvedValue(reply(201, { ...created, observation: null }));
    await scheduledVisitsApi.schedule(request, studyId, { ...input, observation: '   ' });
    expect(JSON.parse((request.mock.calls[0] as [string, RequestInit])[1].body as string)).not.toHaveProperty('observation');
  });

  it.each([
    [400, 'STUDY_CLOSED', 'Não é possível alterar um estudo encerrado.', undefined],
    [400, 'PARTICIPATION_NOT_ACTIVE', 'Somente participantes ativos podem ter visitas agendadas.', 'participationId'],
    [400, 'SCHEDULE_OUT_OF_RANGE', 'A data agendada deve estar entre a inclusão do participante e o término do estudo.', 'scheduledAt'],
    [409, 'VISIT_ALREADY_SCHEDULED', 'Esta visita prevista já está agendada ou realizada para o participante.', 'plannedVisitId'],
  ])('traduz %i %s e aponta o campo afetado', async (status, code, message, field) => {
    const request = vi.fn().mockResolvedValue(reply(status, { statusCode: status, message: 'texto do servidor', code }));
    const error = await rejection(scheduledVisitsApi.schedule(request, studyId, input));
    expect(error).toMatchObject({ message, status, code });
    expect(error.fieldErrors).toEqual(field ? { [field]: message } : {});
  });

  it('marca os campos recusados pelo ValidationPipe sem exibir o texto técnico', async () => {
    const request = vi.fn().mockResolvedValue(reply(400, { statusCode: 400, message: ['scheduledAt must be a valid ISO 8601 date string', 'property extra should not exist'] }));
    const error = await rejection(scheduledVisitsApi.schedule(request, studyId, input));
    expect(error.message).toBe('Os dados do agendamento foram recusados. Revise os campos e tente novamente.');
    expect(Object.keys(error.fieldErrors)).toEqual(['scheduledAt']);
  });

  it('usa as mensagens em português do servidor em 403 e 404', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(reply(403, { statusCode: 403, message: 'O Coordenador só pode alterar estudos em recrutamento ou execução.' }))
      .mockResolvedValueOnce(reply(404, { statusCode: 404, message: 'Visita prevista não encontrada neste estudo.' }));
    expect((await rejection(scheduledVisitsApi.schedule(request, studyId, input))).message).toBe('O Coordenador só pode alterar estudos em recrutamento ou execução.');
    expect((await rejection(scheduledVisitsApi.schedule(request, studyId, input))).message).toBe('Visita prevista não encontrada neste estudo.');
  });

  it('trata falha de conexão, erro do servidor e resposta inválida', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(reply(500, { statusCode: 500, message: 'Internal server error' }))
      .mockResolvedValueOnce(reply(201, { ...created, participationId: 'outra' }));
    expect((await rejection(scheduledVisitsApi.schedule(request, studyId, input))).message).toBe(SCHEDULE_CONNECTION_ERROR);
    expect((await rejection(scheduledVisitsApi.schedule(request, studyId, input))).message).toBe(SCHEDULE_UNEXPECTED_ERROR);
    expect((await rejection(scheduledVisitsApi.schedule(request, studyId, input))).message).toBe(SCHEDULE_INVALID_RESPONSE);
  });

  it('propaga o cancelamento sem convertê-lo em erro de conexão', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    const request = vi.fn().mockRejectedValue(abort);
    await expect(scheduledVisitsApi.schedule(request, studyId, input, controller.signal)).rejects.toBe(abort);
  });
});

describe('utilitários de data', () => {
  it('converte datetime-local em ISO UTC e recusa valores inválidos', () => {
    expect(localDateTimeToIso('2026-11-24T09:00')).toBe(new Date('2026-11-24T09:00').toISOString());
    expect(localDateTimeToIso('')).toBeNull();
    expect(localDateTimeToIso('24/11/2026 09:00')).toBeNull();
  });

  it('usa o dia civil e o horário de America/Sao_Paulo', () => {
    expect(saoPauloDay('2026-11-25T02:30:00.000Z')).toBe('2026-11-24');
    expect(formatScheduledAt('2026-11-24T12:00:00.000Z')).toBe('24/11/2026 · 09:00');
  });
});
