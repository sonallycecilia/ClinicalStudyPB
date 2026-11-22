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

export const SCHEDULED_VISIT_STATUSES = ['Agendada', 'Realizada', 'Ausente', 'Cancelada'] as const;
export type ScheduledVisitStatus = typeof SCHEDULED_VISIT_STATUSES[number];
/** Destinos aceitos por E04: somente uma visita `Agendada` muda, e as três situações finais não mudam (D-05). */
export const FINAL_VISIT_STATUSES = ['Realizada', 'Ausente', 'Cancelada'] as const;
export type FinalVisitStatus = typeof FINAL_VISIT_STATUSES[number];

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

export interface UpdateVisitStatusInput {
  status: FinalVisitStatus;
  /** Instante ISO 8601 com fuso; obrigatório somente para `Realizada`. */
  realizedAt?: string;
  /** Omitido preserva a observação atual; `null` a remove. */
  observation?: string | null;
}

export type StatusField = keyof UpdateVisitStatusInput;

/** Resultado fictício de uma atividade (seção 7.3 do contrato RF12–RF18). */
export interface AssessmentResult {
  id: string;
  scheduledVisitId: string;
  activityId: string;
  value: string;
  unit: string | null;
  observation: string | null;
  registeredAt: string;
  registrarId: string;
}

export interface VisitActivityResult {
  activityId: string;
  name: string;
  type: string;
  description: string | null;
  result: AssessmentResult | null;
}

/** E05 — atividades previstas da visita agendada, com o resultado já registrado (ou `null`). */
export interface ScheduledVisitResults {
  scheduledVisitId: string;
  plannedVisitId: string;
  status: ScheduledVisitStatus;
  activities: VisitActivityResult[];
}

export interface RegisterResultInput {
  activityId: string;
  value: string;
  unit?: string | null;
  observation?: string | null;
}

export type ResultField = keyof RegisterResultInput;

/** Resultado no histórico (E07), com o nome e o tipo da atividade. */
export interface HistoricalResult extends AssessmentResult {
  activityName: string;
  activityType: string;
}

export interface HistoricalVisit extends ScheduledVisit {
  results: HistoricalResult[];
}

/** E07 — participação e visitas em ordem cronológica, cada uma com seus resultados. */
export interface ParticipantHistory {
  participant: IncludedParticipant;
  visits: HistoricalVisit[];
}

export const RESULT_UNIT_MAX = 50;
export const RESULT_OBSERVATION_MAX = 2000;

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

export const STATUS_UPDATE_UNEXPECTED_ERROR = 'Não foi possível atualizar a situação da visita. Tente novamente em alguns instantes.';
export const STATUS_UPDATE_INVALID_RESPONSE = 'O servidor retornou uma visita inválida. Atualize a agenda antes de tentar novamente.';
export const SCHEDULED_VISITS_LOAD_ERROR = 'Não foi possível carregar as visitas agendadas. Tente novamente.';

/** Recusas de domínio de E04. A mensagem de VISIT_STATUS_FINAL vem do servidor, pois cita a situação atual. */
export const STATUS_DOMAIN_ERRORS: Record<string, { message: string; field?: StatusField; useServerMessage?: boolean }> = {
  VISIT_STATUS_FINAL: { message: 'A situação desta visita já foi registrada e não pode ser alterada.', field: 'status', useServerMessage: true },
  REALIZED_AT_INVALID: { message: 'A data de realização é inválida. Ela não pode ser futura nem anterior à inclusão do participante.', field: 'realizedAt' },
  STUDY_CLOSED: { message: 'Não é possível alterar um estudo encerrado.' },
  PARTICIPATION_NOT_ACTIVE: { message: 'Somente visitas de participantes ativos podem ser atualizadas.' },
};

const STATUS_FIELDS: readonly StatusField[] = ['status', 'realizedAt', 'observation'];

export const RESULTS_LOAD_ERROR = 'Não foi possível carregar as atividades da visita. Tente novamente.';
export const RESULT_UNEXPECTED_ERROR = 'Não foi possível registrar o resultado. Tente novamente em alguns instantes.';
export const RESULT_INVALID_RESPONSE = 'O servidor retornou um resultado inválido. Atualize as atividades antes de tentar novamente.';

/** Recusas de domínio de E06. */
export const RESULT_DOMAIN_ERRORS: Record<string, { message: string; field?: ResultField }> = {
  VISIT_NOT_REALIZED: { message: 'Registre resultados somente em visitas realizadas.' },
  ACTIVITY_NOT_IN_VISIT: { message: 'A atividade não pertence à visita prevista agendada.' },
  STUDY_CLOSED: { message: 'Não é possível alterar um estudo encerrado.' },
  RESULT_ALREADY_REGISTERED: { message: 'Já existe resultado registrado para esta atividade nesta visita.' },
};

