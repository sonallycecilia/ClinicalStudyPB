import type { Visit } from '../../src/visits/participantVisitsApi';

// Test input only. Application code must never import this module.
const base: Visit = {
  id: '1', participationId: 'test-participation', studyId: 'test-study',
  studyTitle: 'Estudo de teste', plannedVisitName: 'Visita A', plannedVisitOrder: 1,
  scheduledAt: '2026-11-29T12:30:00.000Z', status: 'Agendada', realizedAt: null,
  code: 'TEST-1', location: 'Local de teste', preparation: 'Orientação de teste.',
};
export const visits: Visit[] = [
  base,
  { ...base, id: '2', plannedVisitName: 'Visita B', scheduledAt: '2026-12-15T17:00:00.000Z' },
  { ...base, id: '3', plannedVisitName: 'Visita C', scheduledAt: '2026-11-01T13:00:00.000Z', status: 'Realizada', realizedAt: '2026-11-01T13:00:00.000Z', preparation: undefined },
  { ...base, id: '4', plannedVisitName: 'Visita D', scheduledAt: '2026-10-01T11:30:00.000Z', status: 'Ausente', preparation: undefined },
  { ...base, id: '5', plannedVisitName: 'Visita E', scheduledAt: '2026-10-15T14:00:00.000Z', status: 'Cancelada', preparation: undefined },
];
