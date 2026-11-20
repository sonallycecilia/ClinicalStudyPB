import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { ParticipantVisitsService } from './participant-visits.service.js';

const studyId = '00000000-0000-4000-8000-000000000001';
const scheduledVisitId = '00000000-0000-4000-8000-000000000002';
const plannedVisitId = '00000000-0000-4000-8000-000000000003';
const activityId = '00000000-0000-4000-8000-000000000004';
const researcherId = '00000000-0000-4000-8000-000000000005';

describe('ParticipantVisitsService — resultados de avaliação', () => {
  let database: {
    query: jest.Mock<
      (sql: string, values?: unknown[]) => Promise<{
        rows: object[];
        rowCount: number | null;
      }>
    >;
    transaction: jest.Mock<
      (operation: (client: PoolClient) => Promise<unknown>) => Promise<unknown>
    >;
  };
  let studies: {
    assertTeamStudyReadAccess: jest.Mock<
      (id: string, userId: string, resourceLabel?: string) => Promise<{
        researcherId: string;
      }>
    >;
    assertTeamStudyWriteAccess: jest.Mock<
      (id: string, userId: string) => Promise<{ researcherId: string }>
    >;
  };
  let service: ParticipantVisitsService;

  beforeEach(() => {
    const query = jest.fn<
      (sql: string, values?: unknown[]) => Promise<{
        rows: object[];
        rowCount: number | null;
      }>
    >();
    database = {
      query,
      transaction: jest.fn(async (operation: (client: PoolClient) => Promise<unknown>) =>
        operation({ query } as unknown as PoolClient)),
    };
    studies = {
      assertTeamStudyReadAccess: jest.fn<
        (id: string, userId: string, resourceLabel?: string) => Promise<{
          researcherId: string;
        }>
      >().mockResolvedValue({ researcherId }),
      assertTeamStudyWriteAccess: jest.fn<
        (id: string, userId: string) => Promise<{ researcherId: string }>
      >().mockResolvedValue({ researcherId }),
    };
    service = new ParticipantVisitsService(
      database as unknown as DatabaseService,
      studies as unknown as StudiesService,
    );
  });

  it('E05 retorna atividades com resultados e sem resultado em ordem de cadastro', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [{ id: scheduledVisitId, plannedVisitId, status: 'Realizada' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            activityId,
            name: 'Primeira',
            type: 'Exame',
            description: null,
            resultId: null,
            value: null,
            unit: null,
            observation: null,
            registeredAt: null,
            registrarId: null,
          },
          {
            activityId: '00000000-0000-4000-8000-000000000006',
            name: 'Segunda',
            type: 'Entrevista',
            description: 'Descrição',
            resultId: '00000000-0000-4000-8000-000000000007',
            value: 'Valor fictício',
            unit: 'unidade',
            observation: 'Observação',
            registeredAt: new Date('2026-11-24T13:05:10.200Z'),
            registrarId: researcherId,
          },
        ],
        rowCount: 2,
      });

    await expect(
      service.getScheduledVisitResults(studyId, scheduledVisitId, researcherId),
    ).resolves.toEqual({
      scheduledVisitId,
      plannedVisitId,
      status: 'Realizada',
      activities: [
        {
          activityId,
          name: 'Primeira',
          type: 'Exame',
          description: null,
          result: null,
        },
        {
          activityId: '00000000-0000-4000-8000-000000000006',
          name: 'Segunda',
          type: 'Entrevista',
          description: 'Descrição',
          result: {
            id: '00000000-0000-4000-8000-000000000007',
            scheduledVisitId,
            activityId: '00000000-0000-4000-8000-000000000006',
            value: 'Valor fictício',
            unit: 'unidade',
            observation: 'Observação',
            registeredAt: '2026-11-24T13:05:10.200Z',
            registrarId: researcherId,
          },
        },
      ],
    });
    expect(database.query.mock.calls[1]?.[0]).toContain('ORDER BY a.ordem');
    expect(studies.assertTeamStudyReadAccess).toHaveBeenCalledWith(
      studyId,
      researcherId,
      'resultados de avaliações',
    );
  });

  it('E05 oculta visita que não pertence ao estudo', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      service.getScheduledVisitResults(studyId, scheduledVisitId, researcherId),
    ).rejects.toThrow(NotFoundException);
  });

  it('E07 agrupa resultados por visita e serializa o horário em ordem cronológica', async () => {
    database.query.mockResolvedValue({
      rows: [
        {
          participationId: '00000000-0000-4000-8000-000000000010',
          candidateId: '00000000-0000-4000-8000-000000000011',
          studyId,
          participantName: 'Participante histórico',
          participationStatus: 'Ativo',
          includedAt: '2020-01-01',
          withdrawnAt: null,
          withdrawalReason: null,
          visitId: '00000000-0000-4000-8000-000000000012',
          visitParticipationId: '00000000-0000-4000-8000-000000000010',
          plannedVisitId,
          plannedVisitName: 'Visita inicial',
          plannedVisitOrder: 1,
          scheduledAt: new Date('2025-03-10T13:00:00.000Z'),
          visitStatus: 'Realizada',
          realizedAt: new Date('2025-03-10T14:00:00.000Z'),
          visitObservation: null,
          createdAt: new Date('2025-03-01T10:00:00.000Z'),
          resultId: '00000000-0000-4000-8000-000000000013',
          activityId,
          activityName: 'Avaliação',
          activityType: 'Exame',
          value: 'resultado',
          unit: null,
          resultObservation: null,
          registeredAt: new Date('2025-03-10T14:05:00.000Z'),
          registrarId: researcherId,
        },
        {
          participationId: '00000000-0000-4000-8000-000000000010',
          candidateId: '00000000-0000-4000-8000-000000000011',
          studyId,
          participantName: 'Participante histórico',
          participationStatus: 'Ativo',
          includedAt: '2020-01-01',
          withdrawnAt: null,
          withdrawalReason: null,
          visitId: '00000000-0000-4000-8000-000000000014',
          visitParticipationId: '00000000-0000-4000-8000-000000000010',
          plannedVisitId: '00000000-0000-4000-8000-000000000015',
          plannedVisitName: 'Visita posterior',
          plannedVisitOrder: 2,
          scheduledAt: new Date('2025-03-20T13:00:00.000Z'),
          visitStatus: 'Ausente',
          realizedAt: null,
          visitObservation: null,
          createdAt: new Date('2025-03-02T10:00:00.000Z'),
          resultId: null,
          activityId: null,
          activityName: null,
          activityType: null,
          value: null,
          unit: null,
          resultObservation: null,
          registeredAt: null,
          registrarId: null,
        },
      ],
      rowCount: 2,
    });

    const history = await service.getParticipantHistory(
      studyId,
      '00000000-0000-4000-8000-000000000010',
      researcherId,
    );
    expect(history.participant).toMatchObject({
      name: 'Participante histórico',
      includedAt: '2020-01-01',
    });
    expect(history.visits.map(({ id }) => id)).toEqual([
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000014',
    ]);
    expect(history.visits[0]?.results[0]).toMatchObject({
      activityId,
      activityName: 'Avaliação',
      activityType: 'Exame',
      value: 'resultado',
      registeredAt: '2025-03-10T14:05:00.000Z',
    });
    expect(history.visits[1]?.results).toEqual([]);
    expect(database.query.mock.calls[0]?.[0]).toContain(
      'ORDER BY v.data_agendada ASC NULLS LAST',
    );
    expect(studies.assertTeamStudyReadAccess).toHaveBeenCalledWith(
      studyId,
      researcherId,
      'histórico do participante',
    );
  });

  it('E07 retorna 404 quando a participação não pertence ao estudo', async () => {
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      service.getParticipantHistory(
        studyId,
        '00000000-0000-4000-8000-000000000010',
        researcherId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('E06 registra valor e autoria em transação e retorna data UTC', async () => {
    database.query
      .mockResolvedValueOnce({
        rows: [{
          status: 'execução',
          endDate: '2099-12-31',
          researcherId,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{
          id: scheduledVisitId,
          plannedVisitId,
          status: 'Realizada',
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: activityId }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{
          id: '00000000-0000-4000-8000-000000000008',
          scheduledVisitId,
          activityId,
          value: '120/80',
          unit: 'mmHg',
          observation: null,
          registeredAt: new Date('2026-11-24T13:05:10.200Z'),
          registrarId: researcherId,
        }],
        rowCount: 1,
      });

    await expect(
      service.registerAssessmentResult(
        studyId,
        scheduledVisitId,
        { activityId, value: '120/80', unit: 'mmHg' },
        researcherId,
      ),
    ).resolves.toMatchObject({
      scheduledVisitId,
      activityId,
      value: '120/80',
      unit: 'mmHg',
      observation: null,
      registeredAt: '2026-11-24T13:05:10.200Z',
      registrarId: researcherId,
    });
    expect(studies.assertTeamStudyWriteAccess).toHaveBeenCalledWith(
      studyId,
      researcherId,
    );
    expect(database.query.mock.calls[3]?.[0]).toContain(
      'ON CONFLICT ON CONSTRAINT resultados_visita_atividade_unico',
    );
    expect(database.query.mock.calls[3]?.[1]).toEqual([
      scheduledVisitId,
      activityId,
      researcherId,
      '120/80',
      'mmHg',
      null,
    ]);
  });

  it('E06 bloqueia escrita fora do proprietário e em visita não realizada', async () => {
    studies.assertTeamStudyWriteAccess.mockResolvedValue({
      researcherId: '00000000-0000-4000-8000-000000000009',
    });
    await expect(
      service.registerAssessmentResult(
        studyId,
        scheduledVisitId,
        { activityId, value: '1' },
        researcherId,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(database.transaction).not.toHaveBeenCalled();

    studies.assertTeamStudyWriteAccess.mockResolvedValue({ researcherId });
    database.query
      .mockResolvedValueOnce({
        rows: [{ status: 'execução', endDate: '2099-12-31', researcherId }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: scheduledVisitId, plannedVisitId, status: 'Agendada' }],
        rowCount: 1,
      });
    await expect(
      service.registerAssessmentResult(
        studyId,
        scheduledVisitId,
        { activityId, value: '1' },
        researcherId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VISIT_NOT_REALIZED' },
    });
  });

  it('E06 rejeita atividade incompatível, visita externa e duplicidade', async () => {
    studies.assertTeamStudyWriteAccess.mockResolvedValue({ researcherId });
    database.query
      .mockResolvedValueOnce({
        rows: [{ status: 'execução', endDate: '2099-12-31', researcherId }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: scheduledVisitId, plannedVisitId, status: 'Realizada' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      service.registerAssessmentResult(
        studyId,
        scheduledVisitId,
        { activityId, value: '1' },
        researcherId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ACTIVITY_NOT_IN_VISIT' },
    });

    database.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      service.registerAssessmentResult(
        studyId,
        scheduledVisitId,
        { activityId, value: '1' },
        researcherId,
      ),
    ).rejects.toThrow(NotFoundException);

    database.query
      .mockResolvedValueOnce({
        rows: [{ status: 'execução', endDate: '2099-12-31', researcherId }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: scheduledVisitId, plannedVisitId, status: 'Realizada' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: activityId }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      service.registerAssessmentResult(
        studyId,
        scheduledVisitId,
        { activityId, value: '1' },
        researcherId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
