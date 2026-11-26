import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsISO8601,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  isISO8601,
} from 'class-validator';
import { USER_ROLES } from '../users/user.types.js';
import type { AccountStatus, EligibleParticipantAccount, UserRole } from '../users/user.types.js';
import { StudyStatus } from '../studies/study.types.js';
import { CANDIDATE_INCLUSION_ERROR_CODES } from '../studies/candidates.types.js';
import type { StudyKind, StudySymbol } from '../studies/study.types.js';
import type { CriterionType } from '../studies/criteria.types.js';
import type {
  CreatePlannedVisitInput,
  CreateVisitActivityInput,
} from '../studies/visits.types.js';
import type {
  Candidate,
  CreateCandidateInput,
} from '../studies/candidates.types.js';
import type {
  CandidateInclusion,
  CandidateEligibilityAssessment,
  CandidateConsent,
  CriterionEvaluationInput,
  EvaluateCandidateInput,
  EligibilityEvaluation,
  RegisterCandidateConsentInput,
} from '../studies/candidates.types.js';
import type {
  CreateScheduledVisitInput,
  ListParticipantsQuery,
  ListScheduledVisitsQuery,
  Participant,
  ParticipationStatus,
  RegisterParticipantWithdrawalInput,
  ScheduledVisit,
  ScheduledVisitFinalStatus,
  ScheduledVisitStatus,
  UpdateScheduledVisitStatusInput,
} from '../studies/participant-visits.types.js';
import type {
  AssessmentResult,
  HistoricalAssessmentResult,
  HistoricalScheduledVisit,
  ParticipantHistory,
  RegisterAssessmentResultInput,
  ScheduledVisitActivityResult,
  ScheduledVisitResults,
} from '../studies/assessment-results.types.js';
import type {
  ListMyVisitsQuery,
  ParticipantStudyDetails,
  ParticipantStudy,
  ParticipantVisit,
} from '../studies/participant-self-service.types.js';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Código HTTP da resposta.' })
  statusCode!: number;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Informe os dados da conta.' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['Dados inválidos.'],
      },
    ],
    description: 'Mensagem de erro retornada pelo NestJS.',
  })
  message!: string | string[];

  @ApiProperty({
    example: 'Bad Request',
    description: 'Descrição do código HTTP.',
  })
  error!: string;

  @ApiPropertyOptional({
    example: 'VISIT_ALREADY_SCHEDULED',
    description: 'Código de erro de domínio, quando aplicável.',
  })
  code?: string;
}

export class CandidateInclusionErrorResponseDto extends ApiErrorResponseDto {
  @ApiPropertyOptional({
    enum: CANDIDATE_INCLUSION_ERROR_CODES,
    description:
      'Motivo estruturado da recusa no RF11. Ausente em erros sem motivo de domínio identificado.',
  })
  code?: (typeof CANDIDATE_INCLUSION_ERROR_CODES)[number] = undefined;
}

export class LoginRequestDto {
  @ApiPropertyOptional({
    example: 'ana.souza@clinicalstudypb.test',
    format: 'email',
  })
  email?: string;

  @ApiPropertyOptional({ example: 'Admin123!' })
  password?: string;
}

export class EligibleParticipantAccountResponseDto implements EligibleParticipantAccount {
  @ApiProperty({
    format: 'uuid',
    example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
    description: 'Identificador da conta a selecionar para o vínculo com um candidato.',
  })
  id!: string;

  @ApiProperty({ example: 'Ana Souza' })
  name!: string;

  @ApiProperty({ example: 'ana.souza@clinicalstudypb.test', format: 'email' })
  email!: string;
}

