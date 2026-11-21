import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

describe('Migration 017 — ordem das atividades preexistentes', () => {
  let client: pg.Client | undefined;
  let schema: string | undefined;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'O teste da migration 017 exige DATABASE_URL de um banco PostgreSQL de testes.',
      );
    }

    schema = `test_activity_order_${randomUUID().replaceAll('-', '')}`;
    client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE visitas_previstas (
        id_visita_prevista UUID PRIMARY KEY
      );
      CREATE TABLE atividades_visita (
        id_atividade UUID PRIMARY KEY,
        id_visita_prevista UUID NOT NULL
          REFERENCES visitas_previstas(id_visita_prevista),
        nome VARCHAR(150) NOT NULL,
        descricao TEXT,
        tipo VARCHAR(50) NOT NULL
      )
    `);

    await client.query(
      `INSERT INTO visitas_previstas (id_visita_prevista)
       VALUES
         ('00000000-0000-4000-8000-000000000001'),
         ('00000000-0000-4000-8000-000000000002')`,
    );
    await client.query(
      `INSERT INTO atividades_visita
         (id_atividade, id_visita_prevista, nome, tipo)
       VALUES
         ('00000000-0000-4000-8000-000000000011',
          '00000000-0000-4000-8000-000000000001', 'Zeta', 'Exame'),
         ('00000000-0000-4000-8000-000000000012',
          '00000000-0000-4000-8000-000000000001', 'Alfa', 'Exame'),
         ('00000000-0000-4000-8000-000000000010',
          '00000000-0000-4000-8000-000000000001', 'Alfa', 'Entrevista'),
         ('00000000-0000-4000-8000-000000000021',
          '00000000-0000-4000-8000-000000000002', 'Beta', 'Exame'),
         ('00000000-0000-4000-8000-000000000022',
          '00000000-0000-4000-8000-000000000002', 'Alfa', 'Exame')`,
    );

    const migration = await readFile(
      new URL('../migrations/017_activity_order.sql', import.meta.url),
      'utf8',
    );
    await client.query(migration);
  });

  afterAll(async () => {
    try {
      if (client && schema) {
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      }
    } finally {
      await client?.end();
    }
  });

  it('preenche registros anteriores, reinicia a ordem por visita e desempata por id', async () => {
    const { rows } = await client!.query<{
      activityId: string;
      plannedVisitId: string;
      name: string;
      order: number;
    }>(
      `SELECT id_atividade::text AS "activityId",
              id_visita_prevista::text AS "plannedVisitId",
              nome AS name,
              ordem AS "order"
       FROM atividades_visita
       ORDER BY id_visita_prevista, ordem`,
    );

    expect(rows).toEqual([
      {
        activityId: '00000000-0000-4000-8000-000000000010',
        plannedVisitId: '00000000-0000-4000-8000-000000000001',
        name: 'Alfa',
        order: 1,
      },
      {
        activityId: '00000000-0000-4000-8000-000000000012',
        plannedVisitId: '00000000-0000-4000-8000-000000000001',
        name: 'Alfa',
        order: 2,
      },
      {
        activityId: '00000000-0000-4000-8000-000000000011',
        plannedVisitId: '00000000-0000-4000-8000-000000000001',
        name: 'Zeta',
        order: 3,
      },
      {
        activityId: '00000000-0000-4000-8000-000000000022',
        plannedVisitId: '00000000-0000-4000-8000-000000000002',
        name: 'Alfa',
        order: 1,
      },
      {
        activityId: '00000000-0000-4000-8000-000000000021',
        plannedVisitId: '00000000-0000-4000-8000-000000000002',
        name: 'Beta',
        order: 2,
      },
    ]);
  });

  it('preenche todas as ordens com valores positivos e únicos em cada visita', async () => {
    const { rows } = await client!.query<{
      total: number;
      populated: number;
      positive: number;
      uniqueOrders: number;
    }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(ordem)::int AS populated,
              COUNT(*) FILTER (WHERE ordem > 0)::int AS positive,
              COUNT(DISTINCT (id_visita_prevista, ordem))::int AS "uniqueOrders"
       FROM atividades_visita`,
    );

    expect(rows[0]).toEqual({
      total: 5,
      populated: 5,
      positive: 5,
      uniqueOrders: 5,
    });
  });

  it('estabelece unicidade composta por visita prevista e ordem', async () => {
    const constraint = await client!.query<{ name: string; definition: string }>(
      `SELECT conname AS name, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = 'atividades_visita'::regclass
         AND conname = 'atividades_visita_ordem_unica'`,
    );
    expect(constraint.rows).toHaveLength(1);
    expect(constraint.rows[0]?.definition).toContain(
      'UNIQUE (id_visita_prevista, ordem)',
    );

    await expect(
      client!.query(
        `INSERT INTO atividades_visita
           (id_atividade, id_visita_prevista, ordem, nome, tipo)
         VALUES
           ('00000000-0000-4000-8000-000000000013',
            '00000000-0000-4000-8000-000000000001', 1, 'Duplicada', 'Exame')`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
