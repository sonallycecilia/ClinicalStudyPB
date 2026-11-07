import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { studiesApi } from '../studies/studiesApi';
import type { CandidateStudyOption } from './candidateValidation';

type ListStudiesState =
  | { status: 'loading' }
  | { status: 'ready'; options: readonly CandidateStudyOption[] }
  | { status: 'error' };

/** As opções atuais são parciais: /studies é restrito ao Pesquisador.
 * Substituir a consulta quando existir uma listagem abrangente para o Coordenador.
 * Independente da consulta do modal, que deve continuar restrita a recrutamento.
 */
export function useCandidateListStudies() {
  const { request } = useAuth();
  const [state, setState] = useState<ListStudiesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void studiesApi.listAvailableForRecruitment(request, controller.signal)
      .then((options) => { if (!controller.signal.aborted) setState({ status: 'ready', options }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error' }); });
    return () => controller.abort();
  }, [request, attempt]);

  return { state, reload: () => setAttempt((current) => current + 1) };
}
