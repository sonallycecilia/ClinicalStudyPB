export type UserRole = 'Administrador' | 'Pesquisador' | 'Coordenador' | 'Participante';
export type AccountStatus = 'Ativo' | 'Inativo';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}
