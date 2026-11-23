import type { AuthenticatedRequest } from '../studies/studiesApi';
import { backendCode, backendMessage } from './apiErrors';

/** Contrato do backend: GET /studies/:studyId/participants (ParticipantResponseDto). */
export const PARTICIPATION_STATUSES = ['Ativo', 'Concluído', 'Retirado'] as const;
export type ParticipationStatus = typeof PARTICIPATION_STATUSES[number];

/**
 * Participante incluído em um estudo. `participationId` identifica a participação (não a pessoa)
 * e é o valor que agendamento, histórico e retirada enviam à API. Sem e-mail ou dados de elegibilidade.
 */
export interface Participant {
  participationId: string;
  candidateId: string;
  studyId: string;
  name: string;
  /** Vem de `participationStatus` na API. */
  status: ParticipationStatus;
  /** AAAA-MM-DD. */
  includedAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

export type ParticipantsByStudyQuery = (
  request: AuthenticatedRequest, studyId: string, signal?: AbortSignal,
) => Promise<readonly Participant[]>;

export class ParticipantsApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ParticipantsApiError';
  }
}

export const PARTICIPANTS_ERROR_MESSAGE = 'Não foi possível consultar os participantes do estudo. Tente novamente.';
export const INVALID_PARTICIPANTS_MESSAGE = 'O servidor retornou uma listagem de participantes inválida. Tente novamente.';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const nullableString = (value: unknown) => value === null || typeof value === 'string';

/** Formato bruto retornado pela API. */
export type ParticipantResponse = Omit<Participant, 'status'> & { participationStatus: ParticipationStatus };

/** Valida o formato bruto retornado pela API (participationStatus). */
export function isParticipantResponse(value: unknown): value is ParticipantResponse {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.participationId === 'string' && item.participationId.length > 0
    && typeof item.candidateId === 'string' && item.candidateId.length > 0
    && typeof item.studyId === 'string' && item.studyId.length > 0
    && typeof item.name === 'string' && item.name.trim().length > 0
    && PARTICIPATION_STATUSES.includes(item.participationStatus as ParticipationStatus)
    && typeof item.includedAt === 'string' && DATE.test(item.includedAt)
    && nullableString(item.withdrawnAt) && nullableString(item.withdrawalReason);
}

export function toParticipant(raw: ParticipantResponse): Participant {
  return {
    participationId: raw.participationId, candidateId: raw.candidateId, studyId: raw.studyId, name: raw.name,
    status: raw.participationStatus, includedAt: raw.includedAt, withdrawnAt: raw.withdrawnAt, withdrawalReason: raw.withdrawalReason,
  };
}

/** Valida o modelo já adaptado do web (status em vez de participationStatus). */
export const isParticipant = (value: unknown): value is Participant => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Participant;
  return isParticipantResponse({ ...item, participationStatus: item.status });
};

function errorFor(status: number, body: unknown, messages: Record<number, string>, fallback: string): ParticipantsApiError {
  const code = backendCode(body);
  const detail = backendMessage(body);
  // 400 e 409 carregam a regra de negócio violada; demais códigos usam texto próprio.
  const text = (status === 400 || status === 409) && detail ? detail : messages[status] ?? fallback;
  return new ParticipantsApiError(text, status, code);
}

const COMMON_MESSAGES: Record<number, string> = {
  401: 'Sua sessão expirou ou é inválida. Entre novamente para continuar.',
  403: 'Você não tem permissão para consultar ou alterar participantes deste estudo.',
  404: 'Estudo ou participante não encontrado. Atualize os estudos disponíveis.',
};

