import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { PublicUser } from '../src/users/user.types.js';

const studyInput = {
  title: 'Estudo de visitas agendadas',
  objective: 'Validar o acompanhamento das visitas com dados fictícios.',
  startDate: '2020-01-01',
  endDate: '2099-12-31',
  participantLimit: 30,
  participantsLinked: 0,
};

describe('Participantes e visitas agendadas (E2E)', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let researcher: PublicUser;
  let otherResearcher: PublicUser;
  let coordinator: PublicUser;
  let adminToken: string;
  let participantToken: string;
  let researcherToken: string;
  let otherResearcherToken: string;
  let coordinatorToken: string;
  const api = () => fixture.app.getHttpServer();
  const bearer = (token: string) => `Bearer ${token}`;

  async function login(email: string): Promise<string> {
    const response = await request(api())
      .post('/auth/login')
      .send({ email, password: 'Senha123!' })
      .expect(201);
    return response.body.accessToken as string;
  }

  async function createStudy(
    title = studyInput.title,
    endDate = studyInput.endDate,
  ) {
    const response = await request(api())
      .post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...studyInput, title, endDate })
      .expect(201);
    await request(api())
      .patch(`/studies/${response.body.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'recrutamento' })
      .expect(200);
    return response.body as { id: string };
  }

  async function createParticipant(
    studyId: string,
    name: string,
    status = 'Ativo',
  ) {
    const database = fixture.app.get(DatabaseService);
    const candidate = await database.query<{ id: string }>(
      `INSERT INTO candidatos (id_estudo, nome, email, status_recrutamento)
       VALUES ($1, $2, $3, 'Incluído')
       RETURNING id_candidato::text AS id`,
      [
        studyId,
        name,
        `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
      ],
    );
    const candidateId = candidate.rows[0]!.id;
    const participation = await database.query<{ id: string }>(
      `INSERT INTO participacoes_estudo
         (id_candidato, data_inclusao, status, data_retirada)
      VALUES ($1, '2020-01-01', $2::varchar,
              CASE WHEN $2::varchar = 'Retirado' THEN '2020-02-01'::date ELSE NULL END)
       RETURNING id_participacao::text AS id`,
      [candidateId, status],
    );
    return { candidateId, participationId: participation.rows[0]!.id };
  }

  async function createPlannedVisit(
    studyId: string,
    name = 'Consulta inicial',
    order = 1,
  ) {
    const response = await request(api())
      .post(`/studies/${studyId}/visits`)
      .set('Authorization', bearer(researcherToken))
      .send({
        name,
        order,
        intervalDays: 14,
        description: 'Visita de acompanhamento.',
      })
      .expect(201);
    return response.body as { id: string };
  }

  async function createActivity(studyId: string, plannedVisitId: string, name: string) {
    const response = await request(api())
      .post(`/studies/${studyId}/visits/${plannedVisitId}/activities`)
      .set('Authorization', bearer(researcherToken))
      .send({ name, type: 'Exame' })
      .expect(201);
    return response.body as { id: string; name: string };
  }

  function schedule(
    studyId: string,
    participationId: string,
    plannedVisitId: string,
    scheduledAt = '2025-03-15T10:00:00-03:00',
  ) {
    return request(api())
      .post(`/studies/${studyId}/scheduled-visits`)
      .set('Authorization', bearer(researcherToken))
      .send({ participationId, plannedVisitId, scheduledAt });
  }

  function scheduleAs(
    token: string,
    studyId: string,
    participationId: string,
    plannedVisitId: string,
    scheduledAt = '2025-03-15T10:00:00-03:00',
  ) {
    return request(api())
      .post(`/studies/${studyId}/scheduled-visits`)
      .set('Authorization', bearer(token))
      .send({ participationId, plannedVisitId, scheduledAt });
  }

  function updateScheduledVisitAs(
    token: string,
    studyId: string,
    scheduledVisitId: string,
    body: Record<string, unknown>,
  ) {
    return request(api())
      .patch(`/studies/${studyId}/scheduled-visits/${scheduledVisitId}/status`)
      .set('Authorization', bearer(token))
      .send(body);
  }

  function registerWithdrawalAs(
    token: string,
    studyId: string,
    participationId: string,
    body: Record<string, unknown>,
  ) {
    return request(api())
      .post(`/studies/${studyId}/participants/${participationId}/withdrawal`)
      .set('Authorization', bearer(token))
      .send(body);
  }

  async function brazilToday(): Promise<string> {
    const database = fixture.app.get(DatabaseService);
    const result = await database.query<{ today: string }>(
      `SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date::text
                AS today`,
    );
    return result.rows[0]!.today;
  }

  beforeAll(async () => {
    fixture = await databaseTestApp();
    const users = fixture.app.get(UsersService);
    const baseUser = {
      name: 'Pessoa Teste',
      phone: '83999990000',
      password: 'Senha123!',
    };
    researcher = await users.create({
      ...baseUser,
      email: 'rf12-pesquisador@example.test',
      role: 'Pesquisador',
    });
    otherResearcher = await users.create({
      ...baseUser,
      email: 'rf12-outro@example.test',
      role: 'Pesquisador',
    });
    coordinator = await users.create({
      ...baseUser,
      email: 'rf12-coordenador@example.test',
      role: 'Coordenador',
    });
    const admin = await users.create({
      ...baseUser,
      email: 'rf12-admin@example.test',
      role: 'Administrador',
    });
    const participant = await users.create({
      ...baseUser,
      email: 'rf12-participante@example.test',
      role: 'Participante',
    });
    researcherToken = await login(researcher.email);
    otherResearcherToken = await login(otherResearcher.email);
    coordinatorToken = await login(coordinator.email);
    adminToken = await login(admin.email);
    participantToken = await login(participant.email);
  });

  afterAll(async () => {
    await fixture?.app.close();
    await fixture?.cleanup();
  });

  it('lista participantes do estudo, aplica o filtro de situação e restringe o acesso à equipe autorizada', async () => {
    const study = await createStudy('E01 lista participantes');
    await createParticipant(study.id, 'Pessoa Ativa');
    await createParticipant(study.id, 'Pessoa Retirada', 'Retirado');
    const endpoint = `/studies/${study.id}/participants`;

    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
        expect(body[0]).toMatchObject({
          studyId: study.id,
          name: 'Pessoa Ativa',
          participationStatus: 'Ativo',
          includedAt: '2020-01-01',
          withdrawnAt: null,
          withdrawalReason: null,
        });
        expect(body[0]).not.toHaveProperty('email');
        expect(body[1]).toMatchObject({
          name: 'Pessoa Retirada',
          participationStatus: 'Retirado',
        });
      });

    await request(api())
      .get(`${endpoint}?status=Ativo`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(otherResearcherToken))
      .expect(403);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(adminToken))
      .expect(403);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(participantToken))
      .expect(403);
  });

  it('cria agendamentos, valida vínculos e limites, impede duplicidade e permite remarcar ausências/cancelamentos', async () => {
    const study = await createStudy('E02 agendamento e validações');
    const otherStudy = await createStudy('E02 estudo isolado');
    const active = await createParticipant(study.id, 'Participante Ativo');
    const inactive = await createParticipant(
      study.id,
      'Participante Retirado',
      'Retirado',
    );
    const foreign = await createParticipant(
      otherStudy.id,
      'Participante de outro estudo',
    );
    const coordinatorParticipant = await createParticipant(
      study.id,
      'Participante Coordenador',
    );
    const plannedVisit = await createPlannedVisit(study.id);
    const foreignVisit = await createPlannedVisit(
      otherStudy.id,
      'Visita de outro estudo',
    );
    const endpoint = `/studies/${study.id}/scheduled-visits`;
    const created = await schedule(
      study.id,
      active.participationId,
      plannedVisit.id,
    ).expect(201);

    expect(created.body).toMatchObject({
      studyId: study.id,
      participationId: active.participationId,
      participantName: 'Participante Ativo',
      plannedVisitId: plannedVisit.id,
      plannedVisitName: 'Consulta inicial',
      status: 'Agendada',
      realizedAt: null,
    });
    expect(created.body.scheduledAt).toMatch(/Z$/);
    expect(created.body.createdAt).toMatch(/Z$/);
    expect(created.body.observation).toBeNull();

    const duplicate = await schedule(
      study.id,
      active.participationId,
      plannedVisit.id,
    ).expect(409);
    expect(duplicate.body.code).toBe('VISIT_ALREADY_SCHEDULED');

    const database = fixture.app.get(DatabaseService);
    await database.query(
      `UPDATE visitas SET status = 'Ausente' WHERE id_visita = $1`,
      [created.body.id],
    );
    const afterAbsence = await schedule(
      study.id,
      active.participationId,
      plannedVisit.id,
    ).expect(201);
    await database.query(
      `UPDATE visitas SET status = 'Cancelada' WHERE id_visita = $1`,
      [afterAbsence.body.id],
    );
    await schedule(study.id, active.participationId, plannedVisit.id).expect(
      201,
    );

    const inactiveResponse = await schedule(
      study.id,
      inactive.participationId,
      plannedVisit.id,
    ).expect(400);
    expect(inactiveResponse.body.code).toBe('PARTICIPATION_NOT_ACTIVE');
    await schedule(study.id, foreign.participationId, plannedVisit.id).expect(
      404,
    );
    await schedule(study.id, active.participationId, foreignVisit.id).expect(
      404,
    );

    const beforeInclusion = await schedule(
      study.id,
      active.participationId,
      plannedVisit.id,
      '2019-12-31T23:59:59Z',
    ).expect(400);
    expect(beforeInclusion.body.code).toBe('SCHEDULE_OUT_OF_RANGE');
    const afterStudy = await schedule(
      study.id,
      active.participationId,
      plannedVisit.id,
      '2100-01-01T03:00:00Z',
    ).expect(400);
    expect(afterStudy.body.code).toBe('SCHEDULE_OUT_OF_RANGE');

    await scheduleAs(
      coordinatorToken,
      study.id,
      coordinatorParticipant.participationId,
      plannedVisit.id,
    ).expect(201);

    await request(api())
      .post(endpoint)
      .set('Authorization', bearer(otherResearcherToken))
      .send({
        participationId: active.participationId,
        plannedVisitId: plannedVisit.id,
        scheduledAt: '2025-03-15T10:00:00Z',
      })
      .expect(403);
  });

  it('serializa agendamentos concorrentes da mesma participação e visita prevista', async () => {
    const study = await createStudy('E02 concorrência');
    const participant = await createParticipant(
      study.id,
      'Participante Concorrente',
    );
    const visit = await createPlannedVisit(study.id);
    const responses = await Promise.all([
      schedule(study.id, participant.participationId, visit.id),
      schedule(study.id, participant.participationId, visit.id),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('VISIT_ALREADY_SCHEDULED');
  });

  it('compara data de agendamento com os dias civis de Brasília nas fronteiras de inclusão e encerramento', async () => {
    const study = await createStudy(
      'E02 datas civis de Brasília',
      '2026-11-30',
    );
    const inclusionBoundary = await createParticipant(
      study.id,
      'Participante Limite Inclusão',
    );
    const endBoundary = await createParticipant(
      study.id,
      'Participante Limite Encerramento',
    );
    const endOutside = await createParticipant(
      study.id,
      'Participante Após Encerramento',
    );
    const visit = await createPlannedVisit(study.id);

    await schedule(
      study.id,
      inclusionBoundary.participationId,
      visit.id,
      '2020-01-01T02:59:59Z',
    ).expect(400);
    await schedule(
      study.id,
      inclusionBoundary.participationId,
      visit.id,
      '2020-01-01T03:00:00Z',
    ).expect(201);

    await schedule(
      study.id,
      endBoundary.participationId,
      visit.id,
      '2026-12-01T02:59:59Z',
    ).expect(201);
    const afterEnd = await schedule(
      study.id,
      endOutside.participationId,
      visit.id,
      '2026-12-01T03:00:00Z',
    ).expect(400);
    expect(afterEnd.body.code).toBe('SCHEDULE_OUT_OF_RANGE');
  });

  it('lista visitas com filtros e isola dados por estudo', async () => {
    const study = await createStudy('E03 filtros');
    const otherStudy = await createStudy('E03 isolamento');
    const participant = await createParticipant(study.id, 'Participante E03');
    const secondParticipant = await createParticipant(
      study.id,
      'Participante E03 dois',
    );
    const foreign = await createParticipant(
      otherStudy.id,
      'Participante E03 externo',
    );
    const visit = await createPlannedVisit(study.id);
    await schedule(
      study.id,
      participant.participationId,
      visit.id,
      '2025-03-15T10:00:00Z',
    ).expect(201);
    await schedule(
      study.id,
      secondParticipant.participationId,
      visit.id,
      '2025-03-17T10:00:00Z',
    ).expect(201);

    const list = `/studies/${study.id}/scheduled-visits`;
    await request(api())
      .get(
        `${list}?participationId=${participant.participationId}&status=Agendada&from=2025-03-15&to=2025-03-15`,
      )
      .set('Authorization', bearer(coordinatorToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          participationId: participant.participationId,
          plannedVisitId: visit.id,
        });
      });
    await request(api())
      .get(`${list}?participationId=${foreign.participationId}`)
      .set('Authorization', bearer(researcherToken))
      .expect(404);
    await request(api())
      .get(list)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
        expect(
          body.every(
            (entry: { studyId: string }) => entry.studyId === study.id,
          ),
        ).toBe(true);
        expect(
          body[0].scheduledAt.localeCompare(body[1].scheduledAt),
        ).toBeLessThan(0);
      });
    await request(api())
      .get(`${list}?from=2025-03-20&to=2025-03-15`)
      .set('Authorization', bearer(researcherToken))
      .expect(400);
    await request(api())
      .get(`${list}?from=2025-02-30`)
      .set('Authorization', bearer(researcherToken))
      .expect(400);
  });

  it('aplica os filtros inclusivos E03 usando o dia civil de Brasília', async () => {
    const study = await createStudy('E03 filtro por dia de Brasília');
    const beforeMidnight = await createParticipant(
      study.id,
      'Participante Antes da Meia-noite',
    );
    const afterMidnight = await createParticipant(
      study.id,
      'Participante Depois da Meia-noite',
    );
    const visit = await createPlannedVisit(study.id);
    await schedule(
      study.id,
      beforeMidnight.participationId,
      visit.id,
      '2026-11-21T02:59:59Z',
    ).expect(201);
    await schedule(
      study.id,
      afterMidnight.participationId,
      visit.id,
      '2026-11-21T03:00:00Z',
    ).expect(201);

    await request(api())
      .get(
        `/studies/${study.id}/scheduled-visits?from=2026-11-20&to=2026-11-20`,
      )
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].participationId).toBe(beforeMidnight.participationId);
      });
  });

  it('atualiza visitas agendadas para estados finais e preserva observação omitida', async () => {
    const study = await createStudy('E04 transições de visita');
    const participants = await Promise.all([
      createParticipant(study.id, 'Participante Realizada'),
      createParticipant(study.id, 'Participante Ausente'),
      createParticipant(study.id, 'Participante Cancelada'),
    ]);
    const plannedVisit = await createPlannedVisit(study.id);
    const scheduledVisits = [];
    for (const participant of participants) {
      const created = await schedule(
        study.id,
        participant.participationId,
        plannedVisit.id,
      ).expect(201);
      scheduledVisits.push(created.body as { id: string });
    }

    const realized = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduledVisits[0]!.id,
      {
        status: 'Realizada',
        realizedAt: '2025-03-15T13:40:00Z',
        observation: '  Compareceu.  ',
      },
    ).expect(200);
    expect(realized.body).toMatchObject({
      status: 'Realizada',
      realizedAt: '2025-03-15T13:40:00.000Z',
      observation: 'Compareceu.',
    });

    const database = fixture.app.get(DatabaseService);
    await database.query(
      `UPDATE visitas SET observacao = 'Observação existente.' WHERE id_visita = $1`,
      [scheduledVisits[1]!.id],
    );
    const absent = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduledVisits[1]!.id,
      {
        status: 'Ausente',
      },
    ).expect(200);
    expect(absent.body).toMatchObject({
      status: 'Ausente',
      realizedAt: null,
      observation: 'Observação existente.',
    });

    const cancelled = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduledVisits[2]!.id,
      {
        status: 'Cancelada',
        observation: null,
      },
    ).expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'Cancelada',
      realizedAt: null,
      observation: null,
    });

    for (const visit of scheduledVisits) {
      const finalState = await database.query<{ status: string }>(
        `SELECT status FROM visitas WHERE id_visita = $1`,
        [visit.id],
      );
      const response = await updateScheduledVisitAs(
        researcherToken,
        study.id,
        visit.id,
        {
          status: 'Cancelada',
        },
      ).expect(400);
      expect(response.body.code).toBe('VISIT_STATUS_FINAL');
      expect(response.body.message).toContain(
        `"${finalState.rows[0]!.status}"`,
      );
    }
  });

  it('valida presença, futuro e dia civil de Brasília de realizedAt', async () => {
    const study = await createStudy('E04 limites de realização');
    const participant = await createParticipant(
      study.id,
      'Participante Limite Realização',
    );
    const plannedVisit = await createPlannedVisit(study.id);
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);

    const missing = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Realizada',
      },
    ).expect(400);
    expect(missing.body.message).toContain(
      'Informe a data de realização somente para visitas realizadas.',
    );

    await updateScheduledVisitAs(researcherToken, study.id, scheduled.body.id, {
      status: 'Ausente',
      realizedAt: '2025-03-15T13:40:00Z',
    }).expect(400);

    const future = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Realizada',
        realizedAt: '2999-03-15T13:40:00Z',
      },
    ).expect(400);
    expect(future.body.code).toBe('REALIZED_AT_INVALID');

    const beforeInclusionDay = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Realizada',
        realizedAt: '2020-01-01T02:59:59Z',
      },
    ).expect(400);
    expect(beforeInclusionDay.body.code).toBe('REALIZED_AT_INVALID');

    const inclusionDayStart = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Realizada',
        realizedAt: '2020-01-01T03:00:00Z',
      },
    ).expect(200);
    expect(inclusionDayStart.body).toMatchObject({
      status: 'Realizada',
      realizedAt: '2020-01-01T03:00:00.000Z',
    });
  });

  it('aplica participação ativa, isolamento, autorização e estados permitidos do estudo em E04', async () => {
    const study = await createStudy('E04 autorização');
    const otherStudy = await createStudy('E04 isolamento');
    const active = await createParticipant(study.id, 'Participante E04 Ativo');
    const inactive = await createParticipant(
      study.id,
      'Participante E04 Retirado',
    );
    const foreign = await createParticipant(
      otherStudy.id,
      'Participante E04 Externo',
    );
    const plannedVisit = await createPlannedVisit(study.id);
    const foreignVisit = await createPlannedVisit(otherStudy.id);
    const scheduled = await schedule(
      study.id,
      active.participationId,
      plannedVisit.id,
    ).expect(201);
    const inactiveScheduled = await schedule(
      study.id,
      inactive.participationId,
      plannedVisit.id,
    ).expect(201);
    const foreignScheduled = await schedule(
      otherStudy.id,
      foreign.participationId,
      foreignVisit.id,
    ).expect(201);

    const database = fixture.app.get(DatabaseService);
    const mismatchedVisit = await database.query<{ id: string }>(
      `INSERT INTO visitas (id_participacao, id_visita_prevista, data_agendada)
       VALUES ($1, $2, '2025-03-15T10:00:00Z')
       RETURNING id_visita::text AS id`,
      [active.participationId, foreignVisit.id],
    );
    await database.query(
      `UPDATE participacoes_estudo
           SET status = 'Retirado', data_retirada = '2020-02-01'
           WHERE id_participacao = $1`,
      [inactive.participationId],
    );
    const inactiveResponse = await updateScheduledVisitAs(
      researcherToken,
      study.id,
      inactiveScheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(400);
    expect(inactiveResponse.body.code).toBe('PARTICIPATION_NOT_ACTIVE');

    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      foreignScheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(404);
    await updateScheduledVisitAs(
      researcherToken,
      otherStudy.id,
      mismatchedVisit.rows[0]!.id,
      { status: 'Ausente' },
    ).expect(404);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      '00000000-0000-4000-8000-000000000001',
      {
        status: 'Ausente',
      },
    ).expect(404);
    await updateScheduledVisitAs(
      otherResearcherToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(403);
    await updateScheduledVisitAs(adminToken, study.id, scheduled.body.id, {
      status: 'Ausente',
    }).expect(403);
    await updateScheduledVisitAs(
      participantToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(403);

    await updateScheduledVisitAs(
      coordinatorToken,
      study.id,
      scheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(200);

    const executionStudy = await createStudy('E04 coordenador em execução');
    const executionParticipant = await createParticipant(
      executionStudy.id,
      'Participante em execução',
    );
    const executionVisit = await createPlannedVisit(executionStudy.id);
    const executionScheduled = await schedule(
      executionStudy.id,
      executionParticipant.participationId,
      executionVisit.id,
    ).expect(201);
    await request(api())
      .patch(`/studies/${executionStudy.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await updateScheduledVisitAs(
      coordinatorToken,
      executionStudy.id,
      executionScheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(200);

    const closedStudy = await createStudy('E04 estudo encerrado');
    const closedParticipant = await createParticipant(
      closedStudy.id,
      'Participante em estudo encerrado',
    );
    const closedVisit = await createPlannedVisit(closedStudy.id);
    const closedScheduled = await schedule(
      closedStudy.id,
      closedParticipant.participationId,
      closedVisit.id,
    ).expect(201);
    await request(api())
      .patch(`/studies/${closedStudy.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await request(api())
      .patch(`/studies/${closedStudy.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'encerrado' })
      .expect(200);
    const closedResponse = await updateScheduledVisitAs(
      researcherToken,
      closedStudy.id,
      closedScheduled.body.id,
      { status: 'Ausente' },
    ).expect(400);
    expect(closedResponse.body.code).toBe('STUDY_CLOSED');

    const planningStudy = await createStudy('E04 coordenador em planejamento');
    const planningParticipant = await createParticipant(
      planningStudy.id,
      'Participante em planejamento',
    );
    const planningVisit = await createPlannedVisit(planningStudy.id);
    const planningScheduled = await schedule(
      planningStudy.id,
      planningParticipant.participationId,
      planningVisit.id,
    ).expect(201);
    await database.query(
      `UPDATE estudos SET status = 'planejamento' WHERE id_estudo = $1`,
      [planningStudy.id],
    );
    await updateScheduledVisitAs(
      coordinatorToken,
      planningStudy.id,
      planningScheduled.body.id,
      {
        status: 'Ausente',
      },
    ).expect(403);
  });

  it('serializa atualizações concorrentes de status da mesma visita', async () => {
    const study = await createStudy('E04 concorrência');
    const participant = await createParticipant(
      study.id,
      'Participante E04 Concorrente',
    );
    const plannedVisit = await createPlannedVisit(study.id);
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);

    const responses = await Promise.all([
      updateScheduledVisitAs(researcherToken, study.id, scheduled.body.id, {
        status: 'Ausente',
      }),
      updateScheduledVisitAs(researcherToken, study.id, scheduled.body.id, {
        status: 'Cancelada',
      }),
    ]);
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 400]);
    expect(
      responses.find((response) => response.status === 400)?.body.code,
    ).toBe('VISIT_STATUS_FINAL');
  });

  it('reverte a atualização de E04 quando uma constraint do PostgreSQL falha', async () => {
    const study = await createStudy('E04 rollback de atualização');
    const participant = await createParticipant(
      study.id,
      'Participante E04 Rollback',
    );
    const plannedVisit = await createPlannedVisit(study.id);
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    const database = fixture.app.get(DatabaseService);
    await database.query(
      `UPDATE visitas
       SET observacao = 'Observação que deve persistir.'
       WHERE id_visita = $1`,
      [scheduled.body.id],
    );

    const constraintName = `e2e_visit_update_failure_${scheduled.body.id.replaceAll('-', '')}`;
    await database.query(
      `ALTER TABLE visitas
       ADD CONSTRAINT "${constraintName}"
       CHECK (id_visita <> '${scheduled.body.id}'::uuid OR status = 'Agendada')`,
    );

    let responseStatus: number | undefined;
    try {
      const response = await updateScheduledVisitAs(
        researcherToken,
        study.id,
        scheduled.body.id,
        {
          status: 'Ausente',
          observation: 'Esta alteração deve sofrer rollback.',
        },
      );
      responseStatus = response.status;
    } finally {
      await database.query(
        `ALTER TABLE visitas DROP CONSTRAINT "${constraintName}"`,
      );
    }

    expect(responseStatus).toBe(500);
    const persistedVisit = await database.query<{
      status: string;
      observation: string | null;
      realizedAt: Date | null;
    }>(
      `SELECT status, observacao AS observation, data_realizacao AS "realizedAt"
       FROM visitas
       WHERE id_visita = $1`,
      [scheduled.body.id],
    );
    expect(persistedVisit.rows[0]).toMatchObject({
      status: 'Agendada',
      observation: 'Observação que deve persistir.',
      realizedAt: null,
    });
  });

  it('permite leitura X02/X03 ao Coordenador sem liberar escrita e aplica estados de estudo', async () => {
    const study = await createStudy('D01 leitura pelo Coordenador');
    const visit = await createPlannedVisit(study.id);
    await request(api())
      .post(`/studies/${study.id}/visits/${visit.id}/activities`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Atividade de teste', type: 'Exame' })
      .expect(201);

    await request(api())
      .get(`/studies/${study.id}/visits`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    await request(api())
      .get(`/studies/${study.id}/visits/${visit.id}/activities`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    await request(api())
      .post(`/studies/${study.id}/visits`)
      .set('Authorization', bearer(coordinatorToken))
      .send({ name: 'Visita proibida', order: 2 })
      .expect(403);
    await request(api())
      .post(`/studies/${study.id}/visits/${visit.id}/activities`)
      .set('Authorization', bearer(coordinatorToken))
      .send({ name: 'Atividade proibida', type: 'Exame' })
      .expect(403);

    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'encerrado' })
      .expect(200);
    await request(api())
      .get(`/studies/${study.id}/visits`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    const closedStudyWrite = await request(api())
      .post(`/studies/${study.id}/scheduled-visits`)
      .set('Authorization', bearer(coordinatorToken))
      .send({
        participationId: '00000000-0000-4000-8000-000000000001',
        plannedVisitId: visit.id,
        scheduledAt: '2025-03-15T10:00:00Z',
      })
      .expect(400);
    expect(closedStudyWrite.body.code).toBe('STUDY_CLOSED');
  });

  it('E05 lista atividades na ordem de cadastro, resultados registrados e leitura do Coordenador', async () => {
    const study = await createStudy('E05 ordem de atividades');
    const participant = await createParticipant(study.id, 'Participante E05');
    const plannedVisit = await createPlannedVisit(study.id);
    const secondActivity = await createActivity(study.id, plannedVisit.id, 'Zeta');
    const firstActivity = await createActivity(study.id, plannedVisit.id, 'Alfa');
    const plannedActivities = await request(api())
      .get(`/studies/${study.id}/visits/${plannedVisit.id}/activities`)
      .set('Authorization', bearer(researcherToken))
      .expect(200);
    expect(plannedActivities.body.map((activity: { id: string }) => activity.id))
      .toEqual([secondActivity.id, firstActivity.id]);
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);

    const initial = await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .expect(200);
    expect(initial.body).toMatchObject({
      scheduledVisitId: scheduled.body.id,
      plannedVisitId: plannedVisit.id,
      status: 'Realizada',
      activities: [
        { activityId: secondActivity.id, name: 'Zeta', result: null },
        { activityId: firstActivity.id, name: 'Alfa', result: null },
      ],
    });

    const coordinatorRead = await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    expect(coordinatorRead.body.activities).toHaveLength(2);
    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(otherResearcherToken))
      .expect(403);
    await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(adminToken))
      .expect(403);
    await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(participantToken))
      .expect(403);
  });

  it('atribui posições distintas a atividades criadas concorrentemente', async () => {
    const study = await createStudy('X03 ordem concorrente');
    const plannedVisit = await createPlannedVisit(study.id);
    await Promise.all([
      createActivity(study.id, plannedVisit.id, 'Atividade concorrente A'),
      createActivity(study.id, plannedVisit.id, 'Atividade concorrente B'),
    ]);

    const database = fixture.app.get(DatabaseService);
    const orders = await database.query<{ order: number }>(
      `SELECT ordem AS "order"
       FROM atividades_visita
       WHERE id_visita_prevista = $1
       ORDER BY ordem`,
      [plannedVisit.id],
    );
    expect(orders.rows.map((row) => row.order)).toEqual([1, 2]);
  });

  it('E06 registra resultado, persiste os campos e converte duplicidade em 409', async () => {
    const study = await createStudy('E06 registro');
    const participant = await createParticipant(study.id, 'Participante E06');
    const plannedVisit = await createPlannedVisit(study.id);
    const activity = await createActivity(study.id, plannedVisit.id, 'Resultado');
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);

    const body = {
      activityId: activity.id,
      value: '  Resultado fictício  ',
      unit: '  mmHg  ',
      observation: '  Dado acadêmico.  ',
    };
    const recorded = await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send(body)
      .expect(201);
    expect(recorded.body).toMatchObject({
      scheduledVisitId: scheduled.body.id,
      activityId: activity.id,
      value: 'Resultado fictício',
      unit: 'mmHg',
      observation: 'Dado acadêmico.',
      registrarId: researcher.id,
    });
    expect(recorded.body.registeredAt).toMatch(/Z$/);

    const database = fixture.app.get(DatabaseService);
    const persisted = await database.query<{
      value: string;
      unit: string | null;
      observation: string | null;
    }>(
      `SELECT valor_ficticio AS value, unidade AS unit, observacao AS observation
       FROM resultados_avaliacao
       WHERE id_visita = $1 AND id_atividade = $2`,
      [scheduled.body.id, activity.id],
    );
    expect(persisted.rows[0]).toEqual({
      value: 'Resultado fictício',
      unit: 'mmHg',
      observation: 'Dado acadêmico.',
    });

    const duplicate = await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send(body)
      .expect(409);
    expect(duplicate.body.code).toBe('RESULT_ALREADY_REGISTERED');

    const listed = await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    expect(listed.body.activities[0].result).toMatchObject({
      value: 'Resultado fictício',
      unit: 'mmHg',
      observation: 'Dado acadêmico.',
      registrarId: researcher.id,
    });
  });

  it('E06 aplica status, vínculos e perfis autorizados', async () => {
    const study = await createStudy('E06 validações');
    const otherStudy = await createStudy('E06 outro estudo');
    const participant = await createParticipant(study.id, 'Participante E06 validação');
    const plannedVisit = await createPlannedVisit(study.id);
    const activity = await createActivity(study.id, plannedVisit.id, 'Atividade compatível');
    const foreignPlannedVisit = await createPlannedVisit(otherStudy.id);
    const foreignActivity = await createActivity(
      otherStudy.id,
      foreignPlannedVisit.id,
      'Atividade externa',
    );
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    const endpoint = `/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`;
    const payload = { activityId: activity.id, value: '1' };

    const notRealized = await request(api())
      .post(endpoint)
      .set('Authorization', bearer(researcherToken))
      .send(payload)
      .expect(400);
    expect(notRealized.body.code).toBe('VISIT_NOT_REALIZED');

    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Ausente' },
    ).expect(200);
    const absent = await request(api())
      .post(endpoint)
      .set('Authorization', bearer(researcherToken))
      .send(payload)
      .expect(400);
    expect(absent.body.code).toBe('VISIT_NOT_REALIZED');

    const cancelledScheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      cancelledScheduled.body.id,
      { status: 'Cancelada' },
    ).expect(200);
    const cancelled = await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${cancelledScheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send(payload)
      .expect(400);
    expect(cancelled.body.code).toBe('VISIT_NOT_REALIZED');

    await schedule(
      otherStudy.id,
      participant.participationId,
      foreignPlannedVisit.id,
    ).expect(404);
    const wrongActivity = await request(api())
      .post(endpoint)
      .set('Authorization', bearer(researcherToken))
      .send({ activityId: foreignActivity.id, value: '1' })
      .expect(400);
    expect(wrongActivity.body.code).toBe('VISIT_NOT_REALIZED');

    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(400);

    const realizedScheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      realizedScheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);
    const realizedEndpoint =
      `/studies/${study.id}/scheduled-visits/${realizedScheduled.body.id}/results`;
    const incompatibleActivity = await request(api())
      .post(realizedEndpoint)
      .set('Authorization', bearer(researcherToken))
      .send({ activityId: foreignActivity.id, value: '1' })
      .expect(400);
    expect(incompatibleActivity.body.code).toBe('ACTIVITY_NOT_IN_VISIT');
    const missingActivity = await request(api())
      .post(realizedEndpoint)
      .set('Authorization', bearer(researcherToken))
      .send({
        activityId: '00000000-0000-4000-8000-000000000099',
        value: '1',
      })
      .expect(400);
    expect(missingActivity.body.code).toBe('ACTIVITY_NOT_IN_VISIT');

    await request(api())
      .post(realizedEndpoint)
      .set('Authorization', bearer(otherResearcherToken))
      .send(payload)
      .expect(403);
    await request(api())
      .post(realizedEndpoint)
      .set('Authorization', bearer(coordinatorToken))
      .send(payload)
      .expect(403);
    await request(api())
      .post(realizedEndpoint)
      .set('Authorization', bearer(adminToken))
      .send(payload)
      .expect(403);
    await request(api())
      .post(realizedEndpoint)
      .set('Authorization', bearer(participantToken))
      .send(payload)
      .expect(403);
  });

  it('E06 impede resultados em estudo encerrado e visita de outro estudo', async () => {
    const study = await createStudy('E06 encerrado');
    const otherStudy = await createStudy('E06 visita isolada');
    const participant = await createParticipant(study.id, 'Participante encerrado');
    const otherParticipant = await createParticipant(otherStudy.id, 'Participante externo E06');
    const plannedVisit = await createPlannedVisit(study.id);
    const activity = await createActivity(study.id, plannedVisit.id, 'Encerramento');
    const foreignVisitPlan = await createPlannedVisit(otherStudy.id);
    const foreignActivity = await createActivity(
      otherStudy.id,
      foreignVisitPlan.id,
      'Atividade externa',
    );
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    const foreignScheduled = await schedule(
      otherStudy.id,
      otherParticipant.participationId,
      foreignVisitPlan.id,
    ).expect(201);
    const database = fixture.app.get(DatabaseService);
    const crossStudyVisit = await database.query<{ id: string }>(
      `INSERT INTO visitas
         (id_participacao, id_visita_prevista, data_agendada, data_realizacao, status)
       VALUES ($1, $2, '2025-03-16T10:00:00Z', '2025-03-16T13:40:00Z', 'Realizada')
       RETURNING id_visita::text AS id`,
      [participant.participationId, foreignVisitPlan.id],
    );
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);
    await updateScheduledVisitAs(
      researcherToken,
      otherStudy.id,
      foreignScheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);

    await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${foreignScheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send({ activityId: foreignActivity.id, value: '1' })
      .expect(404);
    await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${crossStudyVisit.rows[0]!.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send({ activityId: foreignActivity.id, value: '1' })
      .expect(404);

    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'encerrado' })
      .expect(200);
    const closed = await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send({ activityId: activity.id, value: '1' })
      .expect(400);
    expect(closed.body.code).toBe('STUDY_CLOSED');
    await request(api())
      .get(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
  });

  it('serializa E06 concorrente e reverte falhas reais de trigger PostgreSQL', async () => {
    const study = await createStudy('E06 concorrência e rollback');
    const participant = await createParticipant(study.id, 'Participante E06 concorrente');
    const plannedVisit = await createPlannedVisit(study.id);
    const activity = await createActivity(study.id, plannedVisit.id, 'Atividade concorrente');
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);
    const endpoint =
      `/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`;
    const payload = { activityId: activity.id, value: 'concorrente' };
    const responses = await Promise.all([
      request(api()).post(endpoint).set('Authorization', bearer(researcherToken)).send(payload),
      request(api()).post(endpoint).set('Authorization', bearer(researcherToken)).send(payload),
    ]);
    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(responses.find(({ status }) => status === 409)?.body.code)
      .toBe('RESULT_ALREADY_REGISTERED');

    const database = fixture.app.get(DatabaseService);
    const rollbackStudy = await createStudy('E06 falha de persistência');
    const rollbackParticipant = await createParticipant(
      rollbackStudy.id,
      'Participante E06 rollback',
    );
    const rollbackVisitPlan = await createPlannedVisit(rollbackStudy.id);
    const rollbackActivity = await createActivity(
      rollbackStudy.id,
      rollbackVisitPlan.id,
      'Atividade rollback',
    );
    const rollbackVisit = await schedule(
      rollbackStudy.id,
      rollbackParticipant.participationId,
      rollbackVisitPlan.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      rollbackStudy.id,
      rollbackVisit.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);

    const suffix = rollbackVisit.body.id.replaceAll('-', '');
    const functionName = `e2e_fail_result_${suffix}`;
    const triggerName = `e2e_fail_result_trigger_${suffix}`;
    await database.query(
      `CREATE FUNCTION ${functionName}() RETURNS trigger
       LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'failure after result insert';
       END;
       $$`,
    );
    await database.query(
      `CREATE TRIGGER ${triggerName}
       AFTER INSERT ON resultados_avaliacao
       FOR EACH ROW
       WHEN (NEW.id_visita = '${rollbackVisit.body.id}'::uuid)
       EXECUTE FUNCTION ${functionName}()`,
    );

    let responseStatus: number | undefined;
    try {
      const response = await request(api())
        .post(`/studies/${rollbackStudy.id}/scheduled-visits/${rollbackVisit.body.id}/results`)
        .set('Authorization', bearer(researcherToken))
        .send({ activityId: rollbackActivity.id, value: 'falha' });
      responseStatus = response.status;
    } finally {
      await database.query(`DROP TRIGGER ${triggerName} ON resultados_avaliacao`);
      await database.query(`DROP FUNCTION ${functionName}()`);
    }

    expect(responseStatus).toBe(500);
    const rolledBack = await database.query(
      `SELECT 1 FROM resultados_avaliacao
       WHERE id_visita = $1 AND id_atividade = $2`,
      [rollbackVisit.body.id, rollbackActivity.id],
    );
    expect(rolledBack.rowCount).toBe(0);
  });

  it('E07 retorna participação, visitas cronológicas e resultados vinculados', async () => {
    const study = await createStudy('E07 histórico completo');
    const participant = await createParticipant(study.id, 'Participante E07');
    const laterPlan = await createPlannedVisit(study.id, 'Visita posterior', 2);
    const earlierPlan = await createPlannedVisit(study.id, 'Visita anterior', 1);
    const laterActivity = await createActivity(study.id, laterPlan.id, 'Avaliação posterior');
    const earlierActivity = await createActivity(study.id, earlierPlan.id, 'Avaliação anterior');
    const laterVisit = await schedule(
      study.id,
      participant.participationId,
      laterPlan.id,
      '2025-03-20T10:00:00-03:00',
    ).expect(201);
    const earlierVisit = await schedule(
      study.id,
      participant.participationId,
      earlierPlan.id,
      '2025-03-10T10:00:00-03:00',
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      laterVisit.body.id,
      { status: 'Realizada', realizedAt: '2025-03-20T14:00:00Z' },
    ).expect(200);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      earlierVisit.body.id,
      { status: 'Realizada', realizedAt: '2025-03-10T14:00:00Z' },
    ).expect(200);
    await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${laterVisit.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send({
        activityId: laterActivity.id,
        value: 'resultado posterior',
      })
      .expect(201);
    await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${earlierVisit.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send({
        activityId: earlierActivity.id,
        value: 'resultado anterior',
      })
      .expect(201);

    const endpoint =
      `/studies/${study.id}/participants/${participant.participationId}/history`;
    const response = await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200);
    expect(response.body.participant).toMatchObject({
      participationId: participant.participationId,
      candidateId: participant.candidateId,
      studyId: study.id,
      name: 'Participante E07',
      participationStatus: 'Ativo',
      includedAt: '2020-01-01',
      withdrawnAt: null,
      withdrawalReason: null,
    });
    expect(response.body.visits).toHaveLength(2);
    expect(response.body.visits.map((visit: { id: string }) => visit.id)).toEqual([
      earlierVisit.body.id,
      laterVisit.body.id,
    ]);
    expect(response.body.visits[0].results).toMatchObject([
      {
        scheduledVisitId: earlierVisit.body.id,
        activityId: earlierActivity.id,
        activityName: 'Avaliação anterior',
        activityType: 'Exame',
        value: 'resultado anterior',
      },
    ]);
    expect(response.body.visits[1].results).toMatchObject([
      {
        scheduledVisitId: laterVisit.body.id,
        activityId: laterActivity.id,
        activityName: 'Avaliação posterior',
        activityType: 'Exame',
        value: 'resultado posterior',
      },
    ]);
    expect(response.body.visits[0].scheduledAt).toBe('2025-03-10T13:00:00.000Z');
    expect(response.body.visits[0].results[0].registeredAt).toMatch(/Z$/);

    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'encerrado' })
      .expect(200);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
  });

  it('E07 mantém histórico sem visitas e visitas sem resultados', async () => {
    const study = await createStudy('E07 histórico vazio');
    const participant = await createParticipant(study.id, 'Participante sem visita');
    const endpoint =
      `/studies/${study.id}/participants/${participant.participationId}/history`;
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.participant.participationId).toBe(participant.participationId);
        expect(body.visits).toEqual([]);
      });

    const plan = await createPlannedVisit(study.id);
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plan.id,
    ).expect(201);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.visits).toHaveLength(1);
        expect(body.visits[0].id).toBe(scheduled.body.id);
        expect(body.visits[0].results).toEqual([]);
      });
  });

  it('E07 aplica perfis, estados do Coordenador e isolamento do estudo', async () => {
    const study = await createStudy('E07 autorização');
    const foreignStudy = await createStudy('E07 participação externa');
    const participant = await createParticipant(study.id, 'Participante E07 autorizado');
    const foreignParticipant = await createParticipant(
      foreignStudy.id,
      'Participante E07 externo',
    );
    const endpoint =
      `/studies/${study.id}/participants/${participant.participationId}/history`;

    await request(api()).get(endpoint).expect(401);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(adminToken))
      .expect(403);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(participantToken))
      .expect(403);
    await request(api())
      .get(endpoint)
      .set('Authorization', bearer(otherResearcherToken))
      .expect(403);
    await request(api())
      .get(
        `/studies/${study.id}/participants/${foreignParticipant.participationId}/history`,
      )
      .set('Authorization', bearer(researcherToken))
      .expect(404);
    await request(api())
      .get(
        `/studies/${study.id}/participants/00000000-0000-4000-8000-000000000099/history`,
      )
      .set('Authorization', bearer(researcherToken))
      .expect(404);
    await request(api())
      .get(
        `/studies/00000000-0000-4000-8000-000000000099/participants/${participant.participationId}/history`,
      )
      .set('Authorization', bearer(researcherToken))
      .expect(404);

    const planning = await request(api())
      .post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...studyInput, title: 'E07 estudo em planejamento' })
      .expect(201);
    await request(api())
      .get(
        `/studies/${planning.body.id}/participants/${participant.participationId}/history`,
      )
      .set('Authorization', bearer(coordinatorToken))
      .expect(403);
    await request(api())
      .get(
        `/studies/${study.id}/participants/${participant.participationId}/history`,
      )
      .set('Authorization', bearer(coordinatorToken))
      .expect(200);
  });

  it('E08 retira participante com sucesso e preserva visitas, resultados e demais registros', async () => {
    const study = await createStudy('E08 preservação do histórico');
    const participant = await createParticipant(study.id, 'Participante E08');
    const plannedVisit = await createPlannedVisit(study.id);
    const activity = await createActivity(study.id, plannedVisit.id, 'Avaliação E08');
    const scheduled = await schedule(
      study.id,
      participant.participationId,
      plannedVisit.id,
    ).expect(201);
    await updateScheduledVisitAs(
      researcherToken,
      study.id,
      scheduled.body.id,
      { status: 'Realizada', realizedAt: '2025-03-16T13:40:00Z' },
    ).expect(200);
    await request(api())
      .post(`/studies/${study.id}/scheduled-visits/${scheduled.body.id}/results`)
      .set('Authorization', bearer(researcherToken))
      .send({ activityId: activity.id, value: 'resultado preservado' })
      .expect(201);

    const endpoint =
      `/studies/${study.id}/participants/${participant.participationId}/history`;
    const historyBefore = await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200);
    const database = fixture.app.get(DatabaseService);
    const stateBefore = await database.query<{
      linked: number;
      candidateStatus: string;
      visitStatus: string;
      scheduledAt: Date;
      realizedAt: Date;
      observation: string | null;
    }>(
      `SELECT e.participantes_vinculados AS linked,
              c.status_recrutamento AS "candidateStatus",
              v.status AS "visitStatus",
              v.data_agendada AS "scheduledAt",
              v.data_realizacao AS "realizedAt",
              v.observacao AS observation
       FROM estudos e
       JOIN candidatos c ON c.id_estudo = e.id_estudo
       JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato
       JOIN visitas v ON v.id_participacao = p.id_participacao
       WHERE e.id_estudo = $1 AND p.id_participacao = $2 AND v.id_visita = $3`,
      [study.id, participant.participationId, scheduled.body.id],
    );

    const withdrawalDate = await brazilToday();
    const reason = '  Participante solicitou desligamento por motivos pessoais.  ';
    const response = await registerWithdrawalAs(
      researcherToken,
      study.id,
      participant.participationId,
      { withdrawalDate, reason },
    ).expect(201);
    expect(response.body).toMatchObject({
      participationId: participant.participationId,
      candidateId: participant.candidateId,
      studyId: study.id,
      name: 'Participante E08',
      participationStatus: 'Retirado',
      includedAt: '2020-01-01',
      withdrawnAt: withdrawalDate,
      withdrawalReason: reason.trim(),
    });

    const stateAfter = await database.query<{
      linked: number;
      candidateStatus: string;
      visitStatus: string;
      scheduledAt: Date;
      realizedAt: Date;
      observation: string | null;
      participationStatus: string;
      withdrawalDate: string;
      withdrawalReason: string;
    }>(
      `SELECT e.participantes_vinculados AS linked,
              c.status_recrutamento AS "candidateStatus",
              v.status AS "visitStatus",
              v.data_agendada AS "scheduledAt",
              v.data_realizacao AS "realizedAt",
              v.observacao AS observation,
              p.status AS "participationStatus",
              p.data_retirada::text AS "withdrawalDate",
              p.motivo_retirada AS "withdrawalReason"
       FROM estudos e
       JOIN candidatos c ON c.id_estudo = e.id_estudo
       JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato
       JOIN visitas v ON v.id_participacao = p.id_participacao
       WHERE e.id_estudo = $1 AND p.id_participacao = $2 AND v.id_visita = $3`,
      [study.id, participant.participationId, scheduled.body.id],
    );
    expect(stateAfter.rows[0]).toMatchObject({
      linked: stateBefore.rows[0]!.linked,
      candidateStatus: stateBefore.rows[0]!.candidateStatus,
      visitStatus: stateBefore.rows[0]!.visitStatus,
      scheduledAt: stateBefore.rows[0]!.scheduledAt,
      realizedAt: stateBefore.rows[0]!.realizedAt,
      observation: stateBefore.rows[0]!.observation,
      participationStatus: 'Retirado',
      withdrawalDate,
      withdrawalReason: reason.trim(),
    });

    const historyAfter = await request(api())
      .get(endpoint)
      .set('Authorization', bearer(researcherToken))
      .expect(200);
    expect(historyAfter.body.participant).toMatchObject({
      participationStatus: 'Retirado',
      withdrawnAt: withdrawalDate,
      withdrawalReason: reason.trim(),
    });
    expect(historyAfter.body.visits).toEqual(historyBefore.body.visits);
  });

  it('E08 autoriza Coordenador ativo em estudo permitido e rejeita perfis não autorizados', async () => {
    const study = await createStudy('E08 permissões');
    const recruitmentParticipant = await createParticipant(
      study.id,
      'Participante retirado pelo Coordenador em recrutamento',
    );
    const executionParticipant = await createParticipant(
      study.id,
      'Participante retirado pelo Coordenador em execução',
    );
    const unauthorizedParticipant = await createParticipant(
      study.id,
      'Participante sem autorização',
    );
    const date = await brazilToday();

    const coordinated = await registerWithdrawalAs(
      coordinatorToken,
      study.id,
      recruitmentParticipant.participationId,
      { withdrawalDate: date, reason: 'Retirada pelo Coordenador.' },
    ).expect(201);
    expect(coordinated.body.participationStatus).toBe('Retirado');

    await request(api())
      .patch(`/studies/${study.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await registerWithdrawalAs(
      coordinatorToken,
      study.id,
      executionParticipant.participationId,
      { withdrawalDate: date, reason: 'Retirada em execução.' },
    ).expect(201);

    const endpoint = `/studies/${study.id}/participants/${unauthorizedParticipant.participationId}/withdrawal`;
    await request(api()).post(endpoint).send({
      withdrawalDate: date,
      reason: 'Sem autenticação.',
    }).expect(401);
    await registerWithdrawalAs(
      otherResearcherToken,
      study.id,
      unauthorizedParticipant.participationId,
      { withdrawalDate: date, reason: 'Pesquisador não proprietário.' },
    ).expect(403);
    await registerWithdrawalAs(
      adminToken,
      study.id,
      unauthorizedParticipant.participationId,
      { withdrawalDate: date, reason: 'Administrador.' },
    ).expect(403);
    await registerWithdrawalAs(
      participantToken,
      study.id,
      unauthorizedParticipant.participationId,
      { withdrawalDate: date, reason: 'Participante.' },
    ).expect(403);

    const database = fixture.app.get(DatabaseService);
    await database.query(`UPDATE usuarios SET status = 'Inativo' WHERE id_usuario = $1`, [
      coordinator.id,
    ]);
    try {
      await registerWithdrawalAs(
        coordinatorToken,
        study.id,
        unauthorizedParticipant.participationId,
        { withdrawalDate: date, reason: 'Coordenador inativo.' },
      ).expect(401);
    } finally {
      await database.query(`UPDATE usuarios SET status = 'Ativo' WHERE id_usuario = $1`, [
        coordinator.id,
      ]);
    }

    const planningStudy = await request(api())
      .post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...studyInput, title: 'E08 estudo em planejamento' })
      .expect(201);
    const planningParticipant = await createParticipant(
      planningStudy.body.id,
      'Participante em planejamento',
    );
    await registerWithdrawalAs(
      coordinatorToken,
      planningStudy.body.id,
      planningParticipant.participationId,
      { withdrawalDate: date, reason: 'Estado não permitido.' },
    ).expect(403);
    await registerWithdrawalAs(
      researcherToken,
      planningStudy.body.id,
      planningParticipant.participationId,
      {
        withdrawalDate: '2020-01-01',
        reason: 'Pesquisador proprietário na data de inclusão.',
      },
    ).expect(201);
  });

  it('E08 valida estudo, participação, estado, data e motivo', async () => {
    const study = await createStudy('E08 validações');
    const otherStudy = await createStudy('E08 outro estudo');
    const active = await createParticipant(study.id, 'Participante ativo E08');
    const withdrawn = await createParticipant(
      study.id,
      'Participante já retirado E08',
      'Retirado',
    );
    const completed = await createParticipant(
      study.id,
      'Participante concluído E08',
      'Concluído',
    );
    const foreign = await createParticipant(otherStudy.id, 'Participante externo E08');
    const date = await brazilToday();

    await registerWithdrawalAs(researcherToken, study.id, active.participationId, {
      withdrawalDate: '2019-12-31',
      reason: 'Data anterior à inclusão.',
    })
      .expect(400)
      .then((response) =>
        expect(response.body.code).toBe('WITHDRAWAL_DATE_INVALID'),
      );
    const database = fixture.app.get(DatabaseService);
    const futureDate = await database.query<{ date: string }>(
      `SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 1)::text
                AS date`,
    );
    const future = await registerWithdrawalAs(
      researcherToken,
      study.id,
      active.participationId,
      { withdrawalDate: futureDate.rows[0]!.date, reason: 'Data futura.' },
    ).expect(400);
    expect(future.body.code).toBe('WITHDRAWAL_DATE_INVALID');

    const alreadyWithdrawn = await registerWithdrawalAs(
      researcherToken,
      study.id,
      withdrawn.participationId,
      { withdrawalDate: date, reason: 'Retirada repetida.' },
    ).expect(400);
    expect(alreadyWithdrawn.body.code).toBe('PARTICIPATION_NOT_ACTIVE');
    const alreadyCompleted = await registerWithdrawalAs(
      researcherToken,
      study.id,
      completed.participationId,
      { withdrawalDate: date, reason: 'Participação concluída.' },
    ).expect(400);
    expect(alreadyCompleted.body.code).toBe('PARTICIPATION_NOT_ACTIVE');

    await registerWithdrawalAs(
      researcherToken,
      study.id,
      foreign.participationId,
      { withdrawalDate: date, reason: 'Participação de outro estudo.' },
    ).expect(404);
    await registerWithdrawalAs(
      researcherToken,
      study.id,
      '00000000-0000-4000-8000-000000000099',
      { withdrawalDate: date, reason: 'Participação inexistente.' },
    ).expect(404);
    await request(api())
      .post(`/studies/00000000-0000-4000-8000-000000000099/participants/${active.participationId}/withdrawal`)
      .set('Authorization', bearer(researcherToken))
      .send({ withdrawalDate: date, reason: 'Estudo inexistente.' })
      .expect(404);

    const invalidBody = await registerWithdrawalAs(
      researcherToken,
      study.id,
      active.participationId,
      { withdrawalDate: '2026-02-30', reason: 'Data inválida.' },
    ).expect(400);
    expect(invalidBody.body.code).toBeUndefined();
    await registerWithdrawalAs(
      researcherToken,
      study.id,
      active.participationId,
      { withdrawalDate: date },
    ).expect(400);
    await registerWithdrawalAs(
      researcherToken,
      study.id,
      active.participationId,
      { withdrawalDate: date, reason: '   ' },
    ).expect(400);

    const closedStudy = await createStudy('E08 estudo encerrado');
    const closedParticipant = await createParticipant(
      closedStudy.id,
      'Participante em estudo encerrado E08',
    );
    await request(api())
      .patch(`/studies/${closedStudy.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'execução' })
      .expect(200);
    await request(api())
      .patch(`/studies/${closedStudy.id}/status`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'encerrado' })
      .expect(200);
    for (const token of [researcherToken, coordinatorToken]) {
      const closed = await registerWithdrawalAs(
        token,
        closedStudy.id,
        closedParticipant.participationId,
        { withdrawalDate: date, reason: 'Estudo encerrado.' },
      ).expect(400);
      expect(closed.body.code).toBe('STUDY_CLOSED');
    }
  });

  it('E08 serializa retiradas concorrentes e reverte falhas durante a transação', async () => {
    const study = await createStudy('E08 concorrência e rollback');
    const concurrentParticipant = await createParticipant(
      study.id,
      'Participante concorrente E08',
    );
    const date = await brazilToday();
    const responses = await Promise.all([
      registerWithdrawalAs(
        researcherToken,
        study.id,
        concurrentParticipant.participationId,
        { withdrawalDate: date, reason: 'Primeira tentativa.' },
      ),
      registerWithdrawalAs(
        researcherToken,
        study.id,
        concurrentParticipant.participationId,
        { withdrawalDate: date, reason: 'Segunda tentativa.' },
      ),
    ]);
    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201,
      400,
    ]);
    expect(
      responses.find(({ status }) => status === 400)?.body.code,
    ).toBe('PARTICIPATION_NOT_ACTIVE');

    const rollbackParticipant = await createParticipant(
      study.id,
      'Participante rollback E08',
    );
    const database = fixture.app.get(DatabaseService);
    const suffix = rollbackParticipant.participationId.replaceAll('-', '');
    const functionName = `e2e_fail_withdrawal_${suffix}`;
    const triggerName = `e2e_fail_withdrawal_trigger_${suffix}`;
    await database.query(
      `CREATE FUNCTION ${functionName}() RETURNS trigger
       LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'failure after withdrawal update';
       END;
       $$`,
    );
    await database.query(
      `CREATE TRIGGER ${triggerName}
       AFTER UPDATE ON participacoes_estudo
       FOR EACH ROW
       WHEN (NEW.id_participacao = '${rollbackParticipant.participationId}'::uuid
             AND NEW.status = 'Retirado')
       EXECUTE FUNCTION ${functionName}()`,
    );

    let responseStatus: number | undefined;
    try {
      const response = await registerWithdrawalAs(
        researcherToken,
        study.id,
        rollbackParticipant.participationId,
        { withdrawalDate: date, reason: 'Deve sofrer rollback.' },
      );
      responseStatus = response.status;
    } finally {
      await database.query(
        `DROP TRIGGER ${triggerName} ON participacoes_estudo`,
      );
      await database.query(`DROP FUNCTION ${functionName}()`);
    }
    expect(responseStatus).toBe(500);
    const state = await database.query<{
      status: string;
      withdrawalDate: string | null;
      reason: string | null;
    }>(
      `SELECT status, data_retirada::text AS "withdrawalDate",
              motivo_retirada AS reason
       FROM participacoes_estudo
       WHERE id_participacao = $1`,
      [rollbackParticipant.participationId],
    );
    expect(state.rows[0]).toEqual({
      status: 'Ativo',
      withdrawalDate: null,
      reason: null,
    });
  });
});
