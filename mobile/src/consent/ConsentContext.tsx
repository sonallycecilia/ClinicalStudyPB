import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { consentTerm } from './consentTerm';

export interface ConsentAcceptance {
  participantId: string;
  version: string;
  acceptedAt: string;
}

interface ConsentValue {
  acceptance: ConsentAcceptance | null;
  accepted: boolean;
  needsFirstAccess: boolean;
  accept: () => void;
  continueToStudies: () => void;
}

const ConsentContext = createContext<ConsentValue | null>(null);

// Mesmo escopo do protótipo: aceite local em memória, sem simular persistência na API.
export function ConsentProvider({ children }: { children: ReactNode }) {
  const { status, user, client } = useAuth();
  const [acceptances, setAcceptances] = useState<Record<string, ConsentAcceptance>>({});
  const [pendingContinue, setPendingContinue] = useState<{ participantId: string; client: typeof client } | null>(null);
  const participantId = status === 'authenticated' && user?.role === 'Participante' && user.status === 'Ativo' ? user.id : null;
  const record = participantId ? acceptances[participantId] : null;
  const acceptance = record?.version === consentTerm.version ? record : null;
  const accepted = acceptance !== null;

  function accept() {
    if (!participantId || accepted) return;
    setAcceptances(current => ({ ...current, [participantId]: {
      participantId, version: consentTerm.version, acceptedAt: new Date().toISOString(),
    } }));
    setPendingContinue({ participantId, client });
  }

  function continueToStudies() {
    if (participantId && accepted) setPendingContinue(null);
  }

  return <ConsentContext.Provider value={{ acceptance, accepted,
    needsFirstAccess: !accepted || (pendingContinue?.participantId === participantId && pendingContinue?.client === client),
    accept, continueToStudies,
  }}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) throw new Error('useConsent precisa de ConsentProvider.');
  return context;
}