export class PublicUserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
  })
  id!: string;

  @ApiProperty({ example: 'Ana Souza' })
  name!: string;

  @ApiProperty({ example: 'ana.souza@clinicalstudypb.test', format: 'email' })
  email!: string;

  @ApiProperty({
    example: '(83) 99999-0000',
    description: 'Telefone; string vazia quando não informado.',
  })
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

  @ApiProperty({
    format: 'email',
    maxLength: 254,
    example: 'ana.souza@clinicalstudypb.test',
  })
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

  @ApiPropertyOptional({
    format: 'email',
    maxLength: 254,
    example: 'ana.souza@clinicalstudypb.test',
  })
  email?: string;

  @ApiPropertyOptional({
    minLength: 8,
    maxLength: 30,
    example: '(83) 99999-0000',
  })
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

  @ApiProperty({
    minLength: 8,
    example: 'Investigar padrões de sono dos participantes.',
  })
  objective!: string;

  @ApiProperty({
    format: 'date',
    example: '2026-11-01',
    description: 'Data civil no formato AAAA-MM-DD.',
  })
  startDate!: string;

  @ApiProperty({
    format: 'date',
    example: '2026-12-31',
    description: 'Deve ser igual ou posterior a startDate.',
  })
  endDate!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 30 })
  participantLimit!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 0,
    description: 'Não pode exceder participantLimit.',
  })
  participantsLinked!: number;
}

export class UpdateStudyRequestDto {
  @ApiPropertyOptional({ minLength: 3, example: 'Qualidade do sono' })
  title?: string;

  @ApiPropertyOptional({
    minLength: 8,
    example: 'Investigar padrões de sono dos participantes.',
  })
  objective?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-11-01',
    description: 'Data civil no formato AAAA-MM-DD.',
  })
  startDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-12-31',
    description: 'Deve ser igual ou posterior a startDate.',
  })
  endDate?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, example: 30 })
  participantLimit?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    example: 0,
    description: 'Não pode exceder participantLimit.',
  })
  participantsLinked?: number;
}

export class StudyStatusRequestDto {
  @ApiProperty({
    enum: Object.values(StudyStatus),
    example: StudyStatus.Recrutamento,
  })
  @IsEnum(StudyStatus)
  status!: StudyStatus;
}

export class StudyResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
  })
  id!: string;

  @ApiProperty({ example: 'EST-001' })
  code!: string;

  @ApiProperty({ example: 'Qualidade do sono' })
  title!: string;

  @ApiProperty({ example: 'Investigar padrões de sono dos participantes.' })
  objective!: string;

  @ApiProperty({ format: 'uuid' })
  researcherId!: string;

  @ApiProperty({
    example: 'Marina Costa',
    description: 'Nome do pesquisador proprietário.',
  })
  researcher!: string;

  @ApiProperty({ format: 'date', example: '2026-11-01' })
  startDate!: string;

  @ApiProperty({ format: 'date', example: '2026-12-31' })
  endDate!: string;

  @ApiProperty({ type: 'integer', example: 30 })
  participantLimit!: number;

  @ApiProperty({ type: 'integer', example: 0 })
  participantsLinked!: number;

  @ApiProperty({
    enum: Object.values(StudyStatus),
    example: StudyStatus.Planejamento,
  })
  status!: StudyStatus;

  @ApiProperty({
    enum: ['Estudo observacional', 'Estudo longitudinal'],
    example: 'Estudo observacional',
  })
  kind!: StudyKind;

  @ApiProperty({ enum: ['moon', 'heart', 'activity'], example: 'activity' })
  symbol!: StudySymbol;
}

export class CreateCriterionDto {
  @ApiProperty({ enum: ['Inclusão', 'Exclusão'], example: 'Inclusão' })
  @IsString()
  @IsIn(['Inclusão', 'Exclusão'])
  type!: CriterionType;

