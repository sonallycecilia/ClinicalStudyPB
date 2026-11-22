import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ParticipantHistoryPanel } from './ParticipantHistoryPanel';
import { scheduledVisitsApi } from './scheduledVisitsApi';
import { ScheduledVisitStatusBadge } from './StudyScheduledVisitsSection';

/** Histórico por participante nos detalhes do estudo do Pesquisador (RF15, E01 + E07). */
export function StudyParticipantHistorySection({ studyId }: { studyId: string }) {
  const { request } = useAuth();
  const loadParticipants = useCallback((id: string, signal: AbortSignal) => scheduledVisitsApi.listParticipants(request, id, signal), [request]);
  const loadHistory = useCallback((id: string, participationId: string, signal: AbortSignal) => scheduledVisitsApi.getHistory(request, id, participationId, signal), [request]);

  return <section className="study-detail-section study-criteria-section study-history-section" aria-labelledby="study-history-title">
    <div className="study-visits-heading"><h2 id="study-history-title">Histórico por participante</h2></div>
    <p className="study-criteria-description">Visitas, datas, situações e resultados registrados de cada participante, em ordem cronológica. Inclui participantes retirados.</p>
    <ParticipantHistoryPanel studyId={studyId} loadParticipants={loadParticipants} loadHistory={loadHistory}
      renderStatus={(status) => <ScheduledVisitStatusBadge status={status} />} />
  </section>;
}
