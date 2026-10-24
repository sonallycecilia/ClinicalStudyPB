import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

// Cada suíte usa um schema descartável, sem alterar os dados de desenvolvimento.
export async function databaseTestApp() {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) throw new Error('Testes E2E exigem DATABASE_URL com PostgreSQL disponível.');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: originalUrl });
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    await client.query(await readFile(new URL(file, directory), 'utf8'));
  }
  const url = new URL(originalUrl);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  async function open() {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = module.createNestApplication();
    await app.init();
    return app;
  }
  return {
    app: await open(), open,
    async cleanup() {
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      await client.end();
      process.env.DATABASE_URL = originalUrl;
    },
  };
}
