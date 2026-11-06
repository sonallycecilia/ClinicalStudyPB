import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { candidatesApi, CandidatesQueryUnavailableError, type Candidate } from './candidatesApi';

export type StudyCandidatesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; candidates: readonly Candidate[] }
  | { status: 'error'; message: string }
  | { status: 'unavailable'; message: string };

export function useStudyCandidates(studyId: string) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ studyId: string; state: StudyCandidatesState }>({
    studyId: '', state: { status: 'idle' },
  });

  useEffect(() => {
    if (!studyId) {
      setResult({ studyId: '', state: { status: 'idle' } });
      return;
    }
    const controller = new AbortController();
    setResult({ studyId, state: { status: 'loading' } });
    void candidatesApi.listByStudy(request, studyId, controller.signal)
      .then((candidates) => {
        if (!controller.signal.aborted) setResult({ studyId, state: {
          status: 'ready', candidates: candidates.filter((candidate) => candidate.studyId === studyId),
        } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ studyId, state: error instanceof CandidatesQueryUnavailableError
          ? { status: 'unavailable', message: error.message }
          : { status: 'error', message: 'Não foi possível consultar os candidatos deste estudo. Tente novamente.' },
        });
      });
    return () => controller.abort();
  }, [request, studyId, attempt]);

  // Nunca exibe o resultado anterior durante a troca de estudo.
  const state: StudyCandidatesState = !studyId ? { status: 'idle' }
    : result.studyId !== studyId ? { status: 'loading' } : result.state;
  return { state, reload: () => setAttempt((current) => current + 1) };
}
