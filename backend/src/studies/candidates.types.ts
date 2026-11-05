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
