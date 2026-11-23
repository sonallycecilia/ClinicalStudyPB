import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { AuthenticatedHttpClient } from '../api/http';
import { participantVisitsService, type Visit, type VisitScope, visitsForScope } from './participantVisitsApi';

type VisitState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success'; visits: Visit[] };
const VisitsContext = createContext<{
  state: VisitState; scope: VisitScope; setScope: (scope: VisitScope) => void;
  retry: () => void;
} | null>(null);

export function VisitsProvider({ children }: { children: ReactNode }) {
  const { user, status, client } = useAuth();
  const [scope, setScope] = useState<VisitScope>('upcoming');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ user: typeof user; client: AuthenticatedHttpClient; scope: VisitScope; attempt: number; state: VisitState } | null>(null);
  const active = status === 'authenticated' && user?.role === 'Participante' && user.status === 'Ativo';
  useEffect(() => {
    if (!active || !client) return;
    const sessionClient = client;
    let current = true;
    const save = (state: VisitState) => { if (current) setResult({ user, client, scope, attempt, state }); };
    async function load() {
      try {
        const visits = await participantVisitsService.listForAuthenticatedParticipant(scope, sessionClient);
        // Local fictício solicitado para as visitas de demonstração da Bianca.
        const displayVisits = visits.map(visit => __DEV__
          && user?.email === 'bianca.oliveira@clinicalstudypb.test'
          && ['S3M05 Bianca — visita futura', 'S3M05 Bianca — visita realizada'].includes(visit.plannedVisitName)
          && !visit.location
          ? { ...visit, location: 'Centro de Pesquisa ClinicalStudyPB — João Pessoa/PB ' }
          : visit);
        save({ kind: 'success', visits: visitsForScope(displayVisits, scope) });
      } catch (reason) {
        save({ kind: 'error', message: reason instanceof Error ? reason.message : 'Não foi possível carregar suas visitas. Tente novamente.' });
      }
    }
    void load();
    return () => { current = false; };
  }, [active, user, client, scope, attempt]);
  const state: VisitState = active && result?.user === user && result.client === client && result.scope === scope && result.attempt === attempt
    ? result.state : { kind: 'loading' };
  return <VisitsContext.Provider value={{ state, scope, setScope, retry: () => setAttempt(value => value + 1) }}>{children}</VisitsContext.Provider>;
}

export function useVisits() {
  const value = useContext(VisitsContext);
  if (!value) throw new Error('useVisits precisa de VisitsProvider.');
  return value;
}
