import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import type { Study, StudyInput, StudyStatus } from './study.types.js';

function todayISO(): string {
  // Estudos do ClinicalStudyPB usam a data civil de Campina Grande/PB.
  // Evita encerrar o estudo horas antes por causa da virada do dia em UTC.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Classificação provisória por datas. O fluxo completo do RF07
// (planejamento, recrutamento, execução e encerrado) ainda terá etapas próprias.
export function statusFor(startDate: string, endDate: string): StudyStatus {
  const today = todayISO();
  if (endDate < today) return 'Encerrado';
  return startDate > today ? 'Planejado' : 'Em andamento';
}

function validISODate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(`${date}T`);
}

@Injectable()
export class StudiesService {
  // Etapa intermediária da Sprint 1: em memória, seguindo UsersService.
  // A migração para PostgreSQL pertence à tarefa T16-A e ainda é necessária.
  private readonly studies: Study[] = [
    {
      id: 'study-1', code: 'EST-001', title: 'Qualidade do sono',
      objective: 'Investigar padrões de sono e acompanhar indicadores da qualidade do sono dos participantes.',
      researcherId: 'usr-researcher', researcher: 'Marina Costa',
      startDate: '2026-04-01', endDate: '2026-11-28',
      participantLimit: 30, participantsLinked: 18,
      status: statusFor('2026-04-01', '2026-11-28'), kind: 'Estudo observacional', symbol: 'moon',
    },
    {
      id: 'study-2', code: 'EST-002', title: 'Acomp. da pressão arterial',
      objective: 'Acompanhar indicadores de pressão arterial e observar alterações ao longo do período do estudo.',
      researcherId: 'usr-researcher', researcher: 'Marina Costa',
      startDate: '2026-05-06', endDate: '2026-12-30',
      participantLimit: 25, participantsLinked: 11,
      status: statusFor('2026-05-06', '2026-12-30'), kind: 'Estudo longitudinal', symbol: 'heart',
    },
    {
      id: 'study-3', code: 'EST-003', title: 'Hábitos de atividade física',
      objective: 'Avaliar hábitos de atividade física e acompanhar padrões de atividade ao longo do período.',
      researcherId: 'usr-researcher', researcher: 'Marina Costa',
      startDate: '2027-01-11', endDate: '2027-06-30',
      participantLimit: 20, participantsLinked: 0,
      status: statusFor('2027-01-11', '2027-06-30'), kind: 'Estudo observacional', symbol: 'activity',
    },
  ];
  private sequence = 3;

  constructor(private readonly usersService: UsersService) {}

  listForResearcher(researcherId: string): Study[] {
    this.assertResearcher(researcherId);
    return this.studies
      .filter((study) => study.researcherId === researcherId)
      .map((study) => ({ ...study, status: statusFor(study.startDate, study.endDate) }));
  }

  findById(id: string, researcherId: string): Study {
    this.assertResearcher(researcherId);
    const found = this.findOwned(id, researcherId);
    return { ...found, status: statusFor(found.startDate, found.endDate) };
  }

  create(input: StudyInput, researcherId: string): Study {
    const researcherName = this.assertResearcher(researcherId);
    const data = this.validateInput(input);
    this.sequence += 1;
    const study: Study = {
      id: randomUUID(),
      code: `EST-${String(this.sequence).padStart(3, '0')}`,
      ...data,
      researcherId,
      researcher: researcherName,
      status: statusFor(data.startDate, data.endDate),
      kind: 'Estudo observacional',
      symbol: 'activity',
    };
    this.studies.push(study);
    return { ...study };
  }

  update(id: string, input: Partial<StudyInput>, researcherId: string): Study {
    this.assertResearcher(researcherId);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
      throw new BadRequestException('Informe ao menos um campo para alterar.');
    }
    const study = this.findOwned(id, researcherId);
    const data = this.validateInput({
      title: input?.title ?? study.title,
      objective: input?.objective ?? study.objective,
      startDate: input?.startDate ?? study.startDate,
      endDate: input?.endDate ?? study.endDate,
      participantLimit: input?.participantLimit ?? study.participantLimit,
      participantsLinked: input?.participantsLinked ?? study.participantsLinked,
    });
    Object.assign(study, data, { status: statusFor(data.startDate, data.endDate) });
    return { ...study };
  }

  private findOwned(id: string, researcherId: string): Study {
    const study = this.studies.find((entry) => entry.id === id);
    if (!study) throw new NotFoundException('Estudo não encontrado.');
    if (study.researcherId !== researcherId) {
      throw new ForbiddenException('Você não tem permissão para acessar este estudo.');
    }
    return study;
  }

  private assertResearcher(researcherId: string): string {
    const user = this.usersService.findById(researcherId);
    if (user.role !== 'Pesquisador' || user.status !== 'Ativo') {
      throw new ForbiddenException('Apenas pesquisadores ativos podem gerenciar seus estudos.');
    }
    return user.name;
  }

  private validateInput(input: StudyInput): StudyInput {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('Informe os dados do estudo.');
    }
    if (typeof input.title !== 'string' || input.title.trim().length < 3) {
      throw new BadRequestException('O título deve ter pelo menos 3 caracteres.');
    }
    if (typeof input.objective !== 'string' || input.objective.trim().length < 8) {
      throw new BadRequestException('O objetivo deve ter pelo menos 8 caracteres.');
    }
    if (!validISODate(input.startDate) || !validISODate(input.endDate)) {
      throw new BadRequestException('Informe datas válidas no formato AAAA-MM-DD.');
    }
    if (input.endDate < input.startDate) {
      throw new BadRequestException('A data de término deve ser igual ou posterior à data de início.');
    }
    if (!Number.isInteger(input.participantLimit) || input.participantLimit < 1) {
      throw new BadRequestException('O limite de participantes deve ser pelo menos 1.');
    }
    if (!Number.isInteger(input.participantsLinked) || input.participantsLinked < 0) {
      throw new BadRequestException('Informe uma quantidade válida de participantes vinculados.');
    }
    if (input.participantsLinked > input.participantLimit) {
      throw new BadRequestException('Os participantes vinculados não podem ultrapassar o limite definido.');
    }
    return {
      title: input.title.trim(), objective: input.objective.trim(),
      startDate: input.startDate, endDate: input.endDate,
      participantLimit: input.participantLimit,
      participantsLinked: input.participantsLinked,
    };
  }
}
