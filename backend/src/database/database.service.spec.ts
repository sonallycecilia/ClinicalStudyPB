import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

type QueryResultMock = {
  rows: unknown[];
  rowCount: number;
};

describe('DatabaseService transações', () => {
  let service: DatabaseService;
  let clientQuery: jest.Mock<(...args: any[]) => Promise<QueryResultMock>>;
  let release: jest.Mock<() => void>;
  let pool: {
    connect: jest.Mock<() => Promise<{
      query: typeof clientQuery;
      release: typeof release;
    }>>;
    query: jest.Mock;
    end: jest.Mock<() => Promise<void>>;
  };

  beforeEach(() => {
    service = new DatabaseService();

    clientQuery = jest.fn<(...args: any[]) => Promise<QueryResultMock>>()
      .mockResolvedValue({ rows: [], rowCount: 0 });

    release = jest.fn<() => void>();

    pool = {
      connect: jest.fn<() => Promise<{
        query: typeof clientQuery;
        release: typeof release;
      }>>().mockResolvedValue({
        query: clientQuery,
        release,
      }),
      query: jest.fn(),
      end: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };

    Reflect.set(service, 'pool', pool);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('confirma uma operação e sempre libera a conexão', async () => {
    await expect(
      service.transaction(async (client) => {
        await client.query(
          'UPDATE candidatos SET status_recrutamento = $1',
          ['Incluído'],
        );
        return 'persistido';
      }),
    ).resolves.toBe('persistido');

    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'UPDATE candidatos SET status_recrutamento = $1',
      'COMMIT',
    ]);

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('reverte erros da operação, preserva a causa original e libera a conexão', async () => {
    const operationError = new Error('falha ao criar participação');

    await expect(
      service.transaction(async () => {
        throw operationError;
      }),
    ).rejects.toBe(operationError);

    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('expõe ambas as falhas quando a operação e o rollback falham', async () => {
    const operationError = new Error('falha de persistência');
    const rollbackError = new Error('conexão interrompida durante rollback');

    clientQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockRejectedValueOnce(rollbackError);

    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.transaction(async () => {
        throw operationError;
      }),
    ).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [operationError, rollbackError],
    });

    expect(logError).toHaveBeenCalledWith(
      'Falha ao reverter a transação do PostgreSQL.',
      rollbackError.stack,
    );

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rejeita operações quando o pool não foi inicializado e encerra o pool no teardown', async () => {
    const uninitialized = new DatabaseService();

    expect(() => uninitialized.query('SELECT 1')).toThrow(
      'Conexão com PostgreSQL não configurada.',
    );

    await expect(
      uninitialized.transaction(async () => undefined),
    ).rejects.toThrow('Conexão com PostgreSQL não configurada.');

    await service.onModuleDestroy();

    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
