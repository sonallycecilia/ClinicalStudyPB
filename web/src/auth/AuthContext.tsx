import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginResponse, User } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const SESSION_KEY = 'clinicalstudy.session';
interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  request: (path: string, options?: RequestInit) => Promise<Response>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
function storedToken(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as LoginResponse | null;
    return saved?.accessToken && !saved.accessToken.startsWith('demo.') ? saved.accessToken : null;
  } catch { return null; }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState(storedToken);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  function clearSession() {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(SESSION_KEY);
  }
  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    let cancelled = false;
    async function validate() {
      try {
        const response = await fetch(API_URL + '/auth/me', { headers: { Authorization: 'Bearer ' + accessToken } });
        if (!response.ok) throw new Error('Sess?o indisponível.');
        const current = await response.json() as User;
        if (!cancelled) setUser(current);
      } catch { if (!cancelled) clearSession(); }
      finally { if (!cancelled) setLoading(false); }
    }
    void validate();
    const onFocus = () => { void validate(); };
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, [accessToken]);
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === SESSION_KEY) { setUser(null); setLoading(true); setAccessToken(storedToken()); }
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  async function request(path: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
    const response = await fetch(API_URL + path, { ...options, headers });
    if (response.status === 401) clearSession();
    if (response.status === 403 && accessToken) {
      const me = await fetch(API_URL + '/auth/me', { headers });
      if (me.ok) setUser(await me.json() as User);
      else if (me.status === 401) clearSession();
    }
    return response;
  }
  async function login(email: string, password: string): Promise<User> {
    let response: Response;
    try {
      response = await fetch(API_URL + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
    } catch { throw new Error('Não foi possível conectar à API. Tente novamente.'); }
    if (!response.ok) throw new Error(response.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Tente novamente.');
    const session = await response.json() as LoginResponse;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: session.accessToken }));
    setAccessToken(session.accessToken);
    setUser(session.user);
    return session.user;
  }
  async function logout(): Promise<void> {
    // Mantém a sessão local se a API falhar, permitindo tentar invalidá-la novamente.
    const response = await request('/auth/logout', { method: 'POST' });
    if (!response.ok && response.status !== 401) throw new Error('Não foi possível encerrar a sessão. Tente novamente.');
    clearSession();
  }
  return <AuthContext.Provider value={{ user, accessToken, loading, login, logout, request }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return context;
}
