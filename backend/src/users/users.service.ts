import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import type { CreateUserInput, InternalUser, PublicUser, UpdateUserInput } from './user.types.js';

const columns = `id_usuario AS id, nome AS name, email, COALESCE(telefone, '') AS phone,
  perfil AS role, status, data_criacao AS "createdAt",
  senha_hash AS "passwordHash", senha_salt AS "passwordSalt"`;

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<PublicUser[]> {
    const { rows } = await this.database.query<InternalUser>('SELECT ' + columns + ' FROM usuarios ORDER BY data_criacao, id_usuario');
    return rows.map((row) => this.toPublic(row));
  }

  async findById(id: string): Promise<PublicUser> {
    const { rows } = await this.database.query<InternalUser>('SELECT ' + columns + ' FROM usuarios WHERE id_usuario = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Conta não encontrada.');
    return this.toPublic(rows[0]);
  }

  async findInternalByEmail(email: string): Promise<InternalUser | undefined> {
    const { rows } = await this.database.query<InternalUser>('SELECT ' + columns + ' FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
    return rows[0];
  }

  async authenticate(email: string, password: string): Promise<PublicUser | null> {
    const account = await this.findInternalByEmail(email);
    if (!account || account.status !== 'Ativo') return null;
    const candidate = scryptSync(password, account.passwordSalt, 64);
    const stored = Buffer.from(account.passwordHash, 'hex');
    if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) return null;
    return this.toPublic(account);
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    const salt = randomBytes(16).toString('hex');
    try {
      const { rows } = await this.database.query<InternalUser>(
        'INSERT INTO usuarios (nome, email, telefone, perfil, senha_hash, senha_salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ' + columns,
        [input.name.trim(), input.email.trim().toLowerCase(), input.phone.trim(), input.role,
          scryptSync(input.password, salt, 64).toString('hex'), salt],
      );
      return this.toPublic(rows[0]!);
    } catch (error) { this.handleWriteError(error); }
  }

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    const salt = input.password ? randomBytes(16).toString('hex') : null;
    try {
      // Alteração de credenciais e revogação das sessões na mesma instrução.
      const { rows } = await this.database.query<InternalUser>(
        `WITH updated AS (
          UPDATE usuarios SET nome = COALESCE($2, nome), email = COALESCE($3, email),
            telefone = COALESCE($4, telefone), perfil = COALESCE($5, perfil),
            status = COALESCE($6, status), senha_hash = COALESCE($7, senha_hash),
            senha_salt = COALESCE($8, senha_salt)
          WHERE id_usuario = $1 RETURNING *
        ), revoked AS (
          DELETE FROM sessoes WHERE id_usuario = $1
            AND ($7::text IS NOT NULL OR $6::text = 'Inativo')
        ) SELECT ${columns} FROM updated`,
        [id, input.name?.trim() ?? null, input.email?.trim().toLowerCase() ?? null,
          input.phone?.trim() ?? null, input.role ?? null, input.status ?? null,
          salt ? scryptSync(input.password!, salt, 64).toString('hex') : null, salt],
      );
      if (!rows[0]) throw new NotFoundException('Conta não encontrada.');
      return this.toPublic(rows[0]);
    } catch (error) { this.handleWriteError(error); }
  }

  async remove(id: string): Promise<void> {
    try {
      const result = await this.database.query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
      if (!result.rowCount) throw new NotFoundException('Conta não encontrada.');
    } catch (error) {
      // Não apagar estudos associados silenciosamente ao excluir uma conta de pesquisador.
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException('Não é possível excluir esta conta enquanto houver estudos vinculados.');
      }
      throw error;
    }
  }

  private handleWriteError(error: unknown): never {
    if ((error as { code?: string }).code === '23505') {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }
    throw error;
  }

  private toPublic(account: InternalUser): PublicUser {
    const { passwordHash: _hash, passwordSalt: _salt, ...user } = account;
    return { ...user, createdAt: new Date(user.createdAt).toISOString() };
  }
}
