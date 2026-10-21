import type { UserRole } from '../users/user.types.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
