import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AccessTokenGuard, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
