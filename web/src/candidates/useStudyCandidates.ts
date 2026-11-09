import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { candidatesApi, CandidatesApiError, type Candidate } from './candidatesApi';

export type StudyCandidatesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; candidates: readonly Candidate[]; failures?: readonly { studyId: string; message: string }[] }
  | { status: 'error'; message: string };

/** null aguarda os estudos autorizados; [] representa uma consulta válida sem estudos. */
export function useStudyCandidates(studyIds: readonly string[] | null) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const scope = studyIds === null ? null : JSON.stringify([...new Set(studyIds)].sort());
  const [result, setResult] = useState<{ scope: string | null; state: StudyCandidatesState }>({
    scope: null, state: { status: 'idle' },
  });

  useEffect(() => {
    if (scope === null) {
      setResult({ scope, state: { status: 'idle' } });
      return;
    }
    const controller = new AbortController();
    const ids = JSON.parse(scope) as string[];
    setResult({ scope, state: { status: 'loading' } });
    void Promise.allSettled(ids.map((id) => candidatesApi.listByStudy(request, id, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        const candidates = new Map<string, Candidate>();
        const failures: { studyId: string; message: string }[] = [];
        results.forEach((result, index) => {
          const studyId = ids[index];
          if (result.status === 'fulfilled') {
            for (const candidate of result.value) {
              if (candidate.studyId === studyId) candidates.set(`${studyId}:${candidate.id}`, candidate);
            }
          } else {
            const error: unknown = result.reason;
            failures.push({ studyId, message: error instanceof CandidatesApiError ? error.message
              : 'Não foi possível consultar os candidatos deste estudo. Tente novamente.' });
          }
        });
        setResult({ scope, state: ids.length > 0 && failures.length === ids.length
          ? { status: 'error', message: [...new Set(failures.map(({ message }) => message))].join(' ') }
          : { status: 'ready', candidates: [...candidates.values()], failures } });
      });
    return () => controller.abort();
  }, [request, scope, attempt]);

  // Nunca exibe o resultado anterior durante a troca de estudo.
  const state: StudyCandidatesState = scope === null ? { status: 'idle' }
    : result.scope !== scope ? { status: 'loading' } : result.state;
  return { state, reload: () => setAttempt((current) => current + 1) };
}
