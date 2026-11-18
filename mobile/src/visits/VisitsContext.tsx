import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { participantVisitsService, type Visit, type VisitScope, visitsForScope } from './participantVisitsApi';

type VisitState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success'; visits: Visit[] };
const VisitsContext = createContext<{
  state: VisitState; scope: VisitScope; setScope: (scope: VisitScope) => void;
  retry: () => void;
} | null>(null);

export function VisitsProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const [scope, setScope] = useState<VisitScope>('upcoming');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ user: typeof user; scope: VisitScope; attempt: number; state: VisitState } | null>(null);
  const active = status === 'authenticated' && user?.role === 'Participante' && user.status === 'Ativo';
  useEffect(() => {
    if (!active) return;
    let current = true;
    const save = (state: VisitState) => { if (current) setResult({ user, scope, attempt, state }); };
    async function load() {
      try {
        const visits = await participantVisitsService.listForAuthenticatedParticipant(scope);
        save({ kind: 'success', visits: visitsForScope(visits, scope) });
      } catch (reason) {
        save({ kind: 'error', message: reason instanceof Error ? reason.message : 'Não foi possível carregar suas visitas. Tente novamente.' });
      }
    }
    void load();
    return () => { current = false; };
  }, [active, user, scope, attempt]);
  const state: VisitState = active && result?.user === user && result.scope === scope && result.attempt === attempt
    ? result.state : { kind: 'loading' };
  return <VisitsContext.Provider value={{ state, scope, setScope, retry: () => setAttempt(value => value + 1) }}>{children}</VisitsContext.Provider>;
}

export function useVisits() {
  const value = useContext(VisitsContext);
  if (!value) throw new Error('useVisits precisa de VisitsProvider.');
  return value;
}
