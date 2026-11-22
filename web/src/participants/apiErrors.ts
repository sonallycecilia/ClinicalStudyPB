/** Extrai a mensagem de negócio de um corpo de erro do NestJS (string ou lista de strings). */
export function backendMessage(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return message.trim();
  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join(' ').trim();
  return '';
}

export function backendCode(body: unknown): string | undefined {
  const code = (body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Data civil de hoje em America/Sao_Paulo (AAAA-MM-DD), a mesma referência usada pela API. */
export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** "2026-11-24T09:00" (datetime-local) → "2026-11-24T09:00:00-03:00" (offset fixo de São Paulo desde 2019). */
export function toSaoPauloOffset(localDateTime: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(localDateTime);
  if (!match) return localDateTime;
  return `${match[1]}T${match[2]}:${match[3] ?? '00'}-03:00`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
