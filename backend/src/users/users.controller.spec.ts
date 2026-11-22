import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import type { CreateUserInput, UpdateUserInput } from './user.types.js';

describe('UsersController input validation', () => {
  const usersService = {
    list: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as UsersService;
  const controller = new UsersController(usersService);
  const request = { user: { sub: 'another-admin' } } as AuthenticatedRequest;
  const validCreate: CreateUserInput = {
    name: 'Ana Pessoa',
    email: 'ana@example.test',
    phone: '83999990000',
    password: 'Senha123!',
    role: 'Pesquisador',
  };

  it('rejects a missing create body', () => {
    expect(() => controller.create(null as unknown as CreateUserInput)).toThrow(BadRequestException);
  });

  it.each([
    ['name', '  '],
    ['email', 'email-invalido'],
    ['phone', '123'],
    ['password', 'curta'],
    ['role', 'Desconhecido'],
  ] as const)('rejects an invalid create field: %s', (field, value) => {
    expect(() => controller.create({ ...validCreate, [field]: value } as CreateUserInput)).toThrow(BadRequestException);
  });

  it('rejects an empty update body', () => {
    expect(() => controller.update('user-id', {}, request)).toThrow(BadRequestException);
  });

  it.each([
    ['name', '  '],
    ['email', 'email-invalido'],
    ['phone', '123'],
    ['password', 'curta'],
    ['role', 'Desconhecido'],
    ['status', 'Pendente'],
  ] as const)('rejects an invalid update field: %s', (field, value) => {
    expect(() => controller.update('user-id', { [field]: value } as UpdateUserInput, request)).toThrow(BadRequestException);
  });
});
