import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { AppLayout } from '../components/AppLayout';
import { RequireAuth, RequireRole } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { StudiesPage } from '../pages/StudiesPage';
import { UsersPage } from '../pages/UsersPage';
import type { Study } from '../studies/studiesApi';
import type { User, WebUser } from '../types';

const researcher: WebUser = {
  id: 'researcher-id',
  name: 'Marina Costa',
  email: 'marina@example.test',
  phone: '83999990000',
  role: 'Pesquisador',
  status: 'Ativo',
  createdAt: '2026-10-01T12:00:00.000Z',
};

const admin: WebUser = {
  id: 'admin-id',
  name: 'Ana Souza',
  email: 'ana@example.test',
  phone: '83999990000',
  role: 'Administrador',
  status: 'Ativo',
  createdAt: '2026-10-01T12:00:00.000Z',
};

const study: Study = {
  id: 'study-id',
  code: 'EST-001',
  title: 'Qualidade do sono',
  objective: 'Avaliar indicadores de sono com dados fictícios.',
  researcherId: researcher.id,
  researcher: researcher.name,
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  participantLimit: 20,
  participantsLinked: 5,
  status: 'Em andamento',
  kind: 'Estudo observacional',
  symbol: 'moon',
};

const existingUsers: User[] = [admin];

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function brokenJsonResponse(status: number): Response {
  return new Response('{invalid json', {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderWeb(path = '/login') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<p>Acesso não permitido</p>} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route element={<RequireRole />}>
                <Route path="/estudos" element={<StudiesPage />} />
                <Route path="/usuarios" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

function submitLogin(user: WebUser) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

function requestPath(input: RequestInfo | URL): string {
  return new URL(String(input)).pathname;
}

function requestMethod(init?: RequestInit): string {
  return (init?.method ?? 'GET').toUpperCase();
}

function authorization(init?: RequestInit): string | null {
  return new Headers(init?.headers).get('Authorization');
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('integração dos fluxos web com a API HTTP', () => {
  it('faz login, valida a sessão e carrega estudos pelo cliente de API autenticado', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = requestPath(input);
      if (path === '/auth/login') {
        return jsonResponse(201, { accessToken: 'researcher-token', user: researcher });
      }
      if (path === '/auth/me') return jsonResponse(200, researcher);
      if (path === '/studies') return jsonResponse(200, [study]);
      throw new Error(`Requisição inesperada: ${path}`);
    });

    renderWeb();
    submitLogin(researcher);

    expect(await screen.findByRole('heading', { name: study.title })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Menu do perfil Pesquisador' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('clinicalstudy.session') ?? '{}')).toEqual({
      accessToken: 'researcher-token',
    });

    const loginCall = fetchMock.mock.calls.find(([input]) => requestPath(input as RequestInfo) === '/auth/login');
    expect(loginCall?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      email: researcher.email,
      password: 'Senha123!',
    });
    expect(fetchMock.mock.calls.some(([input, init]) =>
      requestPath(input as RequestInfo) === '/auth/me' && authorization(init) === 'Bearer researcher-token',
    )).toBe(true);
    expect(fetchMock.mock.calls.some(([input, init]) =>
      requestPath(input as RequestInfo) === '/studies' && authorization(init) === 'Bearer researcher-token',
    )).toBe(true);
  });

  it('integra o CRUD de usuários com a sessão administrativa e reflete o cadastro na tela', async () => {
    const created: User = {
      id: 'coordinator-id',
      name: 'Joana Teste',
      email: 'joana@example.test',
      phone: '(83) 98765-4321',
      role: 'Coordenador',
      status: 'Ativo',
      createdAt: '2026-10-03T12:00:00.000Z',
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = requestPath(input);
      const method = requestMethod(init);
      if (path === '/auth/login' && method === 'POST') {
        return jsonResponse(201, { accessToken: 'admin-token', user: admin });
      }
      if (path === '/auth/me') return jsonResponse(200, admin);
      if (path === '/users' && method === 'GET') return jsonResponse(200, existingUsers);
      if (path === '/users' && method === 'POST') return jsonResponse(201, created);
      throw new Error(`Requisição inesperada: ${method} ${path}`);
    });

    renderWeb();
    submitLogin(admin);
    expect(await screen.findByRole('row', { name: /ana@example\.test/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: created.name } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: created.email } });
    fireEvent.change(screen.getByLabelText('Telefone *'), { target: { value: '83987654321' } });
    fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'NovaSenha123!' } });
    fireEvent.change(screen.getByLabelText('Perfil de acesso *'), { target: { value: 'Coordenador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar usuário' }));

    expect(await screen.findByText(created.email)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Usuário cadastrado com sucesso.');

    const createCall = fetchMock.mock.calls.find(([input, init]) =>
      requestPath(input as RequestInfo) === '/users' && requestMethod(init) === 'POST',
    );
    expect(authorization(createCall?.[1])).toBe('Bearer admin-token');
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      name: created.name,
      email: created.email,
      role: 'Coordenador',
      password: 'NovaSenha123!',
    });
  });

  it('remove a sessão e retorna ao login quando a API de estudos responde 401', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = requestPath(input);
      if (path === '/auth/login') {
        return jsonResponse(201, { accessToken: 'expired-token', user: researcher });
      }
      if (path === '/auth/me') return jsonResponse(200, researcher);
      if (path === '/studies') return jsonResponse(401, { message: 'Sessão expirada.' });
      throw new Error(`Requisição inesperada: ${path}`);
    });

    renderWeb();
    submitLogin(researcher);

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem('clinicalstudy.session')).toBeNull());
    expect(fetchMock.mock.calls.some(([input, init]) =>
      requestPath(input as RequestInfo) === '/studies'
      && authorization(init) === 'Bearer expired-token',
    )).toBe(true);
  });

  it('impede perfil administrativo de abrir estudos sem chamar a API de estudos', async () => {
    localStorage.setItem('clinicalstudy.session', JSON.stringify({ accessToken: 'admin-token' }));
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = requestPath(input);
      if (path === '/auth/me') return jsonResponse(200, admin);
      throw new Error(`Requisição inesperada: ${path}`);
    });

    renderWeb('/estudos');

    expect(await screen.findByText('Acesso não permitido')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => requestPath(input as RequestInfo) === '/studies')).toBe(false);
  });

  it('mantém a página de usuários operacional e apresenta erro se a resposta HTTP não contém JSON válido', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = requestPath(input);
      if (path === '/auth/login') return jsonResponse(201, { accessToken: 'admin-token', user: admin });
      if (path === '/auth/me') return jsonResponse(200, admin);
      if (path === '/users' && requestMethod(init) === 'GET') return brokenJsonResponse(200);
      throw new Error(`Requisição inesperada: ${requestMethod(init)} ${path}`);
    });

    renderWeb();
    submitLogin(admin);

    expect(await screen.findByText(
      'Não foi possível carregar os usuários. Atualize a página para tentar novamente.',
    )).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Administração de usuários' })).toBeTruthy();
  });

  it('envia logout ao servidor e remove a sessão persistida após resposta bem-sucedida', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = requestPath(input);
      if (path === '/auth/login') return jsonResponse(201, { accessToken: 'researcher-token', user: researcher });
      if (path === '/auth/me') return jsonResponse(200, researcher);
      if (path === '/studies') return jsonResponse(200, [study]);
      if (path === '/auth/logout') return jsonResponse(201, { message: 'Sessão encerrada com sucesso.' });
      throw new Error(`Requisição inesperada: ${requestMethod(init)} ${path}`);
    });

    renderWeb();
    submitLogin(researcher);
    expect(await screen.findByRole('heading', { name: study.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
    expect(localStorage.getItem('clinicalstudy.session')).toBeNull();
    const logoutCall = fetchMock.mock.calls.find(([input]) => requestPath(input as RequestInfo) === '/auth/logout');
    expect(requestMethod(logoutCall?.[1])).toBe('POST');
    expect(authorization(logoutCall?.[1])).toBe('Bearer researcher-token');
  });
});
