import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { UserRole } from '../src/users/user.types.js';

describe('RF11 — inclusão autorizada, transacional e concorrente no PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let ownerToken: string;
  let otherToken: string;
  let coordinatorToken: string;
  let inactiveToken: string;
  let adminToken: string;
  let participantToken: string;
  let studyId: string;
  let candidateId: string;
  let inclusionId: string;
  let exclusionId: string;
  const api = () => fixture.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const studyPath = () => `/studies/${studyId}`;
  const candidatePath = (id = candidateId) => `${studyPath()}/candidates/${id}`;
  const include = (token = coordinatorToken, id = candidateId) => request(api()).post(`${candidatePath(id)}/include`).set('Authorization', auth(token));
  const db = () => fixture.app.get(DatabaseService);
  const studyInput = { title: 'Estudo RF11', objective: 'Validar inclusão real e concorrência', startDate: '2099-01-01', endDate: '2099-12-31', participantLimit: 5, participantsLinked: 0 };
  const evaluations = (inc = 'Atende', exc = 'Não atende') => ({ evaluations: [
    { criterionId: inclusionId, result: inc }, { criterionId: exclusionId, result: exc },
  ] });
  async function evaluate(id = candidateId, inc = 'Atende', exc = 'Não atende') {
    await request(api()).post(`${candidatePath(id)}/eligibility-assessments`).set('Authorization', auth(coordinatorToken)).send(evaluations(inc, exc)).expect(201);
  }
  async function consent(status = 'Registrado', id = candidateId) {
    await request(api()).post(`${candidatePath(id)}/consents`).set('Authorization', auth(coordinatorToken)).send({ status, termVersion: 'termo-academico-v1' }).expect(201);
  }
  async function unchanged(status: string, count = 0) {
    const stored = await db().query('SELECT status_recrutamento AS status FROM candidatos WHERE id_candidato = $1', [candidateId]);
    expect(stored.rows[0]?.status).toBe(status);
    expect((await db().query('SELECT * FROM participacoes_estudo WHERE id_candidato = $1', [candidateId])).rows).toHaveLength(count);
    expect((await db().query('SELECT participantes_vinculados AS count FROM estudos WHERE id_estudo = $1', [studyId])).rows[0]?.count).toBe(count);
  }
  beforeAll(async () => {
    fixture = await databaseTestApp();
    async function account(email: string, role: UserRole) {
      const user = await fixture.app.get(UsersService).create({ name: role, email, role, phone: '83999990000', password: 'Senha123!' });
      const login = await request(api()).post('/auth/login').send({ email, password: 'Senha123!' }).expect(201);
      return { user, token: login.body.accessToken as string };
    }
    ({ token: ownerToken } = await account('owner@rf11.test', 'Pesquisador'));
    ({ token: otherToken } = await account('other@rf11.test', 'Pesquisador'));
    ({ token: coordinatorToken } = await account('coordinator@rf11.test', 'Coordenador'));
    ({ token: adminToken } = await account('admin@rf11.test', 'Administrador'));
    ({ token: participantToken } = await account('participant@rf11.test', 'Participante'));
    const inactive = await account('inactive@rf11.test', 'Coordenador');
    inactiveToken = inactive.token;
    await db().query("UPDATE usuarios SET status = 'Inativo' WHERE id_usuario = $1", [inactive.user.id]);
  });
  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });
  beforeEach(async () => {
    const study = await request(api()).post('/studies').set('Authorization', auth(ownerToken)).send(studyInput).expect(201);
    studyId = study.body.id;
    for (const type of ['Inclusão', 'Exclusão']) {
      const criterion = await request(api()).post(`${studyPath()}/criteria`).set('Authorization', auth(ownerToken)).send({ type, description: `Critério de ${type}` }).expect(201);
      if (type === 'Inclusão') inclusionId = criterion.body.id;
      else exclusionId = criterion.body.id;
    }
    await request(api()).patch(`${studyPath()}/status`).set('Authorization', auth(ownerToken)).send({ status: 'recrutamento' }).expect(200);
    const candidate = await request(api()).post(`${studyPath()}/candidates`).set('Authorization', auth(coordinatorToken)).send({ name: 'Candidato RF11' }).expect(201);
    candidateId = candidate.body.id;
  });

  it('inclui como Coordenador, retorna identidade válida, persiste, reconsulta após reiniciar e rejeita repetição', async () => {
    await evaluate();
    await consent();
    const result = await include().expect(201);
    expect(result.body).toEqual({ participationId: expect.any(String), candidateId, studyId, includedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), participationStatus: 'Ativo', participantsLinked: 1, participantLimit: 5 });
    await unchanged('Incluído', 1);
    expect((await db().query('SELECT id_participacao::text AS id FROM participacoes_estudo WHERE id_candidato = $1', [candidateId])).rows[0]?.id).toBe(result.body.participationId);
    await fixture.app.close();
    fixture.app = await fixture.open();
    await request(api()).get(`${studyPath()}/candidates`).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => expect(body.find((candidate: { id: string }) => candidate.id === candidateId).status).toBe('Incluído'));
    await include().expect(400).expect(({ body }) => expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request', code: 'CANDIDATE_ALREADY_INCLUDED', message: 'O candidato já foi incluído neste estudo.' }));
    await unchanged('Incluído', 1);
  });

  it('nega perfis não autorizados, conta inativa, sessão ausente e outro Pesquisador sem gravar', async () => {
    await evaluate(); await consent();
    for (const [token, status] of [[otherToken, 403], [adminToken, 403], [participantToken, 403], [inactiveToken, 401], ['', 401], ['invalid', 401]] as const) {
      await include(token).expect(status);
      await unchanged('Elegível');
    }
    await request(api()).patch(studyPath()).set('Authorization', auth(coordinatorToken)).send({ title: 'Alterado' }).expect(403);
    await request(api()).post(`${studyPath()}/criteria`).set('Authorization', auth(coordinatorToken)).send({ type: 'Inclusão', description: 'Não autorizado' }).expect(403);
    await request(api()).patch(`${studyPath()}/criteria/${inclusionId}`).set('Authorization', auth(coordinatorToken)).send({ active: false }).expect(403);
  });

  it.each(['planejamento', 'execução', 'encerrado'])('nega Coordenador na fase %s e preserva a operação do proprietário', async (status) => {
    await evaluate(); await consent();
    await db().query('UPDATE estudos SET status = $2 WHERE id_estudo = $1', [studyId, status]);
    await include().expect(403);
    await unchanged('Elegível');
    await include(ownerToken).expect(status === 'encerrado' ? 400 : 201);
    await unchanged(status === 'encerrado' ? 'Elegível' : 'Incluído', status === 'encerrado' ? 0 : 1);
  });

  it.each([
    ['Não atende', 'Não atende', 'Inelegível', 'CANDIDATE_INELIGIBLE'],
    ['Atende', 'Atende', 'Inelegível', 'CANDIDATE_INELIGIBLE'],
    ['Pendente', 'Não atende', 'Em avaliação', 'ELIGIBILITY_PENDING'],
  ])('rejeita avaliação %s/%s sem participação ou alteração de contador', async (inc, exc, status, code) => {
    await evaluate(candidateId, inc, exc); await consent();
    await include().expect(400).expect(({ body }) => expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request', code, message: 'Candidato inelegível: avalie e aprove todos os critérios antes da inclusão.' }));
    await unchanged(status);
  });

  it('revalida critérios ativos e rejeita avaliação incompleta mesmo com status Elegível', async () => {
    await evaluate(); await consent();
    await request(api()).post(`${studyPath()}/criteria`).set('Authorization', auth(ownerToken)).send({ type: 'Inclusão', description: 'Critério novo sem avaliação' }).expect(201);
    await include().expect(400).expect(({ body }) => expect(body).toMatchObject({ code: 'ELIGIBILITY_PENDING', message: 'Candidato inelegível: todos os critérios ativos devem estar avaliados e atendidos.' }));
    await unchanged('Elegível');
  });

  it.each([null, 'Recusado', 'Revogado'])('rejeita último consentimento %s sem gravar', async (status) => {
    await evaluate();
    if (status) { await consent(); await consent(status); }
    await include().expect(400).expect(({ body }) => expect(body).toMatchObject({ code: status ? 'CONSENT_NOT_GRANTED' : 'CONSENT_MISSING', message: 'Consentimento ausente ou não concedido: registre o consentimento antes da inclusão.' }));
    await unchanged('Elegível');
  });

  it('rejeita ausência de vagas sem gravar parcialmente', async () => {
    await evaluate(); await consent();
    await db().query('UPDATE estudos SET participantes_vinculados = limite_participantes WHERE id_estudo = $1', [studyId]);
    await include().expect(400).expect(({ body }) => expect(body).toMatchObject({ code: 'STUDY_FULL', message: 'Limite de vagas atingido: não há vagas disponíveis neste estudo.' }));
    expect((await db().query('SELECT * FROM participacoes_estudo WHERE id_candidato = $1', [candidateId])).rows).toHaveLength(0);
    expect((await db().query('SELECT participantes_vinculados FROM estudos WHERE id_estudo = $1', [studyId])).rows[0]?.participantes_vinculados).toBe(5);
  });

  it('rejeita estudo/candidato inexistente e candidato de outro estudo', async () => {
    const other = await request(api()).post('/studies').set('Authorization', auth(ownerToken)).send(studyInput).expect(201);
    await request(api()).patch(`/studies/${other.body.id}/status`).set('Authorization', auth(ownerToken)).send({ status: 'recrutamento' }).expect(200);
    for (const path of [
      `${studyPath()}/candidates/00000000-0000-4000-8000-000000000099/include`,
      `/studies/00000000-0000-4000-8000-000000000099/candidates/${candidateId}/include`,
      `/studies/${other.body.id}/candidates/${candidateId}/include`,
    ]) await request(api()).post(path).set('Authorization', auth(coordinatorToken)).expect(404);
    await request(api()).post(`${studyPath()}/candidates/invalid/include`).set('Authorization', auth(coordinatorToken)).expect(400);
    await unchanged('Em avaliação');
  });

  it('serializa inclusões simultâneas do mesmo candidato entre proprietário e Coordenador', async () => {
    await evaluate(); await consent();
    const responses = await Promise.all([include().then((response) => response), include(ownerToken).then((response) => response)]);
    expect(responses.map(({ status }) => status).sort((left, right) => left - right)).toEqual([201, 400]);
    expect(responses.find(({ status }) => status === 400)?.body.code).toBe('CANDIDATE_ALREADY_INCLUDED');
    await unchanged('Incluído', 1);
  });

  it('permite apenas um vencedor na disputa concorrente pela última vaga', async () => {
    await evaluate(); await consent();
    const second = await request(api()).post(`${studyPath()}/candidates`).set('Authorization', auth(coordinatorToken)).send({ name: 'Concorrente RF11' }).expect(201);
    await evaluate(second.body.id); await consent('Registrado', second.body.id);
    await db().query('UPDATE estudos SET limite_participantes = 1 WHERE id_estudo = $1', [studyId]);
    const responses = await Promise.all([include().then((response) => response), include(ownerToken, second.body.id).then((response) => response)]);
    expect(responses.map(({ status }) => status).sort((left, right) => left - right)).toEqual([201, 400]);
    expect(responses.find(({ status }) => status === 400)?.body.code).toBe('STUDY_FULL');
    const stored = await db().query('SELECT c.status_recrutamento AS status, p.id_participacao AS participation FROM candidatos c LEFT JOIN participacoes_estudo p ON p.id_candidato = c.id_candidato WHERE c.id_estudo = $1', [studyId]);
    expect(stored.rows.filter(({ participation }) => participation)).toHaveLength(1);
    expect(stored.rows.map(({ status }) => String(status)).sort((left, right) => left.localeCompare(right))).toEqual(['Elegível', 'Incluído']);
    expect((await db().query('SELECT participantes_vinculados FROM estudos WHERE id_estudo = $1', [studyId])).rows[0]?.participantes_vinculados).toBe(1);
  });
});
