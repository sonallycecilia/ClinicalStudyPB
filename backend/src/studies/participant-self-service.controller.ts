import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  ApiErrorResponseDto,
  EmptyParticipantStudiesQueryDto,
  ListMyVisitsQueryDto,
  ParticipantStudyResponseDto,
  ParticipantVisitResponseDto,
} from '../swagger/api.models.js';
import { ParticipantSelfService } from './participant-self-service.service.js';

const queryValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller('me')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Participante')
@ApiTags('Consultas do participante')
@ApiBearerAuth('bearer')
@ApiInternalServerErrorResponse({
  description: 'Erro interno inesperado ao consultar os dados do participante.',
  type: ApiErrorResponseDto,
})
export class ParticipantSelfServiceController {
  constructor(
    private readonly participantSelfService: ParticipantSelfService,
  ) {}

  @Get('studies')
  @ApiOperation({
    summary: 'Listar estudos vinculados ao participante autenticado (RF17)',
  })
  @ApiExtraModels(ParticipantStudyResponseDto)
  @ApiOkResponse({
    description:
      'Participações do próprio participante, incluindo os estados Ativo, Retirado e Concluído. Sem participações, retorna uma lista vazia.',
    type: ParticipantStudyResponseDto,
    isArray: true,
    content: {
      'application/json': {
        examples: {
          participantStudies: {
            summary: 'Estudo vinculado ao participante',
            value: [
              {
                participationId:
                  '3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f',
                participationStatus: 'Ativo',
                includedAt: '2026-11-06',
                withdrawnAt: null,
                study: {
                  id: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
                  code: 'EST-001',
                  title: 'Qualidade do sono',
                  objective: 'Investigar padrões fictícios de sono.',
                  startDate: '2026-04-01',
                  endDate: '2026-11-28',
                  status: 'execução',
                  researcher: 'Marina Costa',
                },
              },
            ],
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Parâmetros de query não permitidos.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido, expirado ou conta inativa.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Somente o perfil Participante pode consultar este recurso.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(queryValidationPipe)
  listStudies(
    @Query() _query: EmptyParticipantStudiesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantSelfService.listStudies(request.user!.sub);
  }

  @Get('visits')
  @ApiOperation({
    summary: 'Listar próximas visitas ou histórico de comparecimento (RF18)',
  })
  @ApiExtraModels(ParticipantVisitResponseDto)
  @ApiQuery({
    name: 'scope',
    required: true,
    enum: ['upcoming', 'history'],
    description:
      'upcoming inclui visitas Agendada com data/hora futura; history inclui somente Realizada, Ausente e Cancelada.',
  })
  @ApiQuery({
    name: 'studyId',
    required: false,
    format: 'uuid',
    description:
      'Filtra um estudo com participação vinculada à conta autenticada.',
  })
  @ApiOkResponse({
    description:
      'Visitas do próprio participante. A resposta não inclui observações internas nem resultados de avaliação.',
    type: ParticipantVisitResponseDto,
    isArray: true,
    content: {
      'application/json': {
        examples: {
          upcomingVisits: {
            summary: 'Próxima visita',
            value: [
              {
                id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
                participationId:
                  '3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f',
                studyId: 'e34e7889-4221-4a63-9f15-5e4d60c5955b',
                studyTitle: 'Qualidade do sono',
                plannedVisitName: 'Consulta inicial',
                plannedVisitOrder: 1,
                scheduledAt: '2026-11-24T12:00:00.000Z',
                status: 'Agendada',
                realizedAt: null,
              },
            ],
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Escopo ausente ou inválido, UUID inválido ou parâmetro não permitido.',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido, expirado ou conta inativa.',
    type: ApiErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Somente o perfil Participante pode consultar este recurso.',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Estudo não encontrado entre as suas participações.',
    type: ApiErrorResponseDto,
  })
  @UsePipes(queryValidationPipe)
  listVisits(
    @Query() query: ListMyVisitsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.participantSelfService.listVisits(query, request.user!.sub);
  }
}
