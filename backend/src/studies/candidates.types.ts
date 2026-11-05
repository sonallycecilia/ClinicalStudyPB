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
