import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { StudyStatusRequestDto } from '../swagger/api.models.js';
import { StudyStatus } from './study.types.js';

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('StudyStatusRequestDto', () => {
  it('aceita somente os quatro estados permitidos e rejeita campos adicionais', async () => {
    for (const status of Object.values(StudyStatus)) {
      await expect(validationPipe.transform(
        { status },
        { type: 'body', metatype: StudyStatusRequestDto },
      )).resolves.toMatchObject({ status });
    }

    await expect(validationPipe.transform(
      { status: 'desconhecido' },
      { type: 'body', metatype: StudyStatusRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { status: StudyStatus.Recrutamento, extra: true },
      { type: 'body', metatype: StudyStatusRequestDto },
    )).rejects.toThrow(BadRequestException);
  });
});
