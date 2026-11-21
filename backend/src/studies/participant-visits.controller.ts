import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  ApiErrorResponseDto,
  CreateScheduledVisitRequestDto,
  ListParticipantsQueryDto,
  ListScheduledVisitsQueryDto,
  ParticipantResponseDto,
  ParticipantHistoryResponseDto,
  RegisterAssessmentResultRequestDto,
  HistoricalAssessmentResultResponseDto,
  HistoricalScheduledVisitResponseDto,
  ScheduledVisitResultsResponseDto,
  AssessmentResultResponseDto,
  ScheduledVisitResponseDto,
  RegisterWithdrawalRequestDto,
  UpdateScheduledVisitStatusRequestDto,
} from '../swagger/api.models.js';
import { ParticipantVisitsService } from './participant-visits.service.js';

const queryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const bodyValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller('studies/:studyId')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Pesquisador', 'Coordenador')
@ApiTags('Participantes e visitas agendadas')
@ApiBearerAuth('bearer')
@ApiInternalServerErrorResponse({
  description: 'Erro interno inesperado ao acessar ou persistir dados.',
  type: ApiErrorResponseDto,
})
export class ParticipantVisitsController {
  constructor(
    private readonly participantVisitsService: ParticipantVisitsService,
  ) {}

  @Get('participants')
  @ApiOperation({ summary: 'Listar participantes incluídos no estudo' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Ativo', 'Retirado', 'Concluído'],
  })
  @ApiOkResponse({
    description: 'Participações vinculadas ao estudo.',
    type: ParticipantResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Estudo ou filtro inválido.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou estudo fora do escopo de acesso.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Estudo não encontrado.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(queryValidationPipe)
  listParticipants(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Query() query: ListParticipantsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.listParticipants(
      studyId,
      query,
      request.user!.sub,
    );
  }

  @Get('participants/:participationId/history')
  @ApiOperation({
    summary: 'Consultar histórico de visitas e avaliações do participante',
  })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({
    name: 'participationId',
    description: 'UUID da participação no estudo.',
    format: 'uuid',
  })
  @ApiExtraModels(
    ParticipantHistoryResponseDto,
    HistoricalScheduledVisitResponseDto,
    HistoricalAssessmentResultResponseDto,
  )
  @ApiOkResponse({
    description:
      'Histórico cronológico da participação. Participações sem visitas retornam visits vazio; visitas sem avaliações retornam results vazio.',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(ParticipantHistoryResponseDto) },
        examples: {
          withVisits: {
            summary: 'Histórico com visita e resultado',
            value: {
              participant: {
                participationId: '3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f',
                candidateId: '9d2e7f40-1c3b-4a5d-8e6f-7a8b9c0d1e2f',
                studyId: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
                name: 'Bianca Oliveira',
                participationStatus: 'Ativo',
                includedAt: '2026-11-06',
                withdrawnAt: null,
                withdrawalReason: null,
              },
              visits: [
                {
                  id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
                  studyId: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
                  participationId: '3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f',
                  participantName: 'Bianca Oliveira',
                  plannedVisitId: '5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d',
                  plannedVisitName: 'Consulta inicial',
                  plannedVisitOrder: 1,
                  scheduledAt: '2026-11-24T12:00:00.000Z',
                  status: 'Realizada',
                  realizedAt: '2026-11-24T12:40:00.000Z',
                  observation: 'Compareceu no horário.',
                  createdAt: '2026-11-16T13:20:41.512Z',
                  results: [
                    {
                      id: '0f1e2d3c-4b5a-4968-8776-655443322110',
                      scheduledVisitId: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
                      activityId: '6e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c',
                      activityName: 'Coleta de sinais vitais',
                      activityType: 'Exame',
                      value: '120/80',
                      unit: 'mmHg',
                      observation: 'Valor fictício para fins acadêmicos.',
                      registeredAt: '2026-11-24T13:05:10.200Z',
                      registrarId: '2c4e6a8b-1d3f-4b5d-9e7f-1a3c5e7b9d2f',
                    },
                  ],
                },
              ],
            },
          },
          empty: {
            summary: 'Histórico sem visitas',
            value: {
              participant: {
                participationId: '3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f',
                candidateId: '9d2e7f40-1c3b-4a5d-8e6f-7a8b9c0d1e2f',
                studyId: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
                name: 'Bianca Oliveira',
                participationStatus: 'Ativo',
                includedAt: '2026-11-06',
                withdrawnAt: null,
                withdrawalReason: null,
              },
              visits: [],
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'UUID inválido.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Perfil sem permissão, Pesquisador não proprietário ou Coordenador em estado não permitido.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Estudo ou participação não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  getParticipantHistory(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('participationId', new ParseUUIDPipe()) participationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.getParticipantHistory(
      studyId,
      participationId,
      request.user!.sub,
    );
  }

  @Post('scheduled-visits')
  @ApiOperation({ summary: 'Agendar visita para uma participação ativa' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiBody({ type: CreateScheduledVisitRequestDto })
  @ApiCreatedResponse({
    description: 'Visita agendada.',
    type: ScheduledVisitResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Corpo inválido ou regra de agendamento violada.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou estado do estudo não permitido.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'Estudo, participação ou visita prevista não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Visita prevista já agendada ou realizada para a participação.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(bodyValidationPipe)
  createScheduledVisit(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Body() input: CreateScheduledVisitRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.createScheduledVisit(
      studyId,
      input,
      request.user!.sub,
    );
  }

  @Post('participants/:participationId/withdrawal')
  @ApiOperation({
    summary: 'Registrar a retirada de um participante do estudo',
    description:
      'Pesquisador proprietário ativo ou Coordenador ativo em estudo em recrutamento/execução. Altera somente a participação para Retirado; visitas, resultados e demais registros são preservados.',
  })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({
    name: 'participationId',
    description: 'UUID da participação no estudo.',
    format: 'uuid',
  })
  @ApiBody({ type: RegisterWithdrawalRequestDto })
  @ApiCreatedResponse({
    description: 'Participação atualizada para Retirado.',
    type: ParticipantResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Corpo inválido, participação inativa, data de retirada inválida ou estudo encerrado.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Perfil sem permissão, Pesquisador não proprietário ou Coordenador em estado não permitido.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'Estudo não encontrado ou participação não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(bodyValidationPipe)
  registerParticipantWithdrawal(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('participationId', new ParseUUIDPipe()) participationId: string,
    @Body() input: RegisterWithdrawalRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.registerParticipantWithdrawal(
      studyId,
      participationId,
      input,
      request.user!.sub,
    );
  }

  @Get('scheduled-visits')
  @ApiOperation({ summary: 'Listar visitas agendadas do estudo' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiQuery({ name: 'participationId', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Agendada', 'Realizada', 'Ausente', 'Cancelada'],
  })
  @ApiQuery({ name: 'from', required: false, type: String, format: 'date' })
  @ApiQuery({ name: 'to', required: false, type: String, format: 'date' })
  @ApiOkResponse({
    description: 'Visitas agendadas em ordem cronológica.',
    type: ScheduledVisitResponseDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'UUID, filtro ou período inválido.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou estudo fora do escopo de acesso.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Estudo ou participação não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(queryValidationPipe)
  listScheduledVisits(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Query() query: ListScheduledVisitsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.listScheduledVisits(
      studyId,
      query,
      request.user!.sub,
    );
  }

  @Patch('scheduled-visits/:scheduledVisitId/status')
  @ApiOperation({ summary: 'Atualizar a situação da visita agendada' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({
    name: 'scheduledVisitId',
    description: 'UUID da visita agendada.',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateScheduledVisitStatusRequestDto })
  @ApiOkResponse({
    description: 'Situação da visita atualizada.',
    type: ScheduledVisitResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Corpo ou regra de atualização inválidos.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou estado do estudo não permitido.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Visita agendada não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(bodyValidationPipe)
  updateScheduledVisitStatus(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('scheduledVisitId', new ParseUUIDPipe()) scheduledVisitId: string,
    @Body() input: UpdateScheduledVisitStatusRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.updateScheduledVisitStatus(
      studyId,
      scheduledVisitId,
      input,
      request.user!.sub,
    );
  }

  @Get('scheduled-visits/:scheduledVisitId/results')
  @ApiOperation({
    summary: 'Consultar atividades e resultados de uma visita agendada',
  })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({
    name: 'scheduledVisitId',
    description: 'UUID da visita agendada.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Atividades da visita prevista e seus resultados, se registrados.',
    type: ScheduledVisitResultsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'UUID inválido.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Perfil sem permissão ou Coordenador em estado de estudo não permitido.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Visita agendada não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  getScheduledVisitResults(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('scheduledVisitId', new ParseUUIDPipe()) scheduledVisitId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.getScheduledVisitResults(
      studyId,
      scheduledVisitId,
      request.user!.sub,
    );
  }

  @Post('scheduled-visits/:scheduledVisitId/results')
  @Roles('Pesquisador')
  @ApiOperation({ summary: 'Registrar resultado fictício de uma atividade' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({
    name: 'scheduledVisitId',
    description: 'UUID da visita agendada.',
    format: 'uuid',
  })
  @ApiBody({ type: RegisterAssessmentResultRequestDto })
  @ApiCreatedResponse({
    description: 'Resultado fictício registrado.',
    type: AssessmentResultResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Corpo inválido, visita não realizada, atividade incompatível ou estudo encerrado.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Somente Pesquisador proprietário ativo pode registrar resultados.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Visita agendada não encontrada neste estudo.',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Já existe resultado para a atividade nesta visita.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(bodyValidationPipe)
  registerAssessmentResult(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('scheduledVisitId', new ParseUUIDPipe()) scheduledVisitId: string,
    @Body() input: RegisterAssessmentResultRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantVisitsService.registerAssessmentResult(
      studyId,
      scheduledVisitId,
      input,
      request.user!.sub,
    );
  }
}
