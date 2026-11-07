import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { UsersModule } from '../users/users.module.js';
import { CriteriaController } from './criteria.controller.js';
import { CriteriaService } from './criteria.service.js';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesService } from './candidates.service.js';
import { StudiesController } from './studies.controller.js';
import { StudiesService } from './studies.service.js';
import { VisitsController } from './visits.controller.js';
import { VisitsService } from './visits.service.js';

@Module({
  // Controllers apply these guards locally. Their dependencies are made
  // available through AuthModule and UsersModule.
  imports: [DatabaseModule, AuthModule, UsersModule],
  controllers: [StudiesController, CriteriaController, VisitsController, CandidatesController],
  providers: [StudiesService, CriteriaService, VisitsService, CandidatesService, AccessTokenGuard, RolesGuard],
  exports: [StudiesService],
})
export class StudiesModule {}
