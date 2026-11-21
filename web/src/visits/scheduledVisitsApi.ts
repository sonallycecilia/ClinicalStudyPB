import type { AuthenticatedRequest } from '../studies/studiesApi';

/** Participação no estudo (E01, seção 7.1 do contrato RF12–RF18). */
export interface IncludedParticipant {
  participationId: string;
  candidateId: string;
  studyId: string;
  name: string;
  participationStatus: 'Ativo' | 'Retirado' | 'Concluído';
  /** Data civil YYYY-MM-DD. */
  includedAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

export type ScheduledVisitStatus = 'Agendada' | 'Realizada' | 'Ausente' | 'Cancelada';

/** Visita agendada (E02, seção 7.2 do contrato RF12–RF18). Instantes em ISO 8601 UTC. */
export interface ScheduledVisit {
  id: string;
  studyId: string;
  participationId: string;
  participantName: string;
  plannedVisitId: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: string;
  status: ScheduledVisitStatus;
  realizedAt: string | null;
  observation: string | null;
  createdAt: string;
}

export interface CreateScheduledVisitInput {
  participationId: string;
  plannedVisitId: string;
  /** Instante ISO 8601 com fuso (ex.: `2026-11-24T12:00:00.000Z`). */
  scheduledAt: string;
  observation?: string | null;
}

export type ScheduleField = keyof CreateScheduledVisitInput;

export const SCHEDULE_CONNECTION_ERROR = 'Não foi possível comunicar com o servidor. Verifique sua conexão e tente novamente.';
export const SCHEDULE_UNEXPECTED_ERROR = 'Não foi possível concluir o agendamento. Tente novamente em alguns instantes.';
export const SCHEDULE_INVALID_RESPONSE = 'O servidor retornou um agendamento inválido. Consulte a agenda antes de tentar novamente.';
export const PARTICIPANTS_LOAD_ERROR = 'Não foi possível carregar os participantes do estudo. Tente novamente.';
const SESSION_EXPIRED = 'Sua sessão expirou ou é inválida. Entre novamente para continuar.';

/** Recusas de domínio de E02, identificadas pelo `code` da resposta. */
export const SCHEDULE_DOMAIN_ERRORS: Record<string, { message: string; field?: ScheduleField }> = {
  STUDY_CLOSED: { message: 'Não é possível alterar um estudo encerrado.' },
  PARTICIPATION_NOT_ACTIVE: { message: 'Somente participantes ativos podem ter visitas agendadas.', field: 'participationId' },
  SCHEDULE_OUT_OF_RANGE: { message: 'A data agendada deve estar entre a inclusão do participante e o término do estudo.', field: 'scheduledAt' },
  VISIT_ALREADY_SCHEDULED: { message: 'Esta visita prevista já está agendada ou realizada para o participante.', field: 'plannedVisitId' },
};

const SCHEDULE_FIELDS: readonly ScheduleField[] = ['participationId', 'plannedVisitId', 'scheduledAt', 'observation'];
const SERVER_FIELD_ERROR = 'O servidor recusou este valor. Revise o campo.';

export class ScheduledVisitsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    /** Campos do formulário apontados pela recusa do servidor. */
    readonly fieldErrors: Partial<Record<ScheduleField, string>> = {},
  ) {
    super(message);
    this.name = 'ScheduledVisitsApiError';
  }
}

interface ErrorBody { message?: unknown; code?: unknown }

function textOf(message: unknown): string {
  if (typeof message === 'string') return message.trim();
  return '';
}

// O ValidationPipe responde uma lista em inglês que começa pelo nome do campo ("scheduledAt must be...").
function rejectedFields(messages: unknown[]): Partial<Record<ScheduleField, string>> {
  const fields = messages.flatMap((item) => {
    const field = typeof item === 'string' ? /^(?:property )?(\w+)/.exec(item)?.[1] : undefined;
    return field && (SCHEDULE_FIELDS as readonly string[]).includes(field) ? [field as ScheduleField] : [];
  });
  return Object.fromEntries(fields.map((field) => [field, SERVER_FIELD_ERROR]));
}

function scheduleError(status: number, body: ErrorBody | null): ScheduledVisitsApiError {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const domain = code && Object.hasOwn(SCHEDULE_DOMAIN_ERRORS, code) ? SCHEDULE_DOMAIN_ERRORS[code] : undefined;
  if (domain && (status === 400 || status === 409)) {
    return new ScheduledVisitsApiError(domain.message, status, code, domain.field ? { [domain.field]: domain.message } : {});
  }
  const detail = textOf(body?.message);
  if (status === 400) {
    if (Array.isArray(body?.message)) {
      return new ScheduledVisitsApiError('Os dados do agendamento foram recusados. Revise os campos e tente novamente.', status, code, rejectedFields(body.message));
    }
    // O ParseUUIDPipe responde "Validation failed (...)": texto técnico, não exibido.
    const userFacing = detail && !detail.startsWith('Validation failed');
    return new ScheduledVisitsApiError(userFacing ? detail : 'Os dados do agendamento foram recusados. Revise os campos e tente novamente.', status, code);
  }
  const fallbacks: Record<number, string> = {
    401: SESSION_EXPIRED,
    403: 'Você não tem permissão para agendar visitas neste estudo.',
    404: 'Estudo, participante ou visita prevista não encontrado. Atualize os dados e tente novamente.',
    409: 'O agendamento foi recusado por conflito. Confira a agenda antes de tentar novamente.',
  };
  // 403, 404 e 409 do backend trazem mensagens em português escritas para o usuário.
  const message = status !== 401 && fallbacks[status] && detail ? detail : fallbacks[status] ?? SCHEDULE_UNEXPECTED_ERROR;
  return new ScheduledVisitsApiError(message, status, code);
}

