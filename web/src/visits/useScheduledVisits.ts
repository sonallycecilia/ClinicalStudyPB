import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { scheduledVisitsApi, ScheduledVisitsApiError, SCHEDULED_VISITS_LOAD_ERROR, type ScheduledVisit } from './scheduledVisitsApi';

export type ScheduledVisitsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; visits: ScheduledVisit[] };

/** Agenda (E03) de um estudo por vez, como prevê o contrato. */
export function useScheduledVisits(studyId: string) {
  const { request } = useAuth();
  const [state, setState] = useState<ScheduledVisitsState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!studyId) { setState({ status: 'idle' }); return; }
    const controller = new AbortController();
    setState({ status: 'loading' });
    scheduledVisitsApi.listScheduledVisits(request, studyId, controller.signal)
      .then((visits) => { if (!controller.signal.aborted) setState({ status: 'ready', visits }); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: reason instanceof ScheduledVisitsApiError ? reason.message : SCHEDULED_VISITS_LOAD_ERROR });
      });
    return () => controller.abort();
  }, [request, studyId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  /** Substitui a linha pela versão confirmada pela API. */
  const replace = useCallback((visit: ScheduledVisit) => setState((current) => current.status === 'ready'
    ? { status: 'ready', visits: current.visits.map((item) => item.id === visit.id ? visit : item) }
    : current), []);

  return { state, reload, replace };
}
