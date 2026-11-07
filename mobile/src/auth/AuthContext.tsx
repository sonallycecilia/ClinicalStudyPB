import { createContext, useContext, useState, type ReactNode } from 'react';
import { authRequest } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Pesquisador' | 'Coordenador' | 'Participante';
}
interface Session { accessToken: string; user: User }
interface AuthValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

// Usado exclusivamente pelas rotas locais de prévia, sem token ou chamadas à API.
export function AuthPreviewProvider({ children, onLogin, onLogout }: {
  children: ReactNode;
  onLogin: () => void;
  onLogout: () => void;
}) {
  if (!__DEV__) return null;
  return <AuthContext.Provider value={{
    user: { id: 'preview', name: 'Bianca Oliveira (prévia)', email: 'bianca.oliveira@clinicalstudypb.test', role: 'Participante' },
    login: async () => { onLogin(); },
    logout: async () => { onLogout(); },
  }}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // A sessão fica apenas em memória; nunca salvamos a senha no dispositivo.
  const [session, setSession] = useState<Session | null>(null);
  async function login(email: string, password: string) {
    const response = await authRequest('login', { email: email.trim(), password });
    if (!response.ok) throw new Error(response.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Tente novamente.');
    const data = await response.json();
    if (typeof data?.accessToken !== 'string' || !data.accessToken
      || typeof data.user?.id !== 'string' || typeof data.user?.name !== 'string'
      || typeof data.user?.email !== 'string'
      || !['Administrador', 'Pesquisador', 'Coordenador', 'Participante'].includes(data.user?.role)) {
      throw new Error('O servidor retornou uma resposta inválida. Tente novamente.');
    }
    setSession(data);
  }
  async function logout() {
    if (!session) return;
    const response = await authRequest('logout', undefined, session.accessToken);
    if (!response.ok && response.status !== 401) throw new Error('Não foi possível sair. Tente novamente.');
    setSession(null);
  }
  return <AuthContext.Provider value={{ user: session?.user ?? null, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa de AuthProvider.');
  return context;
}