function participantsError(status: number, body: ErrorBody | null): ScheduledVisitsApiError {
  const detail = textOf(body?.message);
  const fallbacks: Record<number, string> = {
    401: SESSION_EXPIRED,
    403: 'Você não tem permissão para consultar os participantes deste estudo.',
    404: 'Estudo não encontrado. Atualize os estudos disponíveis.',
  };
  const message = (status === 403 || status === 404) && detail ? detail : fallbacks[status] ?? PARTICIPANTS_LOAD_ERROR;
  return new ScheduledVisitsApiError(message, status);
}

async function send(request: AuthenticatedRequest, path: string, init: RequestInit, toError: (status: number, body: ErrorBody | null) => ScheduledVisitsApiError, connectionError: string): Promise<unknown> {
  let response: Response;
  try {
    response = await request(path, init);
  } catch (reason) {
    if (init.signal?.aborted) throw reason;
    throw new ScheduledVisitsApiError(connectionError);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toError(response.status, body && typeof body === 'object' ? body as ErrorBody : null);
  return body;
}

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isNullableText = (value: unknown) => value === null || typeof value === 'string';

export function isIncludedParticipant(value: unknown): value is IncludedParticipant {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<IncludedParticipant>;
  return isId(item.participationId) && isId(item.candidateId) && isId(item.studyId)
    && typeof item.name === 'string'
    && ['Ativo', 'Retirado', 'Concluído'].includes(item.participationStatus as string)
    && isDate(item.includedAt)
    && (item.withdrawnAt === null || isDate(item.withdrawnAt))
    && isNullableText(item.withdrawalReason);
}

/** Confere também a identidade do agendamento retornado em relação ao que foi enviado. */
export function isScheduledVisit(value: unknown, studyId: string, input: Pick<CreateScheduledVisitInput, 'participationId' | 'plannedVisitId'>): value is ScheduledVisit {
  if (!value || typeof value !== 'object') return false;
  const visit = value as Partial<ScheduledVisit>;
  return isId(visit.id) && visit.studyId === studyId
    && visit.participationId === input.participationId && visit.plannedVisitId === input.plannedVisitId
    && typeof visit.participantName === 'string' && typeof visit.plannedVisitName === 'string'
    && Number.isInteger(visit.plannedVisitOrder)
    && isInstant(visit.scheduledAt) && visit.status === 'Agendada'
    && visit.realizedAt === null && isNullableText(visit.observation) && isInstant(visit.createdAt);
}

const studyPath = (studyId: string) => `/studies/${encodeURIComponent(studyId)}`;

/** E01 — somente participações ativas podem receber agendamento. */
async function listActiveParticipants(request: AuthenticatedRequest, studyId: string, signal?: AbortSignal): Promise<IncludedParticipant[]> {
  const body = await send(request, `${studyPath(studyId)}/participants?status=Ativo`, { signal }, participantsError, SCHEDULE_CONNECTION_ERROR);
  if (!Array.isArray(body) || !body.every(isIncludedParticipant)) {
    throw new ScheduledVisitsApiError('O servidor retornou uma listagem de participantes inválida. Tente novamente.');
  }
  return body.filter((item) => item.studyId === studyId && item.participationStatus === 'Ativo');
}

/** E02 — o corpo leva somente os campos do contrato (o backend recusa campos extras). */
async function schedule(request: AuthenticatedRequest, studyId: string, input: CreateScheduledVisitInput, signal?: AbortSignal): Promise<ScheduledVisit> {
  const observation = input.observation?.trim();
  const body = await send(request, `${studyPath(studyId)}/scheduled-visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      participationId: input.participationId,
      plannedVisitId: input.plannedVisitId,
      scheduledAt: input.scheduledAt,
      ...(observation ? { observation } : {}),
    }),
  }, scheduleError, SCHEDULE_CONNECTION_ERROR);
  if (!isScheduledVisit(body, studyId, input)) throw new ScheduledVisitsApiError(SCHEDULE_INVALID_RESPONSE);
  return body;
}

export const scheduledVisitsApi = { listActiveParticipants, schedule };

const SAO_PAULO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const SAO_PAULO_DATE_TIME = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Converte o valor de um `<input type="datetime-local">` (horário do navegador) em instante ISO UTC. */
export function localDateTimeToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Dia civil em America/Sao_Paulo (YYYY-MM-DD), a referência das regras por data (D-13). */
export function saoPauloDay(instant: string): string {
  return SAO_PAULO_DAY.format(new Date(instant));
}

/** Data e hora para exibição, no fuso de referência do estudo. */
export function formatScheduledAt(instant: string): string {
  return SAO_PAULO_DATE_TIME.format(new Date(instant)).replace(',', ' ·');
}
