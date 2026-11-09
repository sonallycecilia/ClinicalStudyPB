import type { AuthenticatedRequest } from '../studies/studiesApi';
import type { criteriaApi, CriterionType } from '../studies/criteriaApi';

export type CandidateStatus = 'Pendente de avaliação' | 'Participante ativo' | 'Consentimento pendente' | 'Não elegível';

/** Modelo da listagem. O futuro adaptador deve mapear a resposta da API para este formato. */
export interface Candidate {
  id: string;
  name: string;
  studyId: string;
  studyTitle: string;
  /** Data de inscrição no formato YYYY-MM-DD. */
  enrollmentDate: string;
  status: CandidateStatus;
}

export type CandidatesByStudyQuery = (
  request: AuthenticatedRequest,
  studyId: string,
  signal?: AbortSignal,
) => Promise<readonly Candidate[]>;

export class CandidatesQueryUnavailableError extends Error {
  constructor() {
    super('A consulta de candidatos por estudo ainda não está disponível. Não é possível verificar os candidatos cadastrados.');
  }
}

// A listagem já existe no backend, mas exige Pesquisador proprietário do estudo.
// Integrar quando houver autorização para o Coordenador, sem retornar dados fictícios.
const listByStudy: CandidatesByStudyQuery = async () => {
  throw new CandidatesQueryUnavailableError();
};

export type EligibilityCriterionResult = 'Atende' | 'Não atende' | 'Pendente';

export interface CriterionEvaluationInput {
  criterionId: string;
  result: EligibilityCriterionResult;
  observation?: string | null;
}

export interface EvaluateCandidateInput {
  evaluations: CriterionEvaluationInput[];
}

/** Status devolvido pelo backend; não equivale aos rótulos da listagem atual. */
export type CandidateRecruitmentStatus = 'Novo' | 'Em avaliação' | 'Elegível' | 'Inelegível' | 'Incluído' | 'Desistiu';

export interface CandidateEligibilityAssessment {
  candidateId: string;
  studyId: string;
  status: CandidateRecruitmentStatus;
  evaluations: (CriterionEvaluationInput & {
    id: string;
    criterionType: CriterionType;
    criterionDescription: string;
    observation: string | null;
    evaluatorId: string;
    evaluatedAt: string;
  })[];
}

export const ELIGIBILITY_UNAVAILABLE_MESSAGE = 'A avaliação de elegibilidade ainda não está disponível para o Coordenador. A consulta e o registro dependem da liberação de acesso ao estudo. Nenhuma avaliação será salva.';

export class EligibilityUnavailableError extends Error {
  constructor() {
    super(ELIGIBILITY_UNAVAILABLE_MESSAGE);
    this.name = 'EligibilityUnavailableError';
  }
}

// Contrato preparado para S2-W2-06. Os três métodos permanecem indisponíveis:
// os endpoints e os serviços exigem o Pesquisador proprietário do estudo.
// Após a autorização, listEligibilityCriteria poderá delegar a criteriaApi.list.
const listEligibilityCriteria: typeof criteriaApi.list = async () => {
  throw new EligibilityUnavailableError();
};

// GET /studies/:studyId/candidates/:candidateId/eligibility-assessments
const getEligibilityAssessment: (
  request: AuthenticatedRequest, studyId: string, candidateId: string, signal?: AbortSignal,
) => Promise<CandidateEligibilityAssessment> = async () => {
  throw new EligibilityUnavailableError();
};

// POST na mesma rota, com { evaluations }, sem enviar status calculado no frontend.
const registerEligibilityAssessment: (
  request: AuthenticatedRequest, studyId: string, candidateId: string, input: EvaluateCandidateInput,
) => Promise<CandidateEligibilityAssessment> = async () => {
  throw new EligibilityUnavailableError();
};

export const candidatesApi = { listByStudy, listEligibilityCriteria, getEligibilityAssessment, registerEligibilityAssessment };
