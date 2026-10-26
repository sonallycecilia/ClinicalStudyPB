import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('permite quando não há perfil restrito configurado', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(contextFor({}))).toBe(true);
  });

  it('permite administrador em rota exclusiva de administração', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['Administrador']);
    expect(guard.canActivate(contextFor({ user: { role: 'Administrador' } as never }))).toBe(true);
  });

  it('nega pesquisador em rota exclusiva de administração', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['Administrador']);
    expect(() => guard.canActivate(contextFor({ user: { role: 'Pesquisador' } as never }))).toThrow(ForbiddenException);
  });
});
