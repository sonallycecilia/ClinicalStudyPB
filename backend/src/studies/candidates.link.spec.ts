import { jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { CandidatesService } from './candidates.service.js';
import { CreateCandidateRequestDto } from '../swagger/api.models.js';
import { createCandidateValidation } from './candidates.validation.js';

const studyId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const input = { name: 'Nome RF08', id_usuario: '00000000-0000-4000-8000-000000000003' };

describe('#4128 — validação e persistência do vínculo', () => {
  const query = jest.fn<(sql: string, values?: unknown[]) => Promise<{ rows: object[] }>>();
  const transaction = jest.fn(async (operation: (client: PoolClient) => Promise<unknown>) => operation({ query } as unknown as PoolClient));
  const access = jest.fn<() => Promise<unknown>>();
  let service: CandidatesService;
  beforeEach(() => {
    query.mockReset(); transaction.mockClear(); access.mockReset().mockResolvedValue({ researcherId: userId });
    service = new CandidatesService({ transaction, query } as unknown as DatabaseService, {
      assertCandidateStudyAccess: access, assertEligibilityStudyAccess: access,
      assertConsentStudyAccess: access, assertInclusionStudyAccess: access,
    } as unknown as StudiesService);
  });
  function validAccount() {
    query.mockResolvedValueOnce({ rows: [{ status: 'recrutamento' }] })
      .mockResolvedValueOnce({ rows: [{ perfil: 'Participante', status: 'Ativo' }] });
  }
  it('persiste conta/estudo e mantém e-mail opcional', async () => {
    validAccount(); query.mockResolvedValueOnce({ rows: [{ ...input, studyId }] });
    await expect(service.create(studyId, input, userId)).resolves.toEqual({ ...input, studyId });
    expect(query.mock.calls[2]).toEqual([expect.stringContaining('id_usuario'), [studyId, input.name, null, input.id_usuario]]);
    expect(query.mock.calls[1][0]).toContain('FOR SHARE');
  });
  it.each([undefined, null, '', '21', 21])('rejeita vínculo inválido %s antes da transação', async (id_usuario) => {
    await expect(service.create(studyId, { ...input, id_usuario } as unknown as typeof input, userId)).rejects.toThrow(UnprocessableEntityException);
    expect(transaction).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
  });
  it.each([
    undefined, { perfil: 'Participante', status: 'Inativo' },
    ...['Administrador', 'Coordenador', 'Pesquisador'].map((perfil) => ({ perfil, status: 'Ativo' })),
  ])('rejeita conta inexistente ou não elegível %j sem INSERT', async (account) => {
    query.mockResolvedValueOnce({ rows: [{ status: 'recrutamento' }] })
      .mockResolvedValueOnce({ rows: account ? [account] : [] });
    await expect(service.create(studyId, input, userId)).rejects.toThrow(UnprocessableEntityException);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('traduz somente a constraint de duplicação conhecida para 409', async () => {
    validAccount(); query.mockRejectedValueOnce({ code: '23505', constraint: 'candidatos_estudo_usuario_unico' });
    await expect(service.create(studyId, input, userId)).rejects.toMatchObject({ status: 409 });
    validAccount(); const failure = { code: '23505', constraint: 'outra_constraint' }; query.mockRejectedValueOnce(failure);
    await expect(service.create(studyId, input, userId)).rejects.toBe(failure);
  });
  it('permite enviar a mesma conta a estudos distintos', async () => {
    for (const id of [studyId, '00000000-0000-4000-8000-000000000004']) {
      validAccount(); query.mockResolvedValueOnce({ rows: [{ ...input, studyId: id }] });
      await expect(service.create(id, input, userId)).resolves.toMatchObject({ studyId: id, id_usuario: input.id_usuario });
    }
    expect(query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO candidatos')).map(([, values]) => values?.[0])).toEqual([studyId, '00000000-0000-4000-8000-000000000004']);
  });
  it('nega usuário sem autorização antes de ler conta ou gravar candidato', async () => {
    access.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.create(studyId, input, userId)).rejects.toThrow(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('revalida fase do Coordenador e encerramento sob bloqueio', async () => {
    query.mockResolvedValueOnce({ rows: [{ status: 'execução' }] });
    await expect(service.create(studyId, input, 'coordinator')).rejects.toThrow(ForbiddenException);
    query.mockResolvedValueOnce({ rows: [{ status: 'encerrado' }] });
    await expect(service.create(studyId, input, userId)).rejects.toThrow(BadRequestException);
    expect(query.mock.calls.every(([sql]) => sql.includes('FOR SHARE'))).toBe(true);
  });
  it.each(['evaluate', 'registerConsent', 'include'] as const)('D10 bloqueia %s em legado sem INSERT/UPDATE', async (method) => {
    query.mockResolvedValueOnce({ rows: [{ status: 'recrutamento', participantLimit: 5, participantsLinked: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id_usuario: null, status: 'Elegível' }] });
    const operation = method === 'evaluate' ? service.evaluate(studyId, input.id_usuario, { evaluations: [{ criterionId: input.id_usuario, result: 'Atende' }] }, userId)
      : method === 'registerConsent' ? service.registerConsent(studyId, input.id_usuario, { status: 'Registrado', termVersion: 'v1' }, userId)
        : service.include(studyId, input.id_usuario, userId);
    await expect(operation).rejects.toMatchObject({ status: 422, response: { codigo: 'CANDIDATO_SEM_VINCULO' } });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([sql]) => !/INSERT|UPDATE candidatos/.test(sql))).toBe(true);
  });
  it('legados sem vínculo continuam na consulta sem filtro por conta', async () => {
    query.mockResolvedValueOnce({ rows: [{ studyId, id_usuario: null }] });
    await expect(service.list(studyId, userId)).resolves.toEqual([{ studyId, id_usuario: null }]);
    expect(query.mock.calls[0][0]).not.toContain('id_usuario IS NOT NULL');
  });
});

describe('#4128 — ValidationPipe HTTP 422/400', () => {
  it.each([undefined, null, '', '21', 21])('DTO rejeita id_usuario %s com 422', async (id_usuario) => {
    await expect(createCandidateValidation.transform({ ...input, id_usuario }, { type: 'body', metatype: CreateCandidateRequestDto }))
      .rejects.toThrow(UnprocessableEntityException);
  });
  it('normaliza RF08 e mantém 400 para seus campos', async () => {
    await expect(createCandidateValidation.transform({ ...input, name: ' Nome ', email: ' email@example.test ' }, { type: 'body', metatype: CreateCandidateRequestDto }))
      .resolves.toMatchObject({ name: 'Nome', email: 'email@example.test', id_usuario: input.id_usuario });
    await expect(createCandidateValidation.transform({ ...input, name: '' }, { type: 'body', metatype: CreateCandidateRequestDto }))
      .rejects.toThrow(BadRequestException);
  });
});
