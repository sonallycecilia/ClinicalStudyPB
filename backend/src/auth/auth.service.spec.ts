import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { SessionsService } from './sessions.service.js';
import { verifyAccessToken } from './token.util.js';
import type { PublicUser } from '../users/user.types.js';

describe('AuthService', () => {
  const user: PublicUser = { id: '00000000-0000-4000-8000-000000000001', name: 'Teste Pessoa', email: 'teste@example.test', phone: '83999990000', role: 'Administrador', status: 'Ativo', createdAt: new Date().toISOString() };
  let valid: boolean;
  let sessionId: string | undefined;
  let service: AuthService;
  beforeEach(() => {
    valid = true; sessionId = undefined;
    service = new AuthService(
      { authenticate: async () => valid ? user : null } as unknown as UsersService,
      { create: async (payload: { jti: string }) => { sessionId = payload.jti; }, revoke: async () => { sessionId = undefined; } } as unknown as SessionsService,
    );
  });
  it('emite tokens distintos e registra cada sessão', async () => {
    const first = await service.login(user.email, 'Senha123!');
    expect(verifyAccessToken(first.accessToken)?.jti).toBe(sessionId);
    const second = await service.login(user.email, 'Senha123!');
    expect(first.accessToken).not.toBe(second.accessToken);
    await service.logout(sessionId!);
    expect(sessionId).toBeUndefined();
  });
  it('nega credenciais inválidas sem criar sessão', async () => {
    valid = false;
    await expect(service.login(user.email, 'errada')).rejects.toThrow(UnauthorizedException);
    expect(sessionId).toBeUndefined();
  });
});
