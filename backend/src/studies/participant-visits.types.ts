export type ParticipationStatus = 'Ativo' | 'Retirado' | 'Concluído';
export type ScheduledVisitStatus =
  'Agendada' | 'Realizada' | 'Ausente' | 'Cancelada';

export interface Participant {
  participationId: string;
  candidateId: string;
  studyId: string;
  name: string;
  participationStatus: ParticipationStatus;
  includedAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

export interface ListParticipantsQuery {
  status?: ParticipationStatus;
}

export interface RegisterParticipantWithdrawalInput {
  withdrawalDate: string;
  reason: string;
}

export interface CreateScheduledVisitInput {
  participationId: string;
  plannedVisitId: string;
  scheduledAt: string;
  observation?: string | null;
}

export type ScheduledVisitFinalStatus = Exclude<
  ScheduledVisitStatus,
  'Agendada'
>;

export interface UpdateScheduledVisitStatusInput {
  status: ScheduledVisitFinalStatus;
  realizedAt?: string;
  observation?: string | null;
}

export interface ListScheduledVisitsQuery {
  participationId?: string;
  status?: ScheduledVisitStatus;
  from?: string;
  to?: string;
}

export interface ScheduledVisit {
  id: string;
  studyId: string;
  participationId: string;
  participantName: string;
  plannedVisitId: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: string;
  status: ScheduledVisitStatus;
  realizedAt: string | null;
  observation: string | null;
  createdAt: string;
}
