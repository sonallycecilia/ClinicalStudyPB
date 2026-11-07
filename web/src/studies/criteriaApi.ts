import type { AuthenticatedRequest } from './studiesApi';

/** Formatos compatíveis com o EligibilityCriterion retornado pelo backend NestJS. */
export type CriterionType = 'Inclusão' | 'Exclusão';
export interface EligibilityCriterion {
  id: string;
  studyId: string;
  type: CriterionType;
  description: string;
  active: boolean;
}
type CriterionInput = Pick<EligibilityCriterion, 'type' | 'description'>;
/** Critério preenchido no formulário; o id existe somente na interface e não é enviado à API. */
export interface CriterionDraft extends CriterionInput {
  id: string;
}

export const UNEXPECTED_LOAD_ERROR = 'Ocorreu um erro inesperado ao carregar os critérios. Tente novamente em alguns instantes.';
const UNEXPECTED_SAVE_ERROR = 'Ocorreu um erro inesperado ao salvar os critérios. Tente novamente em alguns instantes.';
const CONNECTION_ERROR = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

/** Erro com mensagem própria para o usuário; `retryable` indica se repetir a chamada pode resolver. */
export class CriteriaApiError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'CriteriaApiError';
    this.retryable = retryable;
  }
}

interface ErrorTexts {
  invalid: string;
  notFound: string;
  unexpected: string;
}

const STUDY_NOT_FOUND = 'Estudo não encontrado. Volte à lista de estudos e tente novamente.';

const LOAD_ERROR_TEXTS: ErrorTexts = {
  invalid: 'Não foi possível identificar o estudo. Volte à lista de estudos e tente novamente.',
  notFound: STUDY_NOT_FOUND,
  unexpected: UNEXPECTED_LOAD_ERROR,
};

const SAVE_ERROR_TEXTS: ErrorTexts = {
  invalid: 'Os dados de um critério foram recusados pelo servidor.',
  notFound: STUDY_NOT_FOUND,
  unexpected: UNEXPECTED_SAVE_ERROR,
};

const UPDATE_ERROR_TEXTS: ErrorTexts = {
  ...SAVE_ERROR_TEXTS,
  notFound: 'Critério não encontrado neste estudo. Ele pode ter sido alterado em outra sessão.',
};

// O backend usa o formato padrão do NestJS: { statusCode, message, error }.
// Somente 400, 401 e 403 trazem texto escrito para o usuário. Em 404 e 5xx, message pode
// ser um texto do framework ("Cannot GET ...", "Internal server error").
function errorFromResponse(status: number, message: unknown, texts: ErrorTexts): CriteriaApiError {
  if (status === 404) return new CriteriaApiError(texts.notFound, false);
  const fallbacks: Record<number, string> = {
    400: texts.invalid,
    401: 'Sua sessão expirou. Entre novamente para continuar.',
    403: 'Você não tem permissão para acessar os critérios deste estudo.',
  };
  const fallback = fallbacks[status];
  if (!fallback) return new CriteriaApiError(texts.unexpected, true);
  const detail = Array.isArray(message) ? message.join(' ') : message;
  // "Validation failed (uuid is expected)" é o texto técnico do ParseUUIDPipe.
  const isUserFacing = typeof detail === 'string' && detail.length > 0 && !detail.startsWith('Validation failed');
  return new CriteriaApiError(isUserFacing ? detail : fallback, false);
}

async function criteriaRequest(request: AuthenticatedRequest, path: string, init: RequestInit, texts: ErrorTexts): Promise<unknown> {
  let response: Response;
  try {
    response = await request(path, init);
  } catch {
    throw new CriteriaApiError(CONNECTION_ERROR, true);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: unknown } | null;
    throw errorFromResponse(response.status, body?.message, texts);
  }
  return await response.json().catch(() => null);
}

const criteriaPath = (studyId: string) => `/studies/${encodeURIComponent(studyId)}/criteria`;

