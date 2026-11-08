import type { AuthenticatedRequest } from '../studies/studiesApi';
import type { criteriaApi, CriterionType } from '../studies/criteriaApi';
import { CandidateSubmissionError, type CandidateInput } from './candidateValidation';

export const CANDIDATE_STATUSES = ['Novo', 'Em avaliação', 'Elegível', 'Inelegível', 'Incluído', 'Desistiu'] as const;
export type CandidateStatus = typeof CANDIDATE_STATUSES[number];

/** Modelo da listagem; título obtido das opções de estudos, nunca inferido do candidato. */
export interface Candidate {
  id: string;
  name: string;
  studyId: string;
  studyTitle: string;
  /** registeredAt conforme retornado pela API (data ou timestamp). */
  enrollmentDate: string;
  status: CandidateStatus;
}

export type CandidatesByStudyQuery = (
  request: AuthenticatedRequest,
  studyId: string,
  signal?: AbortSignal,
) => Promise<readonly Candidate[]>;

export class CandidatesApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export interface CandidateResponse {
  id: string;
  studyId: string;
  name: string;
  email: string | null;
  status: CandidateStatus;
  registeredAt: string;
}

/** Adaptação explícita: IDs e status do modelo local não pertencem ao corpo HTTP. */
export function toCreateCandidateBody(input: CandidateInput): { name: string; email?: string } {
  const email = input.email?.trim();
  return { name: input.nome.trim(), ...(email ? { email } : {}) };
}

function isCandidateResponse(value: unknown): value is CandidateResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CandidateResponse>;
  return typeof candidate.id === 'string' && candidate.id.length > 0
    && typeof candidate.studyId === 'string' && typeof candidate.name === 'string'
    && (candidate.email === null || typeof candidate.email === 'string')
    && CANDIDATE_STATUSES.includes(candidate.status as CandidateStatus)
    && typeof candidate.registeredAt === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(candidate.registeredAt);
}

async function recruitmentRequest(request: AuthenticatedRequest, studyId: string, options: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await request(`/studies/${encodeURIComponent(studyId)}/candidates`, options);
  } catch {
    throw new CandidatesApiError('Não foi possível comunicar com o servidor. Tente novamente.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Dados inválidos. Confira os campos e a situação do estudo.',
      401: 'Sua sessão expirou ou é inválida. Entre novamente para continuar.',
      403: 'Você não tem permissão para cadastrar ou consultar candidatos neste estudo.',
      404: 'Estudo não encontrado. Atualize os estudos disponíveis.',
      409: 'O cadastro foi recusado por conflito. Consulte a listagem antes de tentar novamente.',
    };
    const message = (body as { message?: unknown } | null)?.message;
    const detail = typeof message === 'string' ? message
      : Array.isArray(message) ? message.filter((item): item is string => typeof item === 'string').join(' ') : '';
    throw new CandidatesApiError(response.status === 400 && detail.trim() ? detail
      : messages[response.status] ?? 'Não foi possível concluir a solicitação. Tente novamente.', response.status);
  }
  return body;
}

const listByStudy: CandidatesByStudyQuery = async (request, studyId, signal) => {
  const body = await recruitmentRequest(request, studyId, { signal });
  if (!Array.isArray(body) || !body.every(isCandidateResponse)) {
    throw new CandidatesApiError('O servidor retornou uma listagem de candidatos inválida. Tente novamente.');
  }
  return body.filter((candidate) => candidate.studyId === studyId).map((candidate) => ({
    id: candidate.id, studyId: candidate.studyId, name: candidate.name,
    studyTitle: '', enrollmentDate: candidate.registeredAt, status: candidate.status,
  }));
};

const create = async (request: AuthenticatedRequest, input: CandidateInput): Promise<void> => {
  try {
    await recruitmentRequest(request, input.id_estudo, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toCreateCandidateBody(input)),
    });
  } catch (error) {
    if (error instanceof CandidatesApiError) throw new CandidateSubmissionError(error.message);
    throw error;
  }
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

/** Mesmo contrato de status no cadastro, na listagem e na avaliação. */
export type CandidateRecruitmentStatus = CandidateStatus;

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

export const candidatesApi = { create, listByStudy, listEligibilityCriteria, getEligibilityAssessment, registerEligibilityAssessment, getConsent, registerConsent, include };
