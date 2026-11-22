import { describe, expect, it, vi } from 'vitest';
import { INVALID_HISTORY_MESSAGE, INVALID_PARTICIPANTS_MESSAGE, isParticipant, participantsApi, ParticipantsApiError } from './participantsApi';

const raw = { participationId: 'p1', candidateId: 'c1', studyId: 's1', name: 'Ana Silva', participationStatus: 'Ativo', includedAt: '2026-11-08', withdrawnAt: null, withdrawalReason: null };
const model = { participationId: 'p1', candidateId: 'c1', studyId: 's1', name: 'Ana Silva', status: 'Ativo', includedAt: '2026-11-08', withdrawnAt: null, withdrawalReason: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('participantsApi.listByStudy — contrato do backend', () => {
  it('consulta o estudo codificado na rota e adapta participationStatus para status', async () => {
    // O id do estudo da resposta precisa ser o mesmo consultado; aqui contém "/" para provar a codificação da rota.
    const request = vi.fn().mockResolvedValue(json([{ ...raw, studyId: 'a/b', email: 'ana@x.test' }]));
    const result = await participantsApi.listByStudy(request, 'a/b');
    expect(request).toHaveBeenCalledWith('/studies/a%2Fb/participants', undefined);
    expect(result).toEqual([{ ...model, studyId: 'a/b' }]);
    expect(result[0]).not.toHaveProperty('email');
    expect(result[0]).not.toHaveProperty('participationStatus');
  });

  it('descarta participações de outro estudo e aceita retirados com data e motivo', async () => {
    const withdrawn = { ...raw, participationId: 'p3', participationStatus: 'Retirado', withdrawnAt: '2026-11-10', withdrawalReason: 'Motivo pessoal' };
    const request = vi.fn().mockResolvedValue(json([raw, { ...raw, participationId: 'p2', studyId: 's2' }, withdrawn]));
    const result = await participantsApi.listByStudy(request, 's1');
    expect(result.map((p) => p.participationId)).toEqual(['p1', 'p3']);
    expect(result[1]).toMatchObject({ status: 'Retirado', withdrawnAt: '2026-11-10', withdrawalReason: 'Motivo pessoal' });
  });

  it('aceita lista vazia', async () => {
    expect(await participantsApi.listByStudy(vi.fn().mockResolvedValue(json([])), 's1')).toEqual([]);
  });

  it.each([[401, /sessão expirou/], [403, /não tem permissão/], [404, /não encontrado/], [500, /Não foi possível consultar/]])('traduz HTTP %s', async (status, message) => {
    await expect(participantsApi.listByStudy(vi.fn().mockResolvedValue(json({}, status)), 's1')).rejects.toMatchObject({ message: expect.stringMatching(message), status });
  });

  it('usa a mensagem de negócio do 403 apenas quando 400/409; 403 mantém texto próprio', async () => {
    const request = vi.fn().mockResolvedValue(json({ statusCode: 403, message: 'O Coordenador só pode consultar participantes de estudos em recrutamento, execução ou encerrados.' }, 403));
    await expect(participantsApi.listByStudy(request, 's1')).rejects.toThrow(/não tem permissão/);
  });

  it('recusa corpo inválido (inclusive o formato antigo com status) e falha de rede', async () => {
    await expect(participantsApi.listByStudy(vi.fn().mockResolvedValue(json([{ ...raw, participationStatus: 'Outro' }])), 's1')).rejects.toThrow(INVALID_PARTICIPANTS_MESSAGE);
    const { participationStatus: _ignored, ...withoutStatus } = raw;
    await expect(participantsApi.listByStudy(vi.fn().mockResolvedValue(json([{ ...withoutStatus, status: 'Ativo' }])), 's1')).rejects.toThrow(INVALID_PARTICIPANTS_MESSAGE);
    await expect(participantsApi.listByStudy(vi.fn().mockResolvedValue(json({ a: 1 })), 's1')).rejects.toBeInstanceOf(ParticipantsApiError);
    await expect(participantsApi.listByStudy(vi.fn().mockRejectedValue(new Error('x')), 's1')).rejects.toThrow(/comunicar com o servidor/);
  });

  it('valida o modelo adaptado', () => {
    expect(isParticipant(model)).toBe(true);
    expect(isParticipant({ ...model, participationId: '' })).toBe(false);
    expect(isParticipant({ ...model, name: '  ' })).toBe(false);
    expect(isParticipant({ ...model, includedAt: '08/11/2026' })).toBe(false);
    expect(isParticipant(null)).toBe(false);
  });
});

describe('participantsApi.getHistory', () => {
  const visit = { id: 'v1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1, scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: null, results: [] };
  it('consulta a rota do histórico e devolve participante adaptado e visitas', async () => {
    const request = vi.fn().mockResolvedValue(json({ participant: raw, visits: [visit] }));
    const result = await participantsApi.getHistory(request, 's1', 'p1');
    expect(request).toHaveBeenCalledWith('/studies/s1/participants/p1/history', undefined);
    expect(result.participant).toEqual(model);
    expect(result.visits).toHaveLength(1);
  });
  it('recusa histórico de outra participação ou estudo', async () => {
    await expect(participantsApi.getHistory(vi.fn().mockResolvedValue(json({ participant: { ...raw, participationId: 'outro' }, visits: [] })), 's1', 'p1')).rejects.toThrow(INVALID_HISTORY_MESSAGE);
    await expect(participantsApi.getHistory(vi.fn().mockResolvedValue(json({ participant: raw, visits: [{ ...visit, status: 'X' }] })), 's1', 'p1')).rejects.toThrow(INVALID_HISTORY_MESSAGE);
  });
  it('traduz 404', async () => {
    await expect(participantsApi.getHistory(vi.fn().mockResolvedValue(json({}, 404)), 's1', 'p1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('participantsApi.registerWithdrawal', () => {
  const withdrawn = { ...raw, participationStatus: 'Retirado', withdrawnAt: '2026-11-20', withdrawalReason: 'Motivo' };
  it('envia somente withdrawalDate e reason (sem espaços externos) para a participação escolhida', async () => {
    const request = vi.fn().mockResolvedValue(json(withdrawn, 201));
    const result = await participantsApi.registerWithdrawal(request, 's1', 'p1', { withdrawalDate: '2026-11-20', reason: '  Motivo  ' });
    expect(request).toHaveBeenCalledWith('/studies/s1/participants/p1/withdrawal', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ withdrawalDate: '2026-11-20', reason: 'Motivo' });
    expect(result).toMatchObject({ status: 'Retirado', withdrawnAt: '2026-11-20' });
  });
  it('mostra a regra de negócio do 400 e textos próprios para 403 e 404', async () => {
    const input = { withdrawalDate: '2026-11-20', reason: 'x' };
    await expect(participantsApi.registerWithdrawal(vi.fn().mockResolvedValue(json({ message: 'Não é possível alterar um estudo encerrado.', code: 'STUDY_CLOSED' }, 400)), 's1', 'p1', input))
      .rejects.toMatchObject({ message: 'Não é possível alterar um estudo encerrado.', code: 'STUDY_CLOSED', status: 400 });
    await expect(participantsApi.registerWithdrawal(vi.fn().mockResolvedValue(json({}, 403)), 's1', 'p1', input)).rejects.toThrow(/permissão para registrar a retirada/);
    await expect(participantsApi.registerWithdrawal(vi.fn().mockResolvedValue(json({}, 404)), 's1', 'p1', input)).rejects.toMatchObject({ status: 404 });
  });
  it('não confirma sucesso quando a resposta não é a participação retirada', async () => {
    await expect(participantsApi.registerWithdrawal(vi.fn().mockResolvedValue(json(raw, 201)), 's1', 'p1', { withdrawalDate: '2026-11-20', reason: 'x' })).rejects.toThrow(/resposta de retirada inválida/);
    await expect(participantsApi.registerWithdrawal(vi.fn().mockResolvedValue(json({ ...withdrawn, participationId: 'outro' }, 201)), 's1', 'p1', { withdrawalDate: '2026-11-20', reason: 'x' })).rejects.toThrow(/inválida/);
  });
});