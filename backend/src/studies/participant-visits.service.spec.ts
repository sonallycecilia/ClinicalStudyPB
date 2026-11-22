import { jest } from '@jest/globals';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import { ParticipantVisitsService } from './participant-visits.service.js';
import type {
  CreateScheduledVisitInput,
  ListScheduledVisitsQuery,
  ScheduledVisit,
  UpdateScheduledVisitStatusInput,
} from './participant-visits.types.js';

const studyId = '00000000-0000-4000-8000-000000000001';
const participationId = '00000000-0000-4000-8000-000000000003';
const plannedVisitId = '00000000-0000-4000-8000-000000000004';
const scheduledVisitId = '00000000-0000-4000-8000-000000000005';
const researcherId = '00000000-0000-4000-8000-000000000006';

const scheduledVisit: ScheduledVisit & Record<string, unknown> = {
  id: scheduledVisitId,
  studyId,
  participationId,
  participantName: 'Participante Teste',
  plannedVisitId,
  plannedVisitName: 'Consulta inicial',
  plannedVisitOrder: 1,
  scheduledAt: '2026-11-24T12:00:00.000Z',
  status: 'Agendada',
  realizedAt: null,
  observation: null,
  createdAt: '2026-11-20T15:00:00.000Z',
};

type MockQueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number | null;
};

