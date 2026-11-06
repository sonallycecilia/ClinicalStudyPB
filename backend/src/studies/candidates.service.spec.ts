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

describe('CandidatesService', () => {
  let database: {
    query: jest.Mock<
      (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
    >;
  };
  let studies: {
    findById: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
    assertStudyCanBeModified: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
  };
  let service: CandidatesService;

  beforeEach(() => {
    database = {
      query: jest.fn<
        (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
      >(),
    };
    studies = {
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
    expect(studies.assertStudyCanBeModified).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, candidate.name, candidate.email]);
  });

  it('cadastra sem e-mail e lista apenas candidatos do estudo', async () => {
    database.query
      .mockResolvedValueOnce({ rows: [{ ...candidate, email: null }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [candidate], rowCount: 1 });
    await service.create(studyId, { name: candidate.name }, researcherId);
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, candidate.name, null]);

    await expect(service.list(studyId, researcherId)).resolves.toEqual([candidate]);
    expect(studies.findById).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[1]?.[1]).toEqual([studyId]);
    expect(database.query.mock.calls[1]?.[0]).toContain('WHERE id_estudo = $1');
  });

  it('não cadastra candidato se o estudo não existe', async () => {
    studies.assertStudyCanBeModified.mockRejectedValue(new NotFoundException('Estudo não encontrado.'));
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

  it('bloqueia cadastro quando o estudo está encerrado', async () => {
    studies.assertStudyCanBeModified.mockRejectedValue(new BadRequestException());
    await expect(service.create(studyId, { name: candidate.name }, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });
});
