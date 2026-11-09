import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { candidatesApi, ConsentApiError, ConsentUnavailableError, type CandidateConsent } from './candidatesApi';

export type CandidateConsentState =
  | { status: 'loading' }
  | { status: 'ready'; consent: CandidateConsent }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

export function useCandidateConsent(studyId: string, candidateId: string) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ studyId: string; candidateId: string; state: CandidateConsentState }>({
    studyId, candidateId, state: { status: 'loading' },
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ studyId, candidateId, state: { status: 'loading' } });
    void candidatesApi.getConsent(request, studyId, candidateId, controller.signal)
      .then((consent) => {
        if (controller.signal.aborted) return;
        if (consent.studyId !== studyId || consent.candidateId !== candidateId) {
          throw new Error('Consentimento de outro candidato ou estudo.');
        }
        setResult({ studyId, candidateId, state: { status: 'ready', consent } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ studyId, candidateId, state: error instanceof ConsentUnavailableError
          ? { status: 'unavailable', message: error.message }
          : { status: 'error', message: error instanceof ConsentApiError ? error.message : 'Não foi possível consultar o consentimento simulado. Tente novamente.' },
        });
      });
    return () => controller.abort();
  }, [request, studyId, candidateId, attempt]);

  const state: CandidateConsentState = result.studyId === studyId && result.candidateId === candidateId
    ? result.state : { status: 'loading' };
  return { state, reload: () => setAttempt((current) => current + 1) };
}