export const criteriaApi = {
  list: async (request: AuthenticatedRequest, studyId: string, signal?: AbortSignal): Promise<EligibilityCriterion[]> => {
    const body = await criteriaRequest(request, criteriaPath(studyId), { signal }, LOAD_ERROR_TEXTS);
    if (!Array.isArray(body)) throw new CriteriaApiError(UNEXPECTED_LOAD_ERROR, true);
    return body as EligibilityCriterion[];
  },
  create: async (request: AuthenticatedRequest, studyId: string, input: CriterionInput): Promise<EligibilityCriterion> => {
    const body = await criteriaRequest(request, criteriaPath(studyId), {
      method: 'POST', body: JSON.stringify({ type: input.type, description: input.description }), headers: { 'Content-Type': 'application/json' },
    }, SAVE_ERROR_TEXTS);
    if (typeof (body as { id?: unknown } | null)?.id !== 'string') throw new CriteriaApiError(UNEXPECTED_SAVE_ERROR, true);
    return body as EligibilityCriterion;
  },
  update: async (request: AuthenticatedRequest, studyId: string, criterionId: string, input: { description: string } | { active: boolean }): Promise<void> => {
    await criteriaRequest(request, `${criteriaPath(studyId)}/${encodeURIComponent(criterionId)}`, {
      method: 'PATCH', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' },
    }, UPDATE_ERROR_TEXTS);
  },
};

export interface CriteriaChange extends CriterionDraft {
  kind: 'create' | 'update' | 'remove';
}

/** Compara os critérios carregados com o formulário; rascunhos com id desconhecido são novos. */
export function planCriteriaChanges(existing: EligibilityCriterion[], drafts: CriterionDraft[]): CriteriaChange[] {
  const describe = ({ id, type, description }: CriterionDraft) => ({ id, type, description });
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const existingById = new Map(existing.map((item) => [item.id, item]));
  return [
    ...existing.filter((item) => !draftIds.has(item.id)).map((item) => ({ ...describe(item), kind: 'remove' as const })),
    ...drafts.filter((draft) => {
      const current = existingById.get(draft.id);
      return current && current.description !== draft.description;
    }).map((draft) => ({ ...describe(draft), kind: 'update' as const })),
    ...drafts.filter((draft) => !existingById.has(draft.id)).map((draft) => ({ ...describe(draft), kind: 'create' as const })),
  ];
}

// Cada critério já gravado anula somente uma inclusão igual, preservando repetições intencionais.
function withoutSaved(changes: CriteriaChange[], saved: EligibilityCriterion[]): CriteriaChange[] {
  const remaining = [...saved];
  return changes.filter((change) => {
    if (change.kind !== 'create') return true;
    const match = remaining.findIndex((item) => item.type === change.type && item.description === change.description);
    if (match === -1) return true;
    remaining.splice(match, 1);
    return false;
  });
}

// A API não possui DELETE, e avaliacoes_elegibilidade referencia o critério: remover é desativar.
async function applyChange(request: AuthenticatedRequest, studyId: string, change: CriteriaChange): Promise<string | null> {
  if (change.kind === 'create') return (await criteriaApi.create(request, studyId, change)).id;
  await criteriaApi.update(request, studyId, change.id, change.kind === 'remove' ? { active: false } : { description: change.description });
  return null;
}

interface ApplyCriteriaResult {
  pending: CriteriaChange[];
  createdIds: string[];
  error: CriteriaApiError | null;
}

/**
 * Aplica as alterações uma a uma, pois a API não possui envio em lote, e nunca rejeita:
 * devolve o que ficou pendente. Em uma nova tentativa, `knownIds` faz consultar a API antes de enviar,
 * pois uma falha de conexão pode ter ocorrido depois de o backend gravar o critério. Os ids informados
 * não contam como gravados, para que uma inclusão igual a um critério anterior não seja ignorada.
 */
export async function applyCriteriaChanges(
  request: AuthenticatedRequest,
  studyId: string,
  changes: CriteriaChange[],
  knownIds?: string[],
): Promise<ApplyCriteriaResult> {
  let pending = changes;
  const createdIds: string[] = [];
  try {
    if (knownIds && pending.some((change) => change.kind === 'create')) {
      const rows = await criteriaApi.list(request, studyId);
      pending = withoutSaved(pending, rows.filter((row) => row.active && !knownIds.includes(row.id)));
    }
    for (const change of pending) {
      const createdId = await applyChange(request, studyId, change);
      if (createdId) createdIds.push(createdId);
      pending = pending.filter((item) => item !== change);
    }
    return { pending, createdIds, error: null };
  } catch (reason) {
    return { pending, createdIds, error: reason instanceof CriteriaApiError ? reason : new CriteriaApiError(UNEXPECTED_SAVE_ERROR, true) };
  }
}
