import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateCandidateRequestDto,
  RegisterCandidateConsentRequestDto,
} from '../swagger/api.models.js';

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

describe('RegisterCandidateConsentRequestDto', () => {
  it('valida estado e versão obrigatórios e rejeita campos desconhecidos', async () => {
    await expect(validationPipe.transform(
      { status: 'Registrado' },
      { type: 'body', metatype: RegisterCandidateConsentRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { status: 'Aceito', termVersion: 'simulado-v1' },
      { type: 'body', metatype: RegisterCandidateConsentRequestDto },
    )).rejects.toThrow(BadRequestException);
    await expect(validationPipe.transform(
      { status: 'Registrado', termVersion: 'simulado-v1', other: true },
      { type: 'body', metatype: RegisterCandidateConsentRequestDto },
    )).rejects.toThrow(BadRequestException);
  });

  it('normaliza versão e observação opcionais', async () => {
    await expect(validationPipe.transform(
      { status: 'Recusado', termVersion: ' simulado-v1 ', observation: ' Não concedido. ' },
      { type: 'body', metatype: RegisterCandidateConsentRequestDto },
    )).resolves.toMatchObject({
      status: 'Recusado',
      termVersion: 'simulado-v1',
      observation: 'Não concedido.',
    });
  });
});
