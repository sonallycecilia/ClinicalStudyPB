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

export async function authRequest(path: string, body?: object, token?: string) {
  const url = apiUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${url}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.');
  } finally { clearTimeout(timeout); }
}
