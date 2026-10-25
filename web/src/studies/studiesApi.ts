/** Formatos compatíveis com o Study retornado pelo backend NestJS. */
export type StudyStatus = 'Em andamento' | 'Planejado';
export type StudyKind = 'Estudo observacional' | 'Estudo longitudinal';
export interface Study {
  id: string;
  code: string;
  title: string;
  objective: string;
  researcherId: string;
  researcher: string;
  startDate: string;
  endDate: string;
  participantLimit: number;
  participantsLinked: number;
  status: StudyStatus;
  kind: StudyKind;
  symbol: 'moon' | 'heart' | 'activity';
}
export type StudyInput = Pick<Study, 'title' | 'objective' | 'startDate' | 'endDate' | 'participantLimit' | 'participantsLinked'>;

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

async function studiesRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Não foi possível conectar à API de estudos. Verifique se o backend está ligado.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const detail = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new Error(detail || `Falha na API de estudos (HTTP ${response.status}).`);
  }
  return await response.json() as T;
}

export const studiesApi = {
  list: (token: string, signal?: AbortSignal) => studiesRequest<Study[]>(token, '/studies', { signal }),
  detail: (token: string, id: string) => studiesRequest<Study>(token, `/studies/${encodeURIComponent(id)}`),
  create: (token: string, input: StudyInput) => studiesRequest<Study>(token, '/studies', {
    method: 'POST', body: JSON.stringify(input),
  }),
  update: (token: string, id: string, input: StudyInput) => studiesRequest<Study>(token, `/studies/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
};
