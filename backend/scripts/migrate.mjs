import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import pg from 'pg';

if (existsSync('.env')) loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL antes de executar as migrations.');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  await client.query('BEGIN');
  // Serializa execuções concorrentes, inclusive na primeira inicialização.
  await client.query('SELECT pg_advisory_xact_lock(182036, 1)');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nome TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  for (const name of files) {
    const sql = (await readFile(new URL(name, directory), 'utf8')).replace(/\r\n/g, '\n');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE nome = $1', [name]);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error(`Migration já aplicada foi alterada: ${name}. Crie uma nova migration.`);
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (nome, checksum) VALUES ($1, $2)', [name, checksum]);
    console.log(`Aplicada: ${name}`);
  }
  await client.query('COMMIT');
  console.log('Banco atualizado.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