describe('ParticipantVisitsService — RF12, RF13 e RF16', () => {
  let database: {
    query: jest.Mock<
      (sql: string, values?: unknown[]) => Promise<MockQueryResult>
    >;
    transaction: jest.Mock<
      (operation: (client: PoolClient) => Promise<unknown>) => Promise<unknown>
    >;
  };
  let studies: {
    assertTeamStudyReadAccess: jest.Mock<
      (
        id: string,
        userId: string,
        resourceLabel?: string,
      ) => Promise<{ researcherId: string }>
    >;
    assertTeamStudyWriteAccess: jest.Mock<
      (id: string, userId: string) => Promise<{ researcherId: string }>
    >;
  };
  let service: ParticipantVisitsService;

  beforeEach(() => {
    const query = jest.fn<
      (sql: string, values?: unknown[]) => Promise<MockQueryResult>
    >();
    database = {
      query,
      transaction: jest.fn(
        async (operation: (client: PoolClient) => Promise<unknown>) =>
          operation({ query } as unknown as PoolClient),
      ),
    };
    studies = {
      assertTeamStudyReadAccess: jest
        .fn<
          (
            id: string,
            userId: string,
            resourceLabel?: string,
          ) => Promise<{ researcherId: string }>
        >()
        .mockResolvedValue({ researcherId }),
      assertTeamStudyWriteAccess: jest
        .fn<
          (id: string, userId: string) => Promise<{ researcherId: string }>
        >()
        .mockResolvedValue({ researcherId }),
    };
    service = new ParticipantVisitsService(
      database as unknown as DatabaseService,
      studies as unknown as StudiesService,
    );
  });

  describe('E01 — listParticipants', () => {
    it('lista participantes do estudo e aplica o filtro de status', async () => {
      const participant = {
        participationId,
        candidateId: '00000000-0000-4000-8000-000000000008',
        studyId,
        name: 'Participante Teste',
        participationStatus: 'Ativo',
        includedAt: '2026-01-01',
        withdrawnAt: null,
        withdrawalReason: null,
      };
      database.query.mockResolvedValue({ rows: [participant], rowCount: 1 });

      await expect(
        service.listParticipants(studyId, { status: 'Ativo' }, researcherId),
      ).resolves.toEqual([participant]);

      expect(studies.assertTeamStudyReadAccess).toHaveBeenCalledWith(
        studyId,
        researcherId,
      );
      expect(database.query.mock.calls[0]?.[0]).toContain(
        'WHERE c.id_estudo = $1 AND p.status = $2',
      );
      expect(database.query.mock.calls[0]?.[1]).toEqual([studyId, 'Ativo']);
    });

    it('lista sem filtro e retorna lista vazia quando o estudo não tem participantes', async () => {
      database.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(
        service.listParticipants(studyId, {}, researcherId),
      ).resolves.toEqual([]);

      expect(database.query.mock.calls[0]?.[0]).toContain(
        'WHERE c.id_estudo = $1',
      );
      expect(database.query.mock.calls[0]?.[0]).not.toContain(
        'AND p.status',
      );
      expect(database.query.mock.calls[0]?.[1]).toEqual([studyId]);
    });

    it('propaga a recusa de acesso ao estudo antes de consultar participantes', async () => {
      studies.assertTeamStudyReadAccess.mockRejectedValue(
        new NotFoundException('Estudo não encontrado.'),
      );

      await expect(
        service.listParticipants(studyId, {}, researcherId),
      ).rejects.toThrow(NotFoundException);
      expect(database.query).not.toHaveBeenCalled();
    });
  });

  describe('E02 — createScheduledVisit', () => {
    const input: CreateScheduledVisitInput = {
      participationId,
      plannedVisitId,
      scheduledAt: '2026-11-24T09:00:00-03:00',
      observation: 'Trazer exames.',
    };

    function queueSuccessfulSchedule() {
      database.query
        .mockResolvedValueOnce({
          rows: [
            {
              status: 'execução',
              endDate: '2026-11-30',
              researcherId,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: plannedVisitId }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ withinRange: true }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [{ id: scheduledVisitId }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [scheduledVisit], rowCount: 1 });
    }

    it('agenda visita válida na transação, bloqueia a participação e persiste os dados recebidos', async () => {
      queueSuccessfulSchedule();

      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).resolves.toEqual(scheduledVisit);

      expect(database.transaction).toHaveBeenCalledTimes(1);
      expect(database.query.mock.calls[0]?.[0]).toContain('FOR SHARE');
      expect(database.query.mock.calls[1]?.[0]).toContain('FOR UPDATE OF p');
      expect(database.query.mock.calls[1]?.[1]).toEqual([
        participationId,
        studyId,
      ]);
      expect(database.query.mock.calls[2]?.[1]).toEqual([
        plannedVisitId,
        studyId,
      ]);
      expect(database.query.mock.calls[3]?.[0]).toContain(
        "AT TIME ZONE 'America/Sao_Paulo'",
      );
      expect(database.query.mock.calls[3]?.[1]).toEqual([
        input.scheduledAt,
        '2020-01-01',
        '2026-11-30',
      ]);
      expect(database.query.mock.calls[5]?.[1]).toEqual([
        participationId,
        plannedVisitId,
        input.scheduledAt,
        input.observation,
      ]);
    });

    it('rejeita participação retirada ou concluída antes de validar visitas e inserir', async () => {
      for (const status of ['Retirado', 'Concluído']) {
        database.query.mockReset();
        database.query
          .mockResolvedValueOnce({
            rows: [
              { status: 'execução', endDate: '2026-11-30', researcherId },
            ],
            rowCount: 1,
          })
          .mockResolvedValueOnce({
            rows: [{ status, includedAt: '2020-01-01' }],
            rowCount: 1,
          });

        await expect(
          service.createScheduledVisit(studyId, input, researcherId),
        ).rejects.toMatchObject({
          response: { code: 'PARTICIPATION_NOT_ACTIVE' },
        });
        expect(database.query).toHaveBeenCalledTimes(2);
      }
    });

    it('retorna 404 quando participação ou visita prevista não pertence ao estudo', async () => {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).rejects.toThrow(NotFoundException);
      expect(database.query).toHaveBeenCalledTimes(2);

      database.query.mockReset();
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).rejects.toThrow(NotFoundException);
      expect(database.query).toHaveBeenCalledTimes(3);
      expect(database.query.mock.calls[2]?.[1]).toEqual([
        plannedVisitId,
        studyId,
      ]);
    });

    it('rejeita data fora do intervalo civil de São Paulo e não tenta inserir', async () => {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ id: plannedVisitId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ withinRange: false }], rowCount: 1 });

      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).rejects.toMatchObject({
        response: { code: 'SCHEDULE_OUT_OF_RANGE' },
      });
      expect(database.query.mock.calls[3]?.[0]).toContain(
        "AT TIME ZONE 'America/Sao_Paulo'",
      );
      expect(database.query).toHaveBeenCalledTimes(4);
    });

    it('retorna conflito para visita já agendada ou realizada', async () => {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ id: plannedVisitId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ withinRange: true }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{}], rowCount: 1 });

      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).rejects.toMatchObject({
        response: { code: 'VISIT_ALREADY_SCHEDULED' },
      });
      expect(database.query).toHaveBeenCalledTimes(5);
      expect(database.query.mock.calls[4]?.[0]).toContain(
        "status IN ('Agendada', 'Realizada')",
      );
    });

    it.each(['Ausente', 'Cancelada'])(
      'permite novo agendamento após a visita anterior estar %s',
      async () => {
        queueSuccessfulSchedule();
        await expect(
          service.createScheduledVisit(studyId, input, researcherId),
        ).resolves.toEqual(scheduledVisit);
        expect(database.query.mock.calls[4]?.[0]).toContain(
          "status IN ('Agendada', 'Realizada')",
        );
        expect(database.query.mock.calls[4]?.[1]).toEqual([
          participationId,
          plannedVisitId,
        ]);
      },
    );

    it('rejeita estudo encerrado e propaga falha do banco sem apresentar sucesso', async () => {
      database.query.mockResolvedValueOnce({
        rows: [
          { status: 'encerrado', endDate: '2026-11-30', researcherId },
        ],
        rowCount: 1,
      });
      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).rejects.toMatchObject({ response: { code: 'STUDY_CLOSED' } });
      expect(database.query).toHaveBeenCalledTimes(1);

      const databaseError = new Error('insert failed');
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ id: plannedVisitId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ withinRange: true }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockRejectedValueOnce(databaseError);
      await expect(
        service.createScheduledVisit(studyId, input, researcherId),
      ).rejects.toBe(databaseError);
    });
  });

  describe('E03 — listScheduledVisits', () => {
    it('lista sem filtros, limita a consulta ao estudo e converte timestamps para UTC', async () => {
      database.query.mockResolvedValue({
        rows: [
          {
            ...scheduledVisit,
            scheduledAt: new Date('2026-11-24T12:00:00.000Z'),
            createdAt: new Date('2026-11-20T15:00:00.000Z'),
          },
        ],
        rowCount: 1,
      });

      await expect(
        service.listScheduledVisits(studyId, {}, researcherId),
      ).resolves.toEqual([scheduledVisit]);
      expect(database.query.mock.calls[0]?.[0]).toContain(
        'pv.id_estudo = $1 AND c.id_estudo = $1',
      );
      expect(database.query.mock.calls[0]?.[1]).toEqual([studyId]);
      expect(studies.assertTeamStudyReadAccess).toHaveBeenCalledWith(
        studyId,
        researcherId,
        'visitas agendadas',
      );
    });

    it('aplica participação, status e limites inclusivos pelo dia civil de São Paulo', async () => {
      database.query
        .mockResolvedValueOnce({ rows: [{ id: participationId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.listScheduledVisits(
          studyId,
          {
            participationId,
            status: 'Realizada',
            from: '2026-11-20',
            to: '2026-11-30',
          },
          researcherId,
        ),
      ).resolves.toEqual([]);

      const sql = database.query.mock.calls[1]?.[0] ?? '';
      expect(sql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
      expect(sql).toContain('>= $4::date');
      expect(sql).toContain('<= $5::date');
      expect(sql).toContain('v.id_participacao = $2');
      expect(sql).toContain('v.status = $3');
      expect(database.query.mock.calls[1]?.[1]).toEqual([
        studyId,
        participationId,
        'Realizada',
        '2026-11-20',
        '2026-11-30',
      ]);
    });

    it('retorna 404 para participação de outro estudo antes da consulta de visitas', async () => {
      database.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.listScheduledVisits(
          studyId,
          { participationId },
          researcherId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(database.query).toHaveBeenCalledTimes(1);
      expect(database.query.mock.calls[0]?.[1]).toEqual([
        participationId,
        studyId,
      ]);
    });

    it.each<[ListScheduledVisitsQuery, string]>([
      [{ from: '2026-02-30' }, 'invalid calendar date'],
      [{ from: '2026-11-30', to: '2026-11-20' }, 'from after to'],
    ])('rejeita intervalo inválido (%s)', async (query) => {
      await expect(
        service.listScheduledVisits(studyId, query, researcherId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(database.query).not.toHaveBeenCalled();
    });
  });

  describe('E04 — updateScheduledVisitStatus', () => {
    function queueSuccessfulUpdate(
      status: UpdateScheduledVisitStatusInput['status'],
      observation: string | null,
    ) {
      const updatedVisit = {
        ...scheduledVisit,
        status,
        realizedAt:
          status === 'Realizada' ? '2026-11-20T16:00:00.000Z' : null,
        observation,
      };
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ participationId, status: 'Agendada' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ status: 'Agendada' }], rowCount: 1 });
      if (status === 'Realizada') {
        database.query.mockResolvedValueOnce({
          rows: [{ valid: true }],
          rowCount: 1,
        });
      }
      database.query
        .mockResolvedValueOnce({ rows: [{ id: scheduledVisitId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updatedVisit], rowCount: 1 });
    }

    it.each([
      ['Realizada', '2026-11-20T13:00:00-03:00', 'Anotação atualizada.'],
      ['Ausente', undefined, 'Anotação atualizada.'],
      ['Cancelada', undefined, null],
    ] as const)(
      'realiza a transição permitida para %s',
      async (status, realizedAt, observation) => {
        queueSuccessfulUpdate(status, observation);
        const input: UpdateScheduledVisitStatusInput = {
          status,
          ...(realizedAt === undefined ? {} : { realizedAt }),
          observation,
        };

        await expect(
          service.updateScheduledVisitStatus(
            studyId,
            scheduledVisitId,
            input,
            researcherId,
          ),
        ).resolves.toMatchObject({ status, observation });

        const updateCall = database.query.mock.calls.find(([sql]) =>
          sql.includes('UPDATE visitas'),
        );
        expect(updateCall?.[1]).toEqual([
          scheduledVisitId,
          participationId,
          status,
          realizedAt ?? null,
          true,
          observation,
        ]);
      },
    );

    it('preserva observação omitida e limpa quando explicitamente null', async () => {
      queueSuccessfulUpdate('Ausente', 'Observação existente.');
      await service.updateScheduledVisitStatus(
        studyId,
        scheduledVisitId,
        { status: 'Ausente' },
        researcherId,
      );
      const omittedUpdate = database.query.mock.calls.find(([sql]) =>
        sql.includes('UPDATE visitas'),
      );
      expect(omittedUpdate?.[1]).toEqual([
        scheduledVisitId,
        participationId,
        'Ausente',
        null,
        false,
        null,
      ]);
      expect(omittedUpdate?.[0]).toContain(
        'CASE WHEN $5::boolean THEN $6::text ELSE observacao END',
      );

      database.query.mockReset();
      queueSuccessfulUpdate('Cancelada', null);
      await service.updateScheduledVisitStatus(
        studyId,
        scheduledVisitId,
        { status: 'Cancelada', observation: null },
        researcherId,
      );
      const clearedUpdate = database.query.mock.calls.find(([sql]) =>
        sql.includes('UPDATE visitas'),
      );
      expect(clearedUpdate?.[1]).toEqual([
        scheduledVisitId,
        participationId,
        'Cancelada',
        null,
        true,
        null,
      ]);
    });

    it.each(['Realizada', 'Ausente', 'Cancelada'])(
      'rejeita alteração da visita em estado terminal %s',
      async (status) => {
        database.query
          .mockResolvedValueOnce({
            rows: [
              { status: 'execução', endDate: '2026-11-30', researcherId },
            ],
            rowCount: 1,
          })
          .mockResolvedValueOnce({
            rows: [{ participationId, status }],
            rowCount: 1,
          })
          .mockResolvedValueOnce({
            rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
            rowCount: 1,
          })
          .mockResolvedValueOnce({ rows: [{ status }], rowCount: 1 });

        await expect(
          service.updateScheduledVisitStatus(
            studyId,
            scheduledVisitId,
            { status: 'Cancelada' },
            researcherId,
          ),
        ).rejects.toMatchObject({
          response: { code: 'VISIT_STATUS_FINAL' },
        });
        expect(database.query).toHaveBeenCalledTimes(4);
      },
    );

    it('retorna 404 para visita ausente ou pertencente a outro estudo', async () => {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(
        service.updateScheduledVisitStatus(
          studyId,
          scheduledVisitId,
          { status: 'Ausente' },
          researcherId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(database.query).toHaveBeenCalledTimes(2);
    });

    it('rejeita participação não ativa, estudo encerrado e data de realização inválida', async () => {
      database.query.mockResolvedValueOnce({
        rows: [
          { status: 'encerrado', endDate: '2026-11-30', researcherId },
        ],
        rowCount: 1,
      });
      await expect(
        service.updateScheduledVisitStatus(
          studyId,
          scheduledVisitId,
          { status: 'Ausente' },
          researcherId,
        ),
      ).rejects.toMatchObject({ response: { code: 'STUDY_CLOSED' } });

      database.query.mockReset();
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ participationId, status: 'Agendada' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Retirado', includedAt: '2020-01-01' }],
          rowCount: 1,
        });
      await expect(
        service.updateScheduledVisitStatus(
          studyId,
          scheduledVisitId,
          { status: 'Ausente' },
          researcherId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'PARTICIPATION_NOT_ACTIVE' },
      });

      database.query.mockReset();
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ participationId, status: 'Agendada' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ status: 'Agendada' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ valid: false }], rowCount: 1 });
      await expect(
        service.updateScheduledVisitStatus(
          studyId,
          scheduledVisitId,
          {
            status: 'Realizada',
            realizedAt: '2020-01-01T02:59:59Z',
          },
          researcherId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'REALIZED_AT_INVALID' },
      });
      expect(database.query.mock.calls[4]?.[0]).toContain(
        "AT TIME ZONE 'America/Sao_Paulo'",
      );
      expect(database.query.mock.calls[4]?.[0]).toContain(
        'clock_timestamp()',
      );
    });

    it('rejeita a transição se a atualização condicional perder a disputa', async () => {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ participationId, status: 'Agendada' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ status: 'Agendada' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ status: 'Ausente' }], rowCount: 1 });

      await expect(
        service.updateScheduledVisitStatus(
          studyId,
          scheduledVisitId,
          { status: 'Cancelada' },
          researcherId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'VISIT_STATUS_FINAL' },
      });
      expect(database.query.mock.calls[4]?.[0]).toContain(
        "status = 'Agendada'",
      );
    });
  });

  describe('E08 — registerParticipantWithdrawal', () => {
    const input = {
      withdrawalDate: '2026-11-20',
      reason: '  Participante solicitou desligamento.  ',
    };
    const withdrawnParticipant = {
      participationId,
      candidateId: '00000000-0000-4000-8000-000000000008',
      studyId,
      name: 'Participante Teste',
      participationStatus: 'Retirado',
      includedAt: '2020-01-01',
      withdrawnAt: input.withdrawalDate,
      withdrawalReason: 'Participante solicitou desligamento.',
    };

    function queueSuccessfulWithdrawal() {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              participationId,
              candidateId: withdrawnParticipant.candidateId,
              studyId,
              name: withdrawnParticipant.name,
              status: 'Ativo',
              includedAt: '2020-01-01',
              withdrawnAt: null,
              withdrawalReason: null,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ today: '2026-11-20' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [withdrawnParticipant],
          rowCount: 1,
        });
    }

    it('retira participação ativa usando a data civil de São Paulo e altera somente os campos D-07', async () => {
      queueSuccessfulWithdrawal();

      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          input,
          researcherId,
        ),
      ).resolves.toEqual(withdrawnParticipant);

      expect(database.transaction).toHaveBeenCalledTimes(1);
      expect(database.query.mock.calls[0]?.[0]).toContain('FOR SHARE');
      expect(database.query.mock.calls[1]?.[0]).toContain('FOR UPDATE OF p');
      expect(database.query.mock.calls[2]?.[0]).toContain(
        "AT TIME ZONE 'America/Sao_Paulo'",
      );
      const update = database.query.mock.calls[3];
      expect(update?.[0]).toMatch(
        /SET status = 'Retirado',\s+data_retirada = \$3::date,\s+motivo_retirada = \$4/,
      );
      expect(update?.[0]).toContain("AND p.status = 'Ativo'");
      expect(update?.[0]).not.toMatch(
        /SET[^;]*(?:visitas|participantes_vinculados|status_recrutamento)/i,
      );
      expect(update?.[1]).toEqual([
        participationId,
        studyId,
        input.withdrawalDate,
        'Participante solicitou desligamento.',
      ]);
    });

    it.each(['Retirado', 'Concluído'])(
      'rejeita participação com status %s',
      async (status) => {
        database.query
          .mockResolvedValueOnce({
            rows: [
              { status: 'execução', endDate: '2026-11-30', researcherId },
            ],
            rowCount: 1,
          })
          .mockResolvedValueOnce({
            rows: [{ status, includedAt: '2020-01-01' }],
            rowCount: 1,
          });
        await expect(
          service.registerParticipantWithdrawal(
            studyId,
            participationId,
            input,
            researcherId,
          ),
        ).rejects.toMatchObject({
          response: { code: 'PARTICIPATION_NOT_ACTIVE' },
        });
        expect(database.query).toHaveBeenCalledTimes(2);
      },
    );

    it('retorna 404 para participação inexistente ou de outro estudo', async () => {
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          input,
          researcherId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(database.query).toHaveBeenCalledTimes(2);
      expect(database.query.mock.calls[1]?.[1]).toEqual([
        participationId,
        studyId,
      ]);
    });

    it('valida formato, motivo, data de inclusão e data atual sem gravar', async () => {
      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          { ...input, withdrawalDate: '2026-02-30' },
          researcherId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          { ...input, withdrawalDate: '2026-11-20T00:00:00Z' },
          researcherId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          { ...input, reason: '   ' },
          researcherId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(database.transaction).not.toHaveBeenCalled();

      for (const withdrawalDate of ['2019-12-31', '2026-11-21']) {
        database.query.mockReset();
        database.query
          .mockResolvedValueOnce({
            rows: [
              { status: 'execução', endDate: '2026-11-30', researcherId },
            ],
            rowCount: 1,
          })
          .mockResolvedValueOnce({
            rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
            rowCount: 1,
          })
          .mockResolvedValueOnce({ rows: [{ today: '2026-11-20' }], rowCount: 1 });

        await expect(
          service.registerParticipantWithdrawal(
            studyId,
            participationId,
            { ...input, withdrawalDate },
            researcherId,
          ),
        ).rejects.toMatchObject({
          response: { code: 'WITHDRAWAL_DATE_INVALID' },
        });
        expect(database.query).toHaveBeenCalledTimes(3);
      }
    });

    it('rejeita estudo encerrado e não apresenta falha de atualização como sucesso', async () => {
      database.query.mockResolvedValueOnce({
        rows: [
          { status: 'encerrado', endDate: '2026-11-30', researcherId },
        ],
        rowCount: 1,
      });
      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          input,
          researcherId,
        ),
      ).rejects.toMatchObject({ response: { code: 'STUDY_CLOSED' } });

      database.query.mockReset();
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              status: 'Ativo',
              includedAt: '2020-01-01',
              participationId,
              candidateId: withdrawnParticipant.candidateId,
              studyId,
              name: withdrawnParticipant.name,
              withdrawnAt: null,
              withdrawalReason: null,
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ today: '2026-11-20' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          input,
          researcherId,
        ),
      ).rejects.toMatchObject({
        response: { code: 'PARTICIPATION_NOT_ACTIVE' },
      });
    });

    it('propaga erro inesperado da operação transacional', async () => {
      const databaseError = new Error('withdrawal update failed');
      database.query
        .mockResolvedValueOnce({
          rows: [
            { status: 'execução', endDate: '2026-11-30', researcherId },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'Ativo', includedAt: '2020-01-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ today: '2026-11-20' }], rowCount: 1 })
        .mockRejectedValueOnce(databaseError);

      await expect(
        service.registerParticipantWithdrawal(
          studyId,
          participationId,
          input,
          researcherId,
        ),
      ).rejects.toBe(databaseError);
      expect(database.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
