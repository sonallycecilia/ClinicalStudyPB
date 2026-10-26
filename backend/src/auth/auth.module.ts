import { DatabaseModule } from '../database/database.module.js';
import { SessionsService } from './sessions.service.js';
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [UsersModule, DatabaseModule],
  controllers: [AuthController],
  providers: [SessionsService, AuthService, AccessTokenGuard, RolesGuard],
  exports: [AccessTokenGuard, RolesGuard, SessionsService],
})
export class AuthModule {}
