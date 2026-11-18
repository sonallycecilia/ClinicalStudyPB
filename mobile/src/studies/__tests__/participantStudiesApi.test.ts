import { describe, expect, it } from '@jest/globals';
import { ParticipantStudiesUnavailableError, participantStudiesService } from '../participantStudiesApi';

describe('Consulta de estudos do participante', () => {
  it('informa explicitamente que a consulta aguarda a S3-BE-07 sem chamar uma rota não definida', async () => {
    await expect(participantStudiesService.listForAuthenticatedParticipant())
      .rejects.toBeInstanceOf(ParticipantStudiesUnavailableError);
  });
});
