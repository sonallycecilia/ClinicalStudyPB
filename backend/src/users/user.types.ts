export const USER_ROLES = [
  'Administrador',
  'Pesquisador',
  'Coordenador',
  'Participante',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AccountStatus = 'Ativo' | 'Inativo';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface InternalUser extends PublicUser {
  passwordHash: string;
  passwordSalt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  status?: AccountStatus;
}
