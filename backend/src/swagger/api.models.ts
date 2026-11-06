import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { USER_ROLES } from '../users/user.types.js';
import type { AccountStatus, UserRole } from '../users/user.types.js';
import { StudyStatus } from '../studies/study.types.js';
import type { StudyKind, StudySymbol } from '../studies/study.types.js';
import type { CriterionType } from '../studies/criteria.types.js';
import type { CreatePlannedVisitInput, CreateVisitActivityInput } from '../studies/visits.types.js';
import type { Candidate, CreateCandidateInput } from '../studies/candidates.types.js';
import type {
  CandidateInclusion,
  CandidateEligibilityAssessment,
  CandidateConsent,
  CriterionEvaluationInput,
  EvaluateCandidateInput,
  EligibilityEvaluation,
  RegisterCandidateConsentInput,
} from '../studies/candidates.types.js';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class StudyStatusRequestDto {
  @ApiProperty({ enum: Object.values(StudyStatus), example: StudyStatus.Recrutamento })
  @IsEnum(StudyStatus)
  status!: StudyStatus;
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

  @ApiProperty({ enum: Object.values(StudyStatus), example: StudyStatus.Planejamento })
  status!: StudyStatus;

  @ApiProperty({ enum: ['Estudo observacional', 'Estudo longitudinal'], example: 'Estudo observacional' })
  kind!: StudyKind;

  @ApiProperty({ enum: ['moon', 'heart', 'activity'], example: 'activity' })
  symbol!: StudySymbol;
}

export class CreateCriterionRequestDto {
  @ApiProperty({ enum: ['Inclusão', 'Exclusão'], example: 'Inclusão' })
  type!: CriterionType;

  @ApiProperty({ minLength: 1, maxLength: 2000, example: 'Ter idade igual ou superior a 18 anos.' })
  description!: string;

  @ApiPropertyOptional({ default: true, example: true })
  active?: boolean;
}

export class UpdateCriterionRequestDto {
  @ApiPropertyOptional({ enum: ['Inclusão', 'Exclusão'], example: 'Exclusão' })
  type?: CriterionType;

  @ApiPropertyOptional({ minLength: 1, maxLength: 2000, example: 'Ter idade igual ou superior a 18 anos.' })
  description?: string;

  @ApiPropertyOptional({ example: false })
  active?: boolean;
}

export class EligibilityCriterionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ enum: ['Inclusão', 'Exclusão'], example: 'Inclusão' })
  type!: CriterionType;

  @ApiProperty({ example: 'Ter idade igual ou superior a 18 anos.' })
  description!: string;

  @ApiProperty({ example: true })
  active!: boolean;
}

