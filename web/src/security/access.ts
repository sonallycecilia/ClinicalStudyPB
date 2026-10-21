import type { UserRole } from '../types';
import { UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
}

// Apenas a página com design aprovado nesta versão fica disponível no menu.
// As áreas do Pesquisador e do Coordenador serão adicionadas quando seus designs
// forem implementados em uma task própria; esta versão não inclui a task 3205.
export const MENU_ITEMS: MenuItem[] = [
  { label: 'Administração de usuários', path: '/usuarios', icon: UsersRound, roles: ['Administrador'] },
];

const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/usuarios': ['Administrador'],
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
  return '/403';
}
