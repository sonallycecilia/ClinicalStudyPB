import type { UserRole } from '../types';
import { UsersRound, FlaskConical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
}

// Cada perfil enxerga somente as áreas implementadas para ele nesta versão.
export const MENU_ITEMS: MenuItem[] = [
  { label: 'Administração de usuários', path: '/usuarios', icon: UsersRound, roles: ['Administrador'] },
  { label: 'Estudos clínicos', path: '/estudos', icon: FlaskConical, roles: ['Pesquisador'] },
];

const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/usuarios': ['Administrador'],
  '/estudos': ['Pesquisador'],
};

export function menuForRole(role: UserRole): MenuItem[] {
  return MENU_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessRoute(role: UserRole | undefined, path: string): boolean {
  if (!role) return false;
  const allowedRoles = ROUTE_ACCESS[path];
  return Boolean(allowedRoles?.includes(role));
}

export function getHomeForRole(role: UserRole): string {
  if (role === 'Administrador') return '/usuarios';
  if (role === 'Pesquisador') return '/estudos';
  return '/403';
}
