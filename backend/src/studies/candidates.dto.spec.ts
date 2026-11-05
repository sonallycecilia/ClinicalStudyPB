import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateCandidateRequestDto } from '../swagger/api.models.js';

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('CreateCandidateRequestDto', () => {
  it('exige nome e rejeita nome vazio ou campos desconhecidos', async () => {
    await expect(validationPipe.transform(
      { email: 'lucas@example.test' },
      { type: 'body', metatype: CreateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { name: '   ' },
      { type: 'body', metatype: CreateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { name: 'Lucas', unknown: true },
      { type: 'body', metatype: CreateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
  });

  it('normaliza espaços e permite e-mail opcional válido', async () => {
    await expect(validationPipe.transform(
      { name: ' Lucas Martins ', email: ' lucas@example.test ' },
      { type: 'body', metatype: CreateCandidateRequestDto },
    )).resolves.toMatchObject({ name: 'Lucas Martins', email: 'lucas@example.test' });
    await expect(validationPipe.transform(
      { name: 'Lucas Martins', email: 'inválido' },
      { type: 'body', metatype: CreateCandidateRequestDto },
    )).rejects.toThrow(BadRequestException);
  });
});
