import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreatePlannedVisitRequestDto,
  CreateVisitActivityRequestDto,
} from '../swagger/api.models.js';

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('DTOs de visitas previstas', () => {
  it('valida campos obrigatórios e limites da visita prevista', async () => {
    await expect(validationPipe.transform(
      { name: '   ', order: 1 },
      { type: 'body', metatype: CreatePlannedVisitRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { name: 'Consulta', order: 0, intervalDays: -1 },
      { type: 'body', metatype: CreatePlannedVisitRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { name: 'Consulta', order: 1, unexpected: true },
      { type: 'body', metatype: CreatePlannedVisitRequestDto },
    )).rejects.toThrow(BadRequestException);
  });

  it('transforma textos e valores opcionais da visita antes do service', async () => {
    const result = await validationPipe.transform(
      { name: ' Consulta inicial ', order: 1, description: '   ' },
      { type: 'body', metatype: CreatePlannedVisitRequestDto },
    );
    expect(result).toMatchObject({ name: 'Consulta inicial', order: 1, description: null });
  });

  it('valida e transforma os campos obrigatórios e opcionais da atividade', async () => {
    const result = await validationPipe.transform(
      { name: ' Coleta de sinais vitais ', type: ' Exame ', description: ' Aferir pressão. ' },
      { type: 'body', metatype: CreateVisitActivityRequestDto },
    );
    expect(result).toMatchObject({
      name: 'Coleta de sinais vitais',
      type: 'Exame',
      description: 'Aferir pressão.',
    });

    await expect(validationPipe.transform(
      { name: 'Atividade', type: ' ' },
      { type: 'body', metatype: CreateVisitActivityRequestDto },
    )).rejects.toThrow(BadRequestException);
  });
});
