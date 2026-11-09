import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { CriteriaApiError, type EligibilityCriterion } from '../studies/criteriaApi';
import { candidatesApi, EligibilityUnavailableError } from './candidatesApi';

export type CandidateEligibilityCriteriaState =
  | { status: 'loading' }
  | { status: 'ready'; criteria: readonly EligibilityCriterion[] }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string; retryable: boolean };

export function useCandidateEligibilityCriteria(studyId: string) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ studyId: string; state: CandidateEligibilityCriteriaState }>({
    studyId, state: { status: 'loading' },
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ studyId, state: { status: 'loading' } });
    void candidatesApi.listEligibilityCriteria(request, studyId, controller.signal)
      .then((criteria) => {
        if (!controller.signal.aborted) setResult({ studyId, state: {
          status: 'ready', criteria: criteria.filter((criterion) => criterion.active && criterion.studyId === studyId),
        } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const state: CandidateEligibilityCriteriaState = error instanceof EligibilityUnavailableError
          ? { status: 'unavailable', message: error.message }
          : { status: 'error',
            message: error instanceof CriteriaApiError ? error.message : 'Não foi possível carregar os critérios. Tente novamente.',
            retryable: error instanceof CriteriaApiError ? error.retryable : true };
        setResult({ studyId, state });
      });
    return () => controller.abort();
  }, [request, studyId, attempt]);

  const state: CandidateEligibilityCriteriaState = result.studyId === studyId ? result.state : { status: 'loading' };
  return { state, reload: () => setAttempt((current) => current + 1) };
}
