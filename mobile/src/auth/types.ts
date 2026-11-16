export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Administrador' | 'Pesquisador' | 'Coordenador' | 'Participante';
  status: 'Ativo' | 'Inativo';
  createdAt: string;
}

export interface LoginResponse { accessToken: string; user: User }
// GET /auth/me retorna o usuário diretamente, sem o envelope do login.
export type MeResponse = User;

export function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return ['id', 'name', 'email', 'createdAt'].every(key => typeof user[key] === 'string' && !!user[key].trim())
    && typeof user.phone === 'string'
    && ['Administrador', 'Pesquisador', 'Coordenador', 'Participante'].includes(user.role as string)
    && ['Ativo', 'Inativo'].includes(user.status as string);
}

export function accessError(user: User): string | null {
  if (user.status !== 'Ativo') return 'Esta conta está inativa. Entre em contato com a administração.';
  if (user.role !== 'Participante') return 'Este aplicativo é destinado ao perfil Participante.';
  return null;
}