export class CreatePlannedVisitRequestDto implements CreatePlannedVisitInput {
  @ApiProperty({ minLength: 1, maxLength: 150, example: 'Consulta inicial' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiPropertyOptional({ type: 'integer', minimum: 0, nullable: true, example: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  intervalDays?: number | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true, example: 'Realizada após a inclusão.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class CreateVisitActivityRequestDto implements CreateVisitActivityInput {
  @ApiProperty({ minLength: 1, maxLength: 150, example: 'Coleta de sinais vitais' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true, example: 'Aferir pressão arterial e frequência cardíaca.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'Exame' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;
}

export class PlannedVisitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ example: 'Consulta inicial' })
  name!: string;

  @ApiProperty({ type: 'integer', example: 1 })
  order!: number;

  @ApiProperty({ type: 'integer', nullable: true, example: 14 })
  intervalDays!: number | null;

  @ApiProperty({ nullable: true, example: 'Realizada após a inclusão.' })
  description!: string | null;
}

export class VisitActivityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  visitId!: string;

  @ApiProperty({ example: 'Coleta de sinais vitais' })
  name!: string;

  @ApiProperty({ nullable: true, example: 'Aferir pressão arterial e frequência cardíaca.' })
  description!: string | null;

  @ApiProperty({ example: 'Exame' })
  type!: string;
}

export class CreateCandidateRequestDto implements CreateCandidateInput {
  @ApiProperty({ minLength: 1, maxLength: 150, example: 'Lucas Martins' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 254, nullable: true, example: 'lucas@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
}

export class CandidateResponseDto implements Candidate {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ example: 'Lucas Martins' })
  name!: string;

  @ApiPropertyOptional({ format: 'email', nullable: true, example: 'lucas@example.test' })
  email!: string | null;

  @ApiProperty({
    enum: ['Novo', 'Em avaliação', 'Elegível', 'Inelegível', 'Incluído', 'Desistiu'],
    example: 'Em avaliação',
  })
  status!: Candidate['status'];

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;
}

export class RegisterCandidateConsentRequestDto implements RegisterCandidateConsentInput {
  @ApiProperty({
    enum: ['Registrado', 'Recusado', 'Revogado'],
    description: 'Estado do termo simulado: Registrado representa consentimento concedido.',
  })
  @IsIn(['Registrado', 'Recusado', 'Revogado'])
  status!: RegisterCandidateConsentInput['status'];

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'simulado-v1' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  termVersion!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string | null;
}

export class CandidateConsentResponseDto implements CandidateConsent {
  @ApiProperty({ format: 'uuid' })
  candidateId!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({
    enum: ['Registrado', 'Recusado', 'Revogado'],
    nullable: true,
    description: 'Null indica que ainda não há consentimento registrado.',
  })
  status!: CandidateConsent['status'];

  @ApiProperty({ nullable: true, example: 'simulado-v1' })
  termVersion!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  registeredAt!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  registrarId!: string | null;

  @ApiProperty({ nullable: true })
  observation!: string | null;
}

export class CandidateInclusionResponseDto implements CandidateInclusion {
  @ApiProperty({ format: 'uuid' })
  participationId!: string;

  @ApiProperty({ format: 'uuid' })
  candidateId!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ format: 'date', example: '2026-11-06' })
  includedAt!: string;

  @ApiProperty({ enum: ['Ativo'], example: 'Ativo' })
  participationStatus!: 'Ativo';

  @ApiProperty({ type: 'integer', minimum: 1, example: 5 })
  participantsLinked!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 20 })
  participantLimit!: number;
}

export class CriterionEvaluationRequestDto implements CriterionEvaluationInput {
  @ApiProperty({ format: 'uuid', description: 'Critério ativo pertencente ao estudo informado.' })
  @IsUUID()
  criterionId!: string;

  @ApiProperty({ enum: ['Atende', 'Não atende', 'Pendente'] })
  @IsIn(['Atende', 'Não atende', 'Pendente'])
  result!: CriterionEvaluationInput['result'];

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string | null;
}

export class EvaluateCandidateRequestDto implements EvaluateCandidateInput {
  @ApiProperty({ type: CriterionEvaluationRequestDto, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriterionEvaluationRequestDto)
  evaluations!: CriterionEvaluationRequestDto[];
}

export class EligibilityEvaluationResponseDto implements EligibilityEvaluation {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  criterionId!: string;

  @ApiProperty({ enum: ['Inclusão', 'Exclusão'] })
  criterionType!: 'Inclusão' | 'Exclusão';

  @ApiProperty()
  criterionDescription!: string;

  @ApiProperty({ enum: ['Atende', 'Não atende', 'Pendente'] })
  result!: EligibilityEvaluation['result'];

  @ApiProperty({ nullable: true })
  observation!: string | null;

  @ApiProperty({ format: 'uuid' })
  evaluatorId!: string;

  @ApiProperty({ format: 'date-time' })
  evaluatedAt!: string;
}

export class CandidateEligibilityAssessmentResponseDto implements CandidateEligibilityAssessment {
  @ApiProperty({ format: 'uuid' })
  candidateId!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ enum: ['Novo', 'Em avaliação', 'Elegível', 'Inelegível', 'Incluído', 'Desistiu'] })
  status!: Candidate['status'];

  @ApiProperty({ type: EligibilityEvaluationResponseDto, isArray: true })
  evaluations!: EligibilityEvaluationResponseDto[];
}
