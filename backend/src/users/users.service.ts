import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type {
  AccountStatus,
  CreateUserInput,
  InternalUser,
  PublicUser,
  UpdateUserInput,
  UserRole,
} from './user.types.js';

@Injectable()
export class UsersService {
  private readonly accounts: InternalUser[];

  constructor() {
    this.accounts = [
      this.makeSeed('usr-admin', 'Ana Souza', 'ana.souza@clinicalstudypb.test', '(83) 99900-0001', 'Administrador', 'Ativo', 'Admin123!'),
      this.makeSeed('usr-researcher', 'Marina Costa', 'marina.costa@clinicalstudypb.test', '(81) 7788-4444', 'Pesquisador', 'Ativo', 'Demo123!'),
      this.makeSeed('usr-coordinator', 'Rafael Lima', 'rafael.lima@clinicalstudypb.test', '(83) 98888-1111', 'Coordenador', 'Ativo', 'Demo123!'),
      this.makeSeed('usr-participant', 'Bianca Oliveira', 'bianca.oliveira@clinicalstudypb.test', '(83) 97777-2222', 'Participante', 'Ativo', 'Demo123!'),
    ];
  }

  list(): PublicUser[] {
    return this.accounts.map((account) => this.toPublic(account));
  }

  findById(id: string): PublicUser {
    return this.toPublic(this.getInternalById(id));
  }

  findInternalByEmail(email: string): InternalUser | undefined {
    const normalized = email.trim().toLowerCase();
    return this.accounts.find((account) => account.email.toLowerCase() === normalized);
  }

  authenticate(email: string, password: string): PublicUser | null {
    const account = this.findInternalByEmail(email);
    if (!account || account.status !== 'Ativo') return null;

    const candidate = scryptSync(password, account.passwordSalt, 64);
    const stored = Buffer.from(account.passwordHash, 'hex');
    if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) {
      return null;
    }
    return this.toPublic(account);
  }

  create(input: CreateUserInput): PublicUser {
    const email = input.email.trim().toLowerCase();
    if (this.findInternalByEmail(email)) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }

    const account = this.makeAccount({
      id: randomBytes(12).toString('hex'),
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      role: input.role,
      status: 'Ativo',
      password: input.password,
    });
    this.accounts.push(account);
    return this.toPublic(account);
  }

  update(id: string, input: UpdateUserInput): PublicUser {
    const account = this.getInternalById(id);
    const nextEmail = input.email?.trim().toLowerCase();
    if (nextEmail) {
      const duplicate = this.findInternalByEmail(nextEmail);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Já existe uma conta com este e-mail.');
      }
      account.email = nextEmail;
    }

    if (input.name !== undefined) account.name = input.name.trim();
    if (input.phone !== undefined) account.phone = input.phone.trim();
    if (input.role !== undefined) account.role = input.role;
    if (input.status !== undefined) account.status = input.status;
    if (input.password) {
      account.passwordSalt = randomBytes(16).toString('hex');
      account.passwordHash = this.hashPassword(input.password, account.passwordSalt);
    }
    return this.toPublic(account);
  }

  remove(id: string): void {
    const index = this.accounts.findIndex((account) => account.id === id);
    if (index < 0) throw new NotFoundException('Conta não encontrada.');
    this.accounts.splice(index, 1);
  }

  private getInternalById(id: string): InternalUser {
    const account = this.accounts.find((entry) => entry.id === id);
    if (!account) throw new NotFoundException('Conta não encontrada.');
    return account;
  }

  private makeSeed(
    id: string,
    name: string,
    email: string,
    phone: string,
    role: UserRole,
    status: AccountStatus,
    password: string,
  ): InternalUser {
    return this.makeAccount({ id, name, email, phone, role, status, password });
  }

  private makeAccount(data: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    status: AccountStatus;
    password: string;
  }): InternalUser {
    const passwordSalt = randomBytes(16).toString('hex');
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      status: data.status,
      createdAt: new Date().toISOString(),
      passwordSalt,
      passwordHash: this.hashPassword(data.password, passwordSalt),
    };
  }

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex');
  }

  private toPublic(account: InternalUser): PublicUser {
    const { passwordHash: _hash, passwordSalt: _salt, ...safeUser } = account;
    return safeUser;
  }
}
