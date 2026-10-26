import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { UsersService } from '../users/users.service.js';
import type { PublicUser } from '../users/user.types.js';
import type { Study, StudyInput, StudyStatus } from './study.types.js';

interface StudyRow extends QueryResultRow {
  id: string;
  code: string;
  title: string;
  objective: string;
  researcherId: string;
  researcher?: string;
  startDate: string | Date;
  endDate: string | Date;
  participantLimit: number;
  participantsLinked: number;
  kind: Study['kind'];
  symbol: Study['symbol'];
}

const SELECT_STUDY_COLUMNS = `
  e.id_estudo::text AS id,
  e.codigo AS code,
  e.titulo AS title,
  e.objetivo AS objective,
  e.id_pesquisador::text AS "researcherId",
  u.nome AS researcher,
  e.data_inicio::text AS "startDate",
  e.data_fim::text AS "endDate",
  e.limite_participantes AS "participantLimit",
  e.participantes_vinculados AS "participantsLinked",
  e.tipo AS kind,
  e.simbolo AS symbol`;

const RETURNING_STUDY_COLUMNS = `
  id_estudo::text AS id,
  codigo AS code,
  titulo AS title,
  objetivo AS objective,
  id_pesquisador::text AS "researcherId",
  data_inicio::text AS "startDate",
  data_fim::text AS "endDate",
  limite_participantes AS "participantLimit",
  participantes_vinculados AS "participantsLinked",
  tipo AS kind,
  simbolo AS symbol`;

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

function normalizeDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toStudy(row: StudyRow, researcherName = row.researcher ?? ''): Study {
  const startDate = normalizeDate(row.startDate);
  const endDate = normalizeDate(row.endDate);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    objective: row.objective,
    researcherId: row.researcherId,
    researcher: researcherName,
    startDate,
    endDate,
    participantLimit: Number(row.participantLimit),
    participantsLinked: Number(row.participantsLinked),
    status: statusFor(startDate, endDate),
    kind: row.kind,
    symbol: row.symbol,
  };
}

@Injectable()
export class StudiesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async listForResearcher(researcherId: string): Promise<Study[]> {
    await this.assertResearcher(researcherId);
    const { rows } = await this.database.query<StudyRow>(
      `SELECT ${SELECT_STUDY_COLUMNS}
       FROM estudos e JOIN usuarios u ON u.id_usuario = e.id_pesquisador
       WHERE e.id_pesquisador = $1
       ORDER BY e.data_inicio, e.criado_em, e.id_estudo`,
      [researcherId],
    );
    return rows.map((row) => toStudy(row));
  }

  async findById(id: string, researcherId: string): Promise<Study> {
    await this.assertResearcher(researcherId);
    const study = await this.findByIdForOwnerCheck(id);
    if (study.researcherId !== researcherId) {
      throw new ForbiddenException('Você não tem permissão para acessar este estudo.');
    }
    return study;
  }

  async create(input: StudyInput, researcherId: string): Promise<Study> {
    const researcher = await this.assertResearcher(researcherId);
    const data = this.validateInput(input);
    try {
      const { rows } = await this.database.query<StudyRow>(
        `INSERT INTO estudos
          (codigo, titulo, objetivo, id_pesquisador, data_inicio, data_fim,
           limite_participantes, participantes_vinculados, tipo, simbolo)
         VALUES (
           'EST-' || lpad(nextval('estudos_codigo_seq')::text, 3, '0'),
           $1, $2, $3, $4::date, $5::date, $6, $7, 'Estudo observacional', 'activity'
         )
         RETURNING ${RETURNING_STUDY_COLUMNS}`,
        [data.title, data.objective, researcherId, data.startDate, data.endDate,
          data.participantLimit, data.participantsLinked],
      );
      if (!rows[0]) throw new Error('O banco não retornou o estudo cadastrado.');
      return toStudy(rows[0], researcher.name);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Não foi possível gerar um código único para o estudo. Tente novamente.');
      }
      throw error;
    }
  }

  async update(id: string, input: Partial<StudyInput>, researcherId: string): Promise<Study> {
    const researcher = await this.assertResearcher(researcherId);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
      throw new BadRequestException('Informe ao menos um campo para alterar.');
    }
    const allowedKeys = new Set(['title', 'objective', 'startDate', 'endDate', 'participantLimit', 'participantsLinked']);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      throw new BadRequestException('A alteração contém campos não permitidos.');
    }
    const current = await this.findByIdForOwnerCheck(id);
    if (current.researcherId !== researcherId) {
      throw new ForbiddenException('Você não tem permissão para alterar este estudo.');
    }
    const data = this.validateInput({
      title: input.title ?? current.title,
      objective: input.objective ?? current.objective,
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate ?? current.endDate,
      participantLimit: input.participantLimit ?? current.participantLimit,
      participantsLinked: input.participantsLinked ?? current.participantsLinked,
    });
    const { rows } = await this.database.query<StudyRow>(
      `UPDATE estudos SET titulo = $3, objetivo = $4, data_inicio = $5::date,
        data_fim = $6::date, limite_participantes = $7, participantes_vinculados = $8
       WHERE id_estudo = $1 AND id_pesquisador = $2
       RETURNING ${RETURNING_STUDY_COLUMNS}`,
      [id, researcherId, data.title, data.objective, data.startDate, data.endDate,
        data.participantLimit, data.participantsLinked],
    );
    if (!rows[0]) throw new NotFoundException('Estudo não encontrado.');
    return toStudy(rows[0], researcher.name);
  }

  private async findByIdForOwnerCheck(id: string): Promise<Study> {
    const { rows } = await this.database.query<StudyRow>(
      `SELECT ${SELECT_STUDY_COLUMNS}
       FROM estudos e JOIN usuarios u ON u.id_usuario = e.id_pesquisador
       WHERE e.id_estudo = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Estudo não encontrado.');
    return toStudy(rows[0]);
  }

  private async assertResearcher(researcherId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(researcherId);
    if (user.role !== 'Pesquisador' || user.status !== 'Ativo') {
      throw new ForbiddenException('Apenas pesquisadores ativos podem gerenciar seus estudos.');
    }
    return user;
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
