import type { AuthenticatedRequest } from '../studies/studiesApi';
import { backendCode, backendMessage } from './apiErrors';

export type ScheduledVisitStatus = 'Agendada' | 'Realizada' | 'Ausente' | 'Cancelada';
export const SCHEDULED_VISIT_STATUSES: readonly ScheduledVisitStatus[] = ['Agendada', 'Realizada', 'Ausente', 'Cancelada'];

/** Contrato do backend: ScheduledVisitResponseDto. */
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

export class ScheduledVisitsApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ScheduledVisitsApiError';
  }
}

const nullableString = (value: unknown) => value === null || typeof value === 'string';

export function isScheduledVisit(value: unknown): value is ScheduledVisit {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['id', 'studyId', 'participationId', 'participantName', 'plannedVisitId', 'plannedVisitName', 'scheduledAt', 'createdAt']
    .every((key) => typeof v[key] === 'string' && (v[key] as string).length > 0)
    && typeof v.plannedVisitOrder === 'number' && SCHEDULED_VISIT_STATUSES.includes(v.status as ScheduledVisitStatus)
    && nullableString(v.realizedAt) && nullableString(v.observation);
}

const MESSAGES: Record<number, string> = {
  401: 'Sua sessão expirou ou é inválida. Entre novamente para continuar.',
  403: 'Você não tem permissão para consultar ou alterar visitas neste estudo.',
  404: 'Estudo, participante ou visita não encontrado. Atualize a listagem.',
};

async function call(request: AuthenticatedRequest, path: string, init: RequestInit | undefined, fallback: string): Promise<unknown> {
  let response: Response;
  try {
    response = await request(path, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ScheduledVisitsApiError('Não foi possível comunicar com o servidor. Consulte as visitas antes de tentar novamente.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = backendMessage(body);
    // 400 e 409 trazem a regra violada (participação inativa, visita já agendada, estudo encerrado…).
    throw new ScheduledVisitsApiError((response.status === 400 || response.status === 409) && detail ? detail : MESSAGES[response.status] ?? fallback,
      response.status, backendCode(body));
  }
  return body;
}

const base = (studyId: string) => `/studies/${encodeURIComponent(studyId)}/scheduled-visits`;
const INVALID = 'O servidor retornou dados de visita inválidos. Consulte as visitas antes de tentar novamente.';

// GET /studies/:studyId/scheduled-visits?participationId=
const list = async (request: AuthenticatedRequest, studyId: string, participationId?: string, signal?: AbortSignal): Promise<ScheduledVisit[]> => {
  const query = participationId ? `?${new URLSearchParams({ participationId })}` : '';
  const body = await call(request, `${base(studyId)}${query}`, signal ? { signal } : undefined, 'Não foi possível consultar as visitas agendadas. Tente novamente.');
  if (!Array.isArray(body) || !body.every(isScheduledVisit)) throw new ScheduledVisitsApiError(INVALID);
  // Descarta visitas de outro estudo ou de outra participação, caso o servidor as devolva.
  return body.filter((visit) => visit.studyId === studyId && (!participationId || visit.participationId === participationId));
};

export interface CreateScheduledVisitInput {
  participationId: string;
  plannedVisitId: string;
  /** ISO 8601 com offset, por exemplo 2026-11-24T09:00:00-03:00. */
  scheduledAt: string;
  observation?: string | null;
}

// POST /studies/:studyId/scheduled-visits — o corpo leva somente os campos do contrato (forbidNonWhitelisted).
const create = async (request: AuthenticatedRequest, studyId: string, input: CreateScheduledVisitInput): Promise<ScheduledVisit> => {
  const observation = input.observation?.trim();
  const body = await call(request, base(studyId), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participationId: input.participationId, plannedVisitId: input.plannedVisitId, scheduledAt: input.scheduledAt, ...(observation ? { observation } : {}) }),
  }, 'Não foi possível agendar a visita. Consulte as visitas antes de tentar novamente.');
  if (!isScheduledVisit(body) || body.studyId !== studyId || body.participationId !== input.participationId) throw new ScheduledVisitsApiError(INVALID);
  return body;
};

export interface UpdateScheduledVisitStatusInput {
  status: Exclude<ScheduledVisitStatus, 'Agendada'>;
  /** Obrigatório (ISO com offset) somente quando status é Realizada; proibido nos demais. */
  realizedAt?: string;
  observation?: string | null;
}

// PATCH /studies/:studyId/scheduled-visits/:id/status
const updateStatus = async (request: AuthenticatedRequest, studyId: string, visitId: string, input: UpdateScheduledVisitStatusInput): Promise<ScheduledVisit> => {
  const payload: Record<string, unknown> = { status: input.status };
  if (input.status === 'Realizada') payload.realizedAt = input.realizedAt;
  if (input.observation !== undefined) payload.observation = input.observation;
  const body = await call(request, `${base(studyId)}/${encodeURIComponent(visitId)}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }, 'Não foi possível atualizar a visita. Consulte as visitas antes de tentar novamente.');
  if (!isScheduledVisit(body) || body.studyId !== studyId || body.id !== visitId) throw new ScheduledVisitsApiError(INVALID);
  return body;
};

export const scheduledVisitsApi = { list, create, updateStatus };
