import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { participantsApi, ParticipantsApiError, type ParticipantHistory } from './participantsApi';
import { formatDateTime } from './apiErrors';

type State = { key: string; status: 'loading' } | { key: string; status: 'error'; message: string } | { key: string; status: 'ready'; history: ParticipantHistory };

/** Histórico de visitas e avaliações da participação selecionada (GET …/participants/:id/history). */
export function ParticipantHistoryPanel({ studyId, participationId, version = 0 }: { studyId: string; participationId: string; version?: number }) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const key = `${studyId}:${participationId}:${version}:${attempt}`;
  const [state, setState] = useState<State>({ key, status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ key, status: 'loading' });
    participantsApi.getHistory(request, studyId, participationId, controller.signal)
      .then((history) => { if (!controller.signal.aborted) setState({ key, status: 'ready', history }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ key, status: 'error', message: error instanceof ParticipantsApiError ? error.message : 'Não foi possível consultar o histórico. Tente novamente.' });
      });
    return () => controller.abort();
  }, [request, studyId, participationId, key]);

  // Nunca mostra o histórico de outra participação durante a troca.
  const current: State = state.key === key ? state : { key, status: 'loading' };
  return <section className="participant-history" aria-labelledby="participant-history-title">
    <h3 id="participant-history-title">Histórico de visitas</h3>
    {current.status === 'loading' && <p role="status" aria-busy="true" className="coord-help-copy">Consultando histórico…</p>}
    {current.status === 'error' && <div role="alert" className="form-error"><p>{current.message}</p>
      <button type="button" className="button button-outline" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></div>}
    {current.status === 'ready' && (current.history.visits.length === 0
      ? <p role="status" className="coord-help-copy">Nenhuma visita registrada para este participante.</p>
      : <ol className="participant-history-list">
        {current.history.visits.map((visit) => <li key={visit.id}>
          <strong>{visit.plannedVisitName}</strong> · {formatDateTime(visit.scheduledAt)} · <span>{visit.status}</span>
          {visit.realizedAt && <span> · realizada em {formatDateTime(visit.realizedAt)}</span>}
          {visit.observation && <p className="coord-help-copy">{visit.observation}</p>}
          {visit.results.length > 0 && <ul aria-label={`Resultados de ${visit.plannedVisitName}`}>
            {visit.results.map((result) => <li key={result.id}>{result.activityName}: {result.value}{result.unit ? ` ${result.unit}` : ''}</li>)}
          </ul>}
        </li>)}
      </ol>)}
  </section>;
}
