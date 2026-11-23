import type { Participant } from './participantsApi';
import type { StudyParticipantsState } from './useStudyParticipants';
import { ParticipantSummary } from './ParticipantSummary';

/** Estados de carregamento, vazio, falha e sucesso da lista de participantes incluídos. */
export function ParticipantList({ state, studyTitle, selectedId, onSelect, onRetry }: {
  state: StudyParticipantsState;
  studyTitle?: string;
  selectedId?: string;
  onSelect?: (participant: Participant) => void;
  onRetry: () => void;
}) {
  if (state.status === 'idle') return <p role="status" className="coord-help-copy">Selecione um estudo para ver os participantes incluídos.</p>;
  if (state.status === 'loading') return <p role="status" aria-busy="true" className="coord-help-copy">Consultando participantes…</p>;
  if (state.status === 'error') return <div role="alert" className="form-error"><p>{state.message}</p>
    <button type="button" className="button button-outline" onClick={onRetry}>Tentar novamente</button></div>;
  if (state.participants.length === 0) return <p role="status" className="coord-help-copy">Nenhum participante incluído neste estudo.</p>;
  return <ul className="participant-list" aria-label="Participantes incluídos">
    {state.participants.map((participant) => <li key={participant.participationId}>
      <ParticipantSummary participant={participant} studyTitle={studyTitle} selected={participant.participationId === selectedId} onSelect={onSelect} />
    </li>)}
  </ul>;
}
