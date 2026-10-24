import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import pg from 'pg';

if (existsSync('.env')) loadEnvFile('.env');
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Seed fictício exige ALLOW_DEMO_SEED=true e ambiente fora de produção.');
}
if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const accounts = [
  ['Ana Souza', 'ana.souza', 'Administrador', 'Admin123!'],
  ['Marina Costa', 'marina.costa', 'Pesquisador', 'Demo123!'],
  ['Rafael Lima', 'rafael.lima', 'Coordenador', 'Demo123!'],
  ['Bianca Oliveira', 'bianca.oliveira', 'Participante', 'Demo123!'],
];
try {
  await client.connect();
  await client.query('BEGIN');
  for (const [name, email, role, password] of accounts) {
    const salt = randomBytes(16).toString('hex');
    await client.query(
      `INSERT INTO usuarios (nome, email, telefone, perfil, senha_hash, senha_salt)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING`,
      [name, `${email}@clinicalstudypb.test`, '(83) 99999-0000', role,
        scryptSync(password, salt, 64).toString('hex'), salt],
    );
  }
  await client.query('COMMIT');
  console.log('Contas fictícias disponíveis; contas existentes preservadas.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
