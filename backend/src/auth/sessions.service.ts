import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AccessTokenPayload } from './auth.types.js';

@Injectable()
export class SessionsService {
  constructor(private readonly database: DatabaseService) {}

  async create(payload: AccessTokenPayload): Promise<void> {
    await this.database.query('DELETE FROM sessoes WHERE expira_em <= now()');
    const result = await this.database.query(
      `INSERT INTO sessoes (id_sessao, id_usuario, expira_em)
       SELECT $1, id_usuario, to_timestamp($3) FROM usuarios
       WHERE id_usuario = $2 AND status = 'Ativo'`,
      [payload.jti, payload.sub, payload.exp],
    );
    if (!result.rowCount) throw new UnauthorizedException('Conta indisponível para iniciar sessão.');
  }

  async isActive(payload: AccessTokenPayload): Promise<boolean> {
    const result = await this.database.query(
      'SELECT 1 FROM sessoes WHERE id_sessao = $1 AND id_usuario = $2 AND expira_em > now()',
      [payload.jti, payload.sub],
    );
    return Boolean(result.rowCount);
  }

  async revoke(id: string): Promise<void> {
    await this.database.query('DELETE FROM sessoes WHERE id_sessao = $1', [id]);
  }
}
