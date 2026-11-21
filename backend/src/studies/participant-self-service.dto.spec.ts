import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  EmptyParticipantStudiesQueryDto,
  ListMyVisitsQueryDto,
} from '../swagger/api.models.js';

const queryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('DTOs de consultas do participante', () => {
  it('aceita os escopos documentados e o filtro opcional de estudo', async () => {
    await expect(
      queryValidationPipe.transform(
        {
          scope: 'upcoming',
          studyId: '00000000-0000-4000-8000-000000000001',
        },
        { type: 'query', metatype: ListMyVisitsQueryDto },
      ),
    ).resolves.toMatchObject({
      scope: 'upcoming',
      studyId: '00000000-0000-4000-8000-000000000001',
    });
    await expect(
      queryValidationPipe.transform(
        { scope: 'history' },
        { type: 'query', metatype: ListMyVisitsQueryDto },
      ),
    ).resolves.toMatchObject({ scope: 'history' });
  });

  const invalidMyVisitQueries: Array<{
    query: Record<string, string>;
    description: string;
  }> = [
    { query: {}, description: 'missing scope' },
    { query: { scope: 'future' }, description: 'invalid scope' },
    { query: { scope: 'upcoming', studyId: 'invalid' }, description: 'invalid study UUID' },
    {
      query: { scope: 'history', userId: '00000000-0000-4000-8000-000000000001' },
      description: 'userId',
    },
    {
      query: { scope: 'history', candidateId: '00000000-0000-4000-8000-000000000001' },
      description: 'candidateId',
    },
    {
      query: { scope: 'history', participationId: '00000000-0000-4000-8000-000000000001' },
      description: 'participationId',
    },
  ];

  it.each(invalidMyVisitQueries)(
    'rejeita parâmetros E10 inválidos ($description)',
    async ({ query }) => {
      await expect(
        queryValidationPipe.transform(query, {
          type: 'query',
          metatype: ListMyVisitsQueryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejeita query string em E09, que não possui parâmetros', async () => {
    await expect(
      queryValidationPipe.transform(
        { userId: '00000000-0000-4000-8000-000000000001' },
        { type: 'query', metatype: EmptyParticipantStudiesQueryDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
