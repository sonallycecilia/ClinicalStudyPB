import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { StudiesService } from './studies.service.js';
import type { StudyInput } from './study.types.js';
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
import {
  ApiErrorResponseDto,
  StudyInputRequestDto,
  StudyResponseDto,
  UpdateStudyRequestDto,
} from '../swagger/api.models.js';

@Controller('studies')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Pesquisador')
@ApiTags('Estudos clínicos')
@ApiBearerAuth('bearer')
@ApiInternalServerErrorResponse({ description: 'Erro interno inesperado ao acessar ou persistir dados.', type: ApiErrorResponseDto })
export class StudiesController {
  constructor(private readonly studiesService: StudiesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar estudos do pesquisador autenticado' })
  @ApiOkResponse({ description: 'Estudos pertencentes ao pesquisador, ordenados por data de início.', type: StudyResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente pesquisadores ativos podem consultar estudos.', type: ApiErrorResponseDto })
  list(@Req() request: AuthenticatedRequest) {
    return this.studiesService.listForResearcher(request.user!.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar um estudo pelo identificador' })
  @ApiParam({ name: 'id', description: 'UUID do estudo.', format: 'uuid', example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b' })
  @ApiOkResponse({ description: 'Estudo pertencente ao pesquisador autenticado.', type: StudyResponseDto })
  @ApiBadRequestResponse({ description: 'O parâmetro id não é um UUID válido.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'O perfil não é Pesquisador ou o estudo pertence a outro pesquisador.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  findById(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.studiesService.findById(id, request.user!.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar um estudo para o pesquisador autenticado' })
  @ApiBody({ type: StudyInputRequestDto, description: 'O proprietário é obtido da sessão; researcherId não é aceito como campo de entrada.' })
  @ApiCreatedResponse({ description: 'Estudo criado com código e responsável gerados pela API.', type: StudyResponseDto })
  @ApiBadRequestResponse({ description: 'Dados ausentes ou inválidos conforme as validações do endpoint.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Somente pesquisadores ativos podem cadastrar estudos.', type: ApiErrorResponseDto })
  @ApiConflictResponse({ description: 'Não foi possível gerar um código único para o estudo.', type: ApiErrorResponseDto })
  create(@Body() input: StudyInput, @Req() request: AuthenticatedRequest) {
    return this.studiesService.create(input, request.user!.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar parcialmente um estudo próprio' })
  @ApiParam({ name: 'id', description: 'UUID do estudo.', format: 'uuid', example: 'e34e7889-4221-4a63-9f15-5e4d60c5955b' })
  @ApiBody({ type: UpdateStudyRequestDto, description: 'Informe pelo menos um campo permitido. Campos omitidos permanecem inalterados.' })
  @ApiOkResponse({ description: 'Estudo atualizado.', type: StudyResponseDto })
  @ApiBadRequestResponse({ description: 'UUID inválido, corpo vazio, campo não permitido ou valores inválidos.', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'O perfil não é Pesquisador ou o estudo pertence a outro pesquisador.', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Estudo não encontrado.', type: ApiErrorResponseDto })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: Partial<StudyInput>, @Req() request: AuthenticatedRequest) {
    return this.studiesService.update(id, input, request.user!.sub);
  }
}
