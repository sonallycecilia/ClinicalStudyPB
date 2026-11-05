import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudiesService } from './studies.service.js';
import type { Candidate, CreateCandidateInput } from './candidates.types.js';

interface CandidateRow extends QueryResultRow {
  id: string;
  studyId: string;
  name: string;
  email: string | null;
  status: Candidate['status'];
  registeredAt: string;
}

const CANDIDATE_COLUMNS = `
  id_candidato::text AS id,
  id_estudo::text AS "studyId",
  nome AS name,
  email AS email,
  status_recrutamento AS status,
  cadastrado_em::text AS "registeredAt"`;

@Injectable()
export class CandidatesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly studiesService: StudiesService,
  ) {}

  async list(studyId: string, researcherId: string): Promise<Candidate[]> {
    await this.studiesService.findById(studyId, researcherId);
    const { rows } = await this.database.query<CandidateRow>(
      `SELECT ${CANDIDATE_COLUMNS}
       FROM candidatos
       WHERE id_estudo = $1
       ORDER BY cadastrado_em, id_candidato`,
      [studyId],
    );
    return rows;
  }

  async create(
    studyId: string,
    input: CreateCandidateInput,
    researcherId: string,
  ): Promise<Candidate> {
    await this.studiesService.assertStudyCanBeModified(studyId, researcherId);
    const { rows } = await this.database.query<CandidateRow>(
      `INSERT INTO candidatos (id_estudo, nome, email)
       VALUES ($1, $2, $3)
       RETURNING ${CANDIDATE_COLUMNS}`,
      [studyId, input.name, input.email ?? null],
    );
    if (!rows[0]) throw new Error('O banco não retornou o candidato cadastrado.');
    return rows[0];
  }
}
