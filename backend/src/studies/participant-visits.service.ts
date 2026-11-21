import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import type {
  CreateScheduledVisitInput,
  ListParticipantsQuery,
  ListScheduledVisitsQuery,
  Participant,
  ParticipationStatus,
  RegisterParticipantWithdrawalInput,
  ScheduledVisit,
  ScheduledVisitFinalStatus,
  ScheduledVisitStatus,
  UpdateScheduledVisitStatusInput,
} from './participant-visits.types.js';
import type {
  AssessmentResult,
  HistoricalAssessmentResult,
  HistoricalScheduledVisit,
  ParticipantHistory as ParticipantHistoryType,
  RegisterAssessmentResultInput,
  ScheduledVisitActivityResult,
  ScheduledVisitResults,
} from './assessment-results.types.js';

interface ParticipantRow extends QueryResultRow, Participant {}

interface ScheduledVisitRow extends QueryResultRow {
  id: string;
  studyId: string;
  participationId: string;
  participantName: string;
  plannedVisitId: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: Date | string;
  status: ScheduledVisitStatus;
  realizedAt: Date | string | null;
  observation: string | null;
  createdAt: Date | string;
}

interface LockedStudyRow extends QueryResultRow {
  status: string;
  endDate: string;
  researcherId: string;
}

interface ParticipationRow extends QueryResultRow {
  status: ParticipationStatus;
  includedAt: string;
}

interface ScheduledVisitLockRow extends QueryResultRow {
  participationId: string;
  status: ScheduledVisitStatus;
}

interface ScheduledVisitStatusRow extends QueryResultRow {
  status: ScheduledVisitStatus;
}

interface AssessmentVisitRow extends QueryResultRow {
  id: string;
  plannedVisitId: string;
  status: ScheduledVisitStatus;
  researcherId?: string;
}

interface AssessmentActivityResultRow extends QueryResultRow {
  activityId: string;
  name: string;
  type: string;
  description: string | null;
  resultId: string | null;
  value: string | null;
  unit: string | null;
  observation: string | null;
  registeredAt: Date | string | null;
  registrarId: string | null;
}

interface AssessmentResultRow extends QueryResultRow {
  id: string;
  scheduledVisitId: string;
  activityId: string;
  value: string;
  unit: string | null;
  observation: string | null;
  registeredAt: Date | string;
  registrarId: string;
}

interface ParticipantHistoryRow extends QueryResultRow {
  participationId: string;
  candidateId: string;
  studyId: string;
  participantName: string;
  participationStatus: ParticipationStatus;
  includedAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  visitId: string | null;
  visitParticipationId: string | null;
  plannedVisitId: string | null;
  plannedVisitName: string | null;
  plannedVisitOrder: number | null;
  scheduledAt: Date | string | null;
  visitStatus: ScheduledVisitStatus | null;
  realizedAt: Date | string | null;
  visitObservation: string | null;
  createdAt: Date | string | null;
  resultId: string | null;
  activityId: string | null;
  activityName: string | null;
  activityType: string | null;
  value: string | null;
  unit: string | null;
  resultObservation: string | null;
  registeredAt: Date | string | null;
  registrarId: string | null;
}

const SCHEDULED_VISIT_COLUMNS = `
  v.id_visita::text AS id,
  pv.id_estudo::text AS "studyId",
  v.id_participacao::text AS "participationId",
  c.nome AS "participantName",
  v.id_visita_prevista::text AS "plannedVisitId",
  pv.nome AS "plannedVisitName",
  pv.ordem AS "plannedVisitOrder",
  v.data_agendada AS "scheduledAt",
  v.status,
  v.data_realizacao AS "realizedAt",
  v.observacao AS observation,
  v.criado_em AS "createdAt"`;

function domainBadRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message,
    error: 'Bad Request',
    code,
  });
}

function toISOString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toScheduledVisit(row: ScheduledVisitRow): ScheduledVisit {
  return {
    ...row,
    scheduledAt: toISOString(row.scheduledAt)!,
    realizedAt: toISOString(row.realizedAt),
    createdAt: toISOString(row.createdAt)!,
  };
}

function toAssessmentResult(row: AssessmentResultRow): AssessmentResult {
  return {
    id: row.id,
    scheduledVisitId: row.scheduledVisitId,
    activityId: row.activityId,
    value: row.value,
    unit: row.unit,
    observation: row.observation,
    registeredAt: toISOString(row.registeredAt)!,
    registrarId: row.registrarId,
  };
}

