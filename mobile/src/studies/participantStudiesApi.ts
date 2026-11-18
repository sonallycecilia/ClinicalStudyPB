export type StudyStatus = 'planejamento' | 'recrutamento' | 'execução' | 'encerrado';

export interface ParticipantStudy {
  id: string;
  title: string;
  objective: string;
  status: StudyStatus;
}

export interface ParticipantStudiesService {
  listForAuthenticatedParticipant(): Promise<ParticipantStudy[]>;
}

export class ParticipantStudiesUnavailableError extends Error {
  constructor() {
    super('A consulta dos estudos do participante ainda não está disponível. Aguarde a implementação da S3-BE-07.');
    this.name = 'ParticipantStudiesUnavailableError';
  }
}

export const participantStudiesService: ParticipantStudiesService = {
  async listForAuthenticatedParticipant() {
    throw new ParticipantStudiesUnavailableError();
  },
};
