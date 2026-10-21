import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { verifyAccessToken } from './token.util.js';
import { UsersService } from '../users/users.service.js';
import type { PublicUser } from '../users/user.types.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Faça login para acessar este recurso.');
    }

    const payload = verifyAccessToken(authorization.slice('Bearer '.length).trim());
    if (!payload) {
      throw new UnauthorizedException('Token inválido ou expirado. Entre novamente.');
    }

    // Confere a conta atual: uma conta inativada ou com perfil alterado não conserva
    // permissões antigas apenas porque ainda possui um token não expirado.
    let currentUser: PublicUser;
    try {
      currentUser = this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('A conta associada a este token não existe mais.');
    }
    if (currentUser.status !== 'Ativo') {
      throw new UnauthorizedException('Esta conta está inativa. Entre em contato com a administração.');
    }

    request.user = { ...payload, email: currentUser.email, role: currentUser.role };
    return true;
  }
}
