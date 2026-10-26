import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { UsersModule } from '../users/users.module.js';
import { StudiesController } from './studies.controller.js';
import { StudiesService } from './studies.service.js';

@Module({
  // StudiesController applies these guards locally. The guard's dependencies
  // are made available through the exported SessionsService (AuthModule) and
  // UsersService (UsersModule).
  imports: [DatabaseModule, AuthModule, UsersModule],
  controllers: [StudiesController],
  providers: [StudiesService, AccessTokenGuard, RolesGuard],
  exports: [StudiesService],
})
export class StudiesModule {}
