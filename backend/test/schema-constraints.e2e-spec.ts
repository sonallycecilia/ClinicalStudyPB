import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service.js';
import { UsersService } from '../src/users/users.service.js';
import { databaseTestApp } from './database-test-app.js';

const missingId = '00000000-0000-4000-8000-000000000099';

describe('PostgreSQL constraints for RF12–RF18 schema', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let database: DatabaseService;
  let investigatorId: string;
  let linkedUserId: string;
  let studyId: string;
  let plannedVisitId: string;
  let activityId: string;
  let candidateId: string;
  let participationId: string;
  let scheduledVisitId: string;

  async function createStudy(): Promise<string> {
    const result = await database.query<{ id: string }>(
      `INSERT INTO estudos
         (codigo, titulo, objetivo, id_pesquisador, data_inicio, data_fim,
          limite_participantes)
       VALUES ($1, $2, $3, $4, '2020-01-01', '2099-12-31', 10)
       RETURNING id_estudo::text AS id`,
      [
        `T-${randomUUID().slice(0, 12)}`,
        `Estudo ${randomUUID()}`,
        'Objetivo de teste de constraints.',
        investigatorId,
      ],
    );
    return result.rows[0]!.id;
  }

  async function createCandidate(
    idStudy = studyId,
    userId: string | null = null,
  ): Promise<string> {
    const result = await database.query<{ id: string }>(
      `INSERT INTO candidatos (id_estudo, id_usuario, nome)
       VALUES ($1, $2, $3)
       RETURNING id_candidato::text AS id`,
      [idStudy, userId, `Candidato ${randomUUID()}`],
    );
    return result.rows[0]!.id;
  }

  async function createPlannedVisit(
    idStudy = studyId,
    order = 1,
  ): Promise<string> {
    const result = await database.query<{ id: string }>(
      `INSERT INTO visitas_previstas (id_estudo, nome, ordem)
       VALUES ($1, $2, $3)
       RETURNING id_visita_prevista::text AS id`,
      [idStudy, `Visita ${randomUUID()}`, order],
    );
    return result.rows[0]!.id;
  }

  async function createParticipation(idCandidate = candidateId): Promise<string> {
    const result = await database.query<{ id: string }>(
      `INSERT INTO participacoes_estudo (id_candidato)
       VALUES ($1)
       RETURNING id_participacao::text AS id`,
      [idCandidate],
    );
    return result.rows[0]!.id;
  }

  beforeAll(async () => {
    fixture = await databaseTestApp();
    database = fixture.app.get(DatabaseService);
    const users = fixture.app.get(UsersService);
    const investigator = await users.create({
      name: 'Pesquisador de Constraints',
      email: `constraints-researcher-${randomUUID()}@example.test`,
      phone: '83999990000',
      password: 'Senha123!',
      role: 'Pesquisador',
    });
    const linkedUser = await users.create({
      name: 'Participante de Constraints',
      email: `constraints-participant-${randomUUID()}@example.test`,
      phone: '83999990001',
      password: 'Senha123!',
      role: 'Participante',
    });
    investigatorId = investigator.id;
    linkedUserId = linkedUser.id;
    studyId = await createStudy();
    plannedVisitId = await createPlannedVisit();
    const activity = await database.query<{ id: string }>(
      `INSERT INTO atividades_visita
         (id_visita_prevista, nome, tipo, ordem)
       VALUES ($1, 'Atividade base', 'Exame', 1)
       RETURNING id_atividade::text AS id`,
      [plannedVisitId],
    );
    activityId = activity.rows[0]!.id;
    candidateId = await createCandidate(studyId, linkedUserId);
    participationId = await createParticipation(candidateId);
    const scheduledVisit = await database.query<{ id: string }>(
      `INSERT INTO visitas (id_participacao, id_visita_prevista, data_agendada)
       VALUES ($1, $2, '2026-11-20T12:00:00Z')
       RETURNING id_visita::text AS id`,
      [participationId, plannedVisitId],
    );
    scheduledVisitId = scheduledVisit.rows[0]!.id;
  });

  afterAll(async () => {
    await fixture?.app.close();
    await fixture?.cleanup();
  });

  describe('participacoes_estudo — migration 011', () => {
    it('rejeita status fora do conjunto permitido', async () => {
      await expect(
        database.query(
          `INSERT INTO participacoes_estudo (id_candidato, status)
           VALUES ($1, 'Pendente')`,
          [await createCandidate()],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'participacoes_estudo_status_check',
      });
    });

    it.each([
      ['Retirado sem data', 'Retirado', null, 'participacoes_retirada_coerente'],
      [
        'Ativo com data de retirada',
        'Ativo',
        '2026-11-20',
        'participacoes_retirada_coerente',
      ],
      [
        'retirada anterior à inclusão',
        'Retirado',
        '2019-12-31',
        'participacoes_datas_validas',
      ],
    ])('rejeita %s pela constraint %s', async (_label, status, withdrawalDate, constraint) => {
      await expect(
        database.query(
          `INSERT INTO participacoes_estudo
             (id_candidato, data_inclusao, status, data_retirada)
           VALUES ($1, '2020-01-01', $2, $3)`,
          [await createCandidate(), status, withdrawalDate],
        ),
      ).rejects.toMatchObject({ code: '23514', constraint });
    });

    it('rejeita candidato inexistente e segunda participação do mesmo candidato', async () => {
      await expect(
        database.query(
          `INSERT INTO participacoes_estudo (id_candidato) VALUES ($1)`,
          [missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'participacoes_estudo_id_candidato_fkey',
      });

      await expect(
        database.query(
          `INSERT INTO participacoes_estudo (id_candidato) VALUES ($1)`,
          [candidateId],
        ),
      ).rejects.toMatchObject({
        code: '23505',
        constraint: 'participacoes_estudo_id_candidato_key',
      });
    });
  });

  describe('visitas — migration 012', () => {
    it('rejeita situação inválida e visita Realizada sem data de realização', async () => {
      await expect(
        database.query(
          `INSERT INTO visitas (id_participacao, id_visita_prevista, data_agendada, status)
           VALUES ($1, $2, '2026-11-20T12:00:00Z', 'Pendente')`,
          [participationId, plannedVisitId],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'visitas_status_check',
      });

      await expect(
        database.query(
          `INSERT INTO visitas
             (id_participacao, id_visita_prevista, data_agendada, status)
           VALUES ($1, $2, '2026-11-20T12:00:00Z', 'Realizada')`,
          [participationId, plannedVisitId],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'visitas_realizacao_coerente',
      });
    });

    it('rejeita referências inexistentes de participação e visita prevista', async () => {
      await expect(
        database.query(
          `INSERT INTO visitas (id_participacao, id_visita_prevista, data_agendada)
           VALUES ($1, $2, '2026-11-20T12:00:00Z')`,
          [missingId, plannedVisitId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'visitas_id_participacao_fkey',
      });

      await expect(
        database.query(
          `INSERT INTO visitas (id_participacao, id_visita_prevista, data_agendada)
           VALUES ($1, $2, '2026-11-20T12:00:00Z')`,
          [participationId, missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'visitas_id_visita_prevista_fkey',
      });
    });
  });

  describe('visitas_previstas — migration 006', () => {
    it.each([
      ['ordem zero', 0, 0, 'visitas_previstas_ordem_check'],
      ['intervalo negativo', 2, -1, 'visitas_previstas_intervalo_dias_check'],
    ])('rejeita %s pela constraint %s', async (_label, order, interval, constraint) => {
      await expect(
        database.query(
          `INSERT INTO visitas_previstas (id_estudo, nome, ordem, intervalo_dias)
           VALUES ($1, 'Visita inválida', $2, $3)`,
          [studyId, order, interval],
        ),
      ).rejects.toMatchObject({ code: '23514', constraint });
    });

    it('rejeita ordem repetida no estudo e estudo inexistente', async () => {
      await expect(
        database.query(
          `INSERT INTO visitas_previstas (id_estudo, nome, ordem)
           VALUES ($1, 'Visita duplicada', 1)`,
          [studyId],
        ),
      ).rejects.toMatchObject({
        code: '23505',
        constraint: 'visitas_previstas_ordem_unica',
      });

      await expect(
        database.query(
          `INSERT INTO visitas_previstas (id_estudo, nome, ordem)
           VALUES ($1, 'Visita sem estudo', 1)`,
          [missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'visitas_previstas_id_estudo_fkey',
      });
    });
  });

  describe('atividades_visita — migrations 007 e 017', () => {
    it('rejeita ordem nula, ordem não positiva, ordem composta duplicada e visita prevista inexistente', async () => {
      await expect(
        database.query(
          `INSERT INTO atividades_visita (id_visita_prevista, nome, tipo)
           VALUES ($1, 'Sem ordem', 'Exame')`,
          [plannedVisitId],
        ),
      ).rejects.toMatchObject({ code: '23502', column: 'ordem' });

      await expect(
        database.query(
          `INSERT INTO atividades_visita
             (id_visita_prevista, nome, tipo, ordem)
           VALUES ($1, 'Ordem zero', 'Exame', 0)`,
          [plannedVisitId],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'atividades_visita_ordem_positiva',
      });

      await expect(
        database.query(
          `INSERT INTO atividades_visita
             (id_visita_prevista, nome, tipo, ordem)
           VALUES ($1, 'Ordem duplicada', 'Exame', 1)`,
          [plannedVisitId],
        ),
      ).rejects.toMatchObject({
        code: '23505',
        constraint: 'atividades_visita_ordem_unica',
      });

      await expect(
        database.query(
          `INSERT INTO atividades_visita
             (id_visita_prevista, nome, tipo, ordem)
           VALUES ($1, 'Visita inexistente', 'Exame', 1)`,
          [missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'atividades_visita_id_visita_prevista_fkey',
      });
    });
  });

  describe('candidatos — migration 008', () => {
    it('rejeita estudo ou usuário inexistente e duplicidade de usuário por estudo', async () => {
      await expect(
        database.query(
          `INSERT INTO candidatos (id_estudo, nome)
           VALUES ($1, 'Estudo inexistente')`,
          [missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'candidatos_id_estudo_fkey',
      });

      await expect(
        database.query(
          `INSERT INTO candidatos (id_estudo, id_usuario, nome)
           VALUES ($1, $2, 'Usuário inexistente')`,
          [studyId, missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'candidatos_id_usuario_fkey',
      });

      await expect(
        database.query(
          `INSERT INTO candidatos (id_estudo, id_usuario, nome)
           VALUES ($1, $2, 'Mesmo usuário e estudo')`,
          [studyId, linkedUserId],
        ),
      ).rejects.toMatchObject({
        code: '23505',
        constraint: 'candidatos_estudo_usuario_unico',
      });
    });

    it('permite remover a conta sem remover o candidato e aplica ON DELETE SET NULL', async () => {
      const disposableUser = await fixture.app.get(UsersService).create({
        name: 'Conta descartável de teste',
        email: `constraints-delete-${randomUUID()}@example.test`,
        phone: '83999990002',
        password: 'Senha123!',
        role: 'Participante',
      });
      const disposableCandidate = await createCandidate(
        studyId,
        disposableUser.id,
      );

      await database.query(`DELETE FROM usuarios WHERE id_usuario = $1`, [
        disposableUser.id,
      ]);
      const result = await database.query<{ userId: string | null }>(
        `SELECT id_usuario::text AS "userId"
         FROM candidatos
         WHERE id_candidato = $1`,
        [disposableCandidate],
      );
      expect(result.rows[0]).toEqual({ userId: null });
    });
  });

  describe('resultados_avaliacao — migration 013', () => {
    it('rejeita referências inexistentes de visita, atividade e usuário registrador', async () => {
      await expect(
        database.query(
          `INSERT INTO resultados_avaliacao
             (id_visita, id_atividade, id_registrado_por, valor_ficticio)
           VALUES ($1, $2, $3, 'fictício')`,
          [missingId, activityId, investigatorId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'resultados_avaliacao_id_visita_fkey',
      });

      await expect(
        database.query(
          `INSERT INTO resultados_avaliacao
             (id_visita, id_atividade, id_registrado_por, valor_ficticio)
           VALUES ($1, $2, $3, 'fictício')`,
          [scheduledVisitId, missingId, investigatorId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'resultados_avaliacao_id_atividade_fkey',
      });

      await expect(
        database.query(
          `INSERT INTO resultados_avaliacao
             (id_visita, id_atividade, id_registrado_por, valor_ficticio)
           VALUES ($1, $2, $3, 'fictício')`,
          [scheduledVisitId, activityId, missingId],
        ),
      ).rejects.toMatchObject({
        code: '23503',
        constraint: 'resultados_avaliacao_id_registrado_por_fkey',
      });
    });
  });
});
