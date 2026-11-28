import { BadRequestException, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';

export function invalidParticipantAccount() {
  return new UnprocessableEntityException({
    codigo: 'CONTA_PARTICIPANTE_INVALIDA',
    mensagem: 'Selecione uma conta de participante ativa.',
    campo: 'id_usuario',
  });
}

// RF08: somente erros do vínculo usam 422; os demais campos preservam o 400 do NestJS.
export const createCandidateValidation = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors) => errors.some(({ property }) => property === 'id_usuario')
    ? invalidParticipantAccount()
    : new BadRequestException(errors.flatMap(({ constraints }) => Object.values(constraints ?? {}))),
});
