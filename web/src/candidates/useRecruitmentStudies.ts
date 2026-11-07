import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { studiesApi } from '../studies/studiesApi';
import type { CandidateStudiesState } from './CandidateForm';

/** Compartilha a consulta autorizada entre a página e o modal de candidatos. */
export function useRecruitmentStudies(): CandidateStudiesState {
  const { request } = useAuth();
  const [studies, setStudies] = useState<CandidateStudiesState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setStudies({ status: 'loading' });
    void studiesApi.listAvailableForRecruitment(request, controller.signal)
      .then((options) => { if (!controller.signal.aborted) setStudies({ status: 'ready', options }); })
      .catch(() => { if (!controller.signal.aborted) setStudies({ status: 'error' }); });
    return () => controller.abort();
  }, [request]);

  return studies;
}
