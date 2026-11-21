import type { StudyStatus } from './study.types.js';
import type {
  ParticipationStatus,
  ScheduledVisitStatus,
} from './participant-visits.types.js';

export type ParticipantVisitScope = 'upcoming' | 'history';

export interface ListMyVisitsQuery {
  scope: ParticipantVisitScope;
  studyId?: string;
}

export interface ParticipantStudyDetails {
  id: string;
  code: string;
  title: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: StudyStatus;
  researcher: string;
}

export interface ParticipantStudy {
  participationId: string;
  participationStatus: ParticipationStatus;
  includedAt: string;
  withdrawnAt: string | null;
  study: ParticipantStudyDetails;
}

export interface ParticipantVisit {
  id: string;
  participationId: string;
  studyId: string;
  studyTitle: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: string;
  status: ScheduledVisitStatus;
  realizedAt: string | null;
}
