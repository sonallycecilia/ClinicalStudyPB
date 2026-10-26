import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { UsersService } from '../users/users.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body?.email ?? '', body?.password ?? '');
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() request: AuthenticatedRequest) {
    const id = request.user?.sub;
    if (!id) throw new UnauthorizedException('Sessão inválida.');
    return this.usersService.findById(id);
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user!.jti);
  }
}
