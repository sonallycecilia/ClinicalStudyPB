import Constants from 'expo-constants';
import { Platform } from 'react-native';

function apiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (__DEV__) {
    if (Platform.OS === 'web') return 'http://localhost:3000';
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:3000`;
  }
  throw new Error('Configure EXPO_PUBLIC_API_URL para conectar ao servidor.');
}

export interface AuthenticatedHttpClient {
  get(path: string): Promise<unknown>;
}

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(status === 401 ? 'Sua sessão expirou ou não está mais disponível. Entre novamente.'
      : status === 403 ? 'Acesso não autorizado. Seu perfil não tem permissão para este recurso.'
      : status === 404 ? 'O recurso solicitado não foi encontrado ou não está disponível para esta conta.'
      : 'Não foi possível carregar os dados. Tente novamente.');
    this.name = 'HttpError';
  }
}

export class SessionChangedError extends Error {
  constructor() {
    super('A sessão foi alterada. Entre novamente.');
    this.name = 'SessionChangedError';
  }
}

// Shared transport: same URL, Bearer header and timeout for auth and participant queries.
export async function httpRequest(path: string, options: {
  method: 'GET' | 'POST'; body?: object; token?: string; readResponse?: boolean;
}) {
  const url = apiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}${path}`, {
      method: options.method,
      headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    let data: unknown = null;
    if (response.ok && options.readResponse !== false) {
      try { data = await response.json(); }
      catch (error) {
        // JSON malformado é resposta inválida; interrupção da leitura é falha de conexão.
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.');
  } finally { clearTimeout(timeout); }
}
