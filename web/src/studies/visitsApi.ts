import type { AuthenticatedRequest } from './studiesApi';

/** Formatos compatíveis com PlannedVisit e VisitActivity retornados pelo backend NestJS. */
export interface PlannedVisit {
  id: string;
  studyId: string;
  name: string;
  order: number;
  intervalDays: number | null;
  description: string | null;
}
export interface VisitActivity {
  id: string;
  visitId: string;
  name: string;
  description: string | null;
  type: string;
}
export type PlannedVisitInput = Pick<PlannedVisit, 'name' | 'order' | 'intervalDays' | 'description'>;
export type VisitActivityInput = Pick<VisitActivity, 'name' | 'type' | 'description'>;
export interface PlannedVisitWithActivities extends PlannedVisit {
  activities: VisitActivity[];
}

export const UNEXPECTED_VISITS_LOAD_ERROR = 'Ocorreu um erro inesperado ao carregar as visitas. Tente novamente em alguns instantes.';
const UNEXPECTED_VISITS_SAVE_ERROR = 'Ocorreu um erro inesperado ao salvar a visita. Tente novamente em alguns instantes.';
const CONNECTION_ERROR = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

/**
 * Erro com mensagem própria para o usuário; `retryable` indica se repetir a chamada pode resolver.
 * `fieldErrors` aponta, pelo nome do campo no contrato da API, os campos recusados pelo servidor.
 */
export class VisitsApiError extends Error {
  readonly retryable: boolean;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, retryable: boolean, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'VisitsApiError';
    this.retryable = retryable;
    this.fieldErrors = fieldErrors;
  }
}

const SERVER_FIELD_ERROR = 'O servidor recusou este valor. Revise o campo.';
export const ORDER_CONFLICT = 'Já existe uma visita com essa ordem neste estudo.';

// O ValidationPipe do NestJS responde em inglês, iniciando pelo campo: "name must be...", "property x should not exist".
function rejectedFields(messages: unknown[]): Record<string, string> {
  const fields = messages.flatMap((item) => typeof item === 'string' ? /^(?:property )?(\w+)/.exec(item)?.[1] ?? [] : []);
  return Object.fromEntries(fields.map((field) => [field, SERVER_FIELD_ERROR]));
}

interface ErrorTexts {
  invalid: string;
  notFound: string;
  unexpected: string;
}

const LOAD_ERROR_TEXTS: ErrorTexts = {
  invalid: 'Não foi possível identificar o estudo. Volte à lista de estudos e tente novamente.',
  notFound: 'Estudo não encontrado. Volte à lista de estudos e tente novamente.',
  unexpected: UNEXPECTED_VISITS_LOAD_ERROR,
};

const SAVE_ERROR_TEXTS: ErrorTexts = {
  invalid: 'Os dados da visita foram recusados pelo servidor. Revise os campos e tente novamente.',
  notFound: 'Estudo ou visita não encontrada. Volte à lista de estudos e tente novamente.',
  unexpected: UNEXPECTED_VISITS_SAVE_ERROR,
};

// O backend usa o formato padrão do NestJS: { statusCode, message, error }.
// 401, 403 e 409 trazem texto escrito para o usuário; em 404 e 5xx, o texto pode ser do framework.
// Em 400, o ValidationPipe responde uma lista técnica em inglês e o ParseUUIDPipe, "Validation failed...";
// já as regras de negócio (ex.: "Não é possível alterar um estudo encerrado.") vêm como texto em português.
function errorFromResponse(status: number, message: unknown, texts: ErrorTexts): VisitsApiError {
  if (status === 404) return new VisitsApiError(texts.notFound, false);
  if (status === 400) {
    if (Array.isArray(message)) return new VisitsApiError(texts.invalid, false, rejectedFields(message));
    const isUserFacing = typeof message === 'string' && message.length > 0 && !message.startsWith('Validation failed');
    return new VisitsApiError(isUserFacing ? message : texts.invalid, false);
  }
  const fallbacks: Record<number, string> = {
    401: 'Sua sessão expirou. Entre novamente para continuar.',
    403: 'Você não tem permissão para acessar as visitas deste estudo.',
    409: ORDER_CONFLICT,
  };
  const fallback = fallbacks[status];
  if (!fallback) return new VisitsApiError(texts.unexpected, true);
  const detail = Array.isArray(message) ? message.join(' ') : message;
  const text = typeof detail === 'string' && detail.length > 0 ? detail : fallback;
  // O único conflito do cadastro é a ordem repetida no estudo (visitas_previstas_ordem_unica).
  return new VisitsApiError(text, false, status === 409 ? { order: text } : {});
}

async function visitsRequest(request: AuthenticatedRequest, path: string, init: RequestInit, texts: ErrorTexts): Promise<unknown> {
  let response: Response;
  try {
    response = await request(path, init);
  } catch (reason) {
    if (init.signal?.aborted) throw reason;
    throw new VisitsApiError(CONNECTION_ERROR, true);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: unknown } | null;
    throw errorFromResponse(response.status, body?.message, texts);
  }
  return await response.json().catch(() => null);
}

const visitsPath = (studyId: string) => `/studies/${encodeURIComponent(studyId)}/visits`;
const activitiesPath = (studyId: string, visitId: string) => `${visitsPath(studyId)}/${encodeURIComponent(visitId)}/activities`;
const jsonPost = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

function asArray<T>(body: unknown): T[] {
  if (!Array.isArray(body)) throw new VisitsApiError(UNEXPECTED_VISITS_LOAD_ERROR, true);
  return body as T[];
}

