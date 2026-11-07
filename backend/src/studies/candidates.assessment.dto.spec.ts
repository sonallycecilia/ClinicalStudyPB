import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { EvaluateCandidateRequestDto } from '../swagger/api.models.js';

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('EvaluateCandidateRequestDto', () => {
  it('valida lista, UUID, resultado e campos desconhecidos das avaliações', async () => {
    await expect(validationPipe.transform(
      { evaluations: [] },
      { type: 'body', metatype: EvaluateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { evaluations: [{ criterionId: 'inválido', result: 'Atende' }] },
      { type: 'body', metatype: EvaluateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      {
        evaluations: [{
          criterionId: '00000000-0000-4000-8000-000000000001',
          result: 'Outro',
        }],
      },
      { type: 'body', metatype: EvaluateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      {
        evaluations: [{
          criterionId: '00000000-0000-4000-8000-000000000001',
          result: 'Atende',
          unknown: true,
        }],
      },
      { type: 'body', metatype: EvaluateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
  });

  it('transforma e valida uma coleção completa de respostas', async () => {
    await expect(validationPipe.transform(
      {
        evaluations: [{
          criterionId: '00000000-0000-4000-8000-000000000001',
          result: 'Atende',
          observation: '  Verificado  ',
        }],
      },
      { type: 'body', metatype: EvaluateCandidateRequestDto },
    )).resolves.toMatchObject({
      evaluations: [{
        criterionId: '00000000-0000-4000-8000-000000000001',
        result: 'Atende',
        observation: 'Verificado',
      }],
    });
  });
});