async function send(request: AuthenticatedRequest, path: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
  let response: Response;
  try {
    response = await request(path, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ParticipantsApiError('Não foi possível comunicar com o servidor. Tente novamente.');
  }
  return { response, body: await response.json().catch(() => null) };
}

const studyPath = (studyId: string) => `/studies/${encodeURIComponent(studyId)}`;

// GET /studies/:studyId/participants
const listByStudy: ParticipantsByStudyQuery = async (request, studyId, signal) => {
  const { response, body } = await send(request, `${studyPath(studyId)}/participants`, signal ? { signal } : undefined);
  if (!response.ok) throw errorFor(response.status, body, COMMON_MESSAGES, PARTICIPANTS_ERROR_MESSAGE);
  if (!Array.isArray(body) || !body.every(isParticipantResponse)) throw new ParticipantsApiError(INVALID_PARTICIPANTS_MESSAGE);
  // Nunca mistura participações de outro estudo, mesmo que o servidor as devolva.
  return body.filter((item) => item.studyId === studyId).map(toParticipant);
};

export interface HistoryResult {
  id: string;
  scheduledVisitId: string;
  activityId: string;
  activityName: string;
  activityType: string;
  value: string;
  unit: string | null;
  observation: string | null;
  registeredAt: string;
}
export interface HistoryVisit {
  id: string;
  plannedVisitName: string;
  plannedVisitOrder: number;
  scheduledAt: string;
  status: 'Agendada' | 'Realizada' | 'Ausente' | 'Cancelada';
  realizedAt: string | null;
  observation: string | null;
  results: HistoryResult[];
}
export interface ParticipantHistory { participant: Participant; visits: HistoryVisit[] }

export const INVALID_HISTORY_MESSAGE = 'O servidor retornou um histórico inválido. Tente novamente.';
const VISIT_STATUSES = ['Agendada', 'Realizada', 'Ausente', 'Cancelada'];

function isHistoryVisit(value: unknown): value is HistoryVisit {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.plannedVisitName === 'string' && typeof v.plannedVisitOrder === 'number'
    && typeof v.scheduledAt === 'string' && VISIT_STATUSES.includes(v.status as string)
    && nullableString(v.realizedAt) && nullableString(v.observation)
    && Array.isArray(v.results) && v.results.every((r) => r && typeof r === 'object' && typeof (r as HistoryResult).id === 'string'
      && typeof (r as HistoryResult).activityName === 'string' && typeof (r as HistoryResult).value === 'string');
}

// GET /studies/:studyId/participants/:participationId/history
const getHistory = async (request: AuthenticatedRequest, studyId: string, participationId: string, signal?: AbortSignal): Promise<ParticipantHistory> => {
  const { response, body } = await send(request, `${studyPath(studyId)}/participants/${encodeURIComponent(participationId)}/history`, signal ? { signal } : undefined);
  if (!response.ok) throw errorFor(response.status, body, COMMON_MESSAGES, 'Não foi possível consultar o histórico do participante. Tente novamente.');
  const data = body as { participant?: unknown; visits?: unknown } | null;
  if (!data || !isParticipantResponse(data.participant) || !Array.isArray(data.visits) || !data.visits.every(isHistoryVisit)
    || data.participant.participationId !== participationId || data.participant.studyId !== studyId) {
    throw new ParticipantsApiError(INVALID_HISTORY_MESSAGE);
  }
  return { participant: toParticipant(data.participant), visits: data.visits };
};

export interface WithdrawalInput { withdrawalDate: string; reason: string }

// POST /studies/:studyId/participants/:participationId/withdrawal — corpo somente com os campos do contrato.
const registerWithdrawal = async (request: AuthenticatedRequest, studyId: string, participationId: string, input: WithdrawalInput): Promise<Participant> => {
  const { response, body } = await send(request, `${studyPath(studyId)}/participants/${encodeURIComponent(participationId)}/withdrawal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ withdrawalDate: input.withdrawalDate, reason: input.reason.trim() }),
  });
  if (!response.ok) {
    throw errorFor(response.status, body, {
      ...COMMON_MESSAGES, 403: 'Você não tem permissão para registrar a retirada neste estudo.',
    }, 'Não foi possível registrar a retirada. Consulte o participante antes de tentar novamente.');
  }
  if (!isParticipantResponse(body) || body.participationId !== participationId || body.studyId !== studyId || body.participationStatus !== 'Retirado') {
    throw new ParticipantsApiError('O servidor retornou uma resposta de retirada inválida. Consulte o participante antes de tentar novamente.');
  }
  return toParticipant(body);
};

/** Resposta simulada para desenvolvimento sem backend (VITE_PARTICIPANTS_MOCK=true). */
export const MOCK_PARTICIPANTS: readonly Participant[] = [
  { participationId: 'mock-p1', candidateId: 'mock-c1', studyId: 'mock-s1', name: 'Bianca Oliveira', status: 'Ativo', includedAt: '2026-10-05', withdrawnAt: null, withdrawalReason: null },
  { participationId: 'mock-p2', candidateId: 'mock-c2', studyId: 'mock-s1', name: 'Rafael Lima', status: 'Ativo', includedAt: '2026-10-12', withdrawnAt: null, withdrawalReason: null },
];
export const mockListByStudy: ParticipantsByStudyQuery = async (_request, studyId) => MOCK_PARTICIPANTS.map((item) => ({ ...item, studyId }));

const useMock = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PARTICIPANTS_MOCK === 'true';

export const participantsApi = { listByStudy: useMock ? mockListByStudy : listByStudy, getHistory, registerWithdrawal };
export { listByStudy as httpListParticipantsByStudy };
