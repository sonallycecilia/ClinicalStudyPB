import { describe, expect, it } from 'vitest';
import { canAccessRoute, getHomeForRole, menuForRole } from './access';

describe('permissões por perfil — tasks 3078, 3081 e 3094', () => {
  it('exibe administração de usuários somente para administradores', () => {
    expect(menuForRole('Administrador').map((item) => item.path)).toEqual(['/usuarios']);
    expect(menuForRole('Pesquisador').map((item) => item.path)).toEqual(['/estudos']);
    expect(menuForRole('Coordenador')).toEqual([]);
    expect(canAccessRoute('Pesquisador', '/usuarios')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/estudos')).toBe(true);
    expect(canAccessRoute('Administrador', '/estudos')).toBe(false);
    expect(canAccessRoute('Coordenador', '/usuarios')).toBe(false);
  });

  it('bloqueia quem não está autenticado ou tenta abrir rotas não definidas', () => {
    expect(canAccessRoute(undefined, '/usuarios')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/')).toBe(false);
    expect(canAccessRoute('Coordenador', '/app/estudos')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/app/protocolos')).toBe(false);
  });

  it('direciona cada perfil para sua página inicial disponível', () => {
    expect(getHomeForRole('Administrador')).toBe('/usuarios');
    expect(getHomeForRole('Pesquisador')).toBe('/estudos');
    expect(getHomeForRole('Coordenador')).toBe('/403');
  });

  it('mantém somente Administração de usuários e Estudos clínicos nos menus', () => {
    expect(menuForRole('Administrador').map((item) => item.path)).toEqual(['/usuarios']);
    expect(menuForRole('Pesquisador').map((item) => item.path)).toEqual(['/estudos']);
    expect(menuForRole('Coordenador').map((item) => item.path)).toEqual([]);
    expect(canAccessRoute('Pesquisador', '/app')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/app/estudos')).toBe(false);
  });
});
