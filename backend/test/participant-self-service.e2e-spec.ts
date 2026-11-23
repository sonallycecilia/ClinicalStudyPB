import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { ParticipantSelfServiceClock } from '../src/studies/participant-self-service.service.js';
import { UsersService } from '../src/users/users.service.js';
import type { UserRole } from '../src/users/user.types.js';
import type { PublicUser } from '../src/users/user.types.js';

const fixedNow = new Date('2030-01-15T12:00:00.000Z');
const studyInput = {
  title: 'Estudo de autoatendimento',
  objective: 'Validar consultas fictícias do participante.',
  startDate: '2020-01-01',
  endDate: '2099-12-31',
  participantLimit: 30,
  participantsLinked: 0,
};

describe('Consultas autenticadas do participante (E2E)', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let researcher: PublicUser;
  let researcherToken: string;
  let accountSequence = 0;
  const api = () => fixture.app.getHttpServer();
  const bearer = (token: string) => 'Bearer ' + token;

  async function login(email: string): Promise<string> {
    const response = await request(api())
      .post('/auth/login')
      .send({ email, password: 'Senha123!' })
      .expect(201);
    return response.body.accessToken as string;
  }

  async function createAccount(role: UserRole) {
    accountSequence += 1;
    const user = await fixture.app.get(UsersService).create({
      name: `Conta Teste ${accountSequence}`,
      email: `self-service-${accountSequence}@example.test`,
      phone: '83999990000',
      password: 'Senha123!',
      role,
    });
    return { user, token: await login(user.email) };
  }

  async function createStudy(title: string): Promise<{ id: string }> {
    const response = await request(api())
      .post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...studyInput, title })
      .expect(201);
    return response.body as { id: string };
  }

  async function createLinkedParticipation(
    studyId: string,
    userId: string,
    name: string,
    status: 'Ativo' | 'Retirado' | 'Concluído' = 'Ativo',
    includedAt = '2020-01-01',
  ) {
    const database = fixture.app.get(DatabaseService);
    const candidate = await database.query<{ id: string }>(
      `INSERT INTO candidatos
         (id_estudo, id_usuario, nome, email, status_recrutamento)
       VALUES ($1, $2, $3, $4, 'Incluído')
       RETURNING id_candidato::text AS id`,
      [
        studyId,
        userId,
        name,
        `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
      ],
    );
    const candidateId = candidate.rows[0]!.id;
    const participation = await database.query<{ id: string }>(
      `INSERT INTO participacoes_estudo
         (id_candidato, data_inclusao, status, data_retirada)
       VALUES (
         $1, $2, $3,
         CASE WHEN $3::varchar = 'Retirado' THEN '2023-01-01'::date ELSE NULL END
       )
       RETURNING id_participacao::text AS id`,
      [candidateId, includedAt, status],
    );
    return {
      candidateId,
      participationId: participation.rows[0]!.id,
    };
  }

  async function createPlannedVisit(studyId: string, order: number) {
    const response = await request(api())
      .post(`/studies/${studyId}/visits`)
      .set('Authorization', bearer(researcherToken))
      .send({
        name: `Visita ${order}`,
        order,
        intervalDays: 0,
        description: 'Visita fictícia de teste.',
      })
      .expect(201);
    return response.body as { id: string };
  }

  async function insertScheduledVisit(
    participationId: string,
    plannedVisitId: string,
    scheduledAt: string,
    status: 'Agendada' | 'Realizada' | 'Ausente' | 'Cancelada',
    observation = 'Anotação interna não retornada ao participante.',
  ): Promise<{ id: string }> {
    const database = fixture.app.get(DatabaseService);
    const result = await database.query<{ id: string }>(
      `INSERT INTO visitas
         (id_participacao, id_visita_prevista, data_agendada,
          data_realizacao, status, observacao)
       VALUES (
         $1, $2, $3::timestamptz,
         CASE WHEN $4 = 'Realizada' THEN $3::timestamptz ELSE NULL END,
         $4, $5
       )
       RETURNING id_visita::text AS id`,
      [participationId, plannedVisitId, scheduledAt, status, observation],
    );
    return result.rows[0]!;
  }

  beforeAll(async () => {
    fixture = await databaseTestApp();
    researcher = await fixture.app.get(UsersService).create({
      name: 'Pesquisador de Teste',
      email: 'self-service-researcher@example.test',
      phone: '83999990000',
      password: 'Senha123!',
      role: 'Pesquisador',
    });
    researcherToken = await login(researcher.email);
  });

  afterAll(async () => {
    await fixture?.app.close();
    await fixture?.cleanup();
  });

  it('E09 lista as participações próprias nos três estados, ordena e retorna vazio sem vínculo', async () => {
    const participant = await createAccount('Participante');
    const otherParticipant = await createAccount('Participante');
    const olderStudy = await createStudy('E09 estudo antigo');
    const newestStudy = await createStudy('E09 estudo recente');
    const middleStudy = await createStudy('E09 estudo intermediário');
    const foreignStudy = await createStudy('E09 estudo de outra conta');
    await createLinkedParticipation(
      olderStudy.id,
      participant.user.id,
      'Candidato E09 antigo',
      'Ativo',
      '2020-01-01',
    );
    await createLinkedParticipation(
      newestStudy.id,
      participant.user.id,
      'Candidato E09 retirado',
      'Retirado',
      '2022-01-01',
    );
    await createLinkedParticipation(
      middleStudy.id,
      participant.user.id,
      'Candidato E09 concluído',
      'Concluído',
      '2021-01-01',
    );
    await createLinkedParticipation(
      foreignStudy.id,
      otherParticipant.user.id,
      'Candidato E09 estrangeiro',
    );
    const unlinkedStudy = await createStudy('E09 candidato sem conta vinculada');
    const database = fixture.app.get(DatabaseService);
    const unlinkedCandidate = await database.query<{ id: string }>(
      `INSERT INTO candidatos (id_estudo, nome, email, status_recrutamento)
       VALUES ($1, 'Candidato sem vínculo', 'sem-vinculo@example.test', 'Incluído')
       RETURNING id_candidato::text AS id`,
      [unlinkedStudy.id],
    );
    await database.query(
      `INSERT INTO participacoes_estudo
         (id_candidato, data_inclusao, status)
       VALUES ($1, '2020-01-01', 'Ativo')`,
      [unlinkedCandidate.rows[0]!.id],
    );

    await request(api())
      .get('/me/studies')
      .set('Authorization', bearer(participant.token))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(3);
        expect(body.map((item: { study: { id: string } }) => item.study.id))
          .toEqual([newestStudy.id, middleStudy.id, olderStudy.id]);
        expect(body.map((item: { participationStatus: string }) => item.participationStatus))
          .toEqual(['Retirado', 'Concluído', 'Ativo']);
        expect(body[0]).toMatchObject({
          includedAt: '2022-01-01',
          withdrawnAt: '2023-01-01',
          study: {
            id: newestStudy.id,
            title: 'E09 estudo recente',
            researcher: 'Pesquisador de Teste',
          },
        });
        for (const item of body) {
          expect(item).not.toHaveProperty('candidateId');
          expect(item).not.toHaveProperty('email');
          expect(item).not.toHaveProperty('researcherId');
          expect(item.study).not.toHaveProperty('participantLimit');
          expect(item.study).not.toHaveProperty('participantsLinked');
        }
      });

    await request(api())
      .get('/me/studies')
      .set('Authorization', bearer(otherParticipant.token))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].study.id).toBe(foreignStudy.id);
      });

    const unlinked = await createAccount('Participante');
    await request(api())
      .get('/me/studies')
      .set('Authorization', bearer(unlinked.token))
      .expect(200)
      .expect(({ body }) => expect(body).toEqual([]));

    await request(api())
      .get('/me/studies?userId=00000000-0000-4000-8000-000000000001')
      .set('Authorization', bearer(participant.token))
      .expect(400);
  });

  it('E10 aplica os escopos temporais, estados, ordenação, isolamento e integridade dos vínculos', async () => {
    const participant = await createAccount('Participante');
    const otherParticipant = await createAccount('Participante');
    const activeStudy = await createStudy('E10 estudo ativo');
    const withdrawnStudy = await createStudy('E10 estudo retirado');
    const emptyStudy = await createStudy('E10 estudo sem visitas');
    const foreignStudy = await createStudy('E10 estudo alheio');
    const active = await createLinkedParticipation(
      activeStudy.id,
      participant.user.id,
      'Participante E10 ativo',
    );
    const otherInSameStudy = await createLinkedParticipation(
      activeStudy.id,
      otherParticipant.user.id,
      'Participante E10 de outra conta',
    );
    const withdrawn = await createLinkedParticipation(
      withdrawnStudy.id,
      participant.user.id,
      'Participante E10 retirado',
      'Retirado',
    );
    await createLinkedParticipation(
      emptyStudy.id,
      participant.user.id,
      'Participante E10 sem visitas',
    );
    const foreign = await createLinkedParticipation(
      foreignStudy.id,
      otherParticipant.user.id,
      'Participante E10 estudo alheio',
    );

    const activePlans = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        createPlannedVisit(activeStudy.id, index + 1),
      ),
    );
    const withdrawnPlans = await Promise.all([
      createPlannedVisit(withdrawnStudy.id, 1),
      createPlannedVisit(withdrawnStudy.id, 2),
    ]);
    const foreignPlan = await createPlannedVisit(foreignStudy.id, 1);
    const activeFuture = await insertScheduledVisit(
      active.participationId,
      activePlans[0]!.id,
      '2030-01-15T12:00:01.000Z',
      'Agendada',
    );
    await insertScheduledVisit(
      active.participationId,
      activePlans[1]!.id,
      '2030-01-15T11:59:59.000Z',
      'Agendada',
    );
    await insertScheduledVisit(
      active.participationId,
      activePlans[2]!.id,
      '2030-01-15T12:00:00.000Z',
      'Agendada',
    );
    const realized = await insertScheduledVisit(
      active.participationId,
      activePlans[3]!.id,
      '2030-01-15T11:00:00.000Z',
      'Realizada',
    );
    await insertScheduledVisit(
      active.participationId,
      activePlans[4]!.id,
      '2030-01-15T10:00:00.000Z',
      'Ausente',
    );
    await insertScheduledVisit(
      active.participationId,
      activePlans[5]!.id,
      '2030-01-15T09:00:00.000Z',
      'Cancelada',
    );
    const foreignMismatch = await insertScheduledVisit(
      active.participationId,
      foreignPlan.id,
      '2030-01-15T13:00:00.000Z',
      'Agendada',
    );
    await insertScheduledVisit(
      otherInSameStudy.participationId,
      activePlans[6]!.id,
      '2030-01-15T12:30:00.000Z',
      'Agendada',
    );
    const withdrawnFuture = await insertScheduledVisit(
      withdrawn.participationId,
      withdrawnPlans[0]!.id,
      '2030-01-15T14:00:00.000Z',
      'Agendada',
    );
    await insertScheduledVisit(
      withdrawn.participationId,
      withdrawnPlans[1]!.id,
      '2030-01-15T11:00:00.000Z',
      'Agendada',
    );
    await insertScheduledVisit(
      foreign.participationId,
      foreignPlan.id,
      '2030-01-15T15:00:00.000Z',
      'Agendada',
    );

    const activity = await request(api())
      .post(`/studies/${activeStudy.id}/visits/${activePlans[3]!.id}/activities`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Avaliação fictícia', type: 'Exame' })
      .expect(201);
    await fixture.app.get(DatabaseService).query(
      `INSERT INTO resultados_avaliacao
         (id_visita, id_atividade, id_registrado_por, valor_ficticio)
       VALUES ($1, $2, $3, 'resultado fictício')`,
      [realized.id, activity.body.id, researcher.id],
    );

    const clock = fixture.app.get(ParticipantSelfServiceClock);
    const originalNow = clock.now.bind(clock);
    clock.now = () => fixedNow;
    try {
      await request(api())
        .get(`/me/visits?scope=upcoming&studyId=${activeStudy.id}`)
        .set('Authorization', bearer(participant.token))
        .expect(200)
        .expect(({ body }) => {
          expect(body.map((visit: { id: string }) => visit.id)).toEqual([
            activeFuture.id,
          ]);
          expect(body.map((visit: { id: string }) => visit.id)).not.toContain(
            foreignMismatch.id,
          );
          expect(body[0]).toMatchObject({
            studyId: activeStudy.id,
            status: 'Agendada',
            scheduledAt: '2030-01-15T12:00:01.000Z',
            realizedAt: null,
          });
        });

      await request(api())
        .get('/me/visits?scope=upcoming')
        .set('Authorization', bearer(participant.token))
        .expect(200)
        .expect(({ body }) => {
          expect(body.map((visit: { id: string }) => visit.id)).toEqual([
            activeFuture.id,
            withdrawnFuture.id,
          ]);
          expect(body.map((visit: { participationId: string }) => visit.participationId))
            .toEqual([active.participationId, withdrawn.participationId]);
          expect(body.map((visit: { id: string }) => visit.id)).not.toContain(
            foreignMismatch.id,
          );
        });

      await request(api())
        .get(`/me/visits?scope=history&studyId=${activeStudy.id}`)
        .set('Authorization', bearer(participant.token))
        .expect(200)
        .expect(({ body }) => {
          expect(body.map((visit: { status: string }) => visit.status)).toEqual([
            'Realizada',
            'Ausente',
            'Cancelada',
          ]);
          expect(body.map((visit: { scheduledAt: string }) => visit.scheduledAt))
            .toEqual([
              '2030-01-15T11:00:00.000Z',
              '2030-01-15T10:00:00.000Z',
              '2030-01-15T09:00:00.000Z',
            ]);
          expect(body[0]).not.toHaveProperty('observation');
          expect(body[0]).not.toHaveProperty('results');
          expect(body[0]).not.toHaveProperty('email');
        });

      await request(api())
        .get(`/me/visits?scope=upcoming&studyId=${emptyStudy.id}`)
        .set('Authorization', bearer(participant.token))
        .expect(200)
        .expect(({ body }) => expect(body).toEqual([]));

      await request(api())
        .get(`/me/visits?scope=upcoming&studyId=${foreignStudy.id}`)
        .set('Authorization', bearer(participant.token))
        .expect(404)
        .expect(({ body }) =>
          expect(body.message).toBe(
            'Estudo não encontrado entre as suas participações.',
          ),
        );
    } finally {
      clock.now = originalNow;
    }
  });

  it('E09 e E10 exigem autenticação e perfil Participante e validam as queries', async () => {
    const participant = await createAccount('Participante');
    const study = await createStudy('E10 validação de query');
    const researcherAccount = await createAccount('Pesquisador');
    const adminAccount = await createAccount('Administrador');
    const coordinatorAccount = await createAccount('Coordenador');

    await request(api()).get('/me/studies').expect(401);
    await request(api())
      .get('/me/studies')
      .set('Authorization', bearer('token-inválido'))
      .expect(401);
    for (const token of [
      researcherAccount.token,
      adminAccount.token,
      coordinatorAccount.token,
    ]) {
      await request(api())
        .get('/me/studies')
        .set('Authorization', bearer(token))
        .expect(403);
      await request(api())
        .get('/me/visits?scope=history')
        .set('Authorization', bearer(token))
        .expect(403);
    }

    await request(api())
      .get('/me/visits')
      .set('Authorization', bearer(participant.token))
      .expect(400);
    await request(api())
      .get('/me/visits?scope=recent')
      .set('Authorization', bearer(participant.token))
      .expect(400);
    for (const key of ['userId', 'candidateId', 'participationId']) {
      await request(api())
        .get(`/me/studies?${key}=00000000-0000-4000-8000-000000000001`)
        .set('Authorization', bearer(participant.token))
        .expect(400);
    }
    await request(api())
      .get('/me/visits?scope=history&studyId=nao-e-uuid')
      .set('Authorization', bearer(participant.token))
      .expect(400);
    for (const key of ['userId', 'candidateId', 'participationId']) {
      await request(api())
          .get(`/me/visits?scope=history&${key}=00000000-0000-4000-8000-000000000001`)
        .set('Authorization', bearer(participant.token))
        .expect(400);
    }

    const database = fixture.app.get(DatabaseService);
    await database.query(
      `UPDATE usuarios SET status = 'Inativo' WHERE id_usuario = $1`,
      [participant.user.id],
    );
    try {
      await request(api())
        .get('/me/studies')
        .set('Authorization', bearer(participant.token))
        .expect(401);
      await request(api())
        .get(`/me/visits?scope=history&studyId=${study.id}`)
        .set('Authorization', bearer(participant.token))
        .expect(401);
    } finally {
      await database.query(
        `UPDATE usuarios SET status = 'Ativo' WHERE id_usuario = $1`,
        [participant.user.id],
      );
    }
  });
});
