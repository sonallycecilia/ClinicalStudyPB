import type { AuthenticatedRequest } from '../studies/studiesApi';

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

// A API de candidatos ainda não existe. Integrar aqui quando houver contrato e
// autorização para o Coordenador, sem inventar uma rota ou retornar uma lista vazia.
const listByStudy: CandidatesByStudyQuery = async () => {
  throw new CandidatesQueryUnavailableError();
};

export const candidatesApi = { listByStudy };
