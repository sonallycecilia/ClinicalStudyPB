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
import { ParticipantVisitsController } from './participant-visits.controller.js';
import { ParticipantVisitsService } from './participant-visits.service.js';
import { ParticipantSelfServiceController } from './participant-self-service.controller.js';
import {
  ParticipantSelfService,
  ParticipantSelfServiceClock,
} from './participant-self-service.service.js';

@Module({
  // Controllers apply these guards locally. Their dependencies are made
  // available through AuthModule and UsersModule.
  imports: [DatabaseModule, AuthModule, UsersModule],
  controllers: [
    StudiesController,
    CriteriaController,
    VisitsController,
    CandidatesController,
    ParticipantVisitsController,
    ParticipantSelfServiceController,
  ],
  providers: [
    StudiesService,
    CriteriaService,
    VisitsService,
    CandidatesService,
    ParticipantVisitsService,
    ParticipantSelfService,
    ParticipantSelfServiceClock,
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [StudiesService],
})
export class StudiesModule {}
