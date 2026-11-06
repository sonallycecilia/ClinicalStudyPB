import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { StudyStatus } from './study.types.js';
import { StudiesService } from './studies.service.js';
import type {
  Candidate,
  CandidateConsent,
  CandidateConsentStatus,
  CandidateEligibilityAssessment,
  CreateCandidateInput,
  EligibilityCriterionResult,
  EvaluateCandidateInput,
  RegisterCandidateConsentInput,
} from './candidates.types.js';

interface CandidateRow extends QueryResultRow {
  id: string;
  studyId: string;
  name: string;
  email: string | null;
  status: Candidate['status'];
  registeredAt: string;
}

interface CriterionRow extends QueryResultRow {
  id: string;
  type: 'Inclusão' | 'Exclusão';
  description: string;
}

interface EligibilityEvaluationRow extends QueryResultRow {
  id: string;
  criterionId: string;
  criterionType: 'Inclusão' | 'Exclusão';
  criterionDescription: string;
  result: EligibilityCriterionResult;
  observation: string | null;
  evaluatorId: string;
  evaluatedAt: string;
}

interface CandidateConsentRow extends QueryResultRow {
  candidateId: string;
  studyId: string;
  status: CandidateConsentStatus | null;
  termVersion: string | null;
  registeredAt: string | null;
  registrarId: string | null;
  observation: string | null;
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

