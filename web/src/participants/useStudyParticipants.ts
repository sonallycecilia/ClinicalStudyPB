import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { participantsApi, ParticipantsApiError, PARTICIPANTS_ERROR_MESSAGE, type Participant, type ParticipantsByStudyQuery } from './participantsApi';

export type StudyParticipantsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; participants: readonly Participant[] }
  | { status: 'error'; message: string };

/** null/'' aguarda a escolha do estudo. Nunca exibe a lista do estudo anterior durante a troca. */
export function useStudyParticipants(studyId: string | null, query: ParticipantsByStudyQuery = participantsApi.listByStudy) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ studyId: string | null; state: StudyParticipantsState }>({ studyId: null, state: { status: 'idle' } });
  const key = studyId || null;

  useEffect(() => {
    if (key === null) { setResult({ studyId: null, state: { status: 'idle' } }); return; }
    const controller = new AbortController();
    setResult({ studyId: key, state: { status: 'loading' } });
    query(request, key, controller.signal)
      .then((participants) => {
        if (!controller.signal.aborted) setResult({ studyId: key, state: { status: 'ready', participants: participants.filter((item) => item.studyId === key) } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ studyId: key, state: { status: 'error', message: error instanceof ParticipantsApiError ? error.message : PARTICIPANTS_ERROR_MESSAGE } });
      });
    return () => controller.abort();
  }, [request, key, query, attempt]);

  const state: StudyParticipantsState = key === null ? { status: 'idle' }
    : result.studyId !== key ? { status: 'loading' } : result.state;
  return { state, reload: () => setAttempt((current) => current + 1) };
}
