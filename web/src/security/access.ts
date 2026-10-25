import type { UserRole } from '../types';
import { UsersRound, FlaskConical, LayoutDashboard, Users, CalendarCheck, CalendarClock, FileText, } from 'lucide-react';
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
  { label: 'Painel do coordenador', path: '/coordenador/painel', icon: LayoutDashboard, roles: ['Coordenador'] },
  { label: 'Candidatos e participantes', path: '/coordenador/candidatos', icon: Users, roles: ['Coordenador'] },
  { label: 'Visitas e avaliações', path: '/coordenador/visitas', icon: CalendarCheck, roles: ['Coordenador'] },
  { label: 'Reagendamentos', path: '/coordenador/reagendamentos', icon: CalendarClock, roles: ['Coordenador'] },
  { label: 'Relatórios', path: '/coordenador/relatorios', icon: FileText, roles: ['Coordenador'] },
];

const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/usuarios': ['Administrador'],
  '/estudos': ['Pesquisador'],
  '/coordenador/painel': ['Coordenador'],
  '/coordenador/candidatos': ['Coordenador'],
  '/coordenador/visitas': ['Coordenador'],
  '/coordenador/reagendamentos': ['Coordenador'],
  '/coordenador/relatorios': ['Coordenador'],
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
  if (role === 'Coordenador') return '/coordenador/painel';
  return '/403';
}
