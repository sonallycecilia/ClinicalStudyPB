export type StudyStatus = 'Planejado' | 'Em andamento';
export type StudyKind = 'Estudo observacional' | 'Estudo longitudinal';
export type StudySymbol = 'moon' | 'heart' | 'activity';

/** Registro devolvido pela API ao frontend. */
export interface Study {
  id: string;
  code: string;
  title: string;
  objective: string;
  researcherId: string;
  researcher: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  participantLimit: number;
  participantsLinked: number;
  status: StudyStatus;
  kind: StudyKind;
  symbol: StudySymbol;
}

/** Nunca aceitar researcherId do cliente: o responsável vem do token. */
export interface StudyInput {
  title: string;
  objective: string;
  startDate: string;
  endDate: string;
  participantLimit: number;
  participantsLinked: number;
}
