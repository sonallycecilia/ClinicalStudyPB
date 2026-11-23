export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasStrings(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => typeof value[key] === 'string');
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function invalidListResponse() {
  return new Error('O servidor retornou dados em formato inválido. Tente novamente.');
}
