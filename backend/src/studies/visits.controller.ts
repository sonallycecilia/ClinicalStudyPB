import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  ApiErrorResponseDto,
  CreatePlannedVisitRequestDto,
  CreateVisitActivityRequestDto,
  PlannedVisitResponseDto,
  VisitActivityResponseDto,
} from '../swagger/api.models.js';
import type { CreatePlannedVisitInput, CreateVisitActivityInput } from './visits.types.js';
import { VisitsService } from './visits.service.js';

@Controller('studies/:studyId/visits')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Pesquisador')
@ApiTags('Visitas previstas')
@ApiBearerAuth('bearer')
@ApiInternalServerErrorResponse({ description: 'Erro interno inesperado ao acessar ou persistir dados.', type: ApiErrorResponseDto })
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar visitas previstas de um estudo próprio' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiOkResponse({ description: 'Visitas previstas em ordem de execução.', type: PlannedVisitResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'O parâmetro studyId não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar as visitas.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  list(@Param('studyId', new ParseUUIDPipe()) studyId: string, @Req() request: AuthenticatedRequest) {
    return this.visitsService.list(studyId, request.user!.sub);
  }

  @Get(':visitId')
  @ApiOperation({ summary: 'Consultar uma visita prevista do estudo' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'visitId', description: 'UUID da visita prevista.', format: 'uuid' })
  @ApiOkResponse({ description: 'Visita prevista vinculada ao estudo.', type: PlannedVisitResponseDto })
  @ApiBadRequestResponse({ description: 'Um dos parâmetros não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar a visita.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou visita prevista não encontrada neste estudo.', type: ApiErrorResponseDto })
  find(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('visitId', new ParseUUIDPipe()) visitId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.visitsService.find(studyId, visitId, request.user!.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar uma visita prevista em estudo próprio' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiBody({ type: CreatePlannedVisitRequestDto })
  @ApiCreatedResponse({ description: 'Visita prevista cadastrada.', type: PlannedVisitResponseDto })
  @ApiBadRequestResponse({ description: 'Estudo inválido ou dados obrigatórios ausentes ou inválidos.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode cadastrar visitas.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  @ApiConflictResponse({ description: 'Já existe uma visita com essa ordem neste estudo.', type: ApiErrorResponseDto })
  create(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Body() input: CreatePlannedVisitInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.visitsService.create(studyId, input, request.user!.sub);
  }

  @Get(':visitId/activities')
  @ApiOperation({ summary: 'Listar atividades de uma visita prevista do estudo' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'visitId', description: 'UUID da visita prevista.', format: 'uuid' })
  @ApiOkResponse({ description: 'Atividades vinculadas à visita.', type: VisitActivityResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Um dos parâmetros não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar as atividades.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou visita prevista não encontrada neste estudo.', type: ApiErrorResponseDto })
  listActivities(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('visitId', new ParseUUIDPipe()) visitId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.visitsService.listActivities(studyId, visitId, request.user!.sub);
  }

  @Post(':visitId/activities')
  @ApiOperation({ summary: 'Cadastrar uma atividade em uma visita prevista' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'visitId', description: 'UUID da visita prevista.', format: 'uuid' })
  @ApiBody({ type: CreateVisitActivityRequestDto })
  @ApiCreatedResponse({ description: 'Atividade cadastrada.', type: VisitActivityResponseDto })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos ou dados obrigatórios ausentes ou inválidos.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode cadastrar atividades.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou visita prevista não encontrada neste estudo.', type: ApiErrorResponseDto })
  createActivity(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('visitId', new ParseUUIDPipe()) visitId: string,
    @Body() input: CreateVisitActivityInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.visitsService.createActivity(studyId, visitId, input, request.user!.sub);
  }
}
