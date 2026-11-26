import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HttpError, SessionChangedError, httpRequest, type AuthenticatedHttpClient } from '../api/http';
import { authRequest } from './api';
import { tokenStorage } from './tokenStorage';
import { accessError, isUser, type LoginResponse, type MeResponse, type User } from './types';

export type { User } from './types';
export type AuthStatus = 'initializing' | 'unauthenticated' | 'verifying' | 'authenticated' | 'validation-error';
interface AuthState { status: AuthStatus; user: User | null; message: string | null }
interface AuthValue extends AuthState {
  client: AuthenticatedHttpClient | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
const invalidResponse = 'O servidor retornou uma resposta inválida. Entre novamente.';
const remoteWarning = 'Não foi possível confirmar a revogação no servidor. A sessão remota poderá permanecer ativa até expirar.';
const signedOut = (message: string | null = null): AuthState => ({ status: 'unauthenticated', user: null, message });

async function revoke(token: string): Promise<boolean> {
  try {
    const response = await authRequest('logout', undefined, token);
    return response.ok;
  } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'initializing', user: null, message: null });
  const token = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const cleanupRequired = useRef(false);
  const logoutPending = useRef<Promise<void> | null>(null);

  const clearLocal = useCallback(async (id: number, message: string | null, remote = Promise.resolve(true)) => {
    token.current = null;
    cleanupRequired.current = true;
    setState({ status: 'verifying', user: null, message: null });
    let storageError: string | null = null;
    try {
      await tokenStorage.clear();
      if (id === generation.current) cleanupRequired.current = false;
    } catch (error) {
      storageError = (error as Error).message;
    }
    const revoked = await remote;
    if (id !== generation.current) return;
    const notice = [message, storageError, !revoked ? remoteWarning : null].filter(Boolean).join(' ') || null;
    setState(storageError ? { status: 'validation-error', user: null, message: notice } : signedOut(notice));
  }, []);

  const logout = useCallback((): Promise<void> => {
    if (logoutPending.current) return logoutPending.current;
    const id = ++generation.current;
    const previousToken = token.current;
    token.current = null;
    busy.current = true;
    setState({ status: 'verifying', user: null, message: null });
    logoutPending.current = clearLocal(id, null, previousToken ? revoke(previousToken) : Promise.resolve(true)).finally(() => {
      if (id === generation.current) busy.current = false;
      logoutPending.current = null;
    });
    return logoutPending.current;
  }, [clearLocal]);

  const restore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const id = ++generation.current;
    const current = () => id === generation.current;
    try {
      const savedToken = await (token.current ?? tokenStorage.read());
      if (!current()) return;
      if (!savedToken) { setState(signedOut()); return; }
      token.current = savedToken;
      setState({ status: 'verifying', user: null, message: null });
      const response = await authRequest('me', undefined, savedToken);
      if (!current()) return;
      if (response.status >= 500 || response.status === 408 || response.status === 429) throw new Error('temporary');
      if (!response.ok) {
        await clearLocal(id, response.status === 401
          ? 'Sua sessão expirou ou não está mais disponível. Entre novamente.'
          : 'Esta conta está indisponível. Entre novamente ou contate a administração.');
        return;
      }
      const data = response.data;
      const error = isUser(data) ? accessError(data) : invalidResponse;
      if (error) {
        await clearLocal(id, error, revoke(savedToken));
        return;
      }
      const user = data as MeResponse;
      setState({ status: 'authenticated', user, message: null });
    } catch (error) {
      if (current()) setState({ status: 'validation-error', user: null, message: token.current
        ? 'Não foi possível verificar sua sessão'
        : (error as Error).message });
    } finally { if (current()) busy.current = false; }
  }, [clearLocal]);

  const cancelPending = useCallback(() => {
    ++generation.current;
    busy.current = false;
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return restore(); });
    return () => { active = false; cancelPending(); };
  }, [restore, cancelPending]);

  async function login(email: string, password: string) {
    if (busy.current || cleanupRequired.current || state.status !== 'unauthenticated') return;
    busy.current = true;
    const id = ++generation.current;
    let issuedToken: string | null = null;
    setState(signedOut());
    try {
      const response = await authRequest('login', { email: email.trim(), password });
      if (!response.ok) throw new Error(response.status === 401 ? 'E-mail ou senha inválidos, ou conta indisponível.' : 'Não foi possível entrar. Tente novamente.');
      const candidate = response.data as Partial<LoginResponse> | null;
      if (typeof candidate?.accessToken === 'string' && candidate.accessToken.trim()) issuedToken = candidate.accessToken;
      if (id !== generation.current) { if (issuedToken) await revoke(issuedToken); return; }
      if (!issuedToken || !isUser(candidate?.user)) throw new Error(invalidResponse);
      const error = accessError(candidate.user);
      if (error) throw new Error(error);
      token.current = issuedToken;
      await tokenStorage.save(issuedToken);
      if (id !== generation.current) return;
      setState({ status: 'authenticated', user: candidate.user, message: null });
    } catch (error) {
      if (id !== generation.current) return;
      const message = (error as Error).message;
      if (issuedToken) {
        await clearLocal(id, message, revoke(issuedToken));
      }
      throw new Error(message);
    } finally { if (id === generation.current) busy.current = false; }
  }

  async function retry() {
    if (cleanupRequired.current) await logout();
    else {
      setState({ status: 'verifying', user: null, message: null });
      await restore();
    }
  }

  // The client belongs to this session generation. Components never receive its token.
  const client = useMemo<AuthenticatedHttpClient | null>(() => {
    if (state.status !== 'authenticated' || !state.user) return null;
    const id = generation.current;
    const current = () => id === generation.current && token.current !== null;
    return {
      async get(path) {
        if (!current()) throw new SessionChangedError();
        let response;
        try {
          response = await httpRequest(path, { method: 'GET', token: token.current! });
        } catch (error) {
          if (!current()) throw new SessionChangedError();
          throw error;
        }
        if (!current()) throw new SessionChangedError();
        // /me endpoints return 403 when the account is no longer a Participant (matrix 12.1).
        if (response.status === 401 || response.status === 403) {
          const expiredId = ++generation.current;
          busy.current = true;
          try { await clearLocal(expiredId, new HttpError(response.status).message); }
          finally { if (expiredId === generation.current) busy.current = false; }
        }
        if (!response.ok) throw new HttpError(response.status);
        return response.data;
      },
    };
  }, [state.status, state.user, clearLocal]);

  return <AuthContext.Provider value={{ ...state, client, login, logout, retry }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa de AuthProvider.');
  return context;
}
