import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ParticipantHistoryPanel } from './ParticipantHistoryPanel';
import { scheduledVisitsApi, type IncludedParticipant, type RegisterWithdrawalInput } from './scheduledVisitsApi';
import { ScheduledVisitStatusBadge } from './StudyScheduledVisitsSection';

/**
 * Histórico por participante nos detalhes do estudo do Pesquisador (RF15, E01 + E07),
 * com o registro da retirada (RF16, E08) enquanto o estudo não está encerrado.
 */
export function StudyParticipantHistorySection({ studyId, readOnly = false }: { studyId: string; readOnly?: boolean }) {
  const { request } = useAuth();
  const loadParticipants = useCallback((id: string, signal: AbortSignal) => scheduledVisitsApi.listParticipants(request, id, signal), [request]);
  const loadHistory = useCallback((id: string, participationId: string, signal: AbortSignal) => scheduledVisitsApi.getHistory(request, id, participationId, signal), [request]);
  const withdraw = useCallback((participant: IncludedParticipant, input: RegisterWithdrawalInput, signal: AbortSignal) =>
    scheduledVisitsApi.registerWithdrawal(request, participant, input, signal), [request]);

  return <section className="study-detail-section study-criteria-section study-history-section" aria-labelledby="study-history-title">
    <div className="study-visits-heading"><h2 id="study-history-title">Histórico por participante</h2></div>
    <p className="study-criteria-description">{readOnly
      ? 'Estudo encerrado: o histórico pode ser consultado, mas não é possível registrar retiradas.'
      : 'Visitas, datas, situações e resultados registrados de cada participante, em ordem cronológica. Inclui participantes retirados e permite registrar a retirada de participantes ativos.'}</p>
    <ParticipantHistoryPanel studyId={studyId} loadParticipants={loadParticipants} loadHistory={loadHistory}
      onWithdraw={readOnly ? undefined : withdraw}
      renderStatus={(status) => <ScheduledVisitStatusBadge status={status} />} />
  </section>;
}
