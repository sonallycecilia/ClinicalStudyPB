import { useEffect, useState } from 'react';
import { useAuth, type User } from '../auth/AuthContext';
import type { AuthenticatedHttpClient } from '../api/http';
import { participantStudiesService, type ParticipantStudy } from './participantStudiesApi';

export type StudiesState = { kind: 'loading' }
  | { kind: 'success'; studies: ParticipantStudy[] }
  | { kind: 'error'; message: string };

export function useParticipantStudies(enabled = true) {
  const { status, user, client } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    user: User; client: AuthenticatedHttpClient; attempt: number; state: StudiesState;
  } | null>(null);
  const active = enabled && status === 'authenticated' && user?.role === 'Participante' && user.status === 'Ativo';
  useEffect(() => {
    if (!active || !user || !client) return;
    let current = true;
    void participantStudiesService.listForAuthenticatedParticipant(client).then(
      studies => { if (current) setResult({ user, client, attempt, state: { kind: 'success', studies } }); },
      reason => {
        if (!current) return;
        const message = reason instanceof Error && reason.message.trim()
          ? reason.message : 'Não foi possível carregar seus estudos. Tente novamente.';
        setResult({ user, client, attempt, state: { kind: 'error', message } });
      },
    );
    return () => { current = false; };
  }, [active, user, client, attempt]);
  const state: StudiesState = active && result?.user === user && result.client === client && result.attempt === attempt
    ? result.state : { kind: 'loading' };
  return { state, retry: () => setAttempt(value => value + 1) };
}
