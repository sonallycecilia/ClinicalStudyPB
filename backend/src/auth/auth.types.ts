import type { UserRole } from '../users/user.types.js';

export interface AccessTokenPayload {
  jti: string;
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
