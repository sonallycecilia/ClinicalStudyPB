import { describe, expect, it, vi } from 'vitest';
import {
  formatScheduledAt, localDateTimeToIso, saoPauloDay, scheduledVisitsApi, ScheduledVisitsApiError,
  SCHEDULE_CONNECTION_ERROR, SCHEDULE_INVALID_RESPONSE, SCHEDULE_UNEXPECTED_ERROR,
  STATUS_DOMAIN_ERRORS, STATUS_UPDATE_INVALID_RESPONSE, STATUS_UPDATE_UNEXPECTED_ERROR,
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

describe('scheduledVisitsApi.listScheduledVisits', () => {
  const realized: ScheduledVisit = { ...created, id: 'scheduled-2', status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z' };

  it('consulta E03 e aceita todas as situações', async () => {
    const request = vi.fn().mockResolvedValue(reply(200, [created, realized]));
    await expect(scheduledVisitsApi.listScheduledVisits(request, studyId)).resolves.toEqual([created, realized]);
    expect(request).toHaveBeenCalledWith('/studies/study-1/scheduled-visits', { signal: undefined });
  });

  it('recusa visitas de outro estudo ou com realização incoerente', async () => {
    const otherStudy = vi.fn().mockResolvedValue(reply(200, [{ ...created, studyId: 'study-2' }]));
    const incoherent = vi.fn().mockResolvedValue(reply(200, [{ ...created, status: 'Realizada', realizedAt: null }]));
    expect((await rejection(scheduledVisitsApi.listScheduledVisits(otherStudy, studyId))).message).toMatch(/agenda inválida/);
    expect((await rejection(scheduledVisitsApi.listScheduledVisits(incoherent, studyId))).message).toMatch(/agenda inválida/);
  });

  it('usa a mensagem do servidor em 403', async () => {
    const message = 'O Coordenador só pode consultar visitas agendadas de estudos em recrutamento, execução ou encerrados.';
    const request = vi.fn().mockResolvedValue(reply(403, { statusCode: 403, message }));
    expect((await rejection(scheduledVisitsApi.listScheduledVisits(request, studyId))).message).toBe(message);
  });
});

describe('scheduledVisitsApi.updateStatus', () => {
  const realized: ScheduledVisit = { ...created, status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: 'Compareceu.' };
  const bodyOf = (request: ReturnType<typeof vi.fn>) => JSON.parse((request.mock.calls[0] as [string, RequestInit])[1].body as string);

  it('envia PATCH com realizedAt somente para Realizada e retorna a visita atualizada', async () => {
    const request = vi.fn().mockResolvedValue(reply(200, realized));
    await expect(scheduledVisitsApi.updateStatus(request, created, { status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: ' Compareceu. ' })).resolves.toEqual(realized);
    const [path, init] = request.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/studies/study-1/scheduled-visits/scheduled-1/status');
    expect(init.method).toBe('PATCH');
    expect(bodyOf(request)).toEqual({ status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: 'Compareceu.' });
  });

  it('não envia realizedAt para Ausente e omite a observação quando não informada', async () => {
    const request = vi.fn().mockResolvedValue(reply(200, { ...created, status: 'Ausente' }));
    await scheduledVisitsApi.updateStatus(request, created, { status: 'Ausente', realizedAt: '2026-11-24T12:40:00.000Z' });
    expect(bodyOf(request)).toEqual({ status: 'Ausente' });
  });

  it('envia null para remover a observação', async () => {
    const request = vi.fn().mockResolvedValue(reply(200, { ...created, status: 'Cancelada', observation: null }));
    await scheduledVisitsApi.updateStatus(request, created, { status: 'Cancelada', observation: '   ' });
    expect(bodyOf(request)).toEqual({ status: 'Cancelada', observation: null });
  });

  it('recusa resposta de outra visita ou em outra situação', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(reply(200, { ...realized, id: 'outra' }))
      .mockResolvedValueOnce(reply(200, { ...created, status: 'Agendada' }));
    expect((await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Realizada', realizedAt: realized.realizedAt! }))).message).toBe(STATUS_UPDATE_INVALID_RESPONSE);
    expect((await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Cancelada' }))).message).toBe(STATUS_UPDATE_INVALID_RESPONSE);
  });

  it('exibe a transição recusada com a mensagem do servidor', async () => {
    const message = 'Transição de "Cancelada" para "Realizada" não permitida.';
    const request = vi.fn().mockResolvedValue(reply(400, { statusCode: 400, message, code: 'VISIT_STATUS_FINAL' }));
    const error = await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Realizada', realizedAt: realized.realizedAt! }));
    expect(error).toMatchObject({ message, code: 'VISIT_STATUS_FINAL', fieldErrors: { status: message } });
  });

  it.each([
    ['REALIZED_AT_INVALID', STATUS_DOMAIN_ERRORS.REALIZED_AT_INVALID.message, 'realizedAt'],
    ['STUDY_CLOSED', 'Não é possível alterar um estudo encerrado.', undefined],
    ['PARTICIPATION_NOT_ACTIVE', 'Somente visitas de participantes ativos podem ser atualizadas.', undefined],
  ])('traduz %s', async (code, message, field) => {
    const request = vi.fn().mockResolvedValue(reply(400, { statusCode: 400, message: 'texto', code }));
    const error = await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Realizada', realizedAt: realized.realizedAt! }));
    expect(error.message).toBe(message);
    expect(error.fieldErrors).toEqual(field ? { [field]: message } : {});
  });

  it('aponta realizedAt quando o ValidationPipe recusa a data de realização', async () => {
    const request = vi.fn().mockResolvedValue(reply(400, { statusCode: 400, message: ['Informe a data de realização somente para visitas realizadas.'] }));
    const error = await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Realizada', realizedAt: 'x' }));
    expect(error.fieldErrors).toEqual({ realizedAt: 'Informe a data de realização somente para visitas realizadas.' });
  });

  it('trata 404 com a mensagem do servidor e erro inesperado com mensagem genérica', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(reply(404, { statusCode: 404, message: 'Visita agendada não encontrada neste estudo.' }))
      .mockResolvedValueOnce(reply(503, null));
    expect((await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Ausente' }))).message).toBe('Visita agendada não encontrada neste estudo.');
    expect((await rejection(scheduledVisitsApi.updateStatus(request, created, { status: 'Ausente' }))).message).toBe(STATUS_UPDATE_UNEXPECTED_ERROR);
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
