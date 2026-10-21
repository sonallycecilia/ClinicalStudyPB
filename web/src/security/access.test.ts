import { describe, expect, it } from 'vitest';
import { canAccessRoute, getHomeForRole, menuForRole } from './access';

describe('permissões por perfil — tasks 3078, 3081 e 3094', () => {
  it('exibe administração de usuários somente para administradores', () => {
    expect(menuForRole('Administrador').map((item) => item.path)).toEqual(['/usuarios']);
    expect(menuForRole('Pesquisador')).toEqual([]);
    expect(menuForRole('Coordenador')).toEqual([]);
    expect(canAccessRoute('Pesquisador', '/usuarios')).toBe(false);
    expect(canAccessRoute('Coordenador', '/usuarios')).toBe(false);
  });

  it('bloqueia quem não está autenticado ou tenta abrir rotas não definidas', () => {
    expect(canAccessRoute(undefined, '/usuarios')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/')).toBe(false);
    expect(canAccessRoute('Coordenador', '/app/estudos')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/app/protocolos')).toBe(false);
  });

  it('direciona o administrador à tela implementada e os outros perfis à página de acesso indisponível nesta versão', () => {
    expect(getHomeForRole('Administrador')).toBe('/usuarios');
    expect(getHomeForRole('Pesquisador')).toBe('/403');
    expect(getHomeForRole('Coordenador')).toBe('/403');
  });

  it('não mantém páginas genéricas ou telas extras no menu', () => {
    expect(menuForRole('Administrador').map((item) => item.path)).toEqual(['/usuarios']);
    expect(menuForRole('Pesquisador').map((item) => item.path)).toEqual([]);
    expect(menuForRole('Coordenador').map((item) => item.path)).toEqual([]);
    expect(canAccessRoute('Pesquisador', '/app')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/app/estudos')).toBe(false);
  });
});
