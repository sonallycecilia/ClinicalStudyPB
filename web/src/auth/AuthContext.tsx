import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginResponse, User, UserRole } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const SESSION_KEY = 'clinicalstudy.session';

const demoAccounts: Array<{ email: string; password: string; user: User }> = [
  {
    email: 'ana.souza@clinicalstudypb.test', password: 'Admin123!',
    user: { id: 'usr-admin', name: 'Ana Souza', email: 'ana.souza@clinicalstudypb.test', phone: '(83) 99900-0001', role: 'Administrador', status: 'Ativo', createdAt: '2026-10-01T12:00:00.000Z' },
  },
  {
    email: 'marina.costa@clinicalstudypb.test', password: 'Demo123!',
    user: { id: 'usr-researcher', name: 'Marina Costa', email: 'marina.costa@clinicalstudypb.test', phone: '(81) 7788-4444', role: 'Pesquisador', status: 'Ativo', createdAt: '2026-10-02T12:00:00.000Z' },
  },
  {
    email: 'rafael.lima@clinicalstudypb.test', password: 'Demo123!',
    user: { id: 'usr-coordinator', name: 'Rafael Lima', email: 'rafael.lima@clinicalstudypb.test', phone: '(83) 98888-1111', role: 'Coordenador', status: 'Ativo', createdAt: '2026-10-03T12:00:00.000Z' },
  },
];

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  demoMode: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  useDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadSession(): { user: User; accessToken: string; demoMode: boolean } | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as { user: User; accessToken: string; demoMode: boolean };
    if (!parsed.user?.id || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadSession);
  const [user, setUser] = useState<User | null>(initial?.user ?? null);
  const [accessToken, setAccessToken] = useState<string | null>(initial?.accessToken ?? null);
  const [demoMode, setDemoMode] = useState(initial?.demoMode ?? true);

  function saveSession(session: LoginResponse, isDemo: boolean): User {
    setUser(session.user);
    setAccessToken(session.accessToken);
    setDemoMode(isDemo);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, demoMode: isDemo }));
    return session.user;
  }

  async function login(email: string, password: string): Promise<User> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      const account = demoAccounts.find((entry) => entry.email === email.trim().toLowerCase() && entry.password === password);
      if (!account) throw new Error('E-mail ou senha inválidos. Confira os dados de demonstração.');
      return saveSession({ accessToken: `demo.${account.user.id}.${account.user.role}`, user: account.user }, true);
    }

    if (!response.ok) throw new Error('E-mail ou senha inválidos.');
    const session = (await response.json()) as LoginResponse;
    return saveSession(session, false);
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    setDemoMode(true);
    localStorage.removeItem(SESSION_KEY);
  }

  function useDemoMode() {
    setDemoMode(true);
  }

  const value = useMemo(() => ({ user, accessToken, demoMode, login, logout, useDemoMode }), [user, accessToken, demoMode]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return context;
}

export function isUserRole(value: string): value is UserRole {
  return ['Administrador', 'Pesquisador', 'Coordenador'].includes(value);
}
