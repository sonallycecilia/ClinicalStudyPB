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
const demoStudies = [
  ['EST-001', 'Qualidade do sono', 'Investigar padrões de sono e acompanhar indicadores da qualidade do sono dos participantes.', '2026-04-01', '2026-11-28', 30, 18, 'Estudo observacional', 'moon'],
  ['EST-002', 'Acomp. da pressão arterial', 'Acompanhar indicadores de pressão arterial e observar alterações ao longo do período do estudo.', '2026-05-06', '2026-12-30', 25, 11, 'Estudo longitudinal', 'heart'],
  ['EST-003', 'Hábitos de atividade física', 'Avaliar hábitos de atividade física e acompanhar padrões de atividade ao longo do período.', '2027-01-11', '2027-06-30', 20, 0, 'Estudo observacional', 'activity'],
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

  // Os estudos fictícios só são criados pelo seed explicitamente habilitado em desenvolvimento.
  const researcher = await client.query(
    `SELECT id_usuario FROM usuarios WHERE email = $1 AND perfil = 'Pesquisador'`,
    ['marina.costa@clinicalstudypb.test'],
  );
  if (!researcher.rows[0]) throw new Error('Conta fictícia da pesquisadora não foi encontrada.');
  for (const [code, title, objective, startDate, endDate, limit, linked, kind, symbol] of demoStudies) {
    await client.query(
      `INSERT INTO estudos
        (codigo, titulo, objetivo, id_pesquisador, data_inicio, data_fim,
         limite_participantes, participantes_vinculados, tipo, simbolo)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10)
       ON CONFLICT (codigo) DO NOTHING`,
      [code, title, objective, researcher.rows[0].id_usuario, startDate, endDate, limit, linked, kind, symbol],
    );
  }
  const sequenceValue = await client.query(
    `SELECT COALESCE(MAX(substring(codigo FROM 5)::bigint), 0) AS max
     FROM estudos WHERE codigo ~ '^EST-[0-9]+$'`,
  );
  const maxCode = Number(sequenceValue.rows[0].max);
  if (maxCode > 0) await client.query("SELECT setval('estudos_codigo_seq', $1, true)", [maxCode]);
  else await client.query("SELECT setval('estudos_codigo_seq', 1, false)");

  await client.query('COMMIT');
  console.log('Contas e estudos fictícios disponíveis; registros existentes preservados.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
