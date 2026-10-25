import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { StudiesService } from './studies.service.js';
import type { StudyInput } from './study.types.js';

@Controller('studies')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('Pesquisador')
export class StudiesController {
  constructor(private readonly studiesService: StudiesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.studiesService.listForResearcher(request.user!.sub);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.studiesService.findById(id, request.user!.sub);
  }

  @Post()
  create(@Body() input: StudyInput, @Req() request: AuthenticatedRequest) {
    return this.studiesService.create(input, request.user!.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: Partial<StudyInput>, @Req() request: AuthenticatedRequest) {
    return this.studiesService.update(id, input, request.user!.sub);
  }
}
