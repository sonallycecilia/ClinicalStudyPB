import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(new UsersService());
  });

  it('emite token e dados públicos para credenciais válidas', () => {
    const result = authService.login('ana.souza@clinicalstudypb.test', 'Admin123!');
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.user.role).toBe('Administrador');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('nega credenciais inválidas', () => {
    expect(() => authService.login('ana.souza@clinicalstudypb.test', 'senha-errada')).toThrow(UnauthorizedException);
  });
});