const RESULT_FIELDS: readonly ResultField[] = ['activityId', 'value', 'unit', 'observation'];

export class ScheduledVisitsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    /** Campos do formulário apontados pela recusa do servidor. */
    readonly fieldErrors: Partial<Record<ScheduleField | StatusField | ResultField, string>> = {},
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
function rejectedFields<F extends string>(messages: unknown[], known: readonly F[]): Partial<Record<F, string>> {
  const fields = messages.flatMap((item) => {
    const field = typeof item === 'string' ? /^(?:property )?(\w+)/.exec(item)?.[1] : undefined;
    return field && (known as readonly string[]).includes(field) ? [field as F] : [];
  });
  return Object.fromEntries(fields.map((field) => [field, SERVER_FIELD_ERROR])) as Partial<Record<F, string>>;
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
      return new ScheduledVisitsApiError('Os dados do agendamento foram recusados. Revise os campos e tente novamente.', status, code, rejectedFields(body.message, SCHEDULE_FIELDS));
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

function statusUpdateError(status: number, body: ErrorBody | null): ScheduledVisitsApiError {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const detail = textOf(body?.message);
  const domain = code && Object.hasOwn(STATUS_DOMAIN_ERRORS, code) ? STATUS_DOMAIN_ERRORS[code] : undefined;
  if (domain && status === 400) {
    const message = domain.useServerMessage && detail ? detail : domain.message;
    return new ScheduledVisitsApiError(message, status, code, domain.field ? { [domain.field]: message } : {});
  }
  if (status === 400) {
    const invalid = 'Os dados da atualização foram recusados. Revise os campos e tente novamente.';
    if (Array.isArray(body?.message)) {
      // O validador de realizedAt responde em português; os demais itens vêm em inglês, iniciando pelo campo.
      const realizedAtMessage = body.message.find((item): item is string => typeof item === 'string' && item.startsWith('Informe a data de realização'));
      const fieldErrors = rejectedFields(body.message, STATUS_FIELDS);
      if (realizedAtMessage) fieldErrors.realizedAt = realizedAtMessage;
      return new ScheduledVisitsApiError(invalid, status, code, fieldErrors);
    }
    return new ScheduledVisitsApiError(detail && !detail.startsWith('Validation failed') ? detail : invalid, status, code);
  }
  const fallbacks: Record<number, string> = {
    401: SESSION_EXPIRED,
    403: 'Você não tem permissão para atualizar visitas neste estudo.',
    404: 'Visita agendada não encontrada neste estudo. Atualize a agenda.',
  };
  const message = (status === 403 || status === 404) && detail ? detail : fallbacks[status] ?? STATUS_UPDATE_UNEXPECTED_ERROR;
  return new ScheduledVisitsApiError(message, status, code);
}

function resultError(status: number, body: ErrorBody | null): ScheduledVisitsApiError {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const domain = code && Object.hasOwn(RESULT_DOMAIN_ERRORS, code) ? RESULT_DOMAIN_ERRORS[code] : undefined;
  if (domain && (status === 400 || status === 409)) {
    return new ScheduledVisitsApiError(domain.message, status, code, domain.field ? { [domain.field]: domain.message } : {});
  }
  const detail = textOf(body?.message);
  if (status === 400) {
    const invalid = 'O resultado foi recusado. Revise os campos e tente novamente.';
    if (Array.isArray(body?.message)) return new ScheduledVisitsApiError(invalid, status, code, rejectedFields(body.message, RESULT_FIELDS));
    return new ScheduledVisitsApiError(detail && !detail.startsWith('Validation failed') ? detail : invalid, status, code);
  }
  const fallbacks: Record<number, string> = {
    401: SESSION_EXPIRED,
    403: 'Você não tem permissão para registrar resultados neste estudo.',
    404: 'Visita agendada não encontrada neste estudo. Atualize a lista de visitas.',
    409: RESULT_DOMAIN_ERRORS.RESULT_ALREADY_REGISTERED.message,
  };
  const message = (status === 403 || status === 404) && detail ? detail : fallbacks[status] ?? RESULT_UNEXPECTED_ERROR;
  return new ScheduledVisitsApiError(message, status, code);
}

function listError(fallback: string, resource: string) {
  return (status: number, body: ErrorBody | null): ScheduledVisitsApiError => {
    const detail = textOf(body?.message);
    const fallbacks: Record<number, string> = {
      401: SESSION_EXPIRED,
      403: `Você não tem permissão para consultar ${resource} deste estudo.`,
      404: 'Estudo não encontrado. Atualize os estudos disponíveis.',
    };
    const message = (status === 403 || status === 404) && detail ? detail : fallbacks[status] ?? fallback;
    return new ScheduledVisitsApiError(message, status);
  };
}

const participantsError = listError(PARTICIPANTS_LOAD_ERROR, 'os participantes');
const scheduledVisitsError = listError(SCHEDULED_VISITS_LOAD_ERROR, 'as visitas agendadas');
const resultsLoadError = listError(RESULTS_LOAD_ERROR, 'os resultados das visitas');
export const HISTORY_LOAD_ERROR = 'Não foi possível carregar o histórico do participante. Tente novamente.';
const historyError = listError(HISTORY_LOAD_ERROR, 'o histórico dos participantes');

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

/** Formato de uma visita agendada do estudo. `realizedAt` existe somente quando `Realizada` (visitas_realizacao_coerente). */
export function isScheduledVisitRecord(value: unknown, studyId: string): value is ScheduledVisit {
  if (!value || typeof value !== 'object') return false;
  const visit = value as Partial<ScheduledVisit>;
  return isId(visit.id) && visit.studyId === studyId
    && isId(visit.participationId) && isId(visit.plannedVisitId)
    && typeof visit.participantName === 'string' && typeof visit.plannedVisitName === 'string'
    && Number.isInteger(visit.plannedVisitOrder)
    && isInstant(visit.scheduledAt)
    && (SCHEDULED_VISIT_STATUSES as readonly string[]).includes(visit.status as string)
    && (visit.status === 'Realizada' ? isInstant(visit.realizedAt) : visit.realizedAt === null)
    && isNullableText(visit.observation) && isInstant(visit.createdAt);
}

/** Confere também a identidade do agendamento retornado em relação ao que foi enviado. */
export function isScheduledVisit(value: unknown, studyId: string, input: Pick<CreateScheduledVisitInput, 'participationId' | 'plannedVisitId'>): value is ScheduledVisit {
  return isScheduledVisitRecord(value, studyId) && value.status === 'Agendada'
    && value.participationId === input.participationId && value.plannedVisitId === input.plannedVisitId;
}

export function isAssessmentResult(value: unknown, scheduledVisitId: string, activityId?: string): value is AssessmentResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AssessmentResult>;
  return isId(result.id) && result.scheduledVisitId === scheduledVisitId
    && isId(result.activityId) && (activityId === undefined || result.activityId === activityId)
    && typeof result.value === 'string' && result.value.trim().length > 0
    && isNullableText(result.unit) && isNullableText(result.observation)
    && isInstant(result.registeredAt) && isId(result.registrarId);
}

