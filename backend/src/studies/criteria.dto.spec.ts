import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateCriterionDto, UpdateCriterionDto } from '../swagger/api.models.js';

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('Criterion DTOs', () => {
  it('valida campos obrigatórios e normaliza a descrição na criação', async () => {
    await expect(validationPipe.transform(
      { type: 'Inclusão' },
      { type: 'body', metatype: CreateCriterionDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { type: 'Outro', description: 'Critério válido' },
      { type: 'body', metatype: CreateCriterionDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { type: 'Inclusão', description: '   ' },
      { type: 'body', metatype: CreateCriterionDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { type: 'Inclusão', description: 'Critério válido', extra: true },
      { type: 'body', metatype: CreateCriterionDto },
    )).rejects.toThrow(BadRequestException);

    await expect(validationPipe.transform(
      { type: 'Inclusão', description: ' Critério válido ', active: true },
      { type: 'body', metatype: CreateCriterionDto },
    )).resolves.toMatchObject({ description: 'Critério válido', active: true });
  });

  it('aceita atualização parcial e valida os campos fornecidos', async () => {
    await expect(validationPipe.transform(
      { active: false, description: ' Critério atualizado ' },
      { type: 'body', metatype: UpdateCriterionDto },
    )).resolves.toMatchObject({ active: false, description: 'Critério atualizado' });
    await expect(validationPipe.transform(
      { type: 'Outro' },
      { type: 'body', metatype: UpdateCriterionDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { active: 'false' },
      { type: 'body', metatype: UpdateCriterionDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { description: '   ' },
      { type: 'body', metatype: UpdateCriterionDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { unexpected: true },
      { type: 'body', metatype: UpdateCriterionDto },
    )).rejects.toThrow(BadRequestException);
  });
});
