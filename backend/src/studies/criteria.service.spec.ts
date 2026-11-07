import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { CriteriaService } from './criteria.service.js';
import type { EligibilityCriterion } from './criteria.types.js';
import { StudyStatus } from './study.types.js';

const studyId = '00000000-0000-4000-8000-000000000003';
const criterionId = '00000000-0000-4000-8000-000000000004';
const researcherId = '00000000-0000-4000-8000-000000000002';
const criterion: EligibilityCriterion = {
  id: criterionId,
  studyId,
  type: 'Inclusão',
  description: 'Ter idade igual ou superior a 18 anos.',
  active: true,
};

type QueryMock = jest.Mock<
  (sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number | null }>
>;
type TransactionClient = { query: QueryMock };
type TransactionOperation = (client: TransactionClient) => Promise<unknown>;

describe('CriteriaService', () => {
  let database: {
    query: QueryMock;
    transaction: jest.Mock<(operation: TransactionOperation) => Promise<unknown>>;
  };
  let transactionClient: TransactionClient;
  let studies: {
    findById: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
    assertStudyCanBeModified: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
  };
  let service: CriteriaService;

  beforeEach(() => {
    transactionClient = {
      query: jest.fn<
        (sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number | null }>
      >(),
    };
    database = {
      query: jest.fn<
        (sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number | null }>
      >(),
      transaction: jest.fn<(operation: TransactionOperation) => Promise<unknown>>()
        .mockImplementation((operation) => operation(transactionClient)),
    };
    studies = {
      findById: jest.fn<(id: string, ownerId: string) => Promise<unknown>>(),
      assertStudyCanBeModified: jest.fn<(id: string, ownerId: string) => Promise<unknown>>()
        .mockResolvedValue({ status: StudyStatus.Planejamento }),
    };
    service = new CriteriaService(database as unknown as DatabaseService, studies as unknown as StudiesService);
  });

  it('cadastra critério associado ao estudo validado e aplica ativo por padrão', async () => {
    database.query.mockResolvedValue({ rows: [criterion], rowCount: 1 });
    const result = await service.create(studyId, {
      type: 'Inclusão',
      description: '  Ter idade igual ou superior a 18 anos.  ',
    }, researcherId);

    expect(result).toEqual(criterion);
    expect(studies.assertStudyCanBeModified).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[0]?.[1]).toEqual([
      studyId, 'Inclusão', criterion.description, true,
    ]);
  });

  it('rejeita tipo, descrição e campos não permitidos', async () => {
    await expect(service.create(studyId, { type: 'Outro' as never, description: 'Descrição' }, researcherId))
      .rejects.toThrow(BadRequestException);
    await expect(service.create(studyId, { type: 'Inclusão', description: '   ' }, researcherId))
      .rejects.toThrow(BadRequestException);
    await expect(service.create(studyId, {
      type: 'Inclusão', description: 'Descrição', extra: true,
    } as never, researcherId)).rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o estudo associado não existe', async () => {
    const notFound = new NotFoundException('Estudo não encontrado.');
    studies.findById.mockRejectedValue(notFound);
    await expect(service.list(studyId, researcherId)).rejects.toThrow(NotFoundException);

    studies.assertStudyCanBeModified.mockRejectedValue(notFound);
    await expect(service.create(studyId, {
      type: 'Inclusão',
      description: 'Ter idade igual ou superior a 18 anos.',
    }, researcherId)).rejects.toThrow(NotFoundException);
    await expect(service.update(studyId, criterionId, { active: false }, researcherId))
      .rejects.toThrow(NotFoundException);

    expect(database.query).not.toHaveBeenCalled();
  });

  it('lista critérios somente dentro do estudo informado', async () => {
    database.query.mockResolvedValue({ rows: [criterion], rowCount: 1 });
    await expect(service.list(studyId, researcherId)).resolves.toEqual([criterion]);
    expect(database.query.mock.calls[0]?.[0]).toContain('WHERE id_estudo = $1');
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId]);
  });

  it('não encontra critério que não esteja vinculado ao estudo informado', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.find(studyId, criterionId, researcherId)).rejects.toThrow(NotFoundException);
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, criterionId]);
  });

  it('atualiza campos parciais e mantém valor booleano false', async () => {
    transactionClient.query
      .mockResolvedValueOnce({ rows: [{ status: StudyStatus.Recrutamento }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [criterion], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ ...criterion, type: 'Exclusão', active: false }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await service.update(studyId, criterionId, { type: 'Exclusão', active: false }, researcherId);
    expect(result).toMatchObject({ type: 'Exclusão', active: false });
    expect(transactionClient.query.mock.calls[2]?.[1]).toEqual([
      studyId, criterionId, 'Exclusão', criterion.description, false,
    ]);
    expect(transactionClient.query.mock.calls[3]?.[0]).toContain("c.status_recrutamento IN ('Novo', 'Em avaliação', 'Elegível', 'Inelegível')");
    expect(transactionClient.query.mock.calls[3]?.[1]).toEqual([criterionId, studyId]);
    expect(transactionClient.query.mock.calls[3]?.[0]).toContain("SET status_recrutamento = 'Em avaliação'");
  });

  it('não invalida avaliações quando o PATCH não altera os valores do critério', async () => {
    transactionClient.query
      .mockResolvedValueOnce({ rows: [{ status: StudyStatus.Recrutamento }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [criterion], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [criterion], rowCount: 1 });

    await expect(service.update(studyId, criterionId, { active: true }, researcherId))
      .resolves.toEqual(criterion);

    expect(transactionClient.query).toHaveBeenCalledTimes(3);
  });

  it('rejeita atualização vazia ou inválida', async () => {
    await expect(service.update(studyId, criterionId, {}, researcherId)).rejects.toThrow(BadRequestException);
    await expect(service.update(studyId, criterionId, { active: 'false' as never }, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('impede criar ou atualizar critérios em estudos encerrados', async () => {
    studies.assertStudyCanBeModified.mockRejectedValue(new BadRequestException());
    await expect(service.create(studyId, { type: 'Inclusão', description: 'Descrição válida' }, researcherId))
      .rejects.toThrow(BadRequestException);
    await expect(service.update(studyId, criterionId, { active: false }, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });
});
