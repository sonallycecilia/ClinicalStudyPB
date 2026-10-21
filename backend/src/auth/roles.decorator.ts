import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../users/user.types.js';

export const REQUIRED_ROLES_KEY = 'required_roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
