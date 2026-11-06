import type { StudyStatus } from './studiesApi';

/** Os quatro estados oficiais, na ordem do ciclo de vida do estudo (valores idênticos aos do backend). */
export const STUDY_STATUSES: readonly StudyStatus[] = ['planejamento', 'recrutamento', 'execução', 'encerrado'];

export const STUDY_STATUS_LABELS: Record<StudyStatus, string> = {
  planejamento: 'Planejamento',
  recrutamento: 'Recrutamento',
  execução: 'Execução',
  encerrado: 'Encerrado',
};

export const STUDY_STATUS_CLASSES: Record<StudyStatus, string> = {
  planejamento: 'status-planejamento',
  recrutamento: 'status-recrutamento',
  execução: 'status-execucao',
  encerrado: 'status-encerrado',
};

export const UNKNOWN_STATUS_LABEL = 'Estado desconhecido';

/**
 * Espelha as transições aceitas por PATCH /studies/:id/status (StudiesService.transitionStatus):
 * planejamento → recrutamento → execução → encerrado. A API não expõe um endpoint com as transições
 * permitidas e continua sendo a autoridade final; este mapa só define as opções oferecidas na interface.
 */
const NEXT_STATUS: Partial<Record<StudyStatus, StudyStatus>> = {
  planejamento: 'recrutamento',
  recrutamento: 'execução',
  execução: 'encerrado',
};

export function isStudyStatus(value: unknown): value is StudyStatus {
  return typeof value === 'string' && (STUDY_STATUSES as readonly string[]).includes(value);
}

/** Estados para os quais o estudo pode avançar; vazio para estudo encerrado ou estado desconhecido. */
export function allowedStatusTransitions(status: unknown): StudyStatus[] {
  if (!isStudyStatus(status)) return [];
  const next = NEXT_STATUS[status];
  return next ? [next] : [];
}

export function studyStatusLabel(status: unknown): string {
  return isStudyStatus(status) ? STUDY_STATUS_LABELS[status] : UNKNOWN_STATUS_LABEL;
}
