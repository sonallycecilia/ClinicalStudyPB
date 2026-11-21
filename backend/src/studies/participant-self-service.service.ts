import { Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import type { StudyStatus } from './study.types.js';
import type {
  ParticipantStudy,
  ParticipantVisit,
  ListMyVisitsQuery,
} from './participant-self-service.types.js';
import type {
  ParticipationStatus,
  ScheduledVisitStatus,
} from './participant-visits.types.js';

interface ParticipantStudyRow extends QueryResultRow {
  participationId: string;
  participationStatus: ParticipationStatus;
  includedAt: string;
  withdrawnAt: string | null;
  studyId: string;
  studyCode: string;
  studyTitle: string;
  studyObjective: string;
  studyStartDate: string;
  studyEndDate: string;
  studyStatus: StudyStatus;
  researcherName: string;
}

interface ParticipantVisitRow extends QueryResultRow {
  id: string;
  participationId: string;
  studyId: string;
  studyTitle: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: Date | string;
  status: ScheduledVisitStatus;
  realizedAt: Date | string | null;
}

@Injectable()
export class ParticipantSelfServiceClock {
  now(): Date {
    return new Date();
  }
}

function toISOString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

@Injectable()
export class ParticipantSelfService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ParticipantSelfServiceClock,
  ) {}

  async listStudies(userId: string): Promise<ParticipantStudy[]> {
    const { rows } = await this.database.query<ParticipantStudyRow>(
      `SELECT
         p.id_participacao::text AS "participationId",
         p.status AS "participationStatus",
         p.data_inclusao::text AS "includedAt",
         p.data_retirada::text AS "withdrawnAt",
         e.id_estudo::text AS "studyId",
         e.codigo AS "studyCode",
         e.titulo AS "studyTitle",
         e.objetivo AS "studyObjective",
         e.data_inicio::text AS "studyStartDate",
         e.data_fim::text AS "studyEndDate",
         e.status AS "studyStatus",
         u.nome AS "researcherName"
       FROM candidatos c
       JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato
       JOIN estudos e ON e.id_estudo = c.id_estudo
       JOIN usuarios u ON u.id_usuario = e.id_pesquisador
       WHERE c.id_usuario = $1
       ORDER BY p.data_inclusao DESC, p.id_participacao DESC`,
      [userId],
    );

    return rows.map((row) => ({
      participationId: row.participationId,
      participationStatus: row.participationStatus,
      includedAt: row.includedAt,
      withdrawnAt: row.withdrawnAt,
      study: {
        id: row.studyId,
        code: row.studyCode,
        title: row.studyTitle,
        objective: row.studyObjective,
        startDate: row.studyStartDate,
        endDate: row.studyEndDate,
        status: row.studyStatus,
        researcher: row.researcherName,
      },
    }));
  }

  async listVisits(
    query: ListMyVisitsQuery,
    userId: string,
  ): Promise<ParticipantVisit[]> {
    if (query.studyId) {
      const participation = await this.database.query(
        `SELECT 1
         FROM candidatos c
         JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato
         WHERE c.id_usuario = $1 AND c.id_estudo = $2
         LIMIT 1`,
        [userId, query.studyId],
      );
      if (!participation.rowCount) {
        throw new NotFoundException(
          'Estudo não encontrado entre as suas participações.',
        );
      }
    }

    const scopeCondition =
      query.scope === 'upcoming'
        ? `v.status = 'Agendada' AND v.data_agendada > $2::timestamptz`
        : `v.status IN ('Realizada', 'Ausente', 'Cancelada')`;
    const order =
      query.scope === 'upcoming'
        ? 'v.data_agendada ASC, v.id_visita ASC'
        : 'v.data_agendada DESC, v.id_visita DESC';
    const values: unknown[] = [userId];
    if (query.scope === 'upcoming') values.push(this.clock.now());
    const studyIdParameter = `$${values.length + 1}`;
    values.push(query.studyId ?? null);
    const { rows } = await this.database.query<ParticipantVisitRow>(
      `SELECT
         v.id_visita::text AS id,
         p.id_participacao::text AS "participationId",
         s.id_estudo::text AS "studyId",
         s.titulo AS "studyTitle",
         pv.nome AS "plannedVisitName",
         pv.ordem AS "plannedVisitOrder",
         v.data_agendada AS "scheduledAt",
         v.status,
         v.data_realizacao AS "realizedAt"
       FROM visitas v
       JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
       JOIN candidatos c ON c.id_candidato = p.id_candidato
       JOIN estudos s ON s.id_estudo = c.id_estudo
       JOIN visitas_previstas pv
         ON pv.id_visita_prevista = v.id_visita_prevista
        AND pv.id_estudo = s.id_estudo
       WHERE c.id_usuario = $1
         AND (${studyIdParameter}::uuid IS NULL OR c.id_estudo = ${studyIdParameter})
         AND ${scopeCondition}
       ORDER BY ${order}`,
      values,
    );

    return rows.map((row) => ({
      id: row.id,
      participationId: row.participationId,
      studyId: row.studyId,
      studyTitle: row.studyTitle,
      plannedVisitName: row.plannedVisitName,
      plannedVisitOrder: row.plannedVisitOrder,
      scheduledAt: toISOString(row.scheduledAt)!,
      status: row.status,
      realizedAt: toISOString(row.realizedAt),
    }));
  }
}
