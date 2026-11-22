import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type {
  ParticipantStudy,
  ParticipantVisit,
} from './participant-self-service.types.js';
import { StudyStatus } from './study.types.js';
import {
  ParticipantSelfService,
  ParticipantSelfServiceClock,
} from './participant-self-service.service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const studyId = '00000000-0000-4000-8000-000000000002';
const fixedNow = new Date('2030-01-15T12:00:00.000Z');

describe('ParticipantSelfService', () => {
  let database: {
    query: jest.Mock<
      (
        sql: string,
        values?: unknown[],
      ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
    >;
  };
  let clock: { now: jest.Mock<() => Date> };
  let service: ParticipantSelfService;

  beforeEach(() => {
    database = {
      query: jest.fn<
        (
          sql: string,
          values?: unknown[],
        ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
      >(),
    };
    clock = { now: jest.fn<() => Date>().mockReturnValue(fixedNow) };
    service = new ParticipantSelfService(
      database as unknown as DatabaseService,
      clock as unknown as ParticipantSelfServiceClock,
    );
  });

  it('lista participações vinculadas ao usuário, ordenadas por inclusão decrescente', async () => {
    const row = {
      participationId: '00000000-0000-4000-8000-000000000003',
      participationStatus: 'Retirado',
      includedAt: '2021-02-03',
      withdrawnAt: '2021-03-04',
      studyId,
      studyCode: 'EST-001',
      studyTitle: 'Estudo fictício',
      studyObjective: 'Objetivo fictício para teste.',
      studyStartDate: '2020-01-01',
      studyEndDate: '2030-12-31',
      studyStatus: StudyStatus.Execucao,
      researcherName: 'Pesquisadora Teste',
    };
    database.query.mockResolvedValue({ rows: [row], rowCount: 1 });

    await expect(service.listStudies(userId)).resolves.toEqual<ParticipantStudy[]>([
      {
        participationId: row.participationId,
        participationStatus: 'Retirado',
        includedAt: row.includedAt,
        withdrawnAt: row.withdrawnAt,
        study: {
          id: studyId,
          code: 'EST-001',
          title: 'Estudo fictício',
          objective: 'Objetivo fictício para teste.',
          startDate: '2020-01-01',
          endDate: '2030-12-31',
          status: StudyStatus.Execucao,
          researcher: 'Pesquisadora Teste',
        },
      },
    ]);
    expect(database.query.mock.calls[0]?.[0]).toContain(
      'WHERE c.id_usuario = $1',
    );
    expect(database.query.mock.calls[0]?.[0]).toContain(
      'ORDER BY p.data_inclusao DESC',
    );
    expect(database.query.mock.calls[0]?.[1]).toEqual([userId]);
  });

  it('retorna lista vazia quando o usuário não tem participações', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.listStudies(userId)).resolves.toEqual([]);
  });

  it('consulta somente visitas futuras agendadas no instante controlado', async () => {
    const row = {
      id: '00000000-0000-4000-8000-000000000004',
      participationId: '00000000-0000-4000-8000-000000000003',
      studyId,
      studyTitle: 'Estudo fictício',
      plannedVisitName: 'Consulta inicial',
      plannedVisitOrder: 1,
      scheduledAt: new Date('2030-01-15T12:00:01.000Z'),
      status: 'Agendada',
      realizedAt: null,
    };
    database.query.mockResolvedValue({ rows: [row], rowCount: 1 });

    await expect(
      service.listVisits({ scope: 'upcoming', studyId }, userId),
    ).resolves.toEqual<ParticipantVisit[]>([
      {
        id: row.id,
        participationId: row.participationId,
        studyId,
        studyTitle: row.studyTitle,
        plannedVisitName: row.plannedVisitName,
        plannedVisitOrder: 1,
        scheduledAt: '2030-01-15T12:00:01.000Z',
        status: 'Agendada',
        realizedAt: null,
      },
    ]);
    expect(database.query.mock.calls[1]?.[0]).toContain(
      "v.status = 'Agendada' AND v.data_agendada > $2::timestamptz",
    );
    expect(database.query.mock.calls[1]?.[0]).toContain(
      'pv.id_estudo = s.id_estudo',
    );
    expect(database.query.mock.calls[1]?.[0]).toContain(
      'WHERE c.id_usuario = $1',
    );
    expect(database.query.mock.calls[1]?.[0]).toContain(
      'ORDER BY v.data_agendada ASC',
    );
    expect(database.query.mock.calls[1]?.[1]).toEqual([
      userId,
      fixedNow,
      studyId,
    ]);
    expect(database.query.mock.calls[1]?.[0]).not.toContain('observacao');
    expect(database.query.mock.calls[1]?.[0]).not.toContain(
      'resultados_avaliacao',
    );
  });

  it('lista apenas estados finais em history e ordena por instante decrescente', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      service.listVisits({ scope: 'history' }, userId),
    ).resolves.toEqual([]);
    expect(database.query.mock.calls[0]?.[0]).toContain(
      "v.status IN ('Realizada', 'Ausente', 'Cancelada')",
    );
    expect(database.query.mock.calls[0]?.[0]).toContain(
      'ORDER BY v.data_agendada DESC',
    );
    expect(database.query.mock.calls[0]?.[1]).toEqual([
      userId,
      null,
    ]);
  });

  it('retorna 404 sem consultar visitas se studyId não pertence ao participante', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      service.listVisits({ scope: 'upcoming', studyId }, userId),
    ).rejects.toThrow(NotFoundException);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]?.[0]).toContain(
      'WHERE c.id_usuario = $1 AND c.id_estudo = $2',
    );
    expect(database.query.mock.calls[0]?.[1]).toEqual([userId, studyId]);
  });
});
