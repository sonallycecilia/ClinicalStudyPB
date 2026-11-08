import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { PublicUser, UserRole } from '../src/users/user.types.js';

describe('RF09 — autorização e persistência PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let owner: PublicUser;
  let coordinator: PublicUser;
  let ownerToken: string;
  let otherToken: string;
  let coordinatorToken: string;
  let inactiveToken: string;
  let adminToken: string;
  let participantToken: string;
  let studyPath: string;
  let assessmentPath: string;
  let inclusionId: string;
  let exclusionId: string;
  let inactiveId: string;
  let candidateId: string;
  const api = () => fixture.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const payload = (inclusion = 'Atende', exclusion = 'Não atende') => ({ evaluations: [
    { criterionId: inclusionId, result: inclusion, observation: 'Observação persistida RF09' },
    { criterionId: exclusionId, result: exclusion },
  ] });

  beforeAll(async () => {
    fixture = await databaseTestApp();
    async function account(email: string, role: UserRole) {
      const user = await fixture.app.get(UsersService).create({ name: role, email, role, phone: '83999990000', password: 'Senha123!' });
      const login = await request(api()).post('/auth/login').send({ email, password: 'Senha123!' }).expect(201);
      return { user, token: login.body.accessToken as string };
    }
    ({ user: owner, token: ownerToken } = await account('owner@rf09.test', 'Pesquisador'));
    ({ token: otherToken } = await account('other@rf09.test', 'Pesquisador'));
    ({ user: coordinator, token: coordinatorToken } = await account('coordinator@rf09.test', 'Coordenador'));
    ({ token: adminToken } = await account('admin@rf09.test', 'Administrador'));
    ({ token: participantToken } = await account('participant@rf09.test', 'Participante'));
    const inactive = await account('inactive@rf09.test', 'Coordenador');
    inactiveToken = inactive.token;
    await fixture.app.get(DatabaseService).query("UPDATE usuarios SET status = 'Inativo' WHERE id_usuario = $1", [inactive.user.id]);
  });
  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });

  beforeEach(async () => {
    const study = await request(api()).post('/studies').set('Authorization', auth(ownerToken)).send({
      title: 'Estudo RF09', objective: 'Validar integração e persistência RF09', startDate: '2099-01-01', endDate: '2099-12-31',
      participantLimit: 5, participantsLinked: 0,
    }).expect(201);
    studyPath = `/studies/${study.body.id}`;
    for (const [type, description, active] of [['Inclusão', 'Idade mínima', true], ['Exclusão', 'Impedimento', true], ['Inclusão', 'Inativo', false]] as const) {
      const criterion = await request(api()).post(`${studyPath}/criteria`).set('Authorization', auth(ownerToken))
        .send({ type, description, active }).expect(201);
      if (!active) inactiveId = criterion.body.id;
      else if (type === 'Inclusão') inclusionId = criterion.body.id;
      else exclusionId = criterion.body.id;
    }
    await request(api()).patch(`${studyPath}/status`).set('Authorization', auth(ownerToken)).send({ status: 'recrutamento' }).expect(200);
    const candidate = await request(api()).post(`${studyPath}/candidates`).set('Authorization', auth(coordinatorToken))
      .send({ name: 'Candidato RF09' }).expect(201);
    candidateId = candidate.body.id;
    assessmentPath = `${studyPath}/candidates/${candidateId}/eligibility-assessments`;
  });

  it('carrega critérios, distingue ausência de avaliação, grava os três resultados e comprova banco, listagem e reconsulta após reiniciar a API', async () => {
    await request(api()).get(`${studyPath}/criteria`).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => expect(body.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([inclusionId, exclusionId, inactiveId])));
    await request(api()).get(assessmentPath).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => expect(body.evaluations).toEqual([]));
    for (const [inclusion, exclusion, status] of [
      ['Atende', 'Não atende', 'Elegível'], ['Não atende', 'Não atende', 'Inelegível'],
      ['Atende', 'Atende', 'Inelegível'], ['Pendente', 'Não atende', 'Em avaliação'],
    ]) {
      const saved = await request(api()).post(assessmentPath).set('Authorization', auth(coordinatorToken)).send(payload(inclusion, exclusion)).expect(201);
      expect(saved.body.status).toBe(status);
      expect(saved.body.evaluations).toHaveLength(2);
      expect(saved.body.evaluations).toEqual(expect.arrayContaining([expect.objectContaining({
        criterionId: inclusionId, observation: 'Observação persistida RF09', evaluatorId: coordinator.id, evaluatedAt: expect.any(String),
      })]));
      await request(api()).get(assessmentPath).set('Authorization', auth(ownerToken)).expect(200)
        .expect(({ body }) => expect(body).toEqual(saved.body));
      await request(api()).get(`${studyPath}/candidates`).set('Authorization', auth(coordinatorToken)).expect(200)
        .expect(({ body }) => expect(body[0].status).toBe(status));
    }
    const rows = await fixture.app.get(DatabaseService).query(
      'SELECT id_avaliador::text, resultado, observacao FROM avaliacoes_elegibilidade WHERE id_candidato = $1', [candidateId]);
    expect(rows.rows).toHaveLength(2); // upsert, sem duplicar as respostas
    expect(rows.rows.every((row) => row.id_avaliador === coordinator.id)).toBe(true);
    await fixture.app.close();
    fixture.app = await fixture.open();
    await request(api()).get(assessmentPath).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('Em avaliação');
        expect(body.evaluations).toEqual(expect.arrayContaining([expect.objectContaining({ result: 'Pendente', observation: 'Observação persistida RF09' })]));
      });
  });

  it('preserva propriedade e rejeita outros perfis, sessão ausente e Coordenador inativo nos três endpoints', async () => {
    for (const [token, expected] of [[otherToken, 403], [adminToken, 403], [participantToken, 403], [inactiveToken, 401], ['', 401]] as const) {
      await request(api()).get(`${studyPath}/criteria`).set('Authorization', auth(token)).expect(expected);
      await request(api()).get(assessmentPath).set('Authorization', auth(token)).expect(expected);
      await request(api()).post(assessmentPath).set('Authorization', auth(token)).send(payload()).expect(expected);
    }
  });

  it('preserva edição de critérios, consulta individual, consentimento e inclusão restritos ao Pesquisador', async () => {
    await request(api()).get(`${studyPath}/criteria/${inclusionId}`).set('Authorization', auth(coordinatorToken)).expect(403);
    await request(api()).post(`${studyPath}/criteria`).set('Authorization', auth(coordinatorToken)).send({ type: 'Inclusão', description: 'Novo' }).expect(403);
    for (const body of [{ description: 'Alterado' }, { active: false }]) {
      await request(api()).patch(`${studyPath}/criteria/${inclusionId}`).set('Authorization', auth(coordinatorToken)).send(body).expect(403);
    }
    for (const method of ['get', 'post'] as const) {
      await request(api())[method](`${studyPath}/candidates/${candidateId}/consents`).set('Authorization', auth(coordinatorToken)).send({}).expect(403);
    }
    await request(api()).post(`${studyPath}/candidates/${candidateId}/include`).set('Authorization', auth(coordinatorToken)).expect(403);
  });

  it('limita Coordenador a recrutamento e preserva consulta do proprietário e bloqueio de gravação no encerramento', async () => {
    const studyId = studyPath.split('/')[2];
    for (const status of ['planejamento', 'execução', 'encerrado']) {
      // Fixture controlada: evita depender de outra task para construir cada estado.
      await fixture.app.get(DatabaseService).query('UPDATE estudos SET status = $2 WHERE id_estudo = $1', [studyId, status]);
      await request(api()).get(`${studyPath}/criteria`).set('Authorization', auth(coordinatorToken)).expect(403);
      await request(api()).get(assessmentPath).set('Authorization', auth(coordinatorToken)).expect(403);
      await request(api()).post(assessmentPath).set('Authorization', auth(coordinatorToken)).send(payload()).expect(403);
      await request(api()).get(assessmentPath).set('Authorization', auth(ownerToken)).expect(200);
      const saved = await request(api()).post(assessmentPath).set('Authorization', auth(ownerToken)).send(payload()).expect(status === 'encerrado' ? 400 : 201);
      if (status !== 'encerrado') expect(saved.body.evaluations[0].evaluatorId).toBe(owner.id);
    }
  });

  it('rejeita respostas ausentes, duplicadas, critérios inativos e observação excessiva sem gravar parcialmente', async () => {
    for (const input of [
      { evaluations: [payload().evaluations[0]] },
      { evaluations: [payload().evaluations[0], payload().evaluations[0]] },
      { evaluations: [payload().evaluations[0], { criterionId: inactiveId, result: 'Atende' }] },
      { evaluations: [{ ...payload().evaluations[0], observation: 'a'.repeat(2001) }, payload().evaluations[1]] },
      { ...payload(), status: 'Elegível' },
    ]) await request(api()).post(assessmentPath).set('Authorization', auth(coordinatorToken)).send(input).expect(400);
    await request(api()).get(assessmentPath).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => expect(body.evaluations).toEqual([]));
    await request(api()).patch(`${studyPath}/criteria/${inclusionId}`).set('Authorization', auth(ownerToken)).send({ active: false }).expect(200);
    await request(api()).post(assessmentPath).set('Authorization', auth(coordinatorToken)).send(payload()).expect(400);
    await request(api()).patch(`${studyPath}/criteria/${exclusionId}`).set('Authorization', auth(ownerToken)).send({ active: false }).expect(200);
    await request(api()).post(assessmentPath).set('Authorization', auth(coordinatorToken)).send(payload()).expect(400);
  });

  it('trata candidato inexistente, candidato de outro estudo e candidato incluído', async () => {
    const absent = `${studyPath}/candidates/00000000-0000-4000-8000-000000000099/eligibility-assessments`;
    for (const method of ['get', 'post'] as const) {
      await request(api())[method](absent).set('Authorization', auth(coordinatorToken)).send(payload()).expect(404);
    }
    const otherStudy = await request(api()).post('/studies').set('Authorization', auth(ownerToken)).send({
      title: 'Outro estudo', objective: 'Verificar isolamento dos candidatos', startDate: '2099-01-01', endDate: '2099-12-31', participantLimit: 5, participantsLinked: 0,
    }).expect(201);
    await request(api()).patch(`/studies/${otherStudy.body.id}/status`).set('Authorization', auth(ownerToken)).send({ status: 'recrutamento' }).expect(200);
    for (const method of ['get', 'post'] as const) {
      await request(api())[method](`/studies/${otherStudy.body.id}/candidates/${candidateId}/eligibility-assessments`)
        .set('Authorization', auth(coordinatorToken)).send(payload()).expect(404);
    }
    await fixture.app.get(DatabaseService).query("UPDATE candidatos SET status_recrutamento = 'Incluído' WHERE id_candidato = $1", [candidateId]);
    await request(api()).post(assessmentPath).set('Authorization', auth(coordinatorToken)).send(payload()).expect(400);
  });
});
