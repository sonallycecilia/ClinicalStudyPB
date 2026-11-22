import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { CandidateStudyOption } from '../candidates/candidateValidation';
import { saoPauloToday, scheduledVisitsApi, ScheduledVisitsApiError, type ScheduledVisit } from './scheduledVisitsApi';

export const UPCOMING_LOAD_ERROR = 'Não foi possível carregar as próximas visitas. Tente novamente.';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface UpcomingVisit extends ScheduledVisit {
  studyTitle: string;
}

export type UpcomingVisitsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; visits: UpcomingVisit[]; activeParticipants: number; nextSevenDays: number };

/**
 * Painel do Coordenador: visitas `Agendada` com instante futuro (E03 com `status` e `from`)
 * e participações ativas (E01) dos estudos informados, consultados estudo a estudo como prevê o contrato.
 */
export function useUpcomingVisits(studies: readonly CandidateStudyOption[] | null, now: () => Date = () => new Date()) {
  const { request } = useAuth();
  const [state, setState] = useState<UpcomingVisitsState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const key = studies?.map((study) => `${study.id}:${study.title}`).join('|') ?? null;

  useEffect(() => {
    if (!studies) { setState({ status: 'idle' }); return; }
    const controller = new AbortController();
    const current = now();
    const from = saoPauloToday(current);
    setState({ status: 'loading' });
    Promise.all(studies.map(async (study) => {
      const [visits, participants] = await Promise.all([
        scheduledVisitsApi.listScheduledVisits(request, study.id, controller.signal, { status: 'Agendada', from }),
        scheduledVisitsApi.listActiveParticipants(request, study.id, controller.signal),
      ]);
      return { visits: visits.map((visit) => ({ ...visit, studyTitle: study.title })), active: participants.length };
    }))
      .then((perStudy) => {
        if (controller.signal.aborted) return;
        // `from` é um dia civil: as visitas de hoje com horário já passado não são "próximas".
        const visits = perStudy.flatMap((item) => item.visits)
          .filter((visit) => Date.parse(visit.scheduledAt) > current.getTime())
          .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
        setState({
          status: 'ready',
          visits,
          activeParticipants: perStudy.reduce((total, item) => total + item.active, 0),
          nextSevenDays: visits.filter((visit) => Date.parse(visit.scheduledAt) - current.getTime() <= WEEK_MS).length,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: reason instanceof ScheduledVisitsApiError ? reason.message : UPCOMING_LOAD_ERROR });
      });
    return () => controller.abort();
    // `studies` é representado por `key`, para não recarregar a cada nova referência do mesmo conteúdo.
  }, [request, key, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, reload };
}
