import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard.js';
import { createAccessToken } from './token.util.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { UsersService } from '../users/users.service.js';
import { SessionsService } from './sessions.service.js';
import type { PublicUser } from '../users/user.types.js';

describe('AccessTokenGuard', () => {
  const user: PublicUser = { id: '00000000-0000-4000-8000-000000000001', name: 'Teste Pessoa', email: 'teste@example.test', phone: '83999990000', role: 'Pesquisador', status: 'Ativo', createdAt: new Date().toISOString() };
  let active: boolean;
  let current: PublicUser;
  let guard: AccessTokenGuard;
  beforeEach(() => {
    active = true; current = { ...user };
    guard = new AccessTokenGuard({ findById: async () => current } as unknown as UsersService,
      { isActive: async () => active } as unknown as SessionsService);
  });
  function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  }
  it('nega token ausente, inválido ou expirado', async () => {
    for (const token of [null, 'incorreto', createAccessToken(user, -1)]) {
      await expect(guard.canActivate(contextFor({ headers: token ? { authorization: 'Bearer ' + token } : {} }))).rejects.toThrow(UnauthorizedException);
    }
  });
  it('nega sessão revogada e conta inativa', async () => {
    const request = { headers: { authorization: 'Bearer ' + createAccessToken(user) } };
    active = false;
    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
    active = true; current.status = 'Inativo';
    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
  });
  it('usa o perfil atual do banco em vez do perfil antigo do token', async () => {
    current.role = 'Participante';
    const request: Partial<AuthenticatedRequest> = { headers: { authorization: 'Bearer ' + createAccessToken(user) } };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user?.role).toBe('Participante');
  });
});
