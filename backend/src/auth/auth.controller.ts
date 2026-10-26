import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { UsersService } from '../users/users.service.js';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  MessageResponseDto,
  PublicUserResponseDto,
} from '../swagger/api.models.js';

@Controller('auth')
@ApiTags('Autenticação')
@ApiInternalServerErrorResponse({ description: 'Erro interno inesperado ao processar a solicitação.', type: ApiErrorResponseDto })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário e iniciar sessão' })
  @ApiBody({ type: LoginRequestDto, required: false })
  @ApiCreatedResponse({ description: 'Autenticação realizada; retorna o token e os dados públicos do usuário.', type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos, conta inativa ou indisponível.', type: ApiErrorResponseDto })
  login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body?.email ?? '', body?.password ?? '');
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Consultar o usuário da sessão atual' })
  @ApiOkResponse({ description: 'Dados públicos do usuário autenticado.', type: PublicUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido, expirado ou sessão inativa.', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Conta associada à sessão não encontrada.', type: ApiErrorResponseDto })
  me(@Req() request: AuthenticatedRequest) {
    const id = request.user?.sub;
    if (!id) throw new UnauthorizedException('Sessão inválida.');
    return this.usersService.findById(id);
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Encerrar a sessão atual' })
  @ApiCreatedResponse({ description: 'Sessão revogada.', type: MessageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido, expirado ou sessão inativa.', type: ApiErrorResponseDto })
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user!.jti);
  }
}
