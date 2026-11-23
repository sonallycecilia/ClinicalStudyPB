import type { AuthenticatedHttpClient } from '../api/http';
import { hasStrings, invalidListResponse, isDate, isRecord } from '../api/validation';

export type StudyStatus = 'planejamento' | 'recrutamento' | 'execução' | 'encerrado';

export interface ParticipantStudy {
  participationId: string;
  participationStatus: 'Ativo' | 'Retirado' | 'Concluído';
  includedAt: string;
  withdrawnAt: string | null;
  study: {
    id: string;
    code: string;
    title: string;
    objective: string;
    startDate: string;
    endDate: string;
    status: StudyStatus;
    researcher: string;
  };
}

export interface ParticipantStudiesService {
  listForAuthenticatedParticipant(client: AuthenticatedHttpClient): Promise<ParticipantStudy[]>;
}

// E09 returns a participation with a nested study, not the administrative study DTO.
function isParticipantStudy(value: unknown): value is ParticipantStudy {
  if (!isRecord(value) || !isRecord(value.study)) return false;
  return hasStrings(value, ['participationId'])
    && ['Ativo', 'Retirado', 'Concluído'].includes(value.participationStatus as string)
    && isDate(value.includedAt) && (value.withdrawnAt === null || isDate(value.withdrawnAt))
    && hasStrings(value.study, ['id', 'code', 'title', 'objective', 'researcher'])
    && isDate(value.study.startDate) && isDate(value.study.endDate)
    && ['planejamento', 'recrutamento', 'execução', 'encerrado'].includes(value.study.status as string);
}

export const participantStudiesService: ParticipantStudiesService = {
  async listForAuthenticatedParticipant(client) {
    const data = await client.get('/me/studies');
    if (!Array.isArray(data) || !data.every(isParticipantStudy)) throw invalidListResponse();
    return data;
  },
};
