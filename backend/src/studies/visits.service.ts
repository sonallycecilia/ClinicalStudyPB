import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import type {
  CreatePlannedVisitInput,
  CreateVisitActivityInput,
  PlannedVisit,
  VisitActivity,
} from './visits.types.js';

interface PlannedVisitRow extends QueryResultRow {
  id: string;
  studyId: string;
  name: string;
  order: number;
  intervalDays: number | null;
  description: string | null;
}

interface VisitActivityRow extends QueryResultRow {
  id: string;
  visitId: string;
  name: string;
  description: string | null;
  type: string;
}

const PLANNED_VISIT_COLUMNS = `
  id_visita_prevista::text AS id,
  id_estudo::text AS "studyId",
  nome AS name,
  ordem AS "order",
  intervalo_dias AS "intervalDays",
  descricao AS description`;

const VISIT_ACTIVITY_COLUMNS = `
  id_atividade::text AS id,
  id_visita_prevista::text AS "visitId",
  nome AS name,
  descricao AS description,
  tipo AS type`;

@Injectable()
export class VisitsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly studiesService: StudiesService,
  ) {}

  async list(studyId: string, researcherId: string): Promise<PlannedVisit[]> {
    await this.assertStudyAccess(studyId, researcherId);
    const { rows } = await this.database.query<PlannedVisitRow>(
      `SELECT ${PLANNED_VISIT_COLUMNS}
       FROM visitas_previstas
       WHERE id_estudo = $1
       ORDER BY ordem, id_visita_prevista`,
      [studyId],
    );
    return rows;
  }

  async find(studyId: string, visitId: string, researcherId: string): Promise<PlannedVisit> {
    await this.assertStudyAccess(studyId, researcherId);
    const visit = await this.findForStudy(studyId, visitId);
    if (!visit) throw new NotFoundException('Visita prevista não encontrada neste estudo.');
    return visit;
  }

  async create(
    studyId: string,
    input: CreatePlannedVisitInput,
    researcherId: string,
  ): Promise<PlannedVisit> {
    await this.assertStudyAccess(studyId, researcherId);
    try {
      const { rows } = await this.database.query<PlannedVisitRow>(
        `INSERT INTO visitas_previstas (id_estudo, nome, ordem, intervalo_dias, descricao)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PLANNED_VISIT_COLUMNS}`,
        [studyId, input.name, input.order, input.intervalDays ?? null, input.description ?? null],
      );
      if (!rows[0]) throw new Error('O banco não retornou a visita prevista cadastrada.');
      return rows[0];
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        error.constraint === 'visitas_previstas_ordem_unica'
      ) {
        throw new ConflictException('Já existe uma visita com essa ordem neste estudo.');
      }
      throw error;
    }
  }

  async listActivities(
    studyId: string,
    visitId: string,
    researcherId: string,
  ): Promise<VisitActivity[]> {
    await this.find(studyId, visitId, researcherId);
    const { rows } = await this.database.query<VisitActivityRow>(
      `SELECT ${VISIT_ACTIVITY_COLUMNS}
       FROM atividades_visita
       WHERE id_visita_prevista = $1
       ORDER BY nome, id_atividade`,
      [visitId],
    );
    return rows;
  }

  async createActivity(
    studyId: string,
    visitId: string,
    input: CreateVisitActivityInput,
    researcherId: string,
  ): Promise<VisitActivity> {
    await this.find(studyId, visitId, researcherId);
    const { rows } = await this.database.query<VisitActivityRow>(
      `INSERT INTO atividades_visita (id_visita_prevista, nome, descricao, tipo)
       VALUES ($1, $2, $3, $4)
       RETURNING ${VISIT_ACTIVITY_COLUMNS}`,
      [visitId, input.name, input.description ?? null, input.type],
    );
    if (!rows[0]) throw new Error('O banco não retornou a atividade cadastrada.');
    return rows[0];
  }

  private async assertStudyAccess(studyId: string, researcherId: string): Promise<void> {
    await this.studiesService.findById(studyId, researcherId);
  }

  private async findForStudy(studyId: string, visitId: string): Promise<PlannedVisit | undefined> {
    const { rows } = await this.database.query<PlannedVisitRow>(
      `SELECT ${PLANNED_VISIT_COLUMNS}
       FROM visitas_previstas
       WHERE id_estudo = $1 AND id_visita_prevista = $2`,
      [studyId, visitId],
    );
    return rows[0];
  }

}
