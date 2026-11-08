import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { UsersService } from '../users/users.service.js';
import type { PublicUser } from '../users/user.types.js';
import { StudiesService } from './studies.service.js';
import type { Study } from './study.types.js';
import { StudyStatus } from './study.types.js';

const researcherId = '00000000-0000-4000-8000-000000000002';
const adminId = '00000000-0000-4000-8000-000000000001';
const studyId = '00000000-0000-4000-8000-000000000003';
const payload = {
  title: 'Teste de qualidade do sono',
  objective: 'Avaliar indicadores de sono em um estudo fictício.',
  startDate: '2099-01-10',
  endDate: '2099-12-31',
  participantLimit: 12,
  participantsLinked: 4,
};
const researcher: PublicUser = {
  id: researcherId, name: 'Marina Costa', email: 'marina@example.test', phone: '83999990000',
  role: 'Pesquisador', status: 'Ativo', createdAt: '2026-10-01T12:00:00.000Z',
};
const baseStudyRow = {
  id: studyId, code: 'EST-007', title: payload.title, objective: payload.objective,
  researcherId, researcher: researcher.name, startDate: payload.startDate, endDate: payload.endDate,
  status: StudyStatus.Planejamento,
  participantLimit: payload.participantLimit, participantsLinked: payload.participantsLinked,
  kind: 'Estudo observacional' as const, symbol: 'activity' as const,
};

function makeStudy(row: typeof baseStudyRow = baseStudyRow): Study {
  return {
    ...row,
  };
}

