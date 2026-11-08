import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { PublicUser } from '../src/users/user.types.js';
import { StudyStatus } from '../src/studies/study.types.js';

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
    await request(api()).get(path).set('Authorization', bearer(coordinatorToken))
      .expect(200).expect(({ body }) => expect(body).toEqual([]));

    let recruitingStudy: { id: string; title: string } | undefined;
    const database = fixture.app.get(DatabaseService);
    for (const phase of Object.values(StudyStatus)) {
      const created = await request(api()).post('/studies').set('Authorization', bearer(researcherToken))
        .send({ ...sample, title: `Estudo na fase ${phase}`, startDate: '2020-01-01' }).expect(201);
      // Fixtures apenas no schema descartável do teste; não reclassifica dados de desenvolvimento.
      await database.query('UPDATE estudos SET status = $1 WHERE id_estudo = $2', [phase, created.body.id]);
      expect(created.body.status).toBe(StudyStatus.Planejamento);
      if (phase === StudyStatus.Recrutamento) recruitingStudy = { id: created.body.id, title: created.body.title };
    }
    await request(api()).get(path).set('Authorization', bearer(coordinatorToken))
      .expect(200).expect(({ body }) => expect(body).toEqual([recruitingStudy]));
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

  it('RF08: Coordenador cadastra e lista em recrutamento sem vínculo individual, preservando isolamento do Pesquisador', async () => {
    const registered: { studyId: string; candidateId: string }[] = [];
    for (const [index, ownerToken] of [researcherToken, otherResearcherToken].entries()) {
      const created = await request(api()).post('/studies').set('Authorization', bearer(ownerToken))
        .send({ ...sample, title: `RF08 recrutamento ${index}` }).expect(201);
      const studyPath = `/studies/${created.body.id}`;
      await request(api()).patch(`${studyPath}/status`).set('Authorization', bearer(ownerToken))
        .send({ status: StudyStatus.Recrutamento }).expect(200);
      const candidate = await request(api()).post(`${studyPath}/candidates`)
        .set('Authorization', bearer(coordinatorToken)).send({ name: `Candidato RF08 ${index}` }).expect(201);
      registered.push({ studyId: created.body.id, candidateId: candidate.body.id });
      for (const token of [coordinatorToken, ownerToken]) {
        await request(api()).get(`${studyPath}/candidates`).set('Authorization', bearer(token))
          .expect(200).expect(({ body }) => expect(body).toEqual([candidate.body]));
      }
      const unauthorizedResearcher = index === 0 ? otherResearcherToken : researcherToken;
      for (const token of [unauthorizedResearcher, adminToken, participantToken]) {
        await request(api()).get(`${studyPath}/candidates`).set('Authorization', bearer(token)).expect(403);
        await request(api()).post(`${studyPath}/candidates`).set('Authorization', bearer(token))
          .send({ name: 'Não autorizado' }).expect(403);
      }
      await request(api()).get(`${studyPath}/candidates`).expect(401);
      await request(api()).post(`${studyPath}/candidates`).send({ name: 'Sem sessão' }).expect(401);
    }
    for (const item of registered) {
      await request(api()).get(`/studies/${item.studyId}/candidates`).set('Authorization', bearer(coordinatorToken))
        .expect(200).expect(({ body }) => {
          expect(body).toHaveLength(1);
          expect(body[0]).toMatchObject({ id: item.candidateId, studyId: item.studyId });
        });
    }
  });

  it('RF08: nega ao Coordenador fases fora de recrutamento e preserva tratamento de encerramento para o proprietário', async () => {
    const created = await request(api()).post('/studies').set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'RF08 fases protegidas' }).expect(201);
    const studyPath = `/studies/${created.body.id}`;
    for (const status of Object.values(StudyStatus)) {
      if (status !== StudyStatus.Planejamento) {
        await request(api()).patch(`${studyPath}/status`).set('Authorization', bearer(researcherToken)).send({ status }).expect(200);
      }
      const expected = status === StudyStatus.Recrutamento;
      await request(api()).get(`${studyPath}/candidates`).set('Authorization', bearer(coordinatorToken)).expect(expected ? 200 : 403);
      await request(api()).post(`${studyPath}/candidates`).set('Authorization', bearer(coordinatorToken))
        .send({ name: 'Candidato de recrutamento' }).expect(expected ? 201 : 403);
    }
    await request(api()).post(`${studyPath}/candidates`).set('Authorization', bearer(researcherToken))
      .send({ name: 'Estudo encerrado' }).expect(400);
    await request(api()).get(`${studyPath}/candidates`).set('Authorization', bearer(researcherToken))
      .expect(200).expect(({ body }) => expect(body).toHaveLength(1));
  });

  it('RF09 preserva consentimento e inclusão restritos ao Pesquisador', async () => {
    const created = await request(api()).post('/studies').set('Authorization', bearer(researcherToken))
      .send({ ...sample, title: 'RF08 permissões preservadas' }).expect(201);
    const studyPath = `/studies/${created.body.id}`;
    await request(api()).patch(`${studyPath}/status`).set('Authorization', bearer(researcherToken))
      .send({ status: StudyStatus.Recrutamento }).expect(200);
    const candidate = await request(api()).post(`${studyPath}/candidates`).set('Authorization', bearer(coordinatorToken))
      .send({ name: 'Candidato protegido' }).expect(201);
    const candidatePath = `${studyPath}/candidates/${candidate.body.id}`;
    for (const endpoint of ['consents']) {
      await request(api()).get(`${candidatePath}/${endpoint}`).set('Authorization', bearer(coordinatorToken)).expect(403);
      await request(api()).post(`${candidatePath}/${endpoint}`).set('Authorization', bearer(coordinatorToken)).send({}).expect(403);
    }
    await request(api()).post(`${candidatePath}/include`).set('Authorization', bearer(coordinatorToken)).expect(403);
  });
});
