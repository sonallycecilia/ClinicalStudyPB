import type { AuthenticatedHttpClient } from '../api/http';
import { hasStrings, invalidListResponse, isDate, isRecord } from '../api/validation';

export type VisitStatus = 'Agendada' | 'Realizada' | 'Ausente' | 'Cancelada';
export type VisitScope = 'upcoming' | 'history';

// S3-PO-03, E10. Location, code and preparation are absent from this contract.
export interface ParticipantVisit {
  id: string;
  participationId: string;
  studyId: string;
  studyTitle: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: string;
  status: VisitStatus;
  realizedAt: string | null;
}

// Optional presentation metadata: never manufacture these fields for API data.
export interface Visit extends ParticipantVisit {
  code?: string;
  location?: string;
  address?: string;
  preparation?: string;
}

export interface ParticipantVisitsService {
  listForAuthenticatedParticipant(scope: VisitScope, client: AuthenticatedHttpClient): Promise<Visit[]>;
}

function isParticipantVisit(value: unknown): value is ParticipantVisit {
  return isRecord(value)
    && hasStrings(value, ['id', 'participationId', 'studyId', 'studyTitle', 'plannedVisitName'])
    && Number.isInteger(value.plannedVisitOrder)
    && isDate(value.scheduledAt)
    && ['Agendada', 'Realizada', 'Ausente', 'Cancelada'].includes(value.status as string)
    && (value.realizedAt === null || isDate(value.realizedAt));
}

// No /studies/:id/visits fallback: that route is RF06 and is not participant data.
export const participantVisitsService: ParticipantVisitsService = {
  async listForAuthenticatedParticipant(scope, client) {
    const data = await client.get(`/me/visits?scope=${encodeURIComponent(scope)}`);
    if (!Array.isArray(data) || !data.every(isParticipantVisit)) throw invalidListResponse();
    return data;
  },
};

export function visitsForScope(visits: Visit[], scope: VisitScope): Visit[] {
  // E10 includes overdue scheduled visits; attendance status defines the scope.
  return visits.filter(visit => scope === 'upcoming' ? visit.status === 'Agendada' : visit.status !== 'Agendada')
    .sort((a, b) => (Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)) * (scope === 'upcoming' ? 1 : -1));
}

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export function visitDateLabels(scheduledAt: string) {
  const date = new Date(scheduledAt);
  return {
    date: `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`,
    day: days[date.getDay()],
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}
