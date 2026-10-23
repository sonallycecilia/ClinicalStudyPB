import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { createAccessToken } from './token.util.js';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  login(email: string, password: string) {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const user = this.usersService.authenticate(email, password);
    if (!user) throw new UnauthorizedException('E-mail ou senha inválidos.');
    return { accessToken: createAccessToken(user), user };
  }
}
