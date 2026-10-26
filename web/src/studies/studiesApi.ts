/** Formatos compatíveis com o Study retornado pelo backend NestJS. */
export type StudyStatus = 'Em andamento' | 'Planejado' | 'Encerrado';
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
export type AuthenticatedRequest = (path: string, options?: RequestInit) => Promise<Response>;

async function studiesRequest<T>(request: AuthenticatedRequest, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await request(path, init);
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
  list: (request: AuthenticatedRequest, signal?: AbortSignal) => studiesRequest<Study[]>(request, '/studies', { signal }),
  detail: (request: AuthenticatedRequest, id: string) => studiesRequest<Study>(request, `/studies/${encodeURIComponent(id)}`),
  create: (request: AuthenticatedRequest, input: StudyInput) => studiesRequest<Study>(request, '/studies', {
    method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' },
  }),
  update: (request: AuthenticatedRequest, id: string, input: StudyInput) => studiesRequest<Study>(request, `/studies/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' },
  }),
};
