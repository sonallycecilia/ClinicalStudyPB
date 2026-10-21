import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard.js';
import { createAccessToken } from './token.util.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { UsersService } from '../users/users.service.js';

describe('AccessTokenGuard', () => {
  const usersService = new UsersService();
  const guard = new AccessTokenGuard(usersService);
  const demoUser = usersService.findById('usr-researcher');

  function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('nega a rota quando não existe token', () => {
    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('nega a rota quando o token é inválido', () => {
    const request = { headers: { authorization: 'Bearer token-incorreto' } };
    expect(() => guard.canActivate(contextFor(request))).toThrow(UnauthorizedException);
  });

  it('permite a rota e inclui o perfil quando o token é válido', () => {
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${createAccessToken(demoUser)}` },
    };
    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.user?.role).toBe('Pesquisador');
    expect(request.user?.sub).toBe(demoUser.id);
  });
});