  @ApiProperty({
    minLength: 1,
    maxLength: 2000,
    example: 'Ter idade igual ou superior a 18 anos.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ default: true, example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCriterionDto {
  @ApiPropertyOptional({ enum: ['Inclusão', 'Exclusão'], example: 'Exclusão' })
  @IsOptional()
  @IsString()
  @IsIn(['Inclusão', 'Exclusão'])
  type?: CriterionType;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 2000,
    example: 'Ter idade igual ou superior a 18 anos.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    nullable: true,
    example: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  intervalDays?: number | null;

  @ApiPropertyOptional({
    maxLength: 2000,
    nullable: true,
    example: 'Realizada após a inclusão.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class CreateVisitActivityRequestDto implements CreateVisitActivityInput {
  @ApiProperty({
    minLength: 1,
    maxLength: 150,
    example: 'Coleta de sinais vitais',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    nullable: true,
    example: 'Aferir pressão arterial e frequência cardíaca.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'Exame' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

  @ApiProperty({
    nullable: true,
    example: 'Aferir pressão arterial e frequência cardíaca.',
  })
  description!: string | null;

  @ApiProperty({ example: 'Exame' })
  type!: string;
}

export class ListParticipantsQueryDto implements ListParticipantsQuery {
  @ApiPropertyOptional({ enum: ['Ativo', 'Retirado', 'Concluído'] })
  @IsOptional()
  @IsIn(['Ativo', 'Retirado', 'Concluído'])
  status?: ParticipationStatus;
}

export class ParticipantResponseDto implements Participant {
  @ApiProperty({ format: 'uuid' })
  participationId!: string;

  @ApiProperty({ format: 'uuid' })
  candidateId!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ example: 'Bianca Oliveira' })
  name!: string;

  @ApiProperty({ enum: ['Ativo', 'Retirado', 'Concluído'] })
  participationStatus!: ParticipationStatus;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-11-06' })
  includedAt!: string;

  @ApiProperty({ type: 'string', format: 'date', nullable: true })
  withdrawnAt!: string | null;

  @ApiProperty({ nullable: true })
  withdrawalReason!: string | null;
}

export class RegisterWithdrawalRequestDto
  implements RegisterParticipantWithdrawalInput
{
  @ApiProperty({
    type: 'string',
    format: 'date',
    example: '2026-11-20',
    description:
      'Data civil de retirada (America/Sao_Paulo), entre a inclusão e a data atual.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true, strictSeparator: true })
  withdrawalDate!: string;

  @ApiProperty({
    type: 'string',
    example: 'Participante solicitou desligamento por motivos pessoais.',
    description:
      'Motivo obrigatório. Espaços externos são removidos e o conteúdo não pode ficar vazio.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class CreateScheduledVisitRequestDto implements CreateScheduledVisitInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  participationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  plannedVisitId!: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    example: '2026-11-24T09:00:00-03:00',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i)
  scheduledAt!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string | null;
}

@ValidatorConstraint({ name: 'realizedAtMatchesStatus', async: false })
class RealizedAtMatchesStatusConstraint {
  validate(value: unknown, args: ValidationArguments): boolean {
    const status = (args.object as { status?: string }).status;
    if (status !== 'Realizada') return value === undefined;
    return (
      typeof value === 'string' &&
      isISO8601(value, { strict: true, strictSeparator: true }) &&
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    );
  }
}

export class UpdateScheduledVisitStatusRequestDto implements UpdateScheduledVisitStatusInput {
  @ApiProperty({ enum: ['Realizada', 'Ausente', 'Cancelada'] })
  @IsIn(['Realizada', 'Ausente', 'Cancelada'])
  status!: ScheduledVisitFinalStatus;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    example: '2026-11-24T09:40:00-03:00',
    description:
      'Obrigatório quando status é Realizada. Não deve ser informado para Ausente ou Cancelada.',
  })
  @Validate(RealizedAtMatchesStatusConstraint, {
    message: 'Informe a data de realização somente para visitas realizadas.',
  })
  realizedAt?: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    nullable: true,
    description:
      'Atualização parcial: omitido preserva o valor atual; texto substitui; null limpa a observação.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string | null;
}

export class RegisterAssessmentResultRequestDto implements RegisterAssessmentResultInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  activityId!: string;

  @ApiProperty({
    type: 'string',
    description: 'Valor fictício obrigatório, normalizado com trim e não vazio.',
    example: '120/80',
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string | null;
}

export class AssessmentResultResponseDto implements AssessmentResult {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  scheduledVisitId!: string;

  @ApiProperty({ format: 'uuid' })
  activityId!: string;

  @ApiProperty({ type: 'string', example: '120/80' })
  value!: string;

  @ApiProperty({ type: 'string', nullable: true, example: 'mmHg' })
  unit!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  observation!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-11-24T13:05:10.200Z' })
  registeredAt!: string;

  @ApiProperty({ format: 'uuid' })
  registrarId!: string;
}

export class ScheduledVisitActivityResultResponseDto implements ScheduledVisitActivityResult {
  @ApiProperty({ format: 'uuid' })
  activityId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: AssessmentResultResponseDto, nullable: true })
  result!: AssessmentResult | null;
}

export class ScheduledVisitResultsResponseDto implements ScheduledVisitResults {
  @ApiProperty({ format: 'uuid' })
  scheduledVisitId!: string;

  @ApiProperty({ format: 'uuid' })
  plannedVisitId!: string;

  @ApiProperty({ enum: ['Agendada', 'Realizada', 'Ausente', 'Cancelada'] })
  status!: ScheduledVisitStatus;

  @ApiProperty({ type: ScheduledVisitActivityResultResponseDto, isArray: true })
  activities!: ScheduledVisitActivityResult[];
}

export class ListScheduledVisitsQueryDto implements ListScheduledVisitsQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  participationId?: string;

  @ApiPropertyOptional({
    enum: ['Agendada', 'Realizada', 'Ausente', 'Cancelada'],
  })
  @IsOptional()
  @IsIn(['Agendada', 'Realizada', 'Ausente', 'Cancelada'])
  status?: ScheduledVisitStatus;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    example: '2026-11-20',
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    example: '2026-11-30',
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class ScheduledVisitResponseDto implements ScheduledVisit {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ format: 'uuid' })
  participationId!: string;

  @ApiProperty({ example: 'Bianca Oliveira' })
  participantName!: string;

  @ApiProperty({ format: 'uuid' })
  plannedVisitId!: string;

  @ApiProperty({ example: 'Consulta inicial' })
  plannedVisitName!: string;

  @ApiProperty({ type: 'integer', example: 1 })
  plannedVisitOrder!: number;

  @ApiProperty({ type: 'string', format: 'date-time' })
  scheduledAt!: string;

  @ApiProperty({ enum: ['Agendada', 'Realizada', 'Ausente', 'Cancelada'] })
  status!: ScheduledVisitStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  realizedAt!: string | null;

  @ApiProperty({ nullable: true })
  observation!: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string;
}

export class HistoricalAssessmentResultResponseDto
  extends AssessmentResultResponseDto
  implements HistoricalAssessmentResult
{
  @ApiProperty({ example: 'Coleta de sinais vitais' })
  activityName!: string;

  @ApiProperty({ example: 'Exame' })
  activityType!: string;
}

export class HistoricalScheduledVisitResponseDto
  extends ScheduledVisitResponseDto
  implements HistoricalScheduledVisit
{
  @ApiProperty({ type: HistoricalAssessmentResultResponseDto, isArray: true })
  results!: HistoricalAssessmentResultResponseDto[];
}

export class EmptyParticipantStudiesQueryDto {}

export class ListMyVisitsQueryDto implements ListMyVisitsQuery {
  @ApiProperty({ enum: ['upcoming', 'history'], example: 'upcoming' })
  @IsIn(['upcoming', 'history'])
  scope!: 'upcoming' | 'history';

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtra um estudo em que o usuário autenticado participa.',
  })
  @IsOptional()
  @IsUUID()
  studyId?: string;
}

export class ParticipantStudyDetailsResponseDto
  implements ParticipantStudyDetails
{
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'EST-001' })
  code!: string;

  @ApiProperty({ example: 'Qualidade do sono' })
  title!: string;

  @ApiProperty({ example: 'Investigar padrões fictícios de sono.' })
  objective!: string;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-04-01' })
  startDate!: string;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-11-28' })
  endDate!: string;

  @ApiProperty({ enum: Object.values(StudyStatus), example: StudyStatus.Execucao })
  status!: StudyStatus;

  @ApiProperty({ example: 'Marina Costa' })
  researcher!: string;
}

