import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USER_ROLES } from '../users/user.types.js';
import type { AccountStatus, UserRole } from '../users/user.types.js';
import type { StudyStatus, StudyKind, StudySymbol } from '../studies/study.types.js';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Código HTTP da resposta.' })
  statusCode!: number;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Informe os dados da conta.' },
      { type: 'array', items: { type: 'string' }, example: ['Dados inválidos.'] },
    ],
    description: 'Mensagem de erro retornada pelo NestJS.',
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request', description: 'Descrição do código HTTP.' })
  error!: string;
}

export class LoginRequestDto {
  @ApiPropertyOptional({ example: 'ana.souza@clinicalstudypb.test', format: 'email' })
  email?: string;

  @ApiPropertyOptional({ example: 'Admin123!' })
  password?: string;
}

export class PublicUserResponseDto {
  @ApiProperty({ format: 'uuid', example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b' })
  id!: string;

  @ApiProperty({ example: 'Ana Souza' })
  name!: string;

  @ApiProperty({ example: 'ana.souza@clinicalstudypb.test', format: 'email' })
  email!: string;

  @ApiProperty({ example: '(83) 99999-0000', description: 'Telefone; string vazia quando não informado.' })
  phone!: string;

  @ApiProperty({ enum: USER_ROLES, example: 'Administrador' })
  role!: UserRole;

  @ApiProperty({ enum: ['Ativo', 'Inativo'], example: 'Ativo' })
  status!: AccountStatus;

  @ApiProperty({ format: 'date-time', example: '2026-10-26T12:00:00.000Z' })
  createdAt!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Token Bearer JWT; validade de uma hora.' })
  accessToken!: string;

  @ApiProperty({ type: PublicUserResponseDto })
  user!: PublicUserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Sessão encerrada com sucesso.' })
  message!: string;
}

export class CreateUserRequestDto {
  @ApiProperty({ minLength: 3, maxLength: 200, example: 'Ana Souza' })
  name!: string;

  @ApiProperty({ format: 'email', maxLength: 254, example: 'ana.souza@clinicalstudypb.test' })
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 30, example: '(83) 99999-0000' })
  phone!: string;

  @ApiProperty({ minLength: 8, example: 'Admin123!' })
  password!: string;

  @ApiProperty({ enum: USER_ROLES, example: 'Administrador' })
  role!: UserRole;
}

export class UpdateUserRequestDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 200, example: 'Ana Souza' })
  name?: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 254, example: 'ana.souza@clinicalstudypb.test' })
  email?: string;

  @ApiPropertyOptional({ minLength: 8, maxLength: 30, example: '(83) 99999-0000' })
  phone?: string;

  @ApiPropertyOptional({ minLength: 8, example: 'NovaSenha123!' })
  password?: string;

  @ApiPropertyOptional({ enum: USER_ROLES, example: 'Pesquisador' })
  role?: UserRole;

  @ApiPropertyOptional({ enum: ['Ativo', 'Inativo'], example: 'Inativo' })
  status?: AccountStatus;
}

export class StudyInputRequestDto {
  @ApiProperty({ minLength: 3, example: 'Qualidade do sono' })
  title!: string;

  @ApiProperty({ minLength: 8, example: 'Investigar padrões de sono dos participantes.' })
  objective!: string;

  @ApiProperty({ format: 'date', example: '2026-11-01', description: 'Data civil no formato AAAA-MM-DD.' })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-12-31', description: 'Deve ser igual ou posterior a startDate.' })
  endDate!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 30 })
  participantLimit!: number;

  @ApiProperty({ type: 'integer', minimum: 0, example: 0, description: 'Não pode exceder participantLimit.' })
  participantsLinked!: number;
}

export class UpdateStudyRequestDto {
  @ApiPropertyOptional({ minLength: 3, example: 'Qualidade do sono' })
  title?: string;

  @ApiPropertyOptional({ minLength: 8, example: 'Investigar padrões de sono dos participantes.' })
  objective?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-11-01', description: 'Data civil no formato AAAA-MM-DD.' })
  startDate?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-12-31', description: 'Deve ser igual ou posterior a startDate.' })
  endDate?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, example: 30 })
  participantLimit?: number;

  @ApiPropertyOptional({ type: 'integer', minimum: 0, example: 0, description: 'Não pode exceder participantLimit.' })
  participantsLinked?: number;
}

export class StudyResponseDto {
  @ApiProperty({ format: 'uuid', example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b' })
  id!: string;

  @ApiProperty({ example: 'EST-001' })
  code!: string;

  @ApiProperty({ example: 'Qualidade do sono' })
  title!: string;

  @ApiProperty({ example: 'Investigar padrões de sono dos participantes.' })
  objective!: string;

  @ApiProperty({ format: 'uuid' })
  researcherId!: string;

  @ApiProperty({ example: 'Marina Costa', description: 'Nome do pesquisador proprietário.' })
  researcher!: string;

  @ApiProperty({ format: 'date', example: '2026-11-01' })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-12-31' })
  endDate!: string;

  @ApiProperty({ type: 'integer', example: 30 })
  participantLimit!: number;

  @ApiProperty({ type: 'integer', example: 0 })
  participantsLinked!: number;

  @ApiProperty({ enum: ['Planejado', 'Em andamento', 'Encerrado'], example: 'Planejado' })
  status!: StudyStatus;

  @ApiProperty({ enum: ['Estudo observacional', 'Estudo longitudinal'], example: 'Estudo observacional' })
  kind!: StudyKind;

  @ApiProperty({ enum: ['moon', 'heart', 'activity'], example: 'activity' })
  symbol!: StudySymbol;
}