function resultFromActivityRow(
  row: AssessmentActivityResultRow,
  scheduledVisitId: string,
): AssessmentResult | null {
  if (row.resultId === null) return null;
  if (
    row.value === null ||
    row.registeredAt === null ||
    row.registrarId === null
  ) {
    throw new Error(
      'O resultado persistido não contém todos os campos obrigatórios.',
    );
  }
  return {
    id: row.resultId,
    scheduledVisitId,
    activityId: row.activityId,
    value: row.value,
    unit: row.unit,
    observation: row.observation,
    registeredAt: toISOString(row.registeredAt)!,
    registrarId: row.registrarId,
  };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

@Injectable()
export class ParticipantVisitsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly studiesService: StudiesService,
  ) {}

  async listParticipants(
    studyId: string,
    query: ListParticipantsQuery,
    userId: string,
  ): Promise<Participant[]> {
    await this.studiesService.assertTeamStudyReadAccess(studyId, userId);
    const values: unknown[] = [studyId];
    let statusFilter = '';
    if (query.status) {
      values.push(query.status);
      statusFilter = 'AND p.status = $2';
    }

    const { rows } = await this.database.query<ParticipantRow>(
      `SELECT
         p.id_participacao::text AS "participationId",
         c.id_candidato::text AS "candidateId",
         c.id_estudo::text AS "studyId",
         c.nome AS name,
         p.status AS "participationStatus",
         p.data_inclusao::text AS "includedAt",
         p.data_retirada::text AS "withdrawnAt",
         p.motivo_retirada AS "withdrawalReason"
       FROM participacoes_estudo p
       JOIN candidatos c ON c.id_candidato = p.id_candidato
       WHERE c.id_estudo = $1 ${statusFilter}
       ORDER BY c.nome, p.data_inclusao, p.id_participacao`,
      values,
    );
    return rows;
  }

  async registerParticipantWithdrawal(
    studyId: string,
    participationId: string,
    input: RegisterParticipantWithdrawalInput,
    userId: string,
  ): Promise<Participant> {
    const authorizedStudy =
      await this.studiesService.assertTeamStudyWriteAccess(studyId, userId);
    if (!isValidDate(input.withdrawalDate)) {
      throw new BadRequestException(
        'Informe uma data válida no formato YYYY-MM-DD.',
      );
    }
    if (typeof input.reason !== 'string' || !input.reason.trim()) {
      throw new BadRequestException('Informe o motivo da retirada.');
    }

    return this.database.transaction(async (client) => {
      const studyResult = await client.query<LockedStudyRow>(
        `SELECT status, data_fim::text AS "endDate",
                id_pesquisador::text AS "researcherId"
         FROM estudos
         WHERE id_estudo = $1
         FOR SHARE`,
        [studyId],
      );
      const study = studyResult.rows[0];
      if (!study) throw new NotFoundException('Estudo não encontrado.');
      if (study.researcherId !== authorizedStudy.researcherId) {
        throw new ForbiddenException(
          'O responsável pelo estudo foi alterado durante a operação.',
        );
      }
      if (study.status === 'encerrado') {
        throw domainBadRequest(
          'STUDY_CLOSED',
          'Não é possível alterar um estudo encerrado.',
        );
      }
      if (
        userId !== authorizedStudy.researcherId &&
        study.status !== 'recrutamento' &&
        study.status !== 'execução'
      ) {
        throw new ForbiddenException(
          'O Coordenador só pode alterar estudos em recrutamento ou execução.',
        );
      }

      const participationResult = await client.query<
        ParticipantRow & { status: ParticipationStatus }
      >(
        `SELECT p.status,
                p.data_inclusao::text AS "includedAt",
                c.id_candidato::text AS "candidateId",
                c.id_estudo::text AS "studyId",
                c.nome AS name,
                p.id_participacao::text AS "participationId",
                p.data_retirada::text AS "withdrawnAt",
                p.motivo_retirada AS "withdrawalReason"
         FROM participacoes_estudo p
         JOIN candidatos c ON c.id_candidato = p.id_candidato
         WHERE p.id_participacao = $1
           AND c.id_estudo = $2
         FOR UPDATE OF p`,
        [participationId, studyId],
      );
      const participation = participationResult.rows[0];
      if (!participation) {
        throw new NotFoundException(
          'Participante não encontrado neste estudo.',
        );
      }
      if (participation.status !== 'Ativo') {
        throw domainBadRequest(
          'PARTICIPATION_NOT_ACTIVE',
          'Somente participantes ativos podem ser retirados do estudo.',
        );
      }

      const todayResult = await client.query<{ today: string }>(
        `SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text
                  AS today`,
      );
      const todayRow = todayResult.rows[0];
      if (!todayRow) {
        throw new Error('O banco não retornou a data civil atual.');
      }
      const today = todayRow.today;
      if (
        input.withdrawalDate < participation.includedAt ||
        input.withdrawalDate > today
      ) {
        throw domainBadRequest(
          'WITHDRAWAL_DATE_INVALID',
          'A data de retirada deve estar entre a inclusão e a data atual.',
        );
      }

      const updated = await client.query<ParticipantRow>(
        `UPDATE participacoes_estudo p
         SET status = 'Retirado',
             data_retirada = $3::date,
             motivo_retirada = $4
         FROM candidatos c
         WHERE p.id_participacao = $1
           AND p.id_candidato = c.id_candidato
           AND c.id_estudo = $2
           AND p.status = 'Ativo'
         RETURNING
           p.id_participacao::text AS "participationId",
           c.id_candidato::text AS "candidateId",
           c.id_estudo::text AS "studyId",
           c.nome AS name,
           p.status AS "participationStatus",
           p.data_inclusao::text AS "includedAt",
           p.data_retirada::text AS "withdrawnAt",
           p.motivo_retirada AS "withdrawalReason"`,
        [
          participationId,
          studyId,
          input.withdrawalDate,
          input.reason.trim(),
        ],
      );
      const participant = updated.rows[0];
      if (!participant) {
        throw domainBadRequest(
          'PARTICIPATION_NOT_ACTIVE',
          'Somente participantes ativos podem ser retirados do estudo.',
        );
      }
      return participant;
    });
  }

  async getParticipantHistory(
    studyId: string,
    participationId: string,
    userId: string,
  ): Promise<ParticipantHistoryType> {
    await this.studiesService.assertTeamStudyReadAccess(
      studyId,
      userId,
      'histórico do participante',
    );

    const { rows } = await this.database.query<ParticipantHistoryRow>(
      `SELECT
         p.id_participacao::text AS "participationId",
         c.id_candidato::text AS "candidateId",
         c.id_estudo::text AS "studyId",
         c.nome AS "participantName",
         p.status AS "participationStatus",
         p.data_inclusao::text AS "includedAt",
         p.data_retirada::text AS "withdrawnAt",
         p.motivo_retirada AS "withdrawalReason",
         v.id_visita::text AS "visitId",
         v.id_participacao::text AS "visitParticipationId",
         pv.id_visita_prevista::text AS "plannedVisitId",
         pv.nome AS "plannedVisitName",
         pv.ordem AS "plannedVisitOrder",
         v.data_agendada AS "scheduledAt",
         v.status AS "visitStatus",
         v.data_realizacao AS "realizedAt",
         v.observacao AS "visitObservation",
         v.criado_em AS "createdAt",
         r.id_resultado::text AS "resultId",
         a.id_atividade::text AS "activityId",
         a.nome AS "activityName",
         a.tipo AS "activityType",
         r.valor_ficticio AS value,
         r.unidade AS unit,
         r.observacao AS "resultObservation",
         r.registrado_em AS "registeredAt",
         r.id_registrado_por::text AS "registrarId"
       FROM participacoes_estudo p
       JOIN candidatos c ON c.id_candidato = p.id_candidato
       LEFT JOIN visitas v ON v.id_participacao = p.id_participacao
       LEFT JOIN visitas_previstas pv
         ON pv.id_visita_prevista = v.id_visita_prevista
        AND pv.id_estudo = c.id_estudo
       LEFT JOIN resultados_avaliacao r
         ON r.id_visita = v.id_visita
        AND EXISTS (
          SELECT 1
          FROM atividades_visita matching_activity
          WHERE matching_activity.id_atividade = r.id_atividade
            AND matching_activity.id_visita_prevista = v.id_visita_prevista
        )
       LEFT JOIN atividades_visita a
         ON a.id_atividade = r.id_atividade
        AND a.id_visita_prevista = v.id_visita_prevista
       WHERE p.id_participacao = $1
         AND c.id_estudo = $2
         AND (v.id_visita IS NULL OR pv.id_visita_prevista IS NOT NULL)
       ORDER BY v.data_agendada ASC NULLS LAST,
                v.id_visita ASC,
                a.ordem ASC NULLS LAST,
                a.id_atividade ASC`,
      [participationId, studyId],
    );
    const first = rows[0];
    if (!first) {
      throw new NotFoundException(
        'Participante não encontrado neste estudo.',
      );
    }

    const participant: Participant = {
      participationId: first.participationId,
      candidateId: first.candidateId,
      studyId: first.studyId,
      name: first.participantName,
      participationStatus: first.participationStatus,
      includedAt: first.includedAt,
      withdrawnAt: first.withdrawnAt,
      withdrawalReason: first.withdrawalReason,
    };
    const visitsById = new Map<string, HistoricalScheduledVisit>();

    for (const row of rows) {
      if (
        row.visitId === null ||
        row.visitParticipationId === null ||
        row.plannedVisitId === null ||
        row.plannedVisitName === null ||
        row.plannedVisitOrder === null ||
        row.scheduledAt === null ||
        row.visitStatus === null ||
        row.createdAt === null
      ) {
        continue;
      }

      let visit = visitsById.get(row.visitId);
      if (!visit) {
        const scheduledVisit: ScheduledVisit = {
          id: row.visitId,
          studyId: row.studyId,
          participationId: row.visitParticipationId,
          participantName: row.participantName,
          plannedVisitId: row.plannedVisitId,
          plannedVisitName: row.plannedVisitName,
          plannedVisitOrder: row.plannedVisitOrder,
          scheduledAt: toISOString(row.scheduledAt)!,
          status: row.visitStatus,
          realizedAt: toISOString(row.realizedAt),
          observation: row.visitObservation,
          createdAt: toISOString(row.createdAt)!,
        };
        visit = { ...scheduledVisit, results: [] };
        visitsById.set(row.visitId, visit);
      }

      if (row.resultId === null) continue;
      if (
        row.activityId === null ||
        row.activityName === null ||
        row.activityType === null ||
        row.value === null ||
        row.registeredAt === null ||
        row.registrarId === null
      ) {
        throw new Error(
          'O resultado persistido não está vinculado a uma atividade válida.',
        );
      }

      const result: HistoricalAssessmentResult = {
        id: row.resultId,
        scheduledVisitId: row.visitId,
        activityId: row.activityId,
        activityName: row.activityName,
        activityType: row.activityType,
        value: row.value,
        unit: row.unit,
        observation: row.resultObservation,
        registeredAt: toISOString(row.registeredAt)!,
        registrarId: row.registrarId,
      };
      visit.results.push(result);
    }

    return { participant, visits: [...visitsById.values()] };
  }

  async createScheduledVisit(
    studyId: string,
    input: CreateScheduledVisitInput,
    userId: string,
  ): Promise<ScheduledVisit> {
    const authorizedStudy =
      await this.studiesService.assertTeamStudyWriteAccess(studyId, userId);

    return this.database.transaction(async (client) => {
      const studyResult = await client.query<LockedStudyRow>(
        `SELECT status, data_fim::text AS "endDate",
                id_pesquisador::text AS "researcherId"
         FROM estudos
         WHERE id_estudo = $1
         FOR SHARE`,
        [studyId],
      );
      const study = studyResult.rows[0];
      if (!study) throw new NotFoundException('Estudo não encontrado.');
      if (study.researcherId !== authorizedStudy.researcherId) {
        throw new ForbiddenException(
          'O responsável pelo estudo foi alterado durante a operação.',
        );
      }
      if (study.status === 'encerrado') {
        throw domainBadRequest(
          'STUDY_CLOSED',
          'Não é possível alterar um estudo encerrado.',
        );
      }
      if (
        userId !== authorizedStudy.researcherId &&
        study.status !== 'recrutamento' &&
        study.status !== 'execução'
      ) {
        throw new ForbiddenException(
          'O Coordenador só pode alterar estudos em recrutamento ou execução.',
        );
      }

      const participationResult = await client.query<ParticipationRow>(
        `SELECT p.status, p.data_inclusao::text AS "includedAt"
         FROM participacoes_estudo p
         JOIN candidatos c ON c.id_candidato = p.id_candidato
         WHERE p.id_participacao = $1 AND c.id_estudo = $2
         FOR UPDATE OF p`,
        [input.participationId, studyId],
      );
      const participation = participationResult.rows[0];
      if (!participation) {
        throw new NotFoundException(
          'Participante não encontrado neste estudo.',
        );
      }
      if (participation.status !== 'Ativo') {
        throw domainBadRequest(
          'PARTICIPATION_NOT_ACTIVE',
          'Somente participantes ativos podem ter visitas agendadas.',
        );
      }

      const plannedVisitResult = await client.query<{ id: string }>(
        `SELECT id_visita_prevista::text AS id
         FROM visitas_previstas
         WHERE id_visita_prevista = $1 AND id_estudo = $2
         FOR SHARE`,
        [input.plannedVisitId, studyId],
      );
      if (!plannedVisitResult.rows[0]) {
        throw new NotFoundException(
          'Visita prevista não encontrada neste estudo.',
        );
      }

      const dateRange = await client.query<{ withinRange: boolean }>(
        `SELECT (
           ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
             BETWEEN $2::date AND $3::date
         ) AS "withinRange"`,
        [input.scheduledAt, participation.includedAt, study.endDate],
      );
      if (!dateRange.rows[0]?.withinRange) {
        throw domainBadRequest(
          'SCHEDULE_OUT_OF_RANGE',
          'A data agendada deve estar entre a inclusão do participante e o término do estudo.',
        );
      }

      const duplicate = await client.query(
        `SELECT 1
         FROM visitas
         WHERE id_participacao = $1
           AND id_visita_prevista = $2
           AND status IN ('Agendada', 'Realizada')
         LIMIT 1`,
        [input.participationId, input.plannedVisitId],
      );
      if (duplicate.rowCount) {
        throw new ConflictException({
          statusCode: 409,
          message:
            'Esta visita prevista já está agendada ou realizada para o participante.',
          error: 'Conflict',
          code: 'VISIT_ALREADY_SCHEDULED',
        });
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO visitas (id_participacao, id_visita_prevista, data_agendada, observacao, status)
         VALUES ($1, $2, $3::timestamptz, $4, 'Agendada')
         RETURNING id_visita::text AS id`,
        [
          input.participationId,
          input.plannedVisitId,
          input.scheduledAt,
          input.observation ?? null,
        ],
      );
      const scheduledVisitId = inserted.rows[0]?.id;
      if (!scheduledVisitId)
        throw new Error(
          'O banco não retornou o identificador da visita agendada.',
        );

      const created = await this.findScheduledVisit(
        client,
        studyId,
        scheduledVisitId,
      );
      if (!created) throw new Error('O banco não retornou a visita agendada.');
      return created;
    });
  }

  async listScheduledVisits(
    studyId: string,
    query: ListScheduledVisitsQuery,
    userId: string,
  ): Promise<ScheduledVisit[]> {
    await this.studiesService.assertTeamStudyReadAccess(
      studyId,
      userId,
      'visitas agendadas',
    );
    this.validateDateRange(query.from, query.to);

    if (query.participationId) {
      const participation = await this.database.query(
        `SELECT 1
         FROM participacoes_estudo p
         JOIN candidatos c ON c.id_candidato = p.id_candidato
         WHERE p.id_participacao = $1 AND c.id_estudo = $2`,
        [query.participationId, studyId],
      );
      if (!participation.rowCount) {
        throw new NotFoundException(
          'Participante não encontrado neste estudo.',
        );
      }
    }

    const values: unknown[] = [studyId];
    const conditions = ['pv.id_estudo = $1', 'c.id_estudo = $1'];
    const addFilter = (sql: (parameter: string) => string, value: unknown) => {
      values.push(value);
      conditions.push(sql(`$${values.length}`));
    };
    if (query.participationId) {
      addFilter(
        (parameter) => `v.id_participacao = ${parameter}`,
        query.participationId,
      );
    }
    if (query.status) {
      addFilter((parameter) => `v.status = ${parameter}`, query.status);
    }
    if (query.from) {
      addFilter(
        (parameter) =>
          `(v.data_agendada AT TIME ZONE 'America/Sao_Paulo')::date >= ${parameter}::date`,
        query.from,
      );
    }
    if (query.to) {
      addFilter(
        (parameter) =>
          `(v.data_agendada AT TIME ZONE 'America/Sao_Paulo')::date <= ${parameter}::date`,
        query.to,
      );
    }

    const { rows } = await this.database.query<ScheduledVisitRow>(
      `SELECT ${SCHEDULED_VISIT_COLUMNS}
       FROM visitas v
       JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
       JOIN candidatos c ON c.id_candidato = p.id_candidato
       JOIN visitas_previstas pv ON pv.id_visita_prevista = v.id_visita_prevista
       WHERE ${conditions.join(' AND ')}
       ORDER BY v.data_agendada, v.id_visita`,
      values,
    );
    return rows.map(toScheduledVisit);
  }

  async updateScheduledVisitStatus(
    studyId: string,
    scheduledVisitId: string,
    input: UpdateScheduledVisitStatusInput,
    userId: string,
  ): Promise<ScheduledVisit> {
    const authorizedStudy =
      await this.studiesService.assertTeamStudyWriteAccess(studyId, userId);

    return this.database.transaction(async (client) => {
      const studyResult = await client.query<LockedStudyRow>(
        `SELECT status, data_fim::text AS "endDate",
                id_pesquisador::text AS "researcherId"
         FROM estudos
         WHERE id_estudo = $1
         FOR SHARE`,
        [studyId],
      );
      const study = studyResult.rows[0];
      if (!study) throw new NotFoundException('Estudo não encontrado.');
      if (study.researcherId !== authorizedStudy.researcherId) {
        throw new ForbiddenException(
          'O responsável pelo estudo foi alterado durante a operação.',
        );
      }
      if (study.status === 'encerrado') {
        throw domainBadRequest(
          'STUDY_CLOSED',
          'Não é possível alterar um estudo encerrado.',
        );
      }
      if (
        userId !== authorizedStudy.researcherId &&
        study.status !== 'recrutamento' &&
        study.status !== 'execução'
      ) {
        throw new ForbiddenException(
          'O Coordenador só pode alterar estudos em recrutamento ou execução.',
        );
      }

      const visitLookup = await client.query<ScheduledVisitLockRow>(
        `SELECT v.id_participacao::text AS "participationId", v.status
         FROM visitas v
         JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
         JOIN candidatos c ON c.id_candidato = p.id_candidato
         JOIN visitas_previstas pv ON pv.id_visita_prevista = v.id_visita_prevista
         WHERE v.id_visita = $1
           AND c.id_estudo = $2
           AND pv.id_estudo = $2`,
        [scheduledVisitId, studyId],
      );
      const visitReference = visitLookup.rows[0];
      if (!visitReference) {
        throw new NotFoundException(
          'Visita agendada não encontrada neste estudo.',
        );
      }

      const participationResult = await client.query<ParticipationRow>(
        `SELECT status, data_inclusao::text AS "includedAt"
         FROM participacoes_estudo
         WHERE id_participacao = $1
         FOR UPDATE`,
        [visitReference.participationId],
      );
      const participation = participationResult.rows[0];
      if (!participation) {
        throw new NotFoundException(
          'Visita agendada não encontrada neste estudo.',
        );
      }
      if (participation.status !== 'Ativo') {
        throw domainBadRequest(
          'PARTICIPATION_NOT_ACTIVE',
          'Somente visitas de participantes ativos podem ser atualizadas.',
        );
      }

      const lockedVisitResult = await client.query<ScheduledVisitStatusRow>(
        `SELECT v.status
         FROM visitas v
         JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
         JOIN candidatos c ON c.id_candidato = p.id_candidato
         JOIN visitas_previstas pv ON pv.id_visita_prevista = v.id_visita_prevista
         WHERE v.id_visita = $1
           AND c.id_estudo = $2
           AND pv.id_estudo = $2
         FOR UPDATE OF v`,
        [scheduledVisitId, studyId],
      );
      const visit = lockedVisitResult.rows[0];
      if (!visit) {
        throw new NotFoundException(
          'Visita agendada não encontrada neste estudo.',
        );
      }
      if (visit.status !== 'Agendada') {
        throw domainBadRequest(
          'VISIT_STATUS_FINAL',
          `Transição de "${visit.status}" para "${input.status}" não permitida.`,
        );
      }

      if (input.status === 'Realizada') {
        const validRealizedAt = await client.query<{ valid: boolean }>(
          `SELECT (
             $1::timestamptz <= clock_timestamp()
             AND ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
           ) AS valid`,
          [input.realizedAt, participation.includedAt],
        );
        if (!validRealizedAt.rows[0]?.valid) {
          throw domainBadRequest(
            'REALIZED_AT_INVALID',
            'A data de realização é inválida.',
          );
        }
      }

      const update = await client.query<{ id: string }>(
        `UPDATE visitas
         SET status = $3,
             data_realizacao = $4::timestamptz,
             observacao = CASE WHEN $5::boolean THEN $6::text ELSE observacao END
         WHERE id_visita = $1
           AND id_participacao = $2
           AND status = 'Agendada'
         RETURNING id_visita::text AS id`,
        [
          scheduledVisitId,
          visitReference.participationId,
          input.status satisfies ScheduledVisitFinalStatus,
          input.realizedAt ?? null,
          input.observation !== undefined,
          input.observation ?? null,
        ],
      );
      if (!update.rows[0]) {
        const currentVisit = await client.query<ScheduledVisitStatusRow>(
          `SELECT status FROM visitas WHERE id_visita = $1`,
          [scheduledVisitId],
        );
        const currentStatus = currentVisit.rows[0]?.status;
        if (!currentStatus) {
          throw new NotFoundException(
            'Visita agendada não encontrada neste estudo.',
          );
        }
        throw domainBadRequest(
          'VISIT_STATUS_FINAL',
          `Transição de "${currentStatus}" para "${input.status}" não permitida.`,
        );
      }

      const updated = await this.findScheduledVisit(
        client,
        studyId,
        scheduledVisitId,
      );
      if (!updated)
        throw new Error('O banco não retornou a visita agendada atualizada.');
      return updated;
    });
  }

  async getScheduledVisitResults(
    studyId: string,
    scheduledVisitId: string,
    userId: string,
  ): Promise<ScheduledVisitResults> {
    await this.studiesService.assertTeamStudyReadAccess(
      studyId,
      userId,
      'resultados de avaliações',
    );

    const visitResult = await this.database.query<AssessmentVisitRow>(
      `SELECT v.id_visita::text AS id,
              v.id_visita_prevista::text AS "plannedVisitId",
              v.status
       FROM visitas v
       JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
       JOIN candidatos c ON c.id_candidato = p.id_candidato
       JOIN visitas_previstas pv ON pv.id_visita_prevista = v.id_visita_prevista
       WHERE v.id_visita = $1
         AND c.id_estudo = $2
         AND pv.id_estudo = $2`,
      [scheduledVisitId, studyId],
    );
    const visit = visitResult.rows[0];
    if (!visit) {
      throw new NotFoundException(
        'Visita agendada não encontrada neste estudo.',
      );
    }

    const activitiesResult =
      await this.database.query<AssessmentActivityResultRow>(
        `SELECT a.id_atividade::text AS "activityId",
                a.nome AS name,
                a.tipo AS type,
                a.descricao AS description,
                r.id_resultado::text AS "resultId",
                r.valor_ficticio AS value,
                r.unidade AS unit,
                r.observacao AS observation,
                r.registrado_em AS "registeredAt",
                r.id_registrado_por::text AS "registrarId"
         FROM atividades_visita a
         LEFT JOIN resultados_avaliacao r
           ON r.id_atividade = a.id_atividade
          AND r.id_visita = $1
         WHERE a.id_visita_prevista = $2
         ORDER BY a.ordem, a.id_atividade`,
        [scheduledVisitId, visit.plannedVisitId],
      );

    const activities: ScheduledVisitActivityResult[] =
      activitiesResult.rows.map((row) => ({
        activityId: row.activityId,
        name: row.name,
        type: row.type,
        description: row.description,
        result: resultFromActivityRow(row, scheduledVisitId),
      }));

    return {
      scheduledVisitId: visit.id,
      plannedVisitId: visit.plannedVisitId,
      status: visit.status,
      activities,
    };
  }

  async registerAssessmentResult(
    studyId: string,
    scheduledVisitId: string,
    input: RegisterAssessmentResultInput,
    userId: string,
  ): Promise<AssessmentResult> {
    const authorizedStudy =
      await this.studiesService.assertTeamStudyWriteAccess(studyId, userId);
    if (authorizedStudy.researcherId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este estudo.',
      );
    }

    return this.database.transaction(async (client) => {
      const studyResult = await client.query<LockedStudyRow>(
        `SELECT status, data_fim::text AS "endDate",
                id_pesquisador::text AS "researcherId"
         FROM estudos
         WHERE id_estudo = $1
         FOR SHARE`,
        [studyId],
      );
      const study = studyResult.rows[0];
      if (!study) throw new NotFoundException('Estudo não encontrado.');
      if (study.researcherId !== authorizedStudy.researcherId) {
        throw new ForbiddenException(
          'O responsável pelo estudo foi alterado durante a operação.',
        );
      }
      if (study.status === 'encerrado') {
        throw domainBadRequest(
          'STUDY_CLOSED',
          'Não é possível alterar um estudo encerrado.',
        );
      }

      const visitResult = await client.query<AssessmentVisitRow>(
        `SELECT v.id_visita::text AS id,
                v.id_visita_prevista::text AS "plannedVisitId",
                v.status
         FROM visitas v
         JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
         JOIN candidatos c ON c.id_candidato = p.id_candidato
         JOIN visitas_previstas pv ON pv.id_visita_prevista = v.id_visita_prevista
         WHERE v.id_visita = $1
           AND c.id_estudo = $2
           AND pv.id_estudo = $2
         FOR UPDATE OF v`,
        [scheduledVisitId, studyId],
      );
      const visit = visitResult.rows[0];
      if (!visit) {
        throw new NotFoundException(
          'Visita agendada não encontrada neste estudo.',
        );
      }
      if (visit.status !== 'Realizada') {
        throw domainBadRequest(
          'VISIT_NOT_REALIZED',
          'Registre resultados somente em visitas realizadas.',
        );
      }

      const activityResult = await client.query<{ id: string }>(
        `SELECT id_atividade::text AS id
         FROM atividades_visita
         WHERE id_atividade = $1
           AND id_visita_prevista = $2
         FOR KEY SHARE`,
        [input.activityId, visit.plannedVisitId],
      );
      if (!activityResult.rows[0]) {
        throw domainBadRequest(
          'ACTIVITY_NOT_IN_VISIT',
          'A atividade não pertence à visita prevista agendada.',
        );
      }

      const result = await client.query<AssessmentResultRow>(
        `INSERT INTO resultados_avaliacao
           (id_visita, id_atividade, id_registrado_por, valor_ficticio, unidade, observacao)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ON CONSTRAINT resultados_visita_atividade_unico DO NOTHING
         RETURNING id_resultado::text AS id,
                   id_visita::text AS "scheduledVisitId",
                   id_atividade::text AS "activityId",
                   valor_ficticio AS value,
                   unidade AS unit,
                   observacao AS observation,
                   registrado_em AS "registeredAt",
                   id_registrado_por::text AS "registrarId"`,
        [
          scheduledVisitId,
          input.activityId,
          userId,
          input.value,
          input.unit ?? null,
          input.observation ?? null,
        ],
      );
      if (!result.rows[0]) {
        throw new ConflictException({
          statusCode: 409,
          message:
            'Já existe resultado registrado para esta atividade nesta visita.',
          error: 'Conflict',
          code: 'RESULT_ALREADY_REGISTERED',
        });
      }
      return toAssessmentResult(result.rows[0]);
    });
  }

  private validateDateRange(from?: string, to?: string): void {
    if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
      throw new BadRequestException(
        'Informe datas válidas no formato YYYY-MM-DD.',
      );
    }
    if (from && to && from > to) {
      throw new BadRequestException('O período informado é inválido.');
    }
  }

  private async findScheduledVisit(
    client: PoolClient,
    studyId: string,
    scheduledVisitId: string,
  ): Promise<ScheduledVisit | undefined> {
    const { rows } = await client.query<ScheduledVisitRow>(
      `SELECT ${SCHEDULED_VISIT_COLUMNS}
       FROM visitas v
       JOIN participacoes_estudo p ON p.id_participacao = v.id_participacao
       JOIN candidatos c ON c.id_candidato = p.id_candidato
       JOIN visitas_previstas pv ON pv.id_visita_prevista = v.id_visita_prevista
       WHERE pv.id_estudo = $1
         AND c.id_estudo = $1
         AND v.id_visita = $2
       LIMIT 1`,
      [studyId, scheduledVisitId],
    );
    return rows[0] ? toScheduledVisit(rows[0]) : undefined;
  }
}
