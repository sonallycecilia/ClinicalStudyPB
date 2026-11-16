import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { VisitsService } from './visits.service.js';
import type { PlannedVisit, VisitActivity } from './visits.types.js';
import { StudyStatus } from './study.types.js';

const studyId = '00000000-0000-4000-8000-000000000003';
const visitId = '00000000-0000-4000-8000-000000000004';
const researcherId = '00000000-0000-4000-8000-000000000002';
const visit: PlannedVisit = {
  id: visitId,
  studyId,
  name: 'Consulta inicial',
  order: 1,
  intervalDays: 14,
  description: null,
};
const activity: VisitActivity = {
  id: '00000000-0000-4000-8000-000000000005',
  visitId,
  name: 'Coleta de sinais vitais',
  description: 'Aferir pressão arterial.',
  type: 'Exame',
};

describe('VisitsService', () => {
  let database: {
    query: jest.Mock<
      (sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number | null }>
    >;
  };
  let studies: {
    findById: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
    assertStudyCanBeModified: jest.Mock<(id: string, ownerId: string) => Promise<unknown>>;
  };
  let service: VisitsService;

  beforeEach(() => {
    database = {
      query: jest.fn<
        (sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number | null }>
      >(),
    };
    studies = {
      findById: jest.fn<(id: string, ownerId: string) => Promise<unknown>>(),
      assertStudyCanBeModified: jest.fn<(id: string, ownerId: string) => Promise<unknown>>()
        .mockResolvedValue({ status: StudyStatus.Planejamento }),
    };
    service = new VisitsService(database as unknown as DatabaseService, studies as unknown as StudiesService);
  });

  it('cadastra uma visita no estudo validado e aplica nulos aos campos opcionais ausentes', async () => {
    database.query.mockResolvedValue({ rows: [visit], rowCount: 1 });
    await expect(service.create(studyId, { name: 'Consulta inicial', order: 1 }, researcherId)).resolves.toEqual(visit);
    expect(studies.assertStudyCanBeModified).toHaveBeenCalledWith(studyId, researcherId);
    expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, 'Consulta inicial', 1, null, null]);
  });

  it('lista as visitas do estudo em ordem e consulta visita somente quando vinculada ao estudo', async () => {
    database.query.mockResolvedValue({ rows: [visit], rowCount: 1 });
    await expect(service.list(studyId, researcherId)).resolves.toEqual([visit]);
    expect(database.query.mock.calls[0]?.[0]).toContain('ORDER BY ordem, id_visita_prevista');

    await expect(service.find(studyId, visitId, researcherId)).resolves.toEqual(visit);
    expect(database.query.mock.calls[1]?.[1]).toEqual([studyId, visitId]);

    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.find(studyId, visitId, researcherId)).rejects.toThrow(NotFoundException);
  });

  it('retorna conflito quando a ordem já está cadastrada no estudo', async () => {
    database.query.mockRejectedValue({ code: '23505', constraint: 'visitas_previstas_ordem_unica' });
    await expect(service.create(studyId, { name: 'Consulta inicial', order: 1 }, researcherId))
      .rejects.toThrow(ConflictException);
  });

  it('propaga falhas de persistência que não correspondem à constraint de ordem', async () => {
    const databaseError = { code: '23505', constraint: 'outra_constraint' };
    database.query.mockRejectedValue(databaseError);

    await expect(service.create(studyId, { name: 'Consulta inicial', order: 1 }, researcherId))
      .rejects.toBe(databaseError);
  });

  it('não retorna sucesso se o banco não devolver a visita ou atividade inserida', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.create(studyId, { name: 'Consulta inicial', order: 1 }, researcherId))
      .rejects.toThrow('O banco não retornou a visita prevista cadastrada.');

    database.query
      .mockResolvedValueOnce({ rows: [visit], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(service.createActivity(studyId, visitId, {
      name: 'Coleta de sinais vitais',
      type: 'Exame',
    }, researcherId)).rejects.toThrow('O banco não retornou a atividade cadastrada.');
  });

  it('não tenta cadastrar atividade quando a visita não pertence ao estudo', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(service.createActivity(studyId, visitId, {
      name: 'Coleta de sinais vitais',
      type: 'Exame',
    }, researcherId)).rejects.toThrow(NotFoundException);
    expect(database.query).toHaveBeenCalledTimes(1);
  });

  it('cadastra e lista atividades apenas dentro da visita do estudo', async () => {
    database.query
      .mockResolvedValueOnce({ rows: [visit], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [activity], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [visit], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [activity], rowCount: 1 });

    await expect(service.createActivity(studyId, visitId, {
      name: 'Coleta de sinais vitais',
      description: 'Aferir pressão arterial.',
      type: 'Exame',
    }, researcherId)).resolves.toEqual(activity);
    expect(database.query.mock.calls[1]?.[1]).toEqual([
      visitId, 'Coleta de sinais vitais', 'Aferir pressão arterial.', 'Exame',
    ]);

    await expect(service.listActivities(studyId, visitId, researcherId)).resolves.toEqual([activity]);
    expect(database.query.mock.calls[3]?.[1]).toEqual([visitId]);
  });

  it('impede consultar atividades de uma visita que não pertence ao estudo', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    studies.findById.mockRejectedValue(new NotFoundException());
    await expect(service.listActivities(studyId, visitId, researcherId)).rejects.toThrow(NotFoundException);
  });

  it('impede criar visitas ou atividades em estudos encerrados', async () => {
    studies.assertStudyCanBeModified.mockRejectedValue(new BadRequestException());
    await expect(service.create(studyId, { name: 'Consulta', order: 1 }, researcherId))
      .rejects.toThrow(BadRequestException);
    await expect(service.createActivity(studyId, visitId, { name: 'Atividade', type: 'Exame' }, researcherId))
      .rejects.toThrow(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });
});
