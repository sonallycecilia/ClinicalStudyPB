/** Perfis liberados para a navegação da aplicação Web. */
export type UserRole = 'Administrador' | 'Pesquisador' | 'Coordenador';
/** A API compartilhada também mantém contas Participante para o cliente mobile. */
export type AccountRole = UserRole | 'Participante';
export type AccountStatus = 'Ativo' | 'Inativo';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
}

/** Conta autenticada e autorizada a entrar na interface Web. */
export interface WebUser extends Omit<User, 'role'> {
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}