export class ParticipantStudyResponseDto implements ParticipantStudy {
  @ApiProperty({ format: 'uuid' })
  participationId!: string;

  @ApiProperty({ enum: ['Ativo', 'Retirado', 'Concluído'] })
  participationStatus!: ParticipationStatus;

  @ApiProperty({ type: 'string', format: 'date' })
  includedAt!: string;

  @ApiProperty({ type: 'string', format: 'date', nullable: true })
  withdrawnAt!: string | null;

  @ApiProperty({ type: ParticipantStudyDetailsResponseDto })
  study!: ParticipantStudyDetailsResponseDto;
}

export class ParticipantVisitResponseDto implements ParticipantVisit {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  participationId!: string;

  @ApiProperty({ format: 'uuid' })
  studyId!: string;

  @ApiProperty({ example: 'Qualidade do sono' })
  studyTitle!: string;

  @ApiProperty({ example: 'Consulta inicial' })
  plannedVisitName!: string;

  @ApiProperty({ type: 'integer', example: 1 })
  plannedVisitOrder!: number;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    example: '2026-11-24T12:00:00.000Z',
  })
  scheduledAt!: string;

  @ApiProperty({ enum: ['Agendada', 'Realizada', 'Ausente', 'Cancelada'] })
  status!: ScheduledVisitStatus;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  realizedAt!: string | null;
}

