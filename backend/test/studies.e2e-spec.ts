import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { PublicUser } from '../src/users/user.types.js';

const sample = {
  title: 'Acompanhamento da qualidade do sono',
  objective: 'Analisar hábitos de sono com dados fictícios de participantes.',
  startDate: '2099-10-01',
  endDate: '2099-12-31',
  participantLimit: 30,
  participantsLinked: 0,
};

describe('Estudos clínicos com PostgreSQL (E2E)', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let researcher: PublicUser;
  let otherResearcher: PublicUser;
  let admin: PublicUser;
  let researcherToken: string;
  let otherResearcherToken: string;
  let adminToken: string;
  let coordinatorToken: string;
  let participantToken: string;
  const api = () => fixture.app.getHttpServer();
  const bearer = (token: string) => `Bearer ${token}`;

  async function login(email: string) {
    const response = await request(api()).post('/auth/login').send({ email, password: 'Senha123!' }).expect(201);
    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    fixture = await databaseTestApp();
    const users = fixture.app.get(UsersService);
    const baseUser = { name: 'Pessoa Teste', phone: '83999990000', password: 'Senha123!' };
    researcher = await users.create({ ...baseUser, email: 'pesquisadora@example.test', role: 'Pesquisador' });
    otherResearcher = await users.create({ ...baseUser, email: 'outra.pesquisadora@example.test', role: 'Pesquisador' });
    admin = await users.create({ ...baseUser, email: 'administradora@example.test', role: 'Administrador' });
    researcherToken = await login(researcher.email);
    otherResearcherToken = await login(otherResearcher.email);
    adminToken = await login(admin.email);
    const coordinator = await users.create({ ...baseUser, email: 'coordenador@example.test', role: 'Coordenador' });
    const participant = await users.create({ ...baseUser, email: 'participante@example.test', role: 'Participante' });
    coordinatorToken = await login(coordinator.email);
    participantToken = await login(participant.email);
  });

  afterAll(async () => {
    await fixture?.app.close();
    await fixture?.cleanup();
  });

  it('nega acesso sem sessão e a perfis que não são pesquisadores', async () => {
    await request(api()).get('/studies').expect(401);
    await request(api()).get('/studies').set('Authorization', bearer(adminToken)).expect(403);
  });

  it('lista, cadastra, consulta e atualiza estudos persistidos no PostgreSQL', async () => {
    await request(api()).get('/studies').set('Authorization', bearer(researcherToken))
      .expect(200).expect(({ body }) => expect(body).toEqual([]));

    const created = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send(sample).expect(201);
    expect(created.body).toMatchObject({
      title: sample.title, objective: sample.objective, researcher: researcher.name,
      researcherId: researcher.id, participantLimit: 30, participantsLinked: 0,
    });
    expect(created.body.id).toBeDefined();
    expect(created.body.code).toMatch(/^EST-\d{3,}$/);

    await request(api()).get(`/studies/${created.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));

    await request(api()).patch(`/studies/${created.body.id}`)
      .set('Authorization', bearer(researcherToken)).send({ title: 'Título atualizado' }).expect(200)
      .expect(({ body }) => expect(body.title).toBe('Título atualizado'));

    await request(api()).post('/studies').set('Authorization', bearer(researcherToken))
      .send({ ...sample, participantLimit: 0 }).expect(400);
  });

  it('isola os estudos por pesquisador', async () => {
    const created = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo privado' }).expect(201);
    await request(api()).get('/studies').set('Authorization', bearer(otherResearcherToken))
      .expect(200).expect(({ body }) => expect(body).toEqual([]));
    await request(api()).get(`/studies/${created.body.id}`)
      .set('Authorization', bearer(otherResearcherToken)).expect(403);
    await request(api()).patch(`/studies/${created.body.id}`)
      .set('Authorization', bearer(otherResearcherToken)).send({ title: 'Tentativa indevida' }).expect(403);
  });

  it('cadastra, consulta e atualiza critérios vinculados ao estudo do pesquisador', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo com critérios' }).expect(201);
    const created = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter idade igual ou superior a 18 anos.' })
      .expect(201);

    expect(created.body).toMatchObject({
      studyId: study.body.id,
      type: 'Inclusão',
      description: 'Ter idade igual ou superior a 18 anos.',
      active: true,
    });

    await request(api()).get(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body).toEqual([created.body]));
    await request(api()).get(`/studies/${study.body.id}/criteria/${created.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));
    await request(api()).patch(`/studies/${study.body.id}/criteria/${created.body.id}`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Exclusão', active: false })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ type: 'Exclusão', active: false }));
    await request(api()).get(`/studies/${study.body.id}/criteria/${created.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body.type).toBe('Exclusão'));
  });

  it('valida critérios e impede acesso a critérios fora do estudo ou de outro pesquisador', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo com validação' }).expect(201);
    const otherStudy = await request(api()).post('/studies')
      .set('Authorization', bearer(otherResearcherToken)).send({ ...sample, title: 'Estudo de outra pessoa' }).expect(201);

    await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken)).send({ type: 'Outro', description: 'Descrição válida' }).expect(400);
    await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken)).send({ type: 'Inclusão', description: '   ' }).expect(400);
    await request(api()).post(`/studies/${otherStudy.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Descrição válida' }).expect(403);

    const criterion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Descrição válida' }).expect(201);
    await request(api()).patch(`/studies/${study.body.id}/criteria/${criterion.body.id}`)
      .set('Authorization', bearer(researcherToken)).send({ active: 'false' }).expect(400);
    await request(api()).get(`/studies/${otherStudy.body.id}/criteria/${criterion.body.id}`)
      .set('Authorization', bearer(otherResearcherToken)).expect(404);
    await request(api()).patch(`/studies/${study.body.id}/criteria/${criterion.body.id}`)
      .set('Authorization', bearer(researcherToken)).send({ unexpected: true }).expect(400);
  });

  it('cadastra, consulta e valida visitas previstas e atividades vinculadas ao estudo', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo com visitas' }).expect(201);
    const otherStudy = await request(api()).post('/studies')
      .set('Authorization', bearer(otherResearcherToken)).send({ ...sample, title: 'Estudo de outra pesquisadora' }).expect(201);

    const visit = await request(api()).post(`/studies/${study.body.id}/visits`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Consulta inicial', order: 1, intervalDays: 14 })
      .expect(201);
    expect(visit.body).toMatchObject({
      studyId: study.body.id,
      name: 'Consulta inicial',
      order: 1,
      intervalDays: 14,
      description: null,
    });

    await request(api()).get(`/studies/${study.body.id}/visits`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body).toEqual([visit.body]));
    await request(api()).get(`/studies/${study.body.id}/visits/${visit.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body).toEqual(visit.body));

    const activity = await request(api()).post(`/studies/${study.body.id}/visits/${visit.body.id}/activities`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Coleta de sinais vitais', type: 'Exame', description: 'Aferir pressão arterial.' })
      .expect(201);
    expect(activity.body).toMatchObject({
      visitId: visit.body.id,
      name: 'Coleta de sinais vitais',
      type: 'Exame',
      description: 'Aferir pressão arterial.',
    });
    await request(api()).get(`/studies/${study.body.id}/visits/${visit.body.id}/activities`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body).toEqual([activity.body]));

    await request(api()).post(`/studies/${study.body.id}/visits`)
      .set('Authorization', bearer(researcherToken)).send({ name: 'Visita repetida', order: 1 }).expect(409);
    await request(api()).post(`/studies/${study.body.id}/visits`)
      .set('Authorization', bearer(researcherToken)).send({ name: 'Visita sem ordem' }).expect(400);
    await request(api()).post(`/studies/${otherStudy.body.id}/visits/${visit.body.id}/activities`)
      .set('Authorization', bearer(otherResearcherToken)).send({ name: 'Atividade indevida', type: 'Exame' }).expect(404);
    await request(api()).get(`/studies/${study.body.id}/visits`)
      .set('Authorization', bearer(otherResearcherToken)).expect(403);
  });

  it('persiste estados do estudo e permite somente transições sequenciais', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo com estados' }).expect(201);
    expect(study.body.status).toBe('planejamento');

    await request(api()).patch(`/studies/${study.body.id}/status`)
      .set('Authorization', bearer(researcherToken)).send({ status: 'execução' }).expect(400);
    await request(api()).patch(`/studies/${study.body.id}/status`)
      .set('Authorization', bearer(researcherToken)).send({ status: 'desconhecido' }).expect(400);

    for (const status of ['recrutamento', 'execução', 'encerrado']) {
      await request(api()).patch(`/studies/${study.body.id}/status`)
        .set('Authorization', bearer(researcherToken)).send({ status }).expect(200)
        .expect(({ body }) => expect(body.status).toBe(status));
    }

    await request(api()).patch(`/studies/${study.body.id}/status`)
      .set('Authorization', bearer(researcherToken)).send({ status: 'planejamento' }).expect(400);
    await request(api()).patch(`/studies/${study.body.id}`)
      .set('Authorization', bearer(researcherToken)).send({ title: 'Alteração após encerramento' }).expect(400);
    await request(api()).get(`/studies/${study.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body.status).toBe('encerrado'));
  });

  it('cadastra e consulta candidatos vinculados a um estudo próprio', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo com candidatos' }).expect(201);

    const created = await request(api()).post(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: '  Lucas Martins  ', email: 'lucas@example.test' })
      .expect(201);
    expect(created.body).toMatchObject({
      studyId: study.body.id,
      name: 'Lucas Martins',
      email: 'lucas@example.test',
      status: 'Em avaliação',
    });

    await request(api()).post(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken)).send({ email: 'lucas@example.test' }).expect(400);

    await request(api()).get(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body).toEqual([created.body]));

    await request(api()).post('/studies/00000000-0000-4000-8000-000000000099/candidates')
      .set('Authorization', bearer(researcherToken)).send({ name: 'Estudo inexistente' }).expect(404);
    await request(api()).get(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(otherResearcherToken)).expect(403);
  });

  it('avalia os critérios do candidato e persiste elegibilidade ou inelegibilidade', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo para elegibilidade' }).expect(201);
    const otherStudy = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Outro estudo para critérios' }).expect(201);

    const inclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter 18 anos ou mais.' }).expect(201);
    const exclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Exclusão', description: 'Possuir contraindicação.' }).expect(201);
    const foreignCriterion = await request(api()).post(`/studies/${otherStudy.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Critério de outro estudo.' }).expect(201);
    const candidate = await request(api()).post(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken)).send({ name: 'Pessoa elegível' }).expect(201);

    const assessmentInput = {
      evaluations: [
        { criterionId: inclusion.body.id, result: 'Atende' },
        { criterionId: exclusion.body.id, result: 'Não atende' },
      ],
    };
    const assessment = await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken)).send(assessmentInput).expect(201);
    expect(assessment.body).toMatchObject({
      candidateId: candidate.body.id,
      studyId: study.body.id,
      status: 'Elegível',
    });
    expect(assessment.body.evaluations).toHaveLength(2);

    await request(api()).get(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'Elegível', evaluations: assessment.body.evaluations }));

    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [
        { criterionId: inclusion.body.id, result: 'Não atende' },
        { criterionId: exclusion.body.id, result: 'Não atende' },
      ] })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('Inelegível'));

    const pendingAssessment = await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [
        { criterionId: inclusion.body.id, result: 'Atende' },
        { criterionId: exclusion.body.id, result: 'Pendente', observation: '  Aguardando confirmação.  ' },
      ] })
      .expect(201);
    expect(pendingAssessment.body.status).toBe('Em avaliação');
    expect(pendingAssessment.body.evaluations).toHaveLength(2);
    expect(pendingAssessment.body.evaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({ criterionId: exclusion.body.id, result: 'Pendente', observation: 'Aguardando confirmação.' }),
    ]));

    await request(api())
      .get(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('Em avaliação');
        expect(body.evaluations).toHaveLength(2);
        expect(body.evaluations).toEqual(expect.arrayContaining([
          expect.objectContaining({ criterionId: inclusion.body.id, result: 'Atende' }),
          expect.objectContaining({ criterionId: exclusion.body.id, result: 'Pendente', observation: 'Aguardando confirmação.' }),
        ]));
      });

    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [
        { criterionId: inclusion.body.id, result: 'Atende' },
        { criterionId: inclusion.body.id, result: 'Atende' },
      ] })
      .expect(400);

    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [
        { criterionId: inclusion.body.id, result: 'Atende' },
        { criterionId: foreignCriterion.body.id, result: 'Atende' },
      ] })
      .expect(400);

    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [{ criterionId: inclusion.body.id, result: 'Atende' }] })
      .expect(400);

    await request(api())
      .get(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('Em avaliação');
        expect(body.evaluations).toHaveLength(2);
      });
  });

  it('registra consentimento e inclui apenas candidatos aptos, respeitando o limite de vagas', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'Estudo de inclusão', participantLimit: 1 })
      .expect(201);
    const database = fixture.app.get(DatabaseService);

    const inclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter 18 anos ou mais.' })
      .expect(201);
    const exclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Exclusão', description: 'Possuir contraindicação.' })
      .expect(201);

    async function createCandidate(name: string) {
      return (await request(api()).post(`/studies/${study.body.id}/candidates`)
        .set('Authorization', bearer(researcherToken))
        .send({ name })
        .expect(201)).body;
    }

    async function assessCandidate(candidateId: string, inclusionResult: 'Atende' | 'Não atende') {
      return request(api())
        .post(`/studies/${study.body.id}/candidates/${candidateId}/eligibility-assessments`)
        .set('Authorization', bearer(researcherToken))
        .send({
          evaluations: [
            { criterionId: inclusion.body.id, result: inclusionResult },
            { criterionId: exclusion.body.id, result: 'Não atende' },
          ],
        })
        .expect(201);
    }

    async function registerConsent(candidateId: string, status: 'Registrado' | 'Recusado') {
      return request(api())
        .post(`/studies/${study.body.id}/candidates/${candidateId}/consents`)
        .set('Authorization', bearer(researcherToken))
        .send({ status, termVersion: 'simulado-v1' })
        .expect(201);
    }

    const eligibleWithoutConsent = await createCandidate('Elegível sem consentimento');
    const consentPath = `/studies/${study.body.id}/candidates/${eligibleWithoutConsent.id}/consents`;
    const inclusionPath = `/studies/${study.body.id}/candidates/${eligibleWithoutConsent.id}/include`;
    await request(api()).get(consentPath).expect(401);
    await request(api()).post(consentPath)
      .set('Authorization', bearer(otherResearcherToken))
      .send({ status: 'Registrado', termVersion: 'simulado-v1' })
      .expect(403);
    await request(api()).post(inclusionPath)
      .set('Authorization', bearer(otherResearcherToken))
      .expect(403);
    await request(api()).post(consentPath)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'Concedido', termVersion: 'simulado-v1' })
      .expect(400);
    await request(api()).get(consentPath)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => expect(body.status).toBeNull());

    const assessment = await assessCandidate(eligibleWithoutConsent.id, 'Atende');
    expect(assessment.body.status).toBe('Elegível');
    await request(api())
      .post(inclusionPath)
      .set('Authorization', bearer(researcherToken))
      .expect(400);

    await registerConsent(eligibleWithoutConsent.id, 'Recusado');
    const refusedInclusion = await request(api())
      .post(inclusionPath)
      .set('Authorization', bearer(researcherToken))
      .expect(400);
    expect(refusedInclusion.body.message).toBe(
      'Consentimento ausente ou não concedido: registre o consentimento antes da inclusão.',
    );

    const persistedState = await database.query<{
      candidateStatus: string;
      participantsLinked: number;
      activeParticipations: number;
      latestConsent: string;
    }>(
      `SELECT
         c.status_recrutamento AS "candidateStatus",
         e.participantes_vinculados AS "participantsLinked",
         (SELECT count(*)::int
          FROM participacoes_estudo p
          WHERE p.id_candidato = c.id_candidato AND p.status = 'Ativo') AS "activeParticipations",
         (SELECT consent.status
          FROM consentimentos consent
          WHERE consent.id_candidato = c.id_candidato
          ORDER BY consent.registrado_em DESC, consent.id_consentimento DESC
          LIMIT 1) AS "latestConsent"
       FROM candidatos c
       JOIN estudos e ON e.id_estudo = c.id_estudo
       WHERE c.id_estudo = $1 AND c.id_candidato = $2`,
      [study.body.id, eligibleWithoutConsent.id],
    );
    expect(persistedState.rows).toEqual([{
      candidateStatus: 'Elegível',
      participantsLinked: 0,
      activeParticipations: 0,
      latestConsent: 'Recusado',
    }]);

    await request(api())
      .get(`/studies/${study.body.id}/candidates/${eligibleWithoutConsent.id}/consents`)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({
        candidateId: eligibleWithoutConsent.id,
        studyId: study.body.id,
        status: 'Recusado',
        registrarId: researcher.id,
      }));

    await registerConsent(eligibleWithoutConsent.id, 'Registrado');
    await request(api())
      .get(`/studies/${study.body.id}/candidates/${eligibleWithoutConsent.id}/consents`)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('Registrado'));

    const included = await request(api())
      .post(`/studies/${study.body.id}/candidates/${eligibleWithoutConsent.id}/include`)
      .set('Authorization', bearer(researcherToken))
      .expect(201);
    expect(included.body).toMatchObject({
      candidateId: eligibleWithoutConsent.id,
      studyId: study.body.id,
      participationStatus: 'Ativo',
      participantsLinked: 1,
      participantLimit: 1,
    });

    await request(api())
      .post(inclusionPath)
      .set('Authorization', bearer(researcherToken))
      .expect(400);

    const ineligibleCandidate = await createCandidate('Candidato inelegível');
    await assessCandidate(ineligibleCandidate.id, 'Não atende');
    await registerConsent(ineligibleCandidate.id, 'Registrado');
    await request(api())
      .post(`/studies/${study.body.id}/candidates/${ineligibleCandidate.id}/include`)
      .set('Authorization', bearer(researcherToken))
      .expect(400);

    const candidateAtCapacity = await createCandidate('Candidato sem vaga');
    await assessCandidate(candidateAtCapacity.id, 'Atende');
    await registerConsent(candidateAtCapacity.id, 'Registrado');
    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidateAtCapacity.id}/include`)
      .set('Authorization', bearer(researcherToken))
      .expect(400);

    await request(api())
      .get(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: eligibleWithoutConsent.id, status: 'Incluído' }),
          expect.objectContaining({ id: ineligibleCandidate.id, status: 'Inelegível' }),
          expect.objectContaining({ id: candidateAtCapacity.id, status: 'Elegível' }),
        ]));
      });
    await request(api())
      .get(`/studies/${study.body.id}`)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => expect(body.participantsLinked).toBe(1));
  }, 20_000);

  it('inclui somente um candidato quando duas requisições disputam a última vaga', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'Estudo com inclusão concorrente', participantLimit: 1 })
      .expect(201);
    const database = fixture.app.get(DatabaseService);

    const inclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter 18 anos ou mais.' })
      .expect(201);
    const exclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Exclusão', description: 'Possuir contraindicação.' })
      .expect(201);

    const candidates = await Promise.all(['Candidato concorrente A', 'Candidato concorrente B'].map(
      async (name) => {
        const candidate = await request(api()).post(`/studies/${study.body.id}/candidates`)
          .set('Authorization', bearer(researcherToken))
          .send({ name })
          .expect(201);

        await request(api())
          .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
          .set('Authorization', bearer(researcherToken))
          .send({
            evaluations: [
              { criterionId: inclusion.body.id, result: 'Atende' },
              { criterionId: exclusion.body.id, result: 'Não atende' },
            ],
          })
          .expect(201)
          .expect(({ body }) => expect(body.status).toBe('Elegível'));

        await request(api())
          .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/consents`)
          .set('Authorization', bearer(researcherToken))
          .send({ status: 'Registrado', termVersion: 'simulado-v1' })
          .expect(201);

        return candidate.body.id as string;
      },
    ));

    const responses = await Promise.all(candidates.map((candidateId) =>
      request(api())
        .post(`/studies/${study.body.id}/candidates/${candidateId}/include`)
        .set('Authorization', bearer(researcherToken)),
    ));

    const successfulResponses = responses.filter(({ status }) => status === 201);
    const rejectedResponses = responses.filter(({ status }) => status === 400);
    expect(successfulResponses).toHaveLength(1);
    expect(rejectedResponses).toHaveLength(1);
    expect(rejectedResponses[0]?.body.message).toBe(
      'Limite de vagas atingido: não há vagas disponíveis neste estudo.',
    );

    const winnerId = successfulResponses[0]?.body.candidateId as string;
    const loserId = candidates.find((candidateId) => candidateId !== winnerId);
    expect(loserId).toBeDefined();

    const studyState = await database.query<{
      participantsLinked: number;
      participantLimit: number;
      participationCount: number;
      activeParticipationCount: number;
    }>(
      `SELECT
         e.participantes_vinculados AS "participantsLinked",
         e.limite_participantes AS "participantLimit",
         count(p.id_participacao)::int AS "participationCount",
         count(p.id_participacao) FILTER (WHERE p.status = 'Ativo')::int AS "activeParticipationCount"
       FROM estudos e
       LEFT JOIN candidatos c ON c.id_estudo = e.id_estudo
       LEFT JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato
       WHERE e.id_estudo = $1
       GROUP BY e.id_estudo`,
      [study.body.id],
    );
    expect(studyState.rows).toEqual([{
      participantsLinked: 1,
      participantLimit: 1,
      participationCount: 1,
      activeParticipationCount: 1,
    }]);

    const candidateStates = await database.query<{
      candidateId: string;
      status: string;
      activeParticipations: number;
    }>(
      `SELECT
         c.id_candidato::text AS "candidateId",
         c.status_recrutamento AS status,
         count(p.id_participacao) FILTER (WHERE p.status = 'Ativo')::int AS "activeParticipations"
       FROM candidatos c
       LEFT JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato
       WHERE c.id_estudo = $1 AND c.id_candidato = ANY($2::uuid[])
       GROUP BY c.id_candidato`,
      [study.body.id, candidates],
    );
    expect(candidateStates.rows).toEqual(expect.arrayContaining([
      { candidateId: winnerId, status: 'Incluído', activeParticipations: 1 },
      { candidateId: loserId, status: 'Elegível', activeParticipations: 0 },
    ]));
  }, 20_000);

  it('reverte participação, candidato e contador quando a atualização final falha', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'Estudo com rollback de inclusão', participantLimit: 1 })
      .expect(201);
    const database = fixture.app.get(DatabaseService);

    const inclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter 18 anos ou mais.' })
      .expect(201);
    const candidate = await request(api()).post(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Candidato para rollback' })
      .expect(201);
    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [{ criterionId: inclusion.body.id, result: 'Atende' }] })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('Elegível'));
    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/consents`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'Registrado', termVersion: 'simulado-v1' })
      .expect(201);

    const constraintName = `e2e_inclusion_failure_${study.body.id.replaceAll('-', '')}`;
    await database.query(
      `ALTER TABLE estudos
       ADD CONSTRAINT "${constraintName}"
       CHECK (id_estudo <> '${study.body.id}'::uuid OR participantes_vinculados = 0)`,
    );

    const failedInclusion = await (async () => {
      try {
        return await request(api())
          .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/include`)
          .set('Authorization', bearer(researcherToken));
      } finally {
        await database.query(`ALTER TABLE estudos DROP CONSTRAINT "${constraintName}"`);
      }
    })();

    expect(failedInclusion.status).toBe(500);
    const persistedState = await database.query<{
      candidateStatus: string;
      participantsLinked: number;
      participationCount: number;
      activeParticipationCount: number;
      consentCount: number;
      latestConsent: string;
    }>(
      `SELECT
         c.status_recrutamento AS "candidateStatus",
         e.participantes_vinculados AS "participantsLinked",
         (SELECT count(*)::int
          FROM participacoes_estudo p
          WHERE p.id_candidato = c.id_candidato) AS "participationCount",
         (SELECT count(*)::int
          FROM participacoes_estudo p
          WHERE p.id_candidato = c.id_candidato AND p.status = 'Ativo') AS "activeParticipationCount",
         (SELECT count(*)::int
          FROM consentimentos consent
          WHERE consent.id_candidato = c.id_candidato) AS "consentCount",
         (SELECT consent.status
          FROM consentimentos consent
          WHERE consent.id_candidato = c.id_candidato
          ORDER BY consent.registrado_em DESC, consent.id_consentimento DESC
          LIMIT 1) AS "latestConsent"
       FROM candidatos c
       JOIN estudos e ON e.id_estudo = c.id_estudo
       WHERE c.id_estudo = $1 AND c.id_candidato = $2`,
      [study.body.id, candidate.body.id],
    );
    expect(persistedState.rows).toEqual([{
      candidateStatus: 'Elegível',
      participantsLinked: 0,
      participationCount: 0,
      activeParticipationCount: 0,
      consentCount: 1,
      latestConsent: 'Registrado',
    }]);
  });

  it('rejeita a inclusão de candidato com avaliação pendente', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'Estudo com elegibilidade pendente', participantLimit: 1 })
      .expect(201);
    const database = fixture.app.get(DatabaseService);

    const inclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter 18 anos ou mais.' })
      .expect(201);
    const exclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Exclusão', description: 'Possuir contraindicação.' })
      .expect(201);
    const candidate = await request(api()).post(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Candidato com avaliação pendente' })
      .expect(201);

    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({
        evaluations: [
          { criterionId: inclusion.body.id, result: 'Atende' },
          { criterionId: exclusion.body.id, result: 'Pendente' },
        ],
      })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('Em avaliação'));
    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/consents`)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'Registrado', termVersion: 'simulado-v1' })
      .expect(201);

    const refusedInclusion = await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/include`)
      .set('Authorization', bearer(researcherToken))
      .expect(400);
    expect(refusedInclusion.body.message).toBe(
      'Candidato inelegível: avalie e aprove todos os critérios antes da inclusão.',
    );

    const persistedState = await database.query<{
      candidateStatus: string;
      participantsLinked: number;
      activeParticipations: number;
    }>(
      `SELECT
         c.status_recrutamento AS "candidateStatus",
         e.participantes_vinculados AS "participantsLinked",
         (SELECT count(*)::int
          FROM participacoes_estudo p
          WHERE p.id_candidato = c.id_candidato AND p.status = 'Ativo') AS "activeParticipations"
       FROM candidatos c
       JOIN estudos e ON e.id_estudo = c.id_estudo
       WHERE c.id_estudo = $1 AND c.id_candidato = $2`,
      [study.body.id, candidate.body.id],
    );
    expect(persistedState.rows).toEqual([{
      candidateStatus: 'Em avaliação',
      participantsLinked: 0,
      activeParticipations: 0,
    }]);
  });

  it('rejeita a inclusão quando o consentimento mais recente foi revogado', async () => {
    const study = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'Estudo com consentimento revogado', participantLimit: 1 })
      .expect(201);
    const database = fixture.app.get(DatabaseService);

    const inclusion = await request(api()).post(`/studies/${study.body.id}/criteria`)
      .set('Authorization', bearer(researcherToken))
      .send({ type: 'Inclusão', description: 'Ter 18 anos ou mais.' })
      .expect(201);
    const candidate = await request(api()).post(`/studies/${study.body.id}/candidates`)
      .set('Authorization', bearer(researcherToken))
      .send({ name: 'Candidato com consentimento revogado' })
      .expect(201);
    await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/eligibility-assessments`)
      .set('Authorization', bearer(researcherToken))
      .send({ evaluations: [{ criterionId: inclusion.body.id, result: 'Atende' }] })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('Elegível'));

    const consentPath = `/studies/${study.body.id}/candidates/${candidate.body.id}/consents`;
    await request(api())
      .post(consentPath)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'Registrado', termVersion: 'simulado-v1' })
      .expect(201);
    await database.query(
      `UPDATE consentimentos
       SET registrado_em = now() - interval '1 minute'
       WHERE id_candidato = $1 AND status = 'Registrado'`,
      [candidate.body.id],
    );
    await request(api())
      .post(consentPath)
      .set('Authorization', bearer(researcherToken))
      .send({ status: 'Revogado', termVersion: 'simulado-v1' })
      .expect(201);

    await request(api())
      .get(consentPath)
      .set('Authorization', bearer(researcherToken))
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('Revogado'));

    const refusedInclusion = await request(api())
      .post(`/studies/${study.body.id}/candidates/${candidate.body.id}/include`)
      .set('Authorization', bearer(researcherToken))
      .expect(400);
    expect(refusedInclusion.body.message).toBe(
      'Consentimento ausente ou não concedido: registre o consentimento antes da inclusão.',
    );

    const persistedState = await database.query<{
      candidateStatus: string;
      participantsLinked: number;
      activeParticipations: number;
      consentCount: number;
      latestConsent: string;
    }>(
      `SELECT
         c.status_recrutamento AS "candidateStatus",
         e.participantes_vinculados AS "participantsLinked",
         (SELECT count(*)::int
          FROM participacoes_estudo p
          WHERE p.id_candidato = c.id_candidato AND p.status = 'Ativo') AS "activeParticipations",
         (SELECT count(*)::int
          FROM consentimentos consent
          WHERE consent.id_candidato = c.id_candidato) AS "consentCount",
         (SELECT consent.status
          FROM consentimentos consent
          WHERE consent.id_candidato = c.id_candidato
          ORDER BY consent.registrado_em DESC, consent.id_consentimento DESC
          LIMIT 1) AS "latestConsent"
       FROM candidatos c
       JOIN estudos e ON e.id_estudo = c.id_estudo
       WHERE c.id_estudo = $1 AND c.id_candidato = $2`,
      [study.body.id, candidate.body.id],
    );
    expect(persistedState.rows).toEqual([{
      candidateStatus: 'Elegível',
      participantsLinked: 0,
      activeParticipations: 0,
      consentCount: 2,
      latestConsent: 'Revogado',
    }]);
  });

  it('persiste os estudos após reiniciar a aplicação', async () => {
    const created = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo persistente' }).expect(201);
    await fixture.app.close();
    fixture.app = await fixture.open();
    await request(api()).get(`/studies/${created.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body.title).toBe('Estudo persistente'));
  });

  
it('permite ao Coordenador consultar somente estudos na fase Recrutamento, com ID e título', async () => {
  const path = '/studies/disponiveis-recrutamento';

  await request(api())
    .get(path)
    .set('Authorization', bearer(coordinatorToken))
    .expect(200)
    .expect(({ body }) => expect(body).toEqual([]));

  let recruitingStudy: { id: string; title: string } | undefined;
  const database = fixture.app.get(DatabaseService);

  const phases = [
    'planejamento',
    'recrutamento',
    'execução',
    'encerrado',
  ];

  for (const phase of phases) {
    const created = await request(api())
      .post('/studies')
      .set('Authorization', bearer(researcherToken))
      .send({
        ...sample,
        title: `Estudo na fase ${phase}`,
        startDate: '2020-01-01',
      })
      .expect(201);

    // Fixtures apenas no schema descartável do teste.
    await database.query(
      'UPDATE estudos SET status = $1 WHERE id_estudo = $2',
      [phase, created.body.id],
    );

    expect(created.body.status).toBe('planejamento');

    if (phase === 'recrutamento') {
      recruitingStudy = {
        id: created.body.id,
        title: created.body.title,
      };
    }
  }

  await request(api())
    .get(path)
    .set('Authorization', bearer(coordinatorToken))
    .expect(200)
    .expect(({ body }) => {
      expect(body).toEqual([recruitingStudy]);
    });
});


  it('mantém a nova consulta restrita ao Coordenador e não libera as demais operações', async () => {
    const path = '/studies/disponiveis-recrutamento';
    await request(api()).get(path).expect(401);
    for (const token of [adminToken, researcherToken, participantToken]) {
      await request(api()).get(path).set('Authorization', bearer(token)).expect(403);
    }
    const created = await request(api()).post('/studies').set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'Estudo protegido do Coordenador' }).expect(201);
    await request(api()).get('/studies').set('Authorization', bearer(coordinatorToken)).expect(403);
    await request(api()).get(`/studies/${created.body.id}`).set('Authorization', bearer(coordinatorToken)).expect(403);
    await request(api()).post('/studies').set('Authorization', bearer(coordinatorToken)).send(sample).expect(403);
    await request(api()).patch(`/studies/${created.body.id}`).set('Authorization', bearer(coordinatorToken))
      .send({ title: 'Alteração indevida' }).expect(403);
    await request(api()).get(`/studies/${created.body.id}`).set('Authorization', bearer(researcherToken))
      .expect(200).expect(({ body }) => expect(body.title).toBe('Estudo protegido do Coordenador'));
  });
});
