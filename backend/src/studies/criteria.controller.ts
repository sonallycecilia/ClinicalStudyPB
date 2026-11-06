import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
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
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  ApiErrorResponseDto,
  CreateCriterionDto,
  EligibilityCriterionResponseDto,
  UpdateCriterionDto,
} from '../swagger/api.models.js';
import { CriteriaService } from './criteria.service.js';

@Controller('studies/:studyId/criteria')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Pesquisador')
@ApiTags('Critérios de elegibilidade')
@ApiBearerAuth('bearer')
@ApiInternalServerErrorResponse({ description: 'Erro interno inesperado ao acessar ou persistir dados.', type: ApiErrorResponseDto })
export class CriteriaController {
  constructor(private readonly criteriaService: CriteriaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar critérios de um estudo próprio' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiOkResponse({ description: 'Critérios vinculados ao estudo.', type: EligibilityCriterionResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'O parâmetro studyId não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar os critérios.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  list(@Param('studyId', new ParseUUIDPipe()) studyId: string, @Req() request: AuthenticatedRequest) {
    return this.criteriaService.list(studyId, request.user!.sub);
  }

  @Get(':criterionId')
  @ApiOperation({ summary: 'Consultar um critério do estudo' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'criterionId', description: 'UUID do critério.', format: 'uuid' })
  @ApiOkResponse({ description: 'Critério vinculado ao estudo.', type: EligibilityCriterionResponseDto })
  @ApiBadRequestResponse({ description: 'Um dos parâmetros não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar os critérios.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou critério não encontrado.', type: ApiErrorResponseDto })
  find(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('criterionId', new ParseUUIDPipe()) criterionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.criteriaService.find(studyId, criterionId, request.user!.sub);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Cadastrar um critério em estudo próprio' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiBody({ type: CreateCriterionDto })
  @ApiCreatedResponse({ description: 'Critério cadastrado.', type: EligibilityCriterionResponseDto })
  @ApiBadRequestResponse({ description: 'Estudo inválido ou dados do critério inválidos.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode cadastrar critérios.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  create(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Body() input: CreateCriterionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.criteriaService.create(studyId, input, request.user!.sub);
  }

  @Patch(':criterionId')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Atualizar um critério do estudo' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'criterionId', description: 'UUID do critério.', format: 'uuid' })
  @ApiBody({ type: UpdateCriterionDto, description: 'Informe ao menos um campo permitido.' })
  @ApiOkResponse({ description: 'Critério atualizado.', type: EligibilityCriterionResponseDto })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos ou dados do critério inválidos.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode atualizar critérios.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou critério não encontrado.', type: ApiErrorResponseDto })
  update(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('criterionId', new ParseUUIDPipe()) criterionId: string,
    @Body() input: UpdateCriterionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.criteriaService.update(studyId, criterionId, input, request.user!.sub);
  }
}