export class ParticipantHistoryResponseDto implements ParticipantHistory {
  @ApiProperty({ type: ParticipantResponseDto })
  participant!: Participant;

  @ApiProperty({ type: HistoricalScheduledVisitResponseDto, isArray: true })
  visits!: HistoricalScheduledVisit[];
}

export class CreateCandidateRequestDto implements CreateCandidateInput {
  @ApiProperty({ minLength: 1, maxLength: 150, example: 'Lucas Martins' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    format: 'email',
    maxLength: 254,
    nullable: true,
    example: 'lucas@example.test',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
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

  @ApiPropertyOptional({
    format: 'email',
    nullable: true,
    example: 'lucas@example.test',
  })
  email!: string | null;

  @ApiProperty({
    enum: [
      'Novo',
      'Em avaliação',
      'Elegível',
      'Inelegível',
      'Incluído',
      'Desistiu',
    ],
    example: 'Em avaliação',
  })
  status!: Candidate['status'];

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;
}

export class RegisterCandidateConsentRequestDto implements RegisterCandidateConsentInput {
  @ApiProperty({
    enum: ['Registrado', 'Recusado', 'Revogado'],
    description:
      'Estado do termo simulado: Registrado representa consentimento concedido.',
  })
  @IsIn(['Registrado', 'Recusado', 'Revogado'])
  status!: RegisterCandidateConsentInput['status'];

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'simulado-v1' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  termVersion!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
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
  @ApiProperty({
    format: 'uuid',
    description: 'Critério ativo pertencente ao estudo informado.',
  })
  @IsUUID()
  criterionId!: string;

  @ApiProperty({ enum: ['Atende', 'Não atende', 'Pendente'] })
  @IsIn(['Atende', 'Não atende', 'Pendente'])
  result!: CriterionEvaluationInput['result'];

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string | null;
}

export class EvaluateCandidateRequestDto implements EvaluateCandidateInput {
  @ApiProperty({
    type: CriterionEvaluationRequestDto,
    isArray: true,
    minItems: 1,
  })
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

  @ApiProperty({
    enum: [
      'Novo',
      'Em avaliação',
      'Elegível',
      'Inelegível',
      'Incluído',
      'Desistiu',
    ],
  })
  status!: Candidate['status'];

  @ApiProperty({ type: EligibilityEvaluationResponseDto, isArray: true })
  evaluations!: EligibilityEvaluationResponseDto[];
}
