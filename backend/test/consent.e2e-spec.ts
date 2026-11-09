import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import type { PublicUser, UserRole } from '../src/users/user.types.js';

describe('RF10 — autorização e persistência do consentimento simulado', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let owner: PublicUser;
  let coordinator: PublicUser;
  let ownerToken: string;
  let otherToken: string;
  let coordinatorToken: string;
  let inactiveToken: string;
  let adminToken: string;
  let participantToken: string;
  let studyId: string;
  let candidateId: string;
  const api = () => fixture.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const studyPath = () => `/studies/${studyId}`;
  const consentPath = () => `${studyPath()}/candidates/${candidateId}/consents`;
  const input = { status: 'Registrado', termVersion: 'simulado-teste-v1', observation: 'Somente simulação acadêmica.' };
  const studyInput = { title: 'Estudo de teste RF10', objective: 'Validar integração de consentimento simulado', startDate: '2099-01-01', endDate: '2099-12-31', participantLimit: 5, participantsLinked: 0 };

  beforeAll(async () => {
    fixture = await databaseTestApp();
    async function account(email: string, role: UserRole) {
      const user = await fixture.app.get(UsersService).create({ name: role, email, role, phone: '83999990000', password: 'Senha123!' });
      const login = await request(api()).post('/auth/login').send({ email, password: 'Senha123!' }).expect(201);
      return { user, token: login.body.accessToken as string };
    }
    ({ user: owner, token: ownerToken } = await account('owner@rf10.test', 'Pesquisador'));
    ({ token: otherToken } = await account('other@rf10.test', 'Pesquisador'));
    ({ user: coordinator, token: coordinatorToken } = await account('coordinator@rf10.test', 'Coordenador'));
    ({ token: adminToken } = await account('admin@rf10.test', 'Administrador'));
    ({ token: participantToken } = await account('participant@rf10.test', 'Participante'));
    const inactive = await account('inactive@rf10.test', 'Coordenador');
    inactiveToken = inactive.token;
    await fixture.app.get(DatabaseService).query("UPDATE usuarios SET status = 'Inativo' WHERE id_usuario = $1", [inactive.user.id]);
  });
  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });

  beforeEach(async () => {
    const study = await request(api()).post('/studies').set('Authorization', auth(ownerToken)).send(studyInput).expect(201);
    studyId = study.body.id;
    await request(api()).patch(`${studyPath()}/status`).set('Authorization', auth(ownerToken)).send({ status: 'recrutamento' }).expect(200);
    const candidate = await request(api()).post(`${studyPath()}/candidates`).set('Authorization', auth(coordinatorToken)).send({ name: 'Candidato de teste RF10' }).expect(201);
    candidateId = candidate.body.id;
  });

  it('distingue ausência de registro, persiste os três estados com identidade e reconsulta após reiniciar a API', async () => {
    await request(api()).get(consentPath()).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => expect(body).toEqual({ studyId, candidateId, status: null, termVersion: null, registeredAt: null, registrarId: null, observation: null }));
    for (const status of ['Registrado', 'Recusado', 'Revogado']) {
      const saved = await request(api()).post(consentPath()).set('Authorization', auth(coordinatorToken)).send({ ...input, status }).expect(201);
      expect(saved.body).toMatchObject({ ...input, studyId, candidateId, status, registrarId: coordinator.id, registeredAt: expect.any(String) });
      await request(api()).get(consentPath()).set('Authorization', auth(ownerToken)).expect(200)
        .expect(({ body }) => expect(body).toEqual(saved.body));
      await request(api()).get(`${studyPath()}/candidates`).set('Authorization', auth(coordinatorToken)).expect(200)
        .expect(({ body }) => expect(body[0].status).toBe('Em avaliação'));
    }
    const db = fixture.app.get(DatabaseService);
    const stored = await db.query('SELECT status, id_registrado_por::text, versao_termo, observacao FROM consentimentos WHERE id_candidato = $1', [candidateId]);
    expect(stored.rows).toHaveLength(3);
    expect(stored.rows.every((row) => row.id_registrado_por === coordinator.id && row.versao_termo === input.termVersion)).toBe(true);
    expect((await db.query('SELECT * FROM participacoes_estudo WHERE id_candidato = $1', [candidateId])).rows).toHaveLength(0);
    await fixture.app.close();
    fixture.app = await fixture.open();
    await request(api()).get(consentPath()).set('Authorization', auth(coordinatorToken)).expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'Revogado', termVersion: input.termVersion, observation: input.observation, registrarId: coordinator.id }));
  });

  it('preserva propriedade, perfis, conta ativa e autenticação em GET e POST', async () => {
    for (const [token, status] of [[otherToken, 403], [adminToken, 403], [participantToken, 403], [inactiveToken, 401], ['', 401], ['invalid', 401]] as const) {
      for (const method of ['get', 'post'] as const) {
        await request(api())[method](consentPath()).set('Authorization', auth(token)).send(input).expect(status);
      }
    }
    await request(api()).post(consentPath()).set('Authorization', auth(ownerToken)).send(input).expect(201)
      .expect(({ body }) => expect(body.registrarId).toBe(owner.id));
  });

  it('limita Coordenador a recrutamento e preserva consulta do proprietário em todas as fases', async () => {
    for (const status of ['planejamento', 'execução', 'encerrado']) {
      await fixture.app.get(DatabaseService).query('UPDATE estudos SET status = $2 WHERE id_estudo = $1', [studyId, status]);
      await request(api()).get(consentPath()).set('Authorization', auth(coordinatorToken)).expect(403);
      await request(api()).post(consentPath()).set('Authorization', auth(coordinatorToken)).send(input).expect(403);
      await request(api()).get(consentPath()).set('Authorization', auth(ownerToken)).expect(200);
      await request(api()).post(consentPath()).set('Authorization', auth(ownerToken)).send(input).expect(status === 'encerrado' ? 400 : 201);
    }
  });

  it('valida versão, observação e estados e rejeita campos extras sem persistência parcial', async () => {
    for (const body of [{ ...input, status: 'Aceito' }, { ...input, termVersion: '' }, { ...input, termVersion: '  ' },
      { ...input, termVersion: 'a'.repeat(51) }, { ...input, observation: 'a'.repeat(2001) }, { ...input, registrarId: owner.id }]) {
      await request(api()).post(consentPath()).set('Authorization', auth(coordinatorToken)).send(body).expect(400);
    }
    expect((await fixture.app.get(DatabaseService).query('SELECT * FROM consentimentos WHERE id_candidato = $1', [candidateId])).rows).toHaveLength(0);
    await request(api()).post(consentPath()).set('Authorization', auth(coordinatorToken))
      .send({ status: 'Recusado', termVersion: 'a'.repeat(50), observation: 'a'.repeat(2000) }).expect(201);
  });

  it('rejeita candidato inexistente, estudo inexistente e candidato de outro estudo', async () => {
    const otherStudy = await request(api()).post('/studies').set('Authorization', auth(ownerToken)).send(studyInput).expect(201);
    await request(api()).patch(`/studies/${otherStudy.body.id}/status`).set('Authorization', auth(ownerToken)).send({ status: 'recrutamento' }).expect(200);
    for (const path of [
      `${studyPath()}/candidates/00000000-0000-4000-8000-000000000099/consents`,
      `/studies/00000000-0000-4000-8000-000000000099/candidates/${candidateId}/consents`,
      `/studies/${otherStudy.body.id}/candidates/${candidateId}/consents`,
    ]) for (const method of ['get', 'post'] as const) {
      await request(api())[method](path).set('Authorization', auth(coordinatorToken)).send(input).expect(404);
    }
  });

  it('não altera elegibilidade, não libera edição e RF11 rejeita consentimento revogado', async () => {
    const criterion = await request(api()).post(`${studyPath()}/criteria`).set('Authorization', auth(ownerToken))
      .send({ type: 'Inclusão', description: 'Critério de teste RF09' }).expect(201);
    const evaluationPath = `${studyPath()}/candidates/${candidateId}/eligibility-assessments`;
    const eligible = await request(api()).post(evaluationPath).set('Authorization', auth(coordinatorToken))
      .send({ evaluations: [{ criterionId: criterion.body.id, result: 'Atende' }] }).expect(201);
    for (const status of ['Registrado', 'Recusado', 'Revogado']) {
      await request(api()).post(consentPath()).set('Authorization', auth(coordinatorToken)).send({ ...input, status }).expect(201);
      await request(api()).get(evaluationPath).set('Authorization', auth(coordinatorToken)).expect(200)
        .expect(({ body }) => expect(body).toEqual(eligible.body));
    }
    await request(api()).post(`${studyPath()}/candidates/${candidateId}/include`).set('Authorization', auth(coordinatorToken)).expect(400);
    await request(api()).patch(studyPath()).set('Authorization', auth(coordinatorToken)).send({ title: 'Alterado' }).expect(403);
    await request(api()).patch(`${studyPath()}/criteria/${criterion.body.id}`).set('Authorization', auth(coordinatorToken)).send({ active: false }).expect(403);
  });
});
