import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { CandidatesService } from './candidates.service.js';
import type { Candidate } from './candidates.types.js';

const studyId = '00000000-0000-4000-8000-000000000003';
const researcherId = '00000000-0000-4000-8000-000000000002';
const candidate: Candidate = {
  id: '00000000-0000-4000-8000-000000000004',
  studyId,
  name: 'Lucas Martins',
  email: 'lucas@example.test',
  status: 'Em avaliação',
  registeredAt: '2026-11-04T15:00:00.000Z',
};

type QueryMock = jest.Mock<
  (sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number | null }>
>;
type TransactionClient = { query: QueryMock };
type TransactionOperation = (client: TransactionClient) => Promise<unknown>;

describe('CandidatesService', () => {
  let database: {
    query: QueryMock;
    transaction: jest.Mock<(operation: TransactionOperation) => Promise<unknown>>;
  };
  let transactionClient: TransactionClient;
  let studies: {
    assertCandidateStudyAccess: jest.Mock<(id: string, userId: string, modifying?: boolean) => Promise<unknown>>;
    findById: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
    assertStudyCanBeModified: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
  };
  let service: CandidatesService;

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
      assertCandidateStudyAccess: jest.fn<(id: string, userId: string, modifying?: boolean) => Promise<unknown>>(),
      findById: jest.fn<(id: string, ownerId: string) => Promise<unknown>>(),
      assertStudyCanBeModified: jest.fn<(id: string, ownerId: string) => Promise<unknown>>(),
    };
    service = new CandidatesService(
      database as unknown as DatabaseService,
      studies as unknown as StudiesService,
    );
  });

  it('cadastra candidato associado ao estudo validado', async () => {
    database.query.mockResolvedValue({ rows: [candidate], rowCount: 1 });
    await expect(service.create(studyId, {
      name: candidate.name,
      email: candidate.email,
    }, researcherId)).resolves.toEqual(candidate);
    expect(studies.assertCandidateStudyAccess).toHaveBeenCalledWith(studyId, researcherId, true);
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, candidate.name, candidate.email]);
  });

  it('cadastra sem e-mail e lista apenas candidatos do estudo', async () => {
    database.query
      .mockResolvedValueOnce({ rows: [{ ...candidate, email: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [candidate], rowCount: 1 });
    await service.create(studyId, { name: candidate.name }, researcherId);
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, candidate.name, null]);

    await expect(service.list(studyId, researcherId)).resolves.toEqual([candidate]);
    expect(studies.assertCandidateStudyAccess).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[1]?.[1]).toEqual([studyId]);
    expect(database.query.mock.calls[1]?.[0]).toContain('WHERE id_estudo = $1');
  });

  it('não cadastra candidato se o estudo não existe', async () => {
    studies.assertCandidateStudyAccess.mockRejectedValue(new NotFoundException('Estudo não encontrado.'));
    await expect(service.create(studyId, { name: candidate.name }, researcherId))
      .rejects.toThrow(NotFoundException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('registra consentimento simulado e vincula o pesquisador autenticado', async () => {
    const consent = {
      candidateId: candidate.id,
      studyId,
      status: 'Registrado',
      termVersion: 'simulado-v1',
      registeredAt: '2026-11-06T10:00:00.000Z',
      registrarId: researcherId,
      observation: null,
    };
    database.query.mockResolvedValue({ rows: [consent], rowCount: 1 });
    await expect(service.registerConsent(studyId, candidate.id, {
      status: 'Registrado',
      termVersion: 'simulado-v1',
    }, researcherId)).resolves.toEqual(consent);
    expect(studies.assertStudyCanBeModified).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[0]?.[0]).toContain('FROM candidatos c');
    expect(database.query.mock.calls[0]?.[1]).toEqual([
      studyId, candidate.id, 'Registrado', 'simulado-v1', researcherId, null,
    ]);
  });

  it('consulta o estado mais recente ou retorna status nulo quando ainda não foi registrado', async () => {
    const consent = {
      candidateId: candidate.id,
      studyId,
      status: 'Recusado',
      termVersion: 'simulado-v1',
      registeredAt: '2026-11-06T10:00:00.000Z',
      registrarId: researcherId,
      observation: 'Não concedido.',
    };
    database.query.mockResolvedValueOnce({ rows: [consent], rowCount: 1 });
    await expect(service.getConsent(studyId, candidate.id, researcherId)).resolves.toEqual(consent);
    expect(studies.findById).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[0]?.[0]).toContain('ORDER BY registrado_em DESC, id_consentimento DESC');

    const unrecorded = {
      candidateId: candidate.id,
      studyId,
      status: null,
      termVersion: null,
      registeredAt: null,
      registrarId: null,
      observation: null,
    };
    database.query.mockResolvedValueOnce({ rows: [unrecorded], rowCount: 1 });
    await expect(service.getConsent(studyId, candidate.id, researcherId)).resolves.toEqual(unrecorded);
  });

  it('não registra consentimento para candidato de outro estudo e rejeita dados inválidos', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.registerConsent(studyId, candidate.id, {
      status: 'Registrado',
      termVersion: 'simulado-v1',
    }, researcherId)).rejects.toThrow(NotFoundException);

    await expect(service.registerConsent(studyId, candidate.id, {
      status: 'Registrado',
      termVersion: '',
    }, researcherId)).rejects.toThrow(BadRequestException);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it('retorna não encontrado ao consultar consentimento de candidato inexistente no estudo', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.getConsent(studyId, candidate.id, researcherId)).rejects.toThrow(NotFoundException);
  });

  it('inclui candidato elegível e consentido, persiste participação e atualiza contador', async () => {
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ status: 'recrutamento', participantLimit: 5, participantsLinked: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Elegível' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ type: 'Inclusão', result: 'Atende' }, { type: 'Exclusão', result: 'Não atende' }],
        rowCount: 2,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Registrado' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{
          participationId: '00000000-0000-4000-8000-000000000005',
          candidateId: candidate.id,
          includedAt: '2026-11-06',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ participantLimit: 5 }], rowCount: 1 });

    await expect(service.include(studyId, candidate.id, researcherId)).resolves.toEqual({
      participationId: '00000000-0000-4000-8000-000000000005',
      candidateId: candidate.id,
      studyId,
      includedAt: '2026-11-06',
      participationStatus: 'Ativo',
      participantsLinked: 3,
      participantLimit: 5,
    });
    expect(studies.findById).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.query.mock.calls[0]?.[0]).toContain('FOR UPDATE');
    expect(transactionClient.query.mock.calls[5]?.[0]).toContain('INSERT INTO participacoes_estudo');
    expect(transactionClient.query.mock.calls[6]?.[0]).toContain("SET status_recrutamento = 'Incluído'");
    expect(transactionClient.query.mock.calls[7]?.[1]).toEqual([studyId, researcherId, 3]);
  });

  it('bloqueia inclusão quando o candidato não é elegível', async () => {
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ status: 'recrutamento', participantLimit: 5, participantsLinked: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Inelegível' }], rowCount: 1 });

    await expect(service.include(studyId, candidate.id, researcherId))
      .rejects.toThrow('Candidato inelegível');
    expect(transactionClient.query).toHaveBeenCalledTimes(2);
  });

  it('bloqueia inclusão se algum critério ativo não foi aprovado', async () => {
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ status: 'recrutamento', participantLimit: 5, participantsLinked: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Elegível' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ type: 'Inclusão', result: null }], rowCount: 1 });

    await expect(service.include(studyId, candidate.id, researcherId))
      .rejects.toThrow('todos os critérios ativos devem estar avaliados');
    expect(transactionClient.query).toHaveBeenCalledTimes(3);
  });

  it('bloqueia inclusão quando não há registro de consentimento', async () => {
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ status: 'recrutamento', participantLimit: 5, participantsLinked: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Elegível' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ type: 'Inclusão', result: 'Atende' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(service.include(studyId, candidate.id, researcherId))
      .rejects.toThrow('Consentimento ausente ou não concedido');
    expect(transactionClient.query).toHaveBeenCalledTimes(4);
  });

  it('bloqueia inclusão quando o consentimento mais recente foi revogado', async () => {
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ status: 'recrutamento', participantLimit: 5, participantsLinked: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Elegível' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ type: 'Inclusão', result: 'Atende' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ status: 'Revogado' }], rowCount: 1 });

    await expect(service.include(studyId, candidate.id, researcherId))
      .rejects.toThrow('Consentimento ausente ou não concedido');
    expect(transactionClient.query).toHaveBeenCalledTimes(4);
  });

  it('bloqueia inclusão quando o limite de vagas foi atingido', async () => {
    transactionClient.query
      .mockResolvedValueOnce({
        rows: [{ status: 'recrutamento', participantLimit: 2, participantsLinked: 2 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ status: 'Elegível' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ type: 'Inclusão', result: 'Atende' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ status: 'Registrado' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: 2 }], rowCount: 1 });

    await expect(service.include(studyId, candidate.id, researcherId))
      .rejects.toThrow('Limite de vagas atingido');
    expect(transactionClient.query).toHaveBeenCalledTimes(5);
  });

  it('bloqueia cadastro quando o estudo está encerrado', async () => {
    studies.assertCandidateStudyAccess.mockRejectedValue(new BadRequestException());
    await expect(service.create(studyId, { name: candidate.name }, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });
});
