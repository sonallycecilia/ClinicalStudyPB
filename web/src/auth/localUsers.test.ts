import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalUser, deleteLocalUser, listLocalUsers, updateLocalUser } from './localUsers';

const storageKey = 'clinicalstudy.demo-users';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('utilitário legado de usuários locais', () => {
  it('inicializa a lista demonstrativa quando ainda não há dados salvos', () => {
    const users = listLocalUsers();

    expect(users.map(({ id }) => id)).toEqual(['usr-researcher', 'usr-coordinator', 'usr-admin']);
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual(users);
  });

  it('recupera a lista demonstrativa de um armazenamento malformado', () => {
    localStorage.setItem(storageKey, '{');

    expect(listLocalUsers()).toHaveLength(3);
  });

  it('cria usuário sem persistir a senha e rejeita e-mail duplicado sem diferenciar caixa', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(userId);
    const input = {
      name: 'Nova pessoa',
      email: 'nova@example.test',
      phone: '83999990000',
      role: 'Coordenador' as const,
      password: 'nao-persistir',
    };

    const created = createLocalUser(input);

    expect(created).toMatchObject({
      id: `demo-${userId}`,
      name: input.name,
      email: input.email,
      role: input.role,
      status: 'Ativo',
    });
    expect(created).not.toHaveProperty('password');
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toContainEqual(created);
    expect(() => createLocalUser({ ...input, email: input.email.toUpperCase() }))
      .toThrow('Já existe uma conta com este e-mail.');
  });

  it('atualiza usuário, evita e-mail de outro usuário e remove o cadastro solicitado', () => {
    const users = listLocalUsers();
    const [first, second] = users;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(updateLocalUser(first!.id, { name: 'Nome atualizado', status: 'Inativo' })[0])
      .toMatchObject({ name: 'Nome atualizado', status: 'Inativo' });
    expect(() => updateLocalUser(first!.id, { email: second!.email.toUpperCase() }))
      .toThrow('Já existe uma conta com este e-mail.');

    expect(deleteLocalUser(first!.id).some(({ id }) => id === first!.id)).toBe(false);
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toHaveLength(2);
  });
});
