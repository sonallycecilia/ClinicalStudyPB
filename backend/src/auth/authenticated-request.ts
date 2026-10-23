import type { Request } from 'express';
import type { AccessTokenPayload } from './auth.types.js';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}
