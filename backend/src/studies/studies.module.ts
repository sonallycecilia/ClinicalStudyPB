import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { StudiesController } from './studies.controller.js';
import { StudiesService } from './studies.service.js';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [StudiesController],
  providers: [StudiesService],
  exports: [StudiesService],
})
export class StudiesModule {}
