import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import type { QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool?: pg.Pool;

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
    this.pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    this.pool.on('error', (error: Error) => this.logger.error(error.message));
    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Conexão com PostgreSQL estabelecida.');
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw error;
    }
  }

  query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
    if (!this.pool) throw new Error('Conexão com PostgreSQL não configurada.');
    return this.pool.query<T>(sql, values);
  }

  async transaction<T>(operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('Conexão com PostgreSQL não configurada.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error(
          'Falha ao reverter a transação do PostgreSQL.',
          rollbackError instanceof Error ? rollbackError.stack : String(rollbackError),
        );
        throw new AggregateError(
          [error, rollbackError],
          'A operação e a reversão da transação falharam.',
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
