import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CandidateEligibilityAssessmentResponseDto,
  CandidateResponseDto,
  CreateCandidateRequestDto,
  EvaluateCandidateRequestDto,
} from '../swagger/api.models.js';
import { CandidatesService } from './candidates.service.js';

@Controller('studies/:studyId/candidates')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Pesquisador')
@ApiTags('Candidatos')
@ApiBearerAuth('bearer')
@ApiInternalServerErrorResponse({ description: 'Erro interno inesperado ao acessar ou persistir dados.', type: ApiErrorResponseDto })
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar candidatos de um estudo próprio' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiOkResponse({ description: 'Candidatos vinculados ao estudo.', type: CandidateResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'O parâmetro studyId não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar os candidatos.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  list(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidatesService.list(studyId, request.user!.sub);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Cadastrar candidato em estudo próprio' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiBody({ type: CreateCandidateRequestDto })
  @ApiCreatedResponse({ description: 'Candidato cadastrado e vinculado ao estudo.', type: CandidateResponseDto })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos, dados obrigatórios ausentes ou estudo encerrado.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode cadastrar candidatos.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  create(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Body() input: CreateCandidateRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidatesService.create(studyId, input, request.user!.sub);
  }

  @Post(':candidateId/eligibility-assessments')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Avaliar os critérios ativos de um candidato' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'candidateId', description: 'UUID do candidato.', format: 'uuid' })
  @ApiBody({ type: EvaluateCandidateRequestDto })
  @ApiCreatedResponse({
    description: 'Avaliações persistidas e situação de elegibilidade atualizada.',
    type: CandidateEligibilityAssessmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Avaliações inválidas, critérios incompletos ou estudo encerrado.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode avaliar candidatos.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou candidato não encontrado neste estudo.', type: ApiErrorResponseDto })
  evaluate(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body() input: EvaluateCandidateRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidatesService.evaluate(studyId, candidateId, input, request.user!.sub);
  }

  @Get(':candidateId/eligibility-assessments')
  @ApiOperation({ summary: 'Consultar avaliações de elegibilidade do candidato' })
  @ApiParam({ name: 'studyId', description: 'UUID do estudo.', format: 'uuid' })
  @ApiParam({ name: 'candidateId', description: 'UUID do candidato.', format: 'uuid' })
  @ApiOkResponse({
    description: 'Avaliações existentes e situação atual de elegibilidade.',
    type: CandidateEligibilityAssessmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Um dos parâmetros não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente o pesquisador proprietário pode consultar avaliações.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo ou candidato não encontrado neste estudo.', type: ApiErrorResponseDto })
  getEligibilityAssessment(
    @Param('studyId', new ParseUUIDPipe()) studyId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.candidatesService.getEligibilityAssessment(studyId, candidateId, request.user!.sub);
  }
}
