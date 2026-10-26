import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginResponse, User, UserRole, WebUser } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const SESSION_KEY = 'clinicalstudy.session';
const WEB_ROLES: readonly UserRole[] = ['Administrador', 'Pesquisador', 'Coordenador'];

interface AuthContextValue {
  user: WebUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<WebUser>;
  logout: () => Promise<void>;
  request: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function storedToken(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as LoginResponse | null;
    return saved?.accessToken && !saved.accessToken.startsWith('demo.') ? saved.accessToken : null;
  } catch {
    return null;
  }
}

function isWebUser(value: unknown): value is WebUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<User>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.email === 'string'
    && WEB_ROLES.includes(candidate.role as UserRole)
    && (candidate.status === 'Ativo' || candidate.status === 'Inativo');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => storedToken());
  const [user, setUser] = useState<WebUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(storedToken()));

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setLoading(false);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      setUser(null);
      return;
    }

    let cancelled = false;
    const validate = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Sessão indisponível.');
        const current: unknown = await response.json();
        // A API compartilhada também conhece Participante para outros clientes;
        // somente Administrador, Pesquisador e Coordenador entram na interface Web.
        if (!isWebUser(current)) throw new Error('Perfil não disponível na interface Web.');
        if (!cancelled) setUser(current);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void validate();
    const onFocus = () => { void validate(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [accessToken, clearSession]);

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== SESSION_KEY) return;
      const token = storedToken();
      setUser(null);
      setAccessToken(token);
      setLoading(Boolean(token));
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const request = useCallback(async (path: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch {
      throw new Error('Não foi possível conectar à API. Verifique se o backend está em execução.');
    }

    if (response.status === 401) {
      clearSession();
    } else if (response.status === 403 && accessToken) {
      // Diferencia uma restrição de perfil de uma sessão que deixou de ser válida.
      try {
        const me = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (me.ok) {
          const current: unknown = await me.json();
          if (isWebUser(current)) setUser(current);
          else clearSession();
        } else if (me.status === 401) {
          clearSession();
        }
      } catch {
        // A resposta original (403) continua sendo devolvida ao chamador.
      }
    }
    return response;
  }, [accessToken, clearSession]);

  const login = useCallback(async (email: string, password: string): Promise<WebUser> => {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Não foi possível conectar à API. Tente novamente.');
    }

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Tente novamente.');
    }

    const session = await response.json() as LoginResponse;
    if (typeof session.accessToken !== 'string' || !session.accessToken || !isWebUser(session.user)) {
      // O backend pode possuir contas de Participante para outros clientes;
      // não manter uma sessão aberta na interface Web para esse perfil.
      if (typeof session.accessToken === 'string' && session.accessToken) {
        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.accessToken}` },
          });
        } catch { /* A sessão não é guardada no browser; a expiração do token limita seu uso. */ }
      }
      clearSession();
      throw new Error('Este perfil não tem acesso à interface Web.');
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: session.accessToken }));
    setAccessToken(session.accessToken);
    setUser(session.user);
    return session.user;
  }, [clearSession]);

  const logout = useCallback(async (): Promise<void> => {
    // Mantém a sessão local se a API falhar, permitindo tentar invalidá-la novamente.
    const response = await request('/auth/logout', { method: 'POST' });
    if (!response.ok && response.status !== 401) {
      throw new Error('Não foi possível encerrar a sessão. Tente novamente.');
    }
    clearSession();
  }, [clearSession, request]);

  const value = useMemo(() => ({ user, accessToken, loading, login, logout, request }), [
    user, accessToken, loading, login, logout, request,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return context;
}
