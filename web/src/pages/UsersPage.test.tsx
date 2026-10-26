import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UsersPage } from './UsersPage';
import type { User, WebUser } from '../types';

const { mockRequest, mockUseAuth } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

const admin: WebUser = {
  id: 'admin-id',
  name: 'Ana Souza',
  email: 'ana@example.test',
  phone: '83999990000',
  role: 'Administrador',
  status: 'Ativo',
  createdAt: '2026-10-01T12:00:00.000Z',
};

const users: User[] = [
  admin,
  {
    id: 'researcher-id',
    name: 'Marina Costa',
    email: 'marina@example.test',
    phone: '83988887777',
    role: 'Pesquisador',
    status: 'Ativo',
    createdAt: '2026-10-02T12:00:00.000Z',
  },
];

const response = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
}) as Response;

function renderUsers() {
  return render(<UsersPage />);
}

beforeEach(() => {
  mockRequest.mockReset();
  mockRequest.mockResolvedValue(response(users));
  mockUseAuth.mockReturnValue({ accessToken: 'token', request: mockRequest, user: admin });
});

afterEach(() => cleanup());

describe('UsersPage', () => {
  it('carrega contas, apresenta os totais e permite buscar e filtrar por perfil', async () => {
    renderUsers();

    expect(await screen.findByText('Marina Costa')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/users');
    expect(screen.getByRole('region', { name: 'Resumo de contas' }).textContent).toContain('02');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou e-mail'), {
      target: { value: 'MARINA@EXAMPLE.TEST' },
    });
    expect(screen.getByText('Marina Costa')).toBeTruthy();
    expect(screen.queryByText('Ana Souza')).toBeNull();

    fireEvent.change(screen.getByLabelText('Filtrar por perfil'), {
      target: { value: 'Pesquisador' },
    });
    expect(screen.getByText('Marina Costa')).toBeTruthy();
    expect(screen.queryByText('Ana Souza')).toBeNull();
  });

  it('apresenta uma mensagem quando a listagem falha', async () => {
    mockRequest.mockRejectedValue(new Error('offline'));
    renderUsers();

    expect((await screen.findByRole('status')).textContent).toContain(
      'Não foi possível carregar os usuários. Atualize a página para tentar novamente.',
    );
  });

  it('valida os campos obrigatórios antes de chamar a API', async () => {
    renderUsers();
    await screen.findByText('Marina Costa');
    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Al' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);

    expect((await screen.findByRole('alert')).textContent).toContain('Informe o nome completo.');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('cadastra usuário, fecha o formulário e atualiza a lista', async () => {
    const created: User = {
      id: 'new-user-id',
      name: 'Joana Teste',
      email: 'joana@example.test',
      phone: '(83) 98765-4321',
      role: 'Coordenador',
      status: 'Ativo',
      createdAt: '2026-10-03T12:00:00.000Z',
    };
    mockRequest.mockResolvedValueOnce(response(users));
    mockRequest.mockResolvedValueOnce(response(created));
    renderUsers();
    await screen.findByText('Marina Costa');

    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: created.name } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: created.email } });
    fireEvent.change(screen.getByLabelText('Telefone *'), { target: { value: '83987654321' } });
    fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'Senha123!' } });
    fireEvent.change(screen.getByLabelText('Perfil de acesso *'), { target: { value: 'Coordenador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar usuário' }));

    expect(await screen.findByText(created.name)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Usuário cadastrado com sucesso.');
    expect(mockRequest).toHaveBeenLastCalledWith('/users', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining(created.email),
    }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('edita uma conta e mostra falha de API sem atualizar a lista', async () => {
    mockRequest.mockResolvedValueOnce(response(users));
    mockRequest.mockResolvedValueOnce(response({ message: 'E-mail já utilizado.' }, false));
    renderUsers();
    await screen.findByText('Marina Costa');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]!);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Marina Atualizada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect((await screen.findByRole('alert')).textContent).toContain('E-mail já utilizado.');
    expect(mockRequest).toHaveBeenLastCalledWith('/users/researcher-id', expect.objectContaining({
      method: 'PATCH',
    }));
  });

  it('edita uma conta com sucesso e atualiza a linha exibida', async () => {
    const updated: User = { ...users[1]!, name: 'Marina Atualizada' };
    mockRequest.mockResolvedValueOnce(response(users));
    mockRequest.mockResolvedValueOnce(response(updated));
    renderUsers();
    await screen.findByText('Marina Costa');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]!);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: updated.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText(updated.name)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Alterações salvas com sucesso.');
    expect(mockRequest).toHaveBeenLastCalledWith('/users/researcher-id', expect.objectContaining({
      method: 'PATCH',
    }));
  });

  it('impede que o administrador inative a própria conta', async () => {
    renderUsers();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]!);
    fireEvent.change(screen.getByLabelText('Situação da conta *'), { target: { value: 'Inativo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Não é permitido inativar a própria conta.');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('permite cancelar a confirmação de exclusão sem chamar a API', async () => {
    renderUsers();
    await screen.findByText('Marina Costa');
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1]!);
    expect(screen.getByRole('dialog', { name: 'Excluir usuário?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Marina Costa')).toBeTruthy();
  });

  it('exclui a conta somente após confirmação e retira a linha da lista', async () => {
    mockRequest.mockResolvedValueOnce(response(users));
    mockRequest.mockResolvedValueOnce(response({ message: 'Conta excluída com sucesso.' }));
    renderUsers();
    await screen.findByText('Marina Costa');
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir usuário' }));

    await waitFor(() => expect(screen.queryByText('Marina Costa')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Conta excluída com sucesso.');
    expect(mockRequest).toHaveBeenLastCalledWith('/users/researcher-id', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('não permite iniciar exclusão da própria conta administrativa', async () => {
    renderUsers();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' })[0]!);

    expect(screen.queryByRole('dialog', { name: 'Excluir usuário?' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('você não pode excluir a própria conta');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
