export type CandidateRecruitmentStatus =
  | 'Novo'
  | 'Em avaliação'
  | 'Elegível'
  | 'Inelegível'
  | 'Incluído'
  | 'Desistiu';

export interface Candidate {
  id: string;
  studyId: string;
  name: string;
  email: string | null;
  status: CandidateRecruitmentStatus;
  registeredAt: string;
}

export interface CreateCandidateInput {
  name: string;
  email?: string | null;
}

export type EligibilityCriterionResult = 'Atende' | 'Não atende' | 'Pendente';

export interface CriterionEvaluationInput {
  criterionId: string;
  result: EligibilityCriterionResult;
  observation?: string | null;
}

export interface EvaluateCandidateInput {
  evaluations: CriterionEvaluationInput[];
}

export interface EligibilityEvaluation {
  id: string;
  criterionId: string;
  criterionType: 'Inclusão' | 'Exclusão';
  criterionDescription: string;
  result: EligibilityCriterionResult;
  observation: string | null;
  evaluatorId: string;
  evaluatedAt: string;
}

export interface CandidateEligibilityAssessment {
  candidateId: string;
  studyId: string;
  status: CandidateRecruitmentStatus;
  evaluations: EligibilityEvaluation[];
}

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

export interface CandidateInclusion {
  participationId: string;
  candidateId: string;
  studyId: string;
  includedAt: string;
  participationStatus: 'Ativo';
  participantsLinked: number;
  participantLimit: number;
}

export const CANDIDATE_INCLUSION_ERROR_CODES = [
  'CANDIDATE_INELIGIBLE', 'ELIGIBILITY_PENDING', 'CONSENT_MISSING',
  'CONSENT_NOT_GRANTED', 'STUDY_FULL', 'CANDIDATE_ALREADY_INCLUDED',
  'INCLUSION_REQUIREMENTS_NOT_MET',
] as const;

export type CandidateInclusionErrorCode = typeof CANDIDATE_INCLUSION_ERROR_CODES[number];