describe('StudiesService com PostgreSQL', () => {
  let database: {
    query: jest.Mock<
      (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
    >;
  };
  let users: { findById: jest.Mock<(id: string) => Promise<PublicUser>> };
  let service: StudiesService;

  beforeEach(() => {
    database = {
      query: jest.fn<
        (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
      >(),
    };
    users = { findById: jest.fn<(id: string) => Promise<PublicUser>>().mockResolvedValue(researcher) };
    service = new StudiesService(database as unknown as DatabaseService, users as unknown as UsersService);
  });

  it('lista apenas os estudos do pesquisador autenticado e retorna o status persistido', async () => {
    database.query.mockResolvedValue({ rows: [baseStudyRow], rowCount: 1 });
    const result = await service.listForResearcher(researcherId);
    expect(result).toEqual([makeStudy()]);
    expect(database.query.mock.calls[0]?.[0]).toContain('WHERE e.id_pesquisador = $1');
    expect(database.query.mock.calls[0]?.[1]).toEqual([researcherId]);
  });

  it('cria um estudo utilizando o pesquisador do token, não um identificador enviado pelo cliente', async () => {
    database.query.mockResolvedValue({ rows: [{ ...baseStudyRow, researcher: undefined }], rowCount: 1 });
    const created = await service.create(payload, researcherId);
    expect(created.researcherId).toBe(researcherId);
    expect(created.researcher).toBe('Marina Costa');
    expect(database.query.mock.calls[0]?.[0]).toContain("nextval('estudos_codigo_seq')");
    expect(database.query.mock.calls[0]?.[1]).toEqual([
      payload.title, payload.objective, researcherId, payload.startDate, payload.endDate,
      payload.participantLimit, payload.participantsLinked,
    ]);
  });

  it('consulta somente ID e título pela fase persistida de recrutamento, sem inferir a fase por datas', async () => {
    const option = { id: studyId, title: payload.title };
    database.query.mockResolvedValue({ rows: [option], rowCount: 1 });
    await expect(service.listAvailableForRecruitment()).resolves.toEqual([option]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM estudos WHERE status = $1'), [StudyStatus.Recrutamento],
    );
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('autoriza Coordenador ativo no RF08 em recrutamento, sem exigir propriedade', async () => {
    users.findById.mockResolvedValue({ ...researcher, id: adminId, role: 'Coordenador' });
    database.query.mockResolvedValue({ rows: [{ ...baseStudyRow, status: StudyStatus.Recrutamento }], rowCount: 1 });
    for (const modifying of [false, true]) {
      await expect(service.assertCandidateStudyAccess(studyId, adminId, modifying))
        .resolves.toMatchObject({ id: studyId, researcherId, status: StudyStatus.Recrutamento });
    }
    // A exceção é específica do RF08, não libera a consulta geral nem a edição do estudo.
    await expect(service.findById(studyId, adminId)).rejects.toThrow(ForbiddenException);
    await expect(service.assertStudyCanBeModified(studyId, adminId)).rejects.toThrow(ForbiddenException);
  });

  it.each([StudyStatus.Planejamento, StudyStatus.Execucao, StudyStatus.Encerrado])('nega RF08 ao Coordenador na fase %s', async (status) => {
    users.findById.mockResolvedValue({ ...researcher, role: 'Coordenador' });
    database.query.mockResolvedValue({ rows: [{ ...baseStudyRow, status }], rowCount: 1 });
    for (const modifying of [false, true]) {
      await expect(service.assertCandidateStudyAccess(studyId, researcherId, modifying)).rejects.toThrow(ForbiddenException);
    }
  });

  it.each([
    { role: 'Coordenador', status: 'Inativo' },
    { role: 'Pesquisador', status: 'Inativo' },
    { role: 'Administrador', status: 'Ativo' },
    { role: 'Participante', status: 'Ativo' },
  ] as const)('rejeita RF08 para $role $status antes de consultar o estudo', async (account) => {
    users.findById.mockResolvedValue({ ...researcher, ...account });
    for (const modifying of [false, true]) {
      await expect(service.assertCandidateStudyAccess(studyId, researcherId, modifying)).rejects.toThrow(ForbiddenException);
    }
    expect(database.query).not.toHaveBeenCalled();
  });

  it('preserva propriedade do Pesquisador e bloqueio de cadastro em estudo encerrado no RF08', async () => {
    database.query.mockResolvedValue({ rows: [baseStudyRow], rowCount: 1 });
    await expect(service.assertCandidateStudyAccess(studyId, researcherId)).resolves.toMatchObject({ id: studyId });
    await expect(service.assertCandidateStudyAccess(studyId, researcherId, true)).resolves.toMatchObject({ id: studyId });
    database.query.mockResolvedValue({ rows: [{ ...baseStudyRow, researcherId: adminId }], rowCount: 1 });
    for (const modifying of [false, true]) {
      await expect(service.assertCandidateStudyAccess(studyId, researcherId, modifying)).rejects.toThrow(ForbiddenException);
    }
    database.query.mockResolvedValue({ rows: [{ ...baseStudyRow, status: StudyStatus.Encerrado }], rowCount: 1 });
    await expect(service.assertCandidateStudyAccess(studyId, researcherId)).resolves.toMatchObject({ id: studyId });
    await expect(service.assertCandidateStudyAccess(studyId, researcherId, true)).rejects.toThrow(BadRequestException);
  });

  it('retorna 404 no RF08 para estudo inexistente, inclusive para Coordenador', async () => {
    users.findById.mockResolvedValue({ ...researcher, role: 'Coordenador' });
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.assertCandidateStudyAccess(studyId, researcherId)).rejects.toThrow(NotFoundException);
  });

  it('atualiza campos autorizados e rejeita campo não permitido', async () => {
    database.query
      .mockResolvedValueOnce({ rows: [baseStudyRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...baseStudyRow, title: 'Título atualizado' }], rowCount: 1 });
    const updated = await service.update(studyId, { title: 'Título atualizado' }, researcherId);
    expect(updated.title).toBe('Título atualizado');

    await expect(service.update(studyId, { researcherId } as never, researcherId))
      .rejects.toThrow(BadRequestException);
  });

  it.each([
    [{ ...payload, endDate: '2099-01-01' }, 'data de término'],
    [{ ...payload, startDate: '2099-02-30' }, 'datas válidas'],
    [{ ...payload, participantLimit: 0 }, 'limite de participantes'],
    [{ ...payload, participantsLinked: 100 }, 'não podem ultrapassar'],
  ])('rejeita dados inválidos do estudo', async (input, message) => {
    await expect(service.create(input, researcherId)).rejects.toThrow(message as string);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('impede que outro pesquisador consulte ou altere um estudo alheio', async () => {
    const otherId = '00000000-0000-4000-8000-000000000004';
    database.query.mockResolvedValue({ rows: [{ ...baseStudyRow, researcherId: otherId }], rowCount: 1 });
    await expect(service.findById(studyId, researcherId)).rejects.toThrow(ForbiddenException);

    database.query.mockResolvedValueOnce({ rows: [{ ...baseStudyRow, researcherId: otherId }], rowCount: 1 });
    await expect(service.update(studyId, { title: 'Título alterado' }, researcherId)).rejects.toThrow(ForbiddenException);
  });

  it('retorna 404 quando o estudo não existe e rejeita perfis que não sejam pesquisadores ativos', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.findById(studyId, researcherId)).rejects.toThrow(NotFoundException);

    users.findById.mockResolvedValue({ ...researcher, id: adminId, role: 'Administrador' });
    await expect(service.listForResearcher(adminId)).rejects.toThrow(ForbiddenException);
  });

  it('permite avançar sequencialmente por todos os estados e persiste cada transição', async () => {
    const recruitment = { ...baseStudyRow, status: StudyStatus.Recrutamento };
    const execution = { ...baseStudyRow, status: StudyStatus.Execucao };
    const closed = { ...baseStudyRow, status: StudyStatus.Encerrado };
    database.query
      .mockResolvedValueOnce({ rows: [baseStudyRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [recruitment], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [recruitment], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [execution], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [execution], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [closed], rowCount: 1 });

    await expect(service.transitionStatus(studyId, StudyStatus.Recrutamento, researcherId))
      .resolves.toMatchObject({ status: StudyStatus.Recrutamento });
    await expect(service.transitionStatus(studyId, StudyStatus.Execucao, researcherId))
      .resolves.toMatchObject({ status: StudyStatus.Execucao });
    await expect(service.transitionStatus(studyId, StudyStatus.Encerrado, researcherId))
      .resolves.toMatchObject({ status: StudyStatus.Encerrado });
    expect(database.query.mock.calls.filter(([sql]) => sql.includes('SET status = $4'))).toHaveLength(3);
  });

  it.each([
    [StudyStatus.Planejamento, StudyStatus.Execucao],
    [StudyStatus.Recrutamento, StudyStatus.Planejamento],
    [StudyStatus.Encerrado, StudyStatus.Planejamento],
  ])('rejeita a transição inválida de %s para %s', async (currentStatus, nextStatus) => {
    database.query.mockResolvedValue({
      rows: [{ ...baseStudyRow, status: currentStatus }],
      rowCount: 1,
    });
    await expect(service.transitionStatus(studyId, nextStatus, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it('rejeita estados desconhecidos sem consultar o banco', async () => {
    await expect(service.transitionStatus(studyId, 'desconhecido' as StudyStatus, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('bloqueia atualizações de dados em estudos encerrados', async () => {
    database.query.mockResolvedValue({
      rows: [{ ...baseStudyRow, status: StudyStatus.Encerrado }],
      rowCount: 1,
    });
    await expect(service.update(studyId, { title: 'Título alterado' }, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).toHaveBeenCalledTimes(1);
  });
});