export function isScheduledVisitResults(value: unknown, scheduledVisitId: string): value is ScheduledVisitResults {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<ScheduledVisitResults>;
  return body.scheduledVisitId === scheduledVisitId && isId(body.plannedVisitId)
    && (SCHEDULED_VISIT_STATUSES as readonly string[]).includes(body.status as string)
    && Array.isArray(body.activities) && body.activities.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const activity = item as Partial<VisitActivityResult>;
      return isId(activity.activityId) && typeof activity.name === 'string' && typeof activity.type === 'string'
        && isNullableText(activity.description)
        && (activity.result === null || isAssessmentResult(activity.result, scheduledVisitId, activity.activityId));
    });
}

export function isParticipantHistory(value: unknown, studyId: string, participationId: string): value is ParticipantHistory {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<ParticipantHistory>;
  return isIncludedParticipant(body.participant) && body.participant.studyId === studyId && body.participant.participationId === participationId
    && Array.isArray(body.visits) && body.visits.every((visit) => isScheduledVisitRecord(visit, studyId)
      && visit.participationId === participationId
      && Array.isArray(visit.results) && visit.results.every((result) => isAssessmentResult(result, visit.id)
        && typeof result.activityName === 'string' && typeof result.activityType === 'string'));
}

/** Confere se a resposta de E04 é a mesma visita, já na situação pedida. */
export function isUpdatedVisit(value: unknown, visit: Pick<ScheduledVisit, 'id' | 'studyId'>, status: FinalVisitStatus): value is ScheduledVisit {
  return isScheduledVisitRecord(value, visit.studyId) && value.id === visit.id && value.status === status;
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

/** E03 — visitas agendadas do estudo, em ordem crescente de data. */
async function listScheduledVisits(request: AuthenticatedRequest, studyId: string, signal?: AbortSignal): Promise<ScheduledVisit[]> {
  const body = await send(request, `${studyPath(studyId)}/scheduled-visits`, { signal }, scheduledVisitsError, SCHEDULE_CONNECTION_ERROR);
  if (!Array.isArray(body) || !body.every((item) => isScheduledVisitRecord(item, studyId))) {
    throw new ScheduledVisitsApiError('O servidor retornou uma agenda inválida. Tente novamente.');
  }
  return body;
}

/** E04 — `realizedAt` vai somente com `Realizada`; o backend recusa o campo nas demais situações. */
async function updateStatus(request: AuthenticatedRequest, visit: Pick<ScheduledVisit, 'id' | 'studyId'>, input: UpdateVisitStatusInput, signal?: AbortSignal): Promise<ScheduledVisit> {
  const body = await send(request, `${studyPath(visit.studyId)}/scheduled-visits/${encodeURIComponent(visit.id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      status: input.status,
      ...(input.status === 'Realizada' ? { realizedAt: input.realizedAt } : {}),
      ...(input.observation !== undefined ? { observation: input.observation?.trim() || null } : {}),
    }),
  }, statusUpdateError, SCHEDULE_CONNECTION_ERROR);
  if (!isUpdatedVisit(body, visit, input.status)) throw new ScheduledVisitsApiError(STATUS_UPDATE_INVALID_RESPONSE);
  return body;
}

const resultsPath = (visit: Pick<ScheduledVisit, 'id' | 'studyId'>) => `${studyPath(visit.studyId)}/scheduled-visits/${encodeURIComponent(visit.id)}/results`;

/** E05 — atividades previstas da visita agendada, com os resultados já registrados. */
async function getResults(request: AuthenticatedRequest, visit: Pick<ScheduledVisit, 'id' | 'studyId'>, signal?: AbortSignal): Promise<ScheduledVisitResults> {
  const body = await send(request, resultsPath(visit), { signal }, resultsLoadError, SCHEDULE_CONNECTION_ERROR);
  if (!isScheduledVisitResults(body, visit.id)) throw new ScheduledVisitsApiError('O servidor retornou atividades inválidas. Tente novamente.');
  return body;
}

/** E06 — exclusivo do Pesquisador proprietário (D-04); unidade e observação vazias não são enviadas. */
async function registerResult(request: AuthenticatedRequest, visit: Pick<ScheduledVisit, 'id' | 'studyId'>, input: RegisterResultInput, signal?: AbortSignal): Promise<AssessmentResult> {
  const unit = input.unit?.trim();
  const observation = input.observation?.trim();
  const body = await send(request, resultsPath(visit), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ activityId: input.activityId, value: input.value.trim(), ...(unit ? { unit } : {}), ...(observation ? { observation } : {}) }),
  }, resultError, SCHEDULE_CONNECTION_ERROR);
  if (!isAssessmentResult(body, visit.id, input.activityId)) throw new ScheduledVisitsApiError(RESULT_INVALID_RESPONSE);
  return body;
}

/** E01 sem filtro — inclui participações retiradas e concluídas, cujo histórico é preservado (D-09). */
async function listParticipants(request: AuthenticatedRequest, studyId: string, signal?: AbortSignal): Promise<IncludedParticipant[]> {
  const body = await send(request, `${studyPath(studyId)}/participants`, { signal }, participantsError, SCHEDULE_CONNECTION_ERROR);
  if (!Array.isArray(body) || !body.every(isIncludedParticipant)) {
    throw new ScheduledVisitsApiError('O servidor retornou uma listagem de participantes inválida. Tente novamente.');
  }
  return body.filter((item) => item.studyId === studyId);
}

/** Momento usado na ordenação cronológica; empate resolvido pela data de criação. */
const chronological = (a: ScheduledVisit, b: ScheduledVisit) =>
  Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt);

/** E07 — o histórico vazio (`visits: []`) não é erro. As visitas são reordenadas cronologicamente por garantia. */
async function getHistory(request: AuthenticatedRequest, studyId: string, participationId: string, signal?: AbortSignal): Promise<ParticipantHistory> {
  const body = await send(request, `${studyPath(studyId)}/participants/${encodeURIComponent(participationId)}/history`, { signal }, historyError, SCHEDULE_CONNECTION_ERROR);
  if (!isParticipantHistory(body, studyId, participationId)) throw new ScheduledVisitsApiError('O servidor retornou um histórico inválido. Tente novamente.');
  return { ...body, visits: [...body.visits].sort(chronological) };
}

export const scheduledVisitsApi = { listActiveParticipants, listParticipants, schedule, listScheduledVisits, updateStatus, getResults, registerResult, getHistory };

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
