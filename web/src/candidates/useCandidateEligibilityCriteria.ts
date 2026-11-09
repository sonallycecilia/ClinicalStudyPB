import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { CriteriaApiError, type EligibilityCriterion } from '../studies/criteriaApi';
import { candidatesApi, EligibilityApiError, type CandidateEligibilityAssessment } from './candidatesApi';

export type CandidateEligibilityCriteriaState =
  | { status: 'loading' }
  | { status: 'ready'; criteria: readonly EligibilityCriterion[]; assessment: CandidateEligibilityAssessment }
  | { status: 'error'; message: string; retryable: boolean };

export function useCandidateEligibilityCriteria(studyId: string, candidateId: string) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ studyId: string; candidateId: string; state: CandidateEligibilityCriteriaState }>({
    studyId, candidateId, state: { status: 'loading' },
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ studyId, candidateId, state: { status: 'loading' } });
    void Promise.all([
      candidatesApi.listEligibilityCriteria(request, studyId, controller.signal),
      candidatesApi.getEligibilityAssessment(request, studyId, candidateId, controller.signal),
    ])
      .then(([criteria, assessment]) => {
        if (!controller.signal.aborted) setResult({ studyId, candidateId, state: {
          status: 'ready', criteria: criteria.filter((criterion) => criterion.active && criterion.studyId === studyId), assessment,
        } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const state: CandidateEligibilityCriteriaState = { status: 'error',
          message: error instanceof CriteriaApiError || error instanceof EligibilityApiError ? error.message : 'Não foi possível carregar os critérios e a avaliação. Tente novamente.',
          retryable: error instanceof CriteriaApiError ? error.retryable
            : error instanceof EligibilityApiError ? !error.status || error.status >= 500 : true };
        setResult({ studyId, candidateId, state });
      });
    return () => controller.abort();
  }, [request, studyId, candidateId, attempt]);

  const state: CandidateEligibilityCriteriaState = result.studyId === studyId && result.candidateId === candidateId ? result.state : { status: 'loading' };
  return { state, reload: () => setAttempt((current) => current + 1) };
}
