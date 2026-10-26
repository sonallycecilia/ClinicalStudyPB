import { ConflictException, NotFoundException } from '@nestjs/common';
import { scryptSync } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { UsersService } from './users.service.js';
import type { InternalUser } from './user.types.js';

describe('UsersService com PostgreSQL', () => {
  const account: InternalUser = { id: '00000000-0000-4000-8000-000000000001', name: 'Teste Pessoa', email: 'teste@example.test', phone: '83999990000', role: 'Pesquisador', status: 'Ativo', createdAt: '2026-10-01T12:00:00.000Z', passwordSalt: 'test-salt', passwordHash: scryptSync('Senha123!', 'test-salt', 64).toString('hex') };
  let rows: InternalUser[];
  let failure: unknown;
  let users: UsersService;
  beforeEach(() => {
    rows = [{ ...account }]; failure = undefined;
    const database = { query: async () => { if (failure) throw failure; return { rows, rowCount: rows.length }; } };
    users = new UsersService(database as unknown as DatabaseService);
  });
  it('omite credenciais em consultas públicas', async () => {
    const result = await users.list();
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('passwordSalt');
  });
  it('autentica somente conta ativa com senha correta', async () => {
    expect(await users.authenticate(account.email, 'Senha123!')).toMatchObject({ id: account.id });
    expect(await users.authenticate(account.email, 'errada')).toBeNull();
    rows[0]!.status = 'Inativo';
    expect(await users.authenticate(account.email, 'Senha123!')).toBeNull();
    rows = [];
    expect(await users.authenticate(account.email, 'Senha123!')).toBeNull();
  });
  it('converte duplicidade do PostgreSQL em conflito', async () => {
    failure = { code: '23505' };
    await expect(users.create({ ...account, password: 'Senha123!' })).rejects.toThrow(ConflictException);
    await expect(users.update(account.id, { email: account.email })).rejects.toThrow(ConflictException);
  });
  it('retorna 404 para conta inexistente', async () => {
    rows = [];
    await expect(users.findById(account.id)).rejects.toThrow(NotFoundException);
    await expect(users.update(account.id, { name: 'Outro Nome' })).rejects.toThrow(NotFoundException);
    await expect(users.remove(account.id)).rejects.toThrow(NotFoundException);
  });
});
