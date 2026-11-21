import type {
  Participant,
  ScheduledVisit,
  ScheduledVisitStatus,
} from './participant-visits.types.js';

export interface RegisterAssessmentResultInput {
  activityId: string;
  value: string;
  unit?: string | null;
  observation?: string | null;
}

export interface AssessmentResult {
  id: string;
  scheduledVisitId: string;
  activityId: string;
  value: string;
  unit: string | null;
  observation: string | null;
  registeredAt: string;
  registrarId: string;
}

export interface ScheduledVisitActivityResult {
  activityId: string;
  name: string;
  type: string;
  description: string | null;
  result: AssessmentResult | null;
}

export interface ScheduledVisitResults {
  scheduledVisitId: string;
  plannedVisitId: string;
  status: ScheduledVisitStatus;
  activities: ScheduledVisitActivityResult[];
}

export interface HistoricalAssessmentResult extends AssessmentResult {
  activityName: string;
  activityType: string;
}

export interface HistoricalScheduledVisit extends ScheduledVisit {
  results: HistoricalAssessmentResult[];
}

export interface ParticipantHistory {
  participant: Participant;
  visits: HistoricalScheduledVisit[];
}
