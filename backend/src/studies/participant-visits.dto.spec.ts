import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateScheduledVisitRequestDto,
  ListParticipantsQueryDto,
  ListScheduledVisitsQueryDto,
  RegisterAssessmentResultRequestDto,
  RegisterWithdrawalRequestDto,
  UpdateScheduledVisitStatusRequestDto,
} from '../swagger/api.models.js';

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

type InvalidDtoCase = [Record<string, unknown>, string];

describe('DTOs de participantes e visitas agendadas', () => {
  it('valida retirada e normaliza o motivo sem impor limite proposto', async () => {
    const result = await validationPipe.transform(
      {
        withdrawalDate: '2026-11-20',
        reason: '  Participante solicitou desligamento.  ',
      },
      { type: 'body', metatype: RegisterWithdrawalRequestDto },
    );
    expect(result).toMatchObject({
      withdrawalDate: '2026-11-20',
      reason: 'Participante solicitou desligamento.',
    });

    await expect(
      validationPipe.transform(
        {
          withdrawalDate: '2026-11-20',
          reason: 'r'.repeat(2001),
        },
        { type: 'body', metatype: RegisterWithdrawalRequestDto },
      ),
    ).resolves.toMatchObject({ reason: 'r'.repeat(2001) });
  });

  const invalidWithdrawalCases: InvalidDtoCase[] = [
    [{ withdrawalDate: '2026-02-30' }, 'invalid calendar date'],
    [{ withdrawalDate: '2026-11-20T00:00:00Z' }, 'date-time instead of date'],
    [{ reason: undefined }, 'missing reason'],
    [{ reason: '   ' }, 'blank reason'],
    [{ extra: true }, 'unknown field'],
  ];

  it.each(invalidWithdrawalCases)(
    'rejeita corpo E08 inválido (%s)',
    async (partial, _caseName) => {
      await expect(
        validationPipe.transform(
          {
            withdrawalDate: '2026-11-20',
            reason: 'Motivo da retirada.',
            ...partial,
          },
          { type: 'body', metatype: RegisterWithdrawalRequestDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('valida o corpo E02 e normaliza a observação opcional', async () => {
    const result = await validationPipe.transform(
      {
        participationId: '00000000-0000-4000-8000-000000000001',
        plannedVisitId: '00000000-0000-4000-8000-000000000002',
        scheduledAt: '2026-11-24T09:00:00-03:00',
        observation: '  Trazer exames anteriores.  ',
      },
      { type: 'body', metatype: CreateScheduledVisitRequestDto },
    );
    expect(result).toMatchObject({
      scheduledAt: '2026-11-24T09:00:00-03:00',
      observation: 'Trazer exames anteriores.',
    });

    const emptyObservation = await validationPipe.transform(
      {
        participationId: '00000000-0000-4000-8000-000000000001',
        plannedVisitId: '00000000-0000-4000-8000-000000000002',
        scheduledAt: '2026-11-24T12:00:00Z',
        observation: '   ',
      },
      { type: 'body', metatype: CreateScheduledVisitRequestDto },
    );
    expect(emptyObservation.observation).toBeNull();
  });

  const invalidE02Cases: InvalidDtoCase[] = [
    [{ participationId: 'invalid' }, 'uuid'],
    [{ plannedVisitId: 'invalid' }, 'uuid'],
    [{ scheduledAt: '2026-11-24T09:00:00' }, 'timezone'],
    [{ scheduledAt: '2026-11-24' }, 'datetime'],
    [{ observation: 'x'.repeat(2001) }, 'observation length'],
    [{ unexpected: true }, 'unknown field'],
  ];

  it.each(invalidE02Cases)(
    'rejeita campos inválidos de E02 (%s)',
    async (partial, _caseName) => {
      await expect(
        validationPipe.transform(
          {
            participationId: '00000000-0000-4000-8000-000000000001',
            plannedVisitId: '00000000-0000-4000-8000-000000000002',
            scheduledAt: '2026-11-24T12:00:00Z',
            ...partial,
          },
          { type: 'body', metatype: CreateScheduledVisitRequestDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('aceita somente os filtros previstos em E01 e E03', async () => {
    await expect(
      validationPipe.transform(
        { status: 'Retirado' },
        { type: 'query', metatype: ListParticipantsQueryDto },
      ),
    ).resolves.toMatchObject({ status: 'Retirado' });
    await expect(
      validationPipe.transform(
        { status: 'Concluído' },
        { type: 'query', metatype: ListScheduledVisitsQueryDto },
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      validationPipe.transform(
        { unexpected: 'value' },
        { type: 'query', metatype: ListParticipantsQueryDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('valida o estado de destino e a data de realização em E04', async () => {
    await expect(
      validationPipe.transform(
        { status: 'Realizada', realizedAt: '2026-11-24T09:40:00-03:00' },
        { type: 'body', metatype: UpdateScheduledVisitStatusRequestDto },
      ),
    ).resolves.toMatchObject({ status: 'Realizada' });
    await expect(
      validationPipe.transform(
        { status: 'Ausente', observation: '  Não compareceu.  ' },
        { type: 'body', metatype: UpdateScheduledVisitStatusRequestDto },
      ),
    ).resolves.toMatchObject({ observation: 'Não compareceu.' });
  });

  const invalidE04Cases: InvalidDtoCase[] = [
    [{ status: 'Realizada' }, 'missing realizedAt'],
    [
      { status: 'Ausente', realizedAt: '2026-11-24T09:40:00-03:00' },
      'unexpected realizedAt',
    ],
    [{ status: 'Cancelada', realizedAt: null }, 'null realizedAt'],
    [{ status: 'Agendada' }, 'Agendada destination'],
    [
      { status: 'Realizada', realizedAt: '2026-11-24T09:40:00' },
      'missing timezone',
    ],
    [{ status: 'Inválida' }, 'unknown status'],
    [{ status: 'Ausente', unexpected: true }, 'unknown field'],
    [
      { status: 'Realizada', observation: 'x'.repeat(2001) },
      'observation length',
    ],
  ];

  it.each(invalidE04Cases)(
    'rejeita corpo E04 inválido (%s)',
    async (partial, _caseName) => {
      await expect(
        validationPipe.transform(
          { ...partial },
          { type: 'body', metatype: UpdateScheduledVisitStatusRequestDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('valida o resultado fictício E06 e normaliza os campos opcionais', async () => {
    await expect(
      validationPipe.transform(
        {
          activityId: '00000000-0000-4000-8000-000000000005',
          value: '  Resultado fictício  ',
          unit: '  mmHg  ',
          observation: '  Registro acadêmico.  ',
        },
        { type: 'body', metatype: RegisterAssessmentResultRequestDto },
      ),
    ).resolves.toMatchObject({
      value: 'Resultado fictício',
      unit: 'mmHg',
      observation: 'Registro acadêmico.',
    });

    await expect(
      validationPipe.transform(
        {
          activityId: '00000000-0000-4000-8000-000000000005',
          value: '  valor  ',
          unit: '   ',
          observation: null,
        },
        { type: 'body', metatype: RegisterAssessmentResultRequestDto },
      ),
    ).resolves.toMatchObject({ value: 'valor', unit: null, observation: null });

    await expect(
      validationPipe.transform(
        {
          activityId: '00000000-0000-4000-8000-000000000005',
          value: 'v'.repeat(5000),
        },
        { type: 'body', metatype: RegisterAssessmentResultRequestDto },
      ),
    ).resolves.toMatchObject({ value: 'v'.repeat(5000) });
  });

  const invalidE06Cases: InvalidDtoCase[] = [
    [{ activityId: 'invalid' }, 'activity id'],
    [{ value: undefined }, 'missing value'],
    [{ value: '   ' }, 'empty value'],
    [{ unit: 'u'.repeat(51) }, 'unit length'],
    [{ observation: 'o'.repeat(2001) }, 'observation length'],
    [{ unexpected: true }, 'unknown field'],
  ];

  it.each(invalidE06Cases)(
    'rejeita corpo E06 inválido (%s)',
    async (partial, _caseName) => {
      await expect(
        validationPipe.transform(
          {
            activityId: '00000000-0000-4000-8000-000000000005',
            value: 'resultado',
            ...partial,
          },
          { type: 'body', metatype: RegisterAssessmentResultRequestDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
