import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import type {
  CreateCriterionInput,
  CriterionType,
  EligibilityCriterion,
  UpdateCriterionInput,
} from './criteria.types.js';

interface CriterionRow extends QueryResultRow {
  id: string;
  studyId: string;
  type: CriterionType;
  description: string;
  active: boolean;
}

const CRITERION_COLUMNS = `
  id_criterio::text AS id,
  id_estudo::text AS "studyId",
  tipo AS type,
  descricao AS description,
  ativo AS active`;

const CRITERION_TYPES: CriterionType[] = ['Inclusão', 'Exclusão'];

@Injectable()
export class CriteriaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly studiesService: StudiesService,
  ) {}

  async list(studyId: string, researcherId: string): Promise<EligibilityCriterion[]> {
    await this.assertStudyAccess(studyId, researcherId);
    const { rows } = await this.database.query<CriterionRow>(
      `SELECT ${CRITERION_COLUMNS}
       FROM criterios_elegibilidade
       WHERE id_estudo = $1
       ORDER BY tipo, descricao, id_criterio`,
      [studyId],
    );
    return rows;
  }

  async find(studyId: string, criterionId: string, researcherId: string): Promise<EligibilityCriterion> {
    await this.assertStudyAccess(studyId, researcherId);
    const criterion = await this.findForStudy(studyId, criterionId);
    if (!criterion) throw new NotFoundException('Critério não encontrado neste estudo.');
    return criterion;
  }

  async create(
    studyId: string,
    input: CreateCriterionInput,
    researcherId: string,
  ): Promise<EligibilityCriterion> {
    await this.assertStudyAccess(studyId, researcherId);
    const data = this.validateCreateInput(input);
    const { rows } = await this.database.query<CriterionRow>(
      `INSERT INTO criterios_elegibilidade (id_estudo, tipo, descricao, ativo)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CRITERION_COLUMNS}`,
      [studyId, data.type, data.description, data.active],
    );
    if (!rows[0]) throw new Error('O banco não retornou o critério cadastrado.');
    return rows[0];
  }

  async update(
    studyId: string,
    criterionId: string,
    input: UpdateCriterionInput,
    researcherId: string,
  ): Promise<EligibilityCriterion> {
    await this.assertStudyAccess(studyId, researcherId);
    const data = this.validateUpdateInput(input);
    const current = await this.findForStudy(studyId, criterionId);
    if (!current) throw new NotFoundException('Critério não encontrado neste estudo.');
    const { rows } = await this.database.query<CriterionRow>(
      `UPDATE criterios_elegibilidade
       SET tipo = $3, descricao = $4, ativo = $5
       WHERE id_estudo = $1 AND id_criterio = $2
       RETURNING ${CRITERION_COLUMNS}`,
      [
        studyId,
        criterionId,
        data.type ?? current.type,
        data.description ?? current.description,
        data.active ?? current.active,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Critério não encontrado neste estudo.');
    return rows[0];
  }

  private async assertStudyAccess(studyId: string, researcherId: string): Promise<void> {
    // O estudo aninhado define o escopo do critério e valida sua propriedade.
    await this.studiesService.findById(studyId, researcherId);
  }

  private async findForStudy(studyId: string, criterionId: string): Promise<EligibilityCriterion | undefined> {
    const { rows } = await this.database.query<CriterionRow>(
      `SELECT ${CRITERION_COLUMNS}
       FROM criterios_elegibilidade
       WHERE id_estudo = $1 AND id_criterio = $2`,
      [studyId, criterionId],
    );
    return rows[0];
  }

  private validateCreateInput(input: CreateCriterionInput): Required<CreateCriterionInput> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Informe os dados do critério.');
    }
    this.rejectUnknownFields(input);
    if (!CRITERION_TYPES.includes(input.type)) {
      throw new BadRequestException('O tipo deve ser Inclusão ou Exclusão.');
    }
    const description = this.validateDescription(input.description);
    if (input.active !== undefined && typeof input.active !== 'boolean') {
      throw new BadRequestException('O campo ativo deve ser booleano.');
    }
    return { type: input.type, description, active: input.active ?? true };
  }

  private validateUpdateInput(input: UpdateCriterionInput): UpdateCriterionInput {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
      throw new BadRequestException('Informe ao menos um campo para alterar.');
    }
    this.rejectUnknownFields(input);
    if (input.type !== undefined && !CRITERION_TYPES.includes(input.type)) {
      throw new BadRequestException('O tipo deve ser Inclusão ou Exclusão.');
    }
    const description = input.description === undefined ? undefined : this.validateDescription(input.description);
    if (input.active !== undefined && typeof input.active !== 'boolean') {
      throw new BadRequestException('O campo ativo deve ser booleano.');
    }
    return { type: input.type, description, active: input.active };
  }

  private validateDescription(description: unknown): string {
    if (typeof description !== 'string' || description.trim().length === 0 || description.trim().length > 2000) {
      throw new BadRequestException('A descrição deve ter entre 1 e 2000 caracteres.');
    }
    return description.trim();
  }

  private rejectUnknownFields(input: object): void {
    const allowedFields = new Set(['type', 'description', 'active']);
    if (Object.keys(input).some((field) => !allowedFields.has(field))) {
      throw new BadRequestException('A solicitação contém campos não permitidos.');
    }
  }
}
