import type { ParticipantStudy } from '../../src/studies/participantStudiesApi';

// Contract E09 input only. Application code must never import this module.
export const studies: ParticipantStudy[] = [{
  participationId: 'participation-1', participationStatus: 'Ativo',
  includedAt: '2026-11-06', withdrawnAt: null,
  study: {
    id: 'study-1', code: 'EST-001', title: 'Qualidade do sono',
    objective: 'Investigar padrões de sono dos participantes.', status: 'execução',
    startDate: '2026-04-01', endDate: '2026-11-28', researcher: 'Marina Costa',
  },
}];
