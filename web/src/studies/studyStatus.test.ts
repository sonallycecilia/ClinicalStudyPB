import { describe, expect, it } from 'vitest';
import {
  STUDY_STATUSES, STUDY_STATUS_CLASSES, STUDY_STATUS_LABELS, UNKNOWN_STATUS_LABEL,
  allowedStatusTransitions, isStudyStatus, studyStatusLabel,
} from './studyStatus';

describe('estados do estudo', () => {
  it('reconhece somente os quatro estados oficiais, com os valores do backend', () => {
    expect(STUDY_STATUSES).toEqual(['planejamento', 'recrutamento', 'execução', 'encerrado']);
    for (const status of STUDY_STATUSES) expect(isStudyStatus(status)).toBe(true);
    for (const legacy of ['Planejamento', 'execucao', 'em andamento', 'ativo', 'concluido', '', null, undefined, 3]) {
      expect(isStudyStatus(legacy)).toBe(false);
    }
  });

  it('apresenta nomes em português e uma classe visual própria para cada estado', () => {
    expect(STUDY_STATUS_LABELS).toEqual({
      planejamento: 'Planejamento', recrutamento: 'Recrutamento', execução: 'Execução', encerrado: 'Encerrado',
    });
    expect(new Set(Object.values(STUDY_STATUS_CLASSES)).size).toBe(4);
    expect(studyStatusLabel('arquivado')).toBe(UNKNOWN_STATUS_LABEL);
  });

  it('oferece apenas a próxima etapa definida pelo backend', () => {
    expect(allowedStatusTransitions('planejamento')).toEqual(['recrutamento']);
    expect(allowedStatusTransitions('recrutamento')).toEqual(['execução']);
    expect(allowedStatusTransitions('execução')).toEqual(['encerrado']);
  });

  it('não oferece transições para estudo encerrado nem para estado desconhecido', () => {
    expect(allowedStatusTransitions('encerrado')).toEqual([]);
    expect(allowedStatusTransitions('arquivado')).toEqual([]);
    expect(allowedStatusTransitions(undefined)).toEqual([]);
  });
});
