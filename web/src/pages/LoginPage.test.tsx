import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { WebUser } from '../types';
import { LoginPage } from './LoginPage';

const { mockLogin, mockUseAuth } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

const researcher: WebUser = {
  id: 'd8d77e38-f240-4a1d-a17f-b0e918a548f3',
  name: 'Marina Costa',
  email: 'marina.costa@clinicalstudypb.test',
  phone: '(83) 99999-0000',
  role: 'Pesquisador',
  status: 'Ativo',
  createdAt: '2026-10-01T12:00:00.000Z',
};

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/estudos" element={<p>Estudos do pesquisador</p>} />
        <Route path="/usuarios" element={<p>Administração de usuários</p>} />
        <Route path="/coordenador/painel" element={<p>Painel do coordenador</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockLogin.mockReset();
  mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin });
});

afterEach(() => cleanup());

describe('LoginPage', () => {
  it('renderiza os campos, ações e informações acessíveis da tela', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
    expect(screen.getByLabelText('E-mail').getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('E-mail').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('E-mail').hasAttribute('required')).toBe(true);
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('password');
    expect(screen.getByLabelText('Senha').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByLabelText('Senha').hasAttribute('required')).toBe(true);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Criar uma conta' })).toBeNull();
    expect(screen.getByText('Acesso restrito a usuários autorizados')).toBeTruthy();
  });

  it('aceita entrada nos campos e permite mostrar ou ocultar a senha', () => {
    renderLogin();
    const email = screen.getByLabelText('E-mail') as HTMLInputElement;
    const password = screen.getByLabelText('Senha') as HTMLInputElement;

    fireEvent.change(email, { target: { value: 'pesquisadora@example.test' } });
    fireEvent.change(password, { target: { value: 'Senha123!' } });

    expect(email.value).toBe('pesquisadora@example.test');
    expect(password.value).toBe('Senha123!');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(password.getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeTruthy();
  });

  it('envia as credenciais pelo formulário, remove espaços do e-mail e navega pelo perfil', async () => {
    mockLogin.mockResolvedValue(researcher);
    renderLogin();
    const email = screen.getByLabelText('E-mail');
    const password = screen.getByLabelText('Senha');

    fireEvent.change(email, { target: { value: ` ${researcher.email} ` } });
    fireEvent.change(password, { target: { value: 'Demo123!' } });
    fireEvent.submit(email.closest('form')!);

    expect(mockLogin).toHaveBeenCalledWith(researcher.email, 'Demo123!');
    expect(await screen.findByText('Estudos do pesquisador')).toBeTruthy();
  });

  it('apresenta o erro de credenciais inválidas devolvido pelo fluxo de autenticação', async () => {
    mockLogin.mockRejectedValue(new Error('E-mail ou senha inválidos.'));
    renderLogin();

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalido@example.test' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'SenhaErrada!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha inválidos.');
    expect(screen.getByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
  });

  it('mantém o envio pendente, desabilita o botão e impede um segundo envio', async () => {
    let resolveLogin!: (user: WebUser) => void;
    mockLogin.mockReturnValue(new Promise<WebUser>((resolve) => { resolveLogin = resolve; }));
    renderLogin();

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: researcher.email } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Demo123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const submitButton = screen.getByRole('button', { name: 'Entrando…' }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    fireEvent.click(submitButton);
    expect(mockLogin).toHaveBeenCalledTimes(1);

    resolveLogin(researcher);
    expect(await screen.findByText('Estudos do pesquisador')).toBeTruthy();
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
  });

  it('apresenta falha de comunicação devolvida pelo fluxo de autenticação', async () => {
    mockLogin.mockRejectedValue(new Error('Não foi possível conectar à API. Tente novamente.'));
    renderLogin();

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: researcher.email } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Demo123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível conectar à API. Tente novamente.');
  });

  it('exibe o aviso de sessão enquanto o contexto ainda a valida', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, login: mockLogin });
    renderLogin();

    expect(screen.getByRole('status').textContent).toContain('Validando sessão…');
    expect(screen.queryByRole('heading', { name: 'Acesse sua conta' })).toBeNull();
  });
});
