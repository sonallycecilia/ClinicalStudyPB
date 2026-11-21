import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { AuthenticatedRequest } from '../studies/studiesApi';

export type FollowUpStudyStatus = 'recrutamento' | 'execução' | 'encerrado';
/** Estudos que o Coordenador acompanha. Encerrados são somente leitura. */
export interface FollowUpStudy { id: string; title: string; status: FollowUpStudyStatus }

const STATUSES: readonly string[] = ['recrutamento', 'execução', 'encerrado'];

export function isFollowUpStudy(value: unknown): value is FollowUpStudy {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FollowUpStudy>;
  return typeof item.id === 'string' && item.id.length > 0 && typeof item.title === 'string' && STATUSES.includes(item.status as string);
}

/** Somente estudos em andamento aceitam alterações (agendamento e retirada). */
export const isStudyWritable = (status: FollowUpStudyStatus | undefined) => status === 'recrutamento' || status === 'execução';

// GET /studies/acompanhamento (Coordenador): recrutamento, execução e encerrados.
export async function listFollowUpStudies(request: AuthenticatedRequest, signal?: AbortSignal): Promise<readonly FollowUpStudy[]> {
  const response = await request('/studies/acompanhamento', signal ? { signal } : undefined);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!Array.isArray(body) || !body.every(isFollowUpStudy)) throw new Error('Resposta inválida de estudos.');
  return body;
}

export type FollowUpStudiesState =
  | { status: 'loading' }
  | { status: 'ready'; options: readonly FollowUpStudy[] }
  | { status: 'error' };

export function useFollowUpStudies() {
  const { request } = useAuth();
  const [state, setState] = useState<FollowUpStudiesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    listFollowUpStudies(request, controller.signal)
      .then((options) => { if (!controller.signal.aborted) setState({ status: 'ready', options }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error' }); });
    return () => controller.abort();
  }, [request, attempt]);
  return { state, reload: () => setAttempt((current) => current + 1) };
}
