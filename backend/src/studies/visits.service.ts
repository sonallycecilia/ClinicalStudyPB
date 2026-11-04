import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    const data = this.validateCreateInput(input);
    try {
      const { rows } = await this.database.query<PlannedVisitRow>(
        `INSERT INTO visitas_previstas (id_estudo, nome, ordem, intervalo_dias, descricao)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PLANNED_VISIT_COLUMNS}`,
        [studyId, data.name, data.order, data.intervalDays, data.description],
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
    const data = this.validateActivityInput(input);
    await this.find(studyId, visitId, researcherId);
    const { rows } = await this.database.query<VisitActivityRow>(
      `INSERT INTO atividades_visita (id_visita_prevista, nome, descricao, tipo)
       VALUES ($1, $2, $3, $4)
       RETURNING ${VISIT_ACTIVITY_COLUMNS}`,
      [visitId, data.name, data.description, data.type],
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

  private validateCreateInput(input: CreatePlannedVisitInput): Required<CreatePlannedVisitInput> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Informe os dados da visita prevista.');
    }
    this.rejectUnknownFields(input, ['name', 'order', 'intervalDays', 'description']);
    const name = this.validateText(input.name, 'O nome da visita', 150);
    if (!Number.isInteger(input.order) || input.order < 1) {
      throw new BadRequestException('A ordem da visita deve ser um número inteiro maior que zero.');
    }
    if (input.intervalDays !== undefined && input.intervalDays !== null &&
      (!Number.isInteger(input.intervalDays) || input.intervalDays < 0)) {
      throw new BadRequestException('O intervalo em dias deve ser um número inteiro maior ou igual a zero.');
    }
    const description = this.validateOptionalDescription(input.description);
    return {
      name,
      order: input.order,
      intervalDays: input.intervalDays ?? null,
      description,
    };
  }

  private validateActivityInput(input: CreateVisitActivityInput): Required<CreateVisitActivityInput> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Informe os dados da atividade.');
    }
    this.rejectUnknownFields(input, ['name', 'description', 'type']);
    const name = this.validateText(input.name, 'O nome da atividade', 150);
    const type = this.validateText(input.type, 'O tipo da atividade', 50);
    return {
      name,
      description: this.validateOptionalDescription(input.description),
      type,
    };
  }

  private validateText(value: unknown, label: string, maxLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
      throw new BadRequestException(`${label} deve ter entre 1 e ${maxLength} caracteres.`);
    }
    return value.trim();
  }

  private validateOptionalDescription(description: unknown): string | null {
    if (description === undefined || description === null) return null;
    if (typeof description !== 'string' || description.trim().length > 2000) {
      throw new BadRequestException('A descrição deve ter no máximo 2000 caracteres.');
    }
    return description.trim() || null;
  }

  private rejectUnknownFields(input: object, allowedFields: string[]): void {
    const allowed = new Set(allowedFields);
    if (Object.keys(input).some((field) => !allowed.has(field))) {
      throw new BadRequestException('A solicitação contém campos não permitidos.');
    }
  }
}
