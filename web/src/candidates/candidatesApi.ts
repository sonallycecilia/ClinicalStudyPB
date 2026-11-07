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

export type CandidateConsentStatus = 'Registrado' | 'Recusado' | 'Revogado';

export interface RegisterCandidateConsentInput {
  status: CandidateConsentStatus;
  termVersion: string;
  observation?: string | null;
}

export interface CandidateConsent {
  candidateId: string;
  studyId: string;
  status: CandidateConsentStatus | null;
  termVersion: string | null;
  registeredAt: string | null;
  registrarId: string | null;
  observation: string | null;
}

export const CONSENT_UNAVAILABLE_MESSAGE = 'A consulta e o registro de consentimento simulado ainda não estão disponíveis para o Coordenador. Dependem da liberação de acesso ao estudo e da integração com a API. Nenhum consentimento será salvo.';

export class ConsentUnavailableError extends Error {
  constructor() {
    super(CONSENT_UNAVAILABLE_MESSAGE);
    this.name = 'ConsentUnavailableError';
  }
}

// Contratos do GET e POST /studies/:studyId/candidates/:candidateId/consents.
// Não chamar as rotas enquanto exigirem o Pesquisador proprietário do estudo.
const getConsent: (
  request: AuthenticatedRequest, studyId: string, candidateId: string, signal?: AbortSignal,
) => Promise<CandidateConsent> = async () => {
  throw new ConsentUnavailableError();
};

const registerConsent: (
  request: AuthenticatedRequest, studyId: string, candidateId: string, input: RegisterCandidateConsentInput,
) => Promise<CandidateConsent> = async () => {
  throw new ConsentUnavailableError();
};

export interface CandidateInclusion {
  participationId: string;
  candidateId: string;
  studyId: string;
  includedAt: string;
  participationStatus: 'Ativo';
  participantsLinked: number;
  participantLimit: number;
}

export const INCLUSION_UNAVAILABLE_MESSAGE = 'A inclusão de participantes ainda não está disponível para o Coordenador. Depende da liberação de acesso ao estudo e da integração da consulta de candidatos. Nenhuma inclusão será realizada.';
export const INVALID_INCLUSION_MESSAGE = 'O servidor não retornou uma confirmação válida da inclusão. Consulte os candidatos antes de tentar novamente.';

export class CandidateInclusionError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'CandidateInclusionError';
  }
}

/** Valida também a identidade do resultado, inclusive quando a operação é injetada. */
export function isCandidateInclusion(value: unknown, studyId: string, candidateId: string): value is CandidateInclusion {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<CandidateInclusion>;
  const date = typeof result.includedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(result.includedAt)
    ? new Date(`${result.includedAt}T00:00:00Z`) : null;
  return typeof result.participationId === 'string' && result.participationId.trim().length > 0
    && result.candidateId === candidateId && result.studyId === studyId
    && date !== null && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === result.includedAt
    && result.participationStatus === 'Ativo'
    && Number.isInteger(result.participantsLinked) && Number.isInteger(result.participantLimit)
    && result.participantsLinked! > 0 && result.participantsLinked! <= result.participantLimit!;
}

// POST sem corpo. Conectar à interface somente após autorização do Coordenador:
// a rota e o serviço atuais exigem o Pesquisador proprietário do estudo.
const include = async (request: AuthenticatedRequest, studyId: string, candidateId: string): Promise<CandidateInclusion> => {
  let response: Response;
  try {
    response = await request(`/studies/${encodeURIComponent(studyId)}/candidates/${encodeURIComponent(candidateId)}/include`, { method: 'POST' });
  } catch {
    throw new CandidateInclusionError('Não foi possível comunicar com o servidor. Nenhum sucesso foi confirmado. Consulte os candidatos antes de tentar novamente.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fallbacks: Record<number, string> = {
      400: 'A inclusão foi recusada. Verifique os requisitos do candidato e a situação do estudo.',
      401: 'Sua sessão expirou ou não está autorizada. Entre novamente para continuar.',
      403: 'Você não tem permissão para incluir participantes neste estudo.',
      404: 'Candidato ou estudo não encontrado. Consulte a lista de candidatos novamente.',
    };
    const message = (body as { message?: unknown } | null)?.message;
    // NestJS não fornece códigos de domínio: preserva o motivo real do 400,
    // sem tentar classificar erros comparando frases ou palavras da mensagem.
    const detail = typeof message === 'string' ? message
      : Array.isArray(message) ? message.filter((item): item is string => typeof item === 'string').join(' ') : '';
    throw new CandidateInclusionError(response.status === 400 && detail.trim() ? detail
      : fallbacks[response.status] ?? 'Não foi possível confirmar a inclusão no servidor. Consulte os candidatos antes de tentar novamente.', response.status);
  }
  if (!isCandidateInclusion(body, studyId, candidateId)) throw new CandidateInclusionError(INVALID_INCLUSION_MESSAGE);
  return body;
};

export const candidatesApi = { listByStudy, listEligibilityCriteria, getEligibilityAssessment, registerEligibilityAssessment, getConsent, registerConsent, include };