function asCreated<T>(body: unknown): T {
  if (typeof (body as { id?: unknown } | null)?.id !== 'string') throw new VisitsApiError(UNEXPECTED_VISITS_SAVE_ERROR, true);
  return body as T;
}

export const visitsApi = {
  list: async (request: AuthenticatedRequest, studyId: string, signal?: AbortSignal): Promise<PlannedVisit[]> =>
    asArray<PlannedVisit>(await visitsRequest(request, visitsPath(studyId), { signal }, LOAD_ERROR_TEXTS)),
  listActivities: async (request: AuthenticatedRequest, studyId: string, visitId: string, signal?: AbortSignal): Promise<VisitActivity[]> =>
    asArray<VisitActivity>(await visitsRequest(request, activitiesPath(studyId, visitId), { signal }, LOAD_ERROR_TEXTS)),
  // O backend recusa campos extras (forbidNonWhitelisted): o corpo leva somente os campos do contrato.
  create: async (request: AuthenticatedRequest, studyId: string, input: PlannedVisitInput): Promise<PlannedVisit> =>
    asCreated<PlannedVisit>(await visitsRequest(request, visitsPath(studyId), jsonPost({
      name: input.name, order: input.order, intervalDays: input.intervalDays, description: input.description,
    }), SAVE_ERROR_TEXTS)),
  createActivity: async (request: AuthenticatedRequest, studyId: string, visitId: string, input: VisitActivityInput): Promise<VisitActivity> =>
    asCreated<VisitActivity>(await visitsRequest(request, activitiesPath(studyId, visitId), jsonPost({
      name: input.name, type: input.type, description: input.description || null,
    }), SAVE_ERROR_TEXTS)),
};

/** A listagem de visitas não inclui atividades: elas são consultadas por visita, em paralelo. */
export async function listVisitsWithActivities(request: AuthenticatedRequest, studyId: string, signal?: AbortSignal): Promise<PlannedVisitWithActivities[]> {
  const visits = await visitsApi.list(request, studyId, signal);
  return await Promise.all(visits.map(async (visit) => ({
    ...visit,
    activities: await visitsApi.listActivities(request, studyId, visit.id, signal),
  })));
}

export interface SaveVisitResult<T extends VisitActivityInput> {
  /** Id da visita, quando ela já foi gravada. */
  visitId: string | null;
  pendingActivities: T[];
  /** Atividades criadas nesta chamada, para não serem confundidas com as pendentes em uma nova tentativa. */
  createdActivityIds: string[];
  error: VisitsApiError | null;
}

const sameText = (draft: string | null, saved: string | null) => (draft || null) === saved;

// A ordem é única no estudo: só a visita com essa ordem e os mesmos dados pode ser a gravada pela tentativa anterior.
function findSavedVisit(visits: PlannedVisit[], input: PlannedVisitInput): PlannedVisit | undefined {
  return visits.find((visit) => visit.order === input.order && visit.name === input.name
    && visit.intervalDays === input.intervalDays && sameText(input.description, visit.description));
}

// Cada atividade gravada anula somente uma pendente igual, preservando repetições intencionais.
function withoutSavedActivities<T extends VisitActivityInput>(pending: T[], saved: VisitActivity[]): T[] {
  const remaining = [...saved];
  return pending.filter((activity) => {
    const match = remaining.findIndex((row) => row.name === activity.name && row.type === activity.type && sameText(activity.description, row.description));
    if (match === -1) return true;
    remaining.splice(match, 1);
    return false;
  });
}

/**
 * Grava a visita e depois cada atividade, pois a API não possui envio em lote, e nunca rejeita.
 * Com `createdVisitId`, a visita já existe: somente as atividades informadas são enviadas.
 * `knownActivityIds` indica uma nova tentativa depois de uma falha de resultado incerto (conexão ou 5xx):
 * o backend pode ter gravado a visita ou a atividade antes de a resposta se perder, então a API é
 * consultada antes de reenviar. As atividades já criadas nesta sessão (os ids informados) não contam,
 * para que uma atividade igual a uma anterior não seja ignorada.
 */
export async function savePlannedVisit<T extends VisitActivityInput>(
  request: AuthenticatedRequest,
  studyId: string,
  input: PlannedVisitInput,
  activities: T[],
  createdVisitId: string | null = null,
  knownActivityIds?: string[],
): Promise<SaveVisitResult<T>> {
  let visitId = createdVisitId;
  let pendingActivities = activities;
  const createdActivityIds: string[] = [];
  try {
    if (knownActivityIds && !visitId) visitId = findSavedVisit(await visitsApi.list(request, studyId), input)?.id ?? null;
    if (knownActivityIds && visitId && pendingActivities.length > 0) {
      const rows = await visitsApi.listActivities(request, studyId, visitId);
      pendingActivities = withoutSavedActivities(pendingActivities, rows.filter((row) => !knownActivityIds.includes(row.id)));
    }
    if (!visitId) visitId = (await visitsApi.create(request, studyId, input)).id;
    for (const activity of [...pendingActivities]) {
      createdActivityIds.push((await visitsApi.createActivity(request, studyId, visitId, activity)).id);
      pendingActivities = pendingActivities.filter((item) => item !== activity);
    }
    return { visitId, pendingActivities, createdActivityIds, error: null };
  } catch (reason) {
    const error = reason instanceof VisitsApiError ? reason : new VisitsApiError(UNEXPECTED_VISITS_SAVE_ERROR, true);
    return { visitId, pendingActivities, createdActivityIds, error };
  }
}
