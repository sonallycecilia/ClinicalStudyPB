import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { createAccessToken, verifyAccessToken } from './token.util.js';
import { SessionsService } from './sessions.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService, private readonly sessions: SessionsService) {}

  async login(email: string, password: string) {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const user = await this.usersService.authenticate(email, password);
    if (!user) throw new UnauthorizedException('E-mail ou senha inválidos.');
    const accessToken = createAccessToken(user);
    await this.sessions.create(verifyAccessToken(accessToken)!);
    return { accessToken, user };
  }

  async logout(sessionId: string) {
    await this.sessions.revoke(sessionId);
    return { message: 'Sessão encerrada com sucesso.' };
  }
}