  async registerConsent(
    studyId: string,
    candidateId: string,
    input: RegisterCandidateConsentInput,
    researcherId: string,
  ): Promise<CandidateConsent> {
    await this.studiesService.assertStudyCanBeModified(studyId, researcherId);
    this.validateConsent(input);

    const { rows } = await this.database.query<CandidateConsentRow>(
      `INSERT INTO consentimentos
        (id_candidato, status, versao_termo, id_registrado_por, observacao)
       SELECT c.id_candidato, $3, $4, $5, $6
       FROM candidatos c
       WHERE c.id_estudo = $1 AND c.id_candidato = $2
       RETURNING
         id_candidato::text AS "candidateId",
         $1::text AS "studyId",
         status,
         versao_termo AS "termVersion",
         registrado_em::text AS "registeredAt",
         id_registrado_por::text AS "registrarId",
         observacao AS observation`,
      [studyId, candidateId, input.status, input.termVersion, researcherId, input.observation ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Candidato não encontrado neste estudo.');
    return rows[0];
  }

  async getConsent(
    studyId: string,
    candidateId: string,
    researcherId: string,
  ): Promise<CandidateConsent> {
    await this.studiesService.findById(studyId, researcherId);
    const { rows } = await this.database.query<CandidateConsentRow>(
      `SELECT
         c.id_candidato::text AS "candidateId",
         c.id_estudo::text AS "studyId",
         consent.status,
         consent.versao_termo AS "termVersion",
         consent.registrado_em::text AS "registeredAt",
         consent.id_registrado_por::text AS "registrarId",
         consent.observacao AS observation
       FROM candidatos c
       LEFT JOIN LATERAL (
         SELECT status, versao_termo, registrado_em, id_registrado_por, observacao
         FROM consentimentos
         WHERE id_candidato = c.id_candidato
         ORDER BY registrado_em DESC, id_consentimento DESC
         LIMIT 1
       ) consent ON TRUE
       WHERE c.id_estudo = $1 AND c.id_candidato = $2`,
      [studyId, candidateId],
    );
    if (!rows[0]) throw new NotFoundException('Candidato não encontrado neste estudo.');
    return rows[0];
  }

  async evaluate(
    studyId: string,
    candidateId: string,
    input: EvaluateCandidateInput,
    researcherId: string,
  ): Promise<CandidateEligibilityAssessment> {
    await this.studiesService.assertStudyCanBeModified(studyId, researcherId);
    this.validateEvaluations(input);

    return this.database.transaction(async (client) => {
      const studyResult = await client.query<{ status: StudyStatus }>(
        `SELECT status
         FROM estudos
         WHERE id_estudo = $1 AND id_pesquisador = $2
         FOR UPDATE`,
        [studyId, researcherId],
      );
      if (!studyResult.rows[0]) throw new NotFoundException('Estudo não encontrado.');
      if (studyResult.rows[0].status === StudyStatus.Encerrado) {
        throw new BadRequestException('Não é possível avaliar candidatos em um estudo encerrado.');
      }

      const candidateResult = await client.query<{ status: Candidate['status'] }>(
        `SELECT status_recrutamento AS status
         FROM candidatos
         WHERE id_estudo = $1 AND id_candidato = $2
         FOR UPDATE`,
        [studyId, candidateId],
      );
      if (!candidateResult.rows[0]) {
        throw new NotFoundException('Candidato não encontrado neste estudo.');
      }

      const criteriaResult = await client.query<CriterionRow>(
        `SELECT id_criterio::text AS id, tipo AS type, descricao AS description
         FROM criterios_elegibilidade
         WHERE id_estudo = $1 AND ativo = TRUE
         ORDER BY id_criterio
         FOR SHARE`,
        [studyId],
      );
      const criteriaById = new Map(criteriaResult.rows.map((criterion) => [criterion.id, criterion]));
      if (criteriaById.size === 0) {
        throw new BadRequestException('O estudo não possui critérios ativos para avaliar.');
      }
      if (input.evaluations.length !== criteriaById.size ||
          input.evaluations.some(({ criterionId }) => !criteriaById.has(criterionId))) {
        throw new BadRequestException(
          'Informe exatamente uma avaliação para cada critério ativo do estudo.',
        );
      }

      const resultByCriterion = new Map<string, EligibilityCriterionResult>();
      for (const evaluation of input.evaluations) {
        const criterion = criteriaById.get(evaluation.criterionId);
        if (!criterion) {
          throw new BadRequestException('O critério não pertence a este estudo ou não está ativo.');
        }
        resultByCriterion.set(evaluation.criterionId, evaluation.result);
        await client.query(
          `INSERT INTO avaliacoes_elegibilidade
            (id_candidato, id_criterio, id_avaliador, resultado, observacao)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id_candidato, id_criterio)
           DO UPDATE SET
             id_avaliador = EXCLUDED.id_avaliador,
             resultado = EXCLUDED.resultado,
             observacao = EXCLUDED.observacao,
             avaliado_em = now()`,
          [
            candidateId,
            evaluation.criterionId,
            researcherId,
            evaluation.result,
            evaluation.observation ?? null,
          ],
        );
      }

      const ineligible = criteriaResult.rows.some((criterion) => {
        const result = resultByCriterion.get(criterion.id);
        return criterion.type === 'Inclusão'
          ? result === 'Não atende'
          : result === 'Atende';
      });
      const pending = input.evaluations.some(({ result }) => result === 'Pendente');
      const status: Candidate['status'] = ineligible
        ? 'Inelegível'
        : pending
          ? 'Em avaliação'
          : 'Elegível';

      await client.query(
        `UPDATE candidatos
         SET status_recrutamento = $3
         WHERE id_estudo = $1 AND id_candidato = $2`,
        [studyId, candidateId, status],
      );

      const evaluationsResult = await client.query<EligibilityEvaluationRow>(
        `SELECT
           a.id_avaliacao::text AS id,
           a.id_criterio::text AS "criterionId",
           c.tipo AS "criterionType",
           c.descricao AS "criterionDescription",
           a.resultado AS result,
           a.observacao AS observation,
           a.id_avaliador::text AS "evaluatorId",
           a.avaliado_em::text AS "evaluatedAt"
         FROM avaliacoes_elegibilidade a
         JOIN criterios_elegibilidade c ON c.id_criterio = a.id_criterio
         WHERE a.id_candidato = $1
         ORDER BY c.tipo, c.id_criterio`,
        [candidateId],
      );

      return {
        candidateId,
        studyId,
        status,
        evaluations: evaluationsResult.rows,
      };
    });
  }

  async getEligibilityAssessment(
    studyId: string,
    candidateId: string,
    researcherId: string,
  ): Promise<CandidateEligibilityAssessment> {
    await this.studiesService.findById(studyId, researcherId);
    const candidateResult = await this.database.query<{ status: Candidate['status'] }>(
      `SELECT status_recrutamento AS status
       FROM candidatos
       WHERE id_estudo = $1 AND id_candidato = $2`,
      [studyId, candidateId],
    );
    if (!candidateResult.rows[0]) {
      throw new NotFoundException('Candidato não encontrado neste estudo.');
    }

    const { rows } = await this.database.query<EligibilityEvaluationRow>(
      `SELECT
         a.id_avaliacao::text AS id,
         a.id_criterio::text AS "criterionId",
         c.tipo AS "criterionType",
         c.descricao AS "criterionDescription",
         a.resultado AS result,
         a.observacao AS observation,
         a.id_avaliador::text AS "evaluatorId",
         a.avaliado_em::text AS "evaluatedAt"
       FROM avaliacoes_elegibilidade a
       JOIN criterios_elegibilidade c ON c.id_criterio = a.id_criterio
       WHERE a.id_candidato = $1
       ORDER BY c.tipo, c.id_criterio`,
      [candidateId],
    );
    return {
      candidateId,
      studyId,
      status: candidateResult.rows[0].status,
      evaluations: rows,
    };
  }

  private validateEvaluations(input: EvaluateCandidateInput): void {
    const allowedResults: EligibilityCriterionResult[] = ['Atende', 'Não atende', 'Pendente'];
    if (!input || !Array.isArray(input.evaluations) || input.evaluations.length === 0) {
      throw new BadRequestException('Informe as avaliações dos critérios.');
    }
    const seenCriterionIds = new Set<string>();
    for (const evaluation of input.evaluations) {
      if (!evaluation || typeof evaluation !== 'object' ||
          typeof evaluation.criterionId !== 'string' ||
          !allowedResults.includes(evaluation.result) ||
          (evaluation.observation != null &&
            (typeof evaluation.observation !== 'string' || evaluation.observation.length > 2000))) {
        throw new BadRequestException('Uma ou mais avaliações possuem dados inválidos.');
      }
      if (seenCriterionIds.has(evaluation.criterionId)) {
        throw new BadRequestException('Não informe mais de uma avaliação para o mesmo critério.');
      }
      seenCriterionIds.add(evaluation.criterionId);
    }
  }

  private validateConsent(input: RegisterCandidateConsentInput): void {
    const allowedStatuses: CandidateConsentStatus[] = ['Registrado', 'Recusado', 'Revogado'];
    if (!input || typeof input !== 'object' ||
        !allowedStatuses.includes(input.status) ||
        typeof input.termVersion !== 'string' ||
        input.termVersion.trim().length === 0 ||
        input.termVersion.length > 50 ||
        (input.observation != null &&
          (typeof input.observation !== 'string' || input.observation.length > 2000))) {
      throw new BadRequestException('Informe um estado e uma versão válidos para o termo de consentimento.');
    }
  }
}
