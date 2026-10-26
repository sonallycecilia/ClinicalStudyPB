import { describe, expect, it } from 'vitest';
import { canAccessRoute, getHomeForRole, menuForRole } from './access';

describe('permissões por perfil — tasks 3078, 3081 e 3094', () => {
  it('exibe somente os menus autorizados para cada perfil web', () => {
    expect(menuForRole('Administrador').map((item) => item.path)).toEqual(['/usuarios']);
    expect(menuForRole('Pesquisador').map((item) => item.path)).toEqual(['/estudos']);
    expect(menuForRole('Coordenador').map((item) => item.path)).toEqual([
      '/coordenador/painel', '/coordenador/candidatos', '/coordenador/visitas',
      '/coordenador/reagendamentos', '/coordenador/relatorios',
    ]);
  });

  it('nega acesso cruzado entre os perfis', () => {
    expect(canAccessRoute('Pesquisador', '/usuarios')).toBe(false);
    expect(canAccessRoute('Administrador', '/estudos')).toBe(false);
    expect(canAccessRoute('Coordenador', '/estudos')).toBe(false);
    expect(canAccessRoute('Coordenador', '/usuarios')).toBe(false);
    expect(canAccessRoute('Administrador', '/coordenador/painel')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/coordenador/painel')).toBe(false);
  });

  it('bloqueia quem não está autenticado ou tenta abrir rotas não definidas', () => {
    expect(canAccessRoute(undefined, '/usuarios')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/')).toBe(false);
    expect(canAccessRoute('Coordenador', '/app/estudos')).toBe(false);
    expect(canAccessRoute('Pesquisador', '/app/protocolos')).toBe(false);
  });

  it('direciona cada perfil para uma página inicial disponível', () => {
    expect(getHomeForRole('Administrador')).toBe('/usuarios');
    expect(getHomeForRole('Pesquisador')).toBe('/estudos');
    expect(getHomeForRole('Coordenador')).toBe('/coordenador/painel');
  });
});
