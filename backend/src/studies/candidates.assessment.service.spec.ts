import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { CandidatesService } from './candidates.service.js';
import { StudyStatus } from './study.types.js';
import type { Candidate } from './candidates.types.js';

const studyId = '00000000-0000-4000-8000-000000000003';
const candidateId = '00000000-0000-4000-8000-000000000004';
const researcherId = '00000000-0000-4000-8000-000000000002';
const inclusionId = '00000000-0000-4000-8000-000000000005';
const exclusionId = '00000000-0000-4000-8000-000000000006';
const criteria = [
  { id: inclusionId, type: 'Inclusão' as const, description: 'Ter 18 anos ou mais.' },
  { id: exclusionId, type: 'Exclusão' as const, description: 'Possuir contraindicação.' },
];

describe('CandidatesService avaliação de elegibilidade', () => {
  let txQuery: jest.Mock<
    (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
  >;
  let database: {
    transaction: jest.Mock<(operation: (client: PoolClient) => Promise<unknown>) => Promise<unknown>>;
  };
  let studies: {
    assertStudyCanBeModified: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
    findById: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
  };
  let service: CandidatesService;

  beforeEach(() => {
    txQuery = jest.fn<
      (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
    >();
    const client = { query: txQuery } as unknown as PoolClient;
    database = {
      transaction: jest.fn(async (operation) => operation(client)),
    };
    studies = {
      assertStudyCanBeModified: jest.fn<(id: string, ownerId: string) => Promise<unknown>>(),
      findById: jest.fn<(id: string, ownerId: string) => Promise<unknown>>(),
    };
    service = new CandidatesService(
      database as unknown as DatabaseService,
      studies as unknown as StudiesService,
    );
  });

  function mockSuccessfulAssessment(status: Candidate['status'], evaluations: Record<string, unknown>[]) {
    txQuery
      .mockResolvedValueOnce({ rows: [{ status: StudyStatus.Recrutamento }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ status: 'Em avaliação' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: criteria, rowCount: criteria.length })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ status }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: evaluations, rowCount: evaluations.length });
  }

  it('persiste as avaliações e marca como elegível quando atende inclusão e exclusão', async () => {
    const savedEvaluations = [
      { id: 'assessment-1', criterionId: inclusionId, result: 'Atende' },
      { id: 'assessment-2', criterionId: exclusionId, result: 'Não atende' },
    ];
    mockSuccessfulAssessment('Elegível', savedEvaluations);

    await expect(service.evaluate(studyId, candidateId, {
      evaluations: [
        { criterionId: inclusionId, result: 'Atende' },
        { criterionId: exclusionId, result: 'Não atende' },
      ],
    }, researcherId)).resolves.toMatchObject({
      candidateId,
      studyId,
      status: 'Elegível',
      evaluations: savedEvaluations,
    });
    expect(studies.assertStudyCanBeModified).toHaveBeenCalledWith(studyId, researcherId);
    expect(txQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO avaliacoes_elegibilidade')))
      .toHaveLength(2);
    expect(txQuery.mock.calls.find(([sql]) => sql.includes('UPDATE candidatos'))?.[1])
      .toEqual([studyId, candidateId, 'Elegível']);
  });

  it('persiste a reprovação por critério e marca o candidato como inelegível', async () => {
    mockSuccessfulAssessment('Inelegível', []);
    const result = await service.evaluate(studyId, candidateId, {
      evaluations: [
        { criterionId: inclusionId, result: 'Não atende' },
        { criterionId: exclusionId, result: 'Não atende' },
      ],
    }, researcherId);
    expect(result.status).toBe('Inelegível');
    expect(txQuery.mock.calls.find(([sql]) => sql.includes('UPDATE candidatos'))?.[1])
      .toEqual([studyId, candidateId, 'Inelegível']);
  });

  it('mantém candidato em avaliação se houver respostas pendentes sem reprovação', async () => {
    mockSuccessfulAssessment('Em avaliação', []);
    await expect(service.evaluate(studyId, candidateId, {
      evaluations: [
        { criterionId: inclusionId, result: 'Pendente' },
        { criterionId: exclusionId, result: 'Não atende' },
      ],
    }, researcherId)).resolves.toMatchObject({ status: 'Em avaliação' });
  });

  it('retorna 404 para candidato inexistente ou fora do estudo', async () => {
    txQuery
      .mockResolvedValueOnce({ rows: [{ status: StudyStatus.Recrutamento }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(service.evaluate(studyId, candidateId, {
      evaluations: [{ criterionId: inclusionId, result: 'Atende' }],
    }, researcherId)).rejects.toThrow(NotFoundException);
    expect(txQuery).toHaveBeenCalledTimes(2);
  });

  it('rejeita critérios de outro estudo e respostas duplicadas antes de gravar', async () => {
    txQuery
      .mockResolvedValueOnce({ rows: [{ status: StudyStatus.Recrutamento }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ status: 'Em avaliação' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: criteria, rowCount: criteria.length });
    await expect(service.evaluate(studyId, candidateId, {
      evaluations: [
        { criterionId: inclusionId, result: 'Atende' },
        { criterionId: '00000000-0000-4000-8000-000000000099', result: 'Atende' },
      ],
    }, researcherId)).rejects.toThrow(BadRequestException);
    expect(txQuery).toHaveBeenCalledTimes(3);

    await expect(service.evaluate(studyId, candidateId, {
      evaluations: [
        { criterionId: inclusionId, result: 'Atende' },
        { criterionId: inclusionId, result: 'Atende' },
      ],
    }, researcherId)).rejects.toThrow(BadRequestException);
  });
});
