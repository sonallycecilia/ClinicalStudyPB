import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let users: UsersService;
  beforeEach(() => { users = new UsersService(); });

  it('não expõe hash nem salt da senha', () => {
    const result = users.list();
    expect(result).toHaveLength(4);
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('passwordSalt');
  });

  it('cria conta e impede e-mail duplicado', () => {
    const input = { name: 'João da Silva', email: 'joao@example.test', phone: '(83) 99999-1111', password: 'Senha123!', role: 'Pesquisador' as const };
    expect(users.create(input).email).toBe('joao@example.test');
    expect(() => users.create({ ...input, email: 'JOAO@example.test' })).toThrow(ConflictException);
  });

  it('atualiza dados e remove conta existente', () => {
    const created = users.create({ name: 'João da Silva', email: 'joao@example.test', phone: '(83) 99999-1111', password: 'Senha123!', role: 'Pesquisador' });
    expect(users.update(created.id, { status: 'Inativo' }).status).toBe('Inativo');
    users.remove(created.id);
    expect(() => users.findById(created.id)).toThrow(NotFoundException);
  });
});
