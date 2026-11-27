import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { databaseTestApp } from './database-test-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { UsersService } from '../src/users/users.service.js';
import type { PublicUser, UserRole } from '../src/users/user.types.js';

describe('S3C-BE-02 #4128 — vínculo obrigatório e legado D10 no PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  let studyId: string;
  let criterionId: string;
  const accounts = {} as Record<UserRole, { user: PublicUser; token: string }>;
  let inactive: PublicUser;
  let otherResearcher: { user: PublicUser; token: string };
  const api = () => fixture.app.getHttpServer();
  const db = () => fixture.app.get(DatabaseService);
  const auth = (role: UserRole = 'Coordenador') => `Bearer ${accounts[role].token}`;
  const path = () => `/studies/${studyId}/candidates`;
  const input = () => ({ id_usuario: accounts.Participante.user.id, name: ' Candidato RF08 ', email: ' rf08@example.test ' });
  async function account(role: UserRole) {
    const user = await fixture.app.get(UsersService).create({
      name: role, role, email: `${randomUUID()}@4128.test`, phone: '83999990000', password: 'Senha123!',
    });
    const login = await request(api()).post('/auth/login').send({ email: user.email, password: 'Senha123!' }).expect(201);
    return { user, token: login.body.accessToken as string };
  }
  async function study() {
    const result = await request(api()).post('/studies').set('Authorization', auth('Pesquisador')).send({
      title: 'Vínculo #4128', objective: 'Validar RF08 e D10 sem alterar históricos',
      startDate: '2099-01-01', endDate: '2099-12-31', participantLimit: 2, participantsLinked: 0,
    }).expect(201);
    await request(api()).patch(`/studies/${result.body.id}/status`).set('Authorization', auth('Pesquisador'))
      .send({ status: 'recrutamento' }).expect(200);
    return result.body.id as string;
  }
  // Compara o conteúdo integral das tabelas de domínio: nenhuma gravação parcial nas rejeições.
  async function snapshot() {
    const result: Record<string, unknown[]> = {};
    for (const table of ['candidatos', 'estudos', 'avaliacoes_elegibilidade', 'consentimentos', 'participacoes_estudo']) {
      result[table] = (await db().query(`SELECT to_jsonb(t) AS registro FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    }
    return result;
  }
  beforeAll(async () => {
    fixture = await databaseTestApp((app) => {
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
      SwaggerModule.setup('api', app, document);
    });
    for (const role of ['Participante', 'Administrador', 'Coordenador', 'Pesquisador'] as const) accounts[role] = await account(role);
    otherResearcher = await account('Pesquisador');
    inactive = (await account('Participante')).user;
    await db().query("UPDATE usuarios SET status = 'Inativo' WHERE id_usuario = $1", [inactive.id]);
  });
  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });
  beforeEach(async () => {
    studyId = await study();
    const criterion = await request(api()).post(`/studies/${studyId}/criteria`).set('Authorization', auth('Pesquisador'))
      .send({ type: 'Inclusão', description: 'Critério de teste #4128' }).expect(201);
    criterionId = criterion.body.id;
  });

  it('usa o id da BE-01, persiste UUID/estudo no PostgreSQL e reconsulta após reiniciar', async () => {
    const eligible = await request(api()).get('/users/eligible-participants').set('Authorization', auth()).expect(200);
    expect(eligible.body).toContainEqual({ id: input().id_usuario, name: accounts.Participante.user.name, email: accounts.Participante.user.email });
    const created = await request(api()).post(path()).set('Authorization', auth()).send(input()).expect(201);
    expect(created.body).toEqual({
      id: expect.any(String), studyId, id_usuario: input().id_usuario,
      name: 'Candidato RF08', email: 'rf08@example.test', status: 'Em avaliação', registeredAt: expect.any(String),
    });
    const stored = await db().query('SELECT id_estudo::text, id_usuario::text, nome, email FROM candidatos WHERE id_candidato = $1', [created.body.id]);
    expect(stored.rows).toEqual([{ id_estudo: studyId, id_usuario: input().id_usuario, nome: 'Candidato RF08', email: 'rf08@example.test' }]);
    await fixture.app.close(); fixture.app = await fixture.open();
    await request(api()).get(path()).set('Authorization', auth()).expect(200)
      .expect(({ body }) => expect(body).toEqual([created.body]));
  });

  it.each([
    ['ausente', undefined], ['nulo', null], ['vazio', ''], ['UUID inválido', '21'],
    ['tipo numérico', 21], ['inexistente', '00000000-0000-4000-8000-000000000099'],
    ['inativa', 'inactive'], ['Administrador', 'Administrador'], ['Coordenador', 'Coordenador'], ['Pesquisador', 'Pesquisador'],
  ])('rejeita vínculo %s com 422 e preserva todos os registros', async (_case, value) => {
    const id = value === 'inactive' ? inactive.id : value === 'Administrador' || value === 'Coordenador' || value === 'Pesquisador' ? accounts[value].user.id : value;
    const before = await snapshot();
    await request(api()).post(path()).set('Authorization', auth()).send({ ...input(), id_usuario: id }).expect(422)
      .expect(({ body }) => expect(body).toEqual({ codigo: 'CONTA_PARTICIPANTE_INVALIDA', mensagem: 'Selecione uma conta de participante ativa.', campo: 'id_usuario' }));
    expect(await snapshot()).toEqual(before);
  });

  it('recusa duplicação sequencial e concorrente com 409, permitindo a mesma conta em outro estudo', async () => {
    const responses = await Promise.all([1, 2].map(() => request(api()).post(path()).set('Authorization', auth()).send(input())));
    expect(responses.map(({ status }) => status).sort((left, right) => left - right)).toEqual([201, 409]);
    const before = await snapshot();
    await request(api()).post(path()).set('Authorization', auth()).send({ ...input(), name: 'Não sobrescrever' }).expect(409);
    expect(await snapshot()).toEqual(before);
    const otherStudy = await study();
    await request(api()).post(`/studies/${otherStudy}/candidates`).set('Authorization', auth()).send(input()).expect(201);
    expect((await db().query('SELECT id_estudo::text FROM candidatos WHERE id_usuario = $1 AND id_estudo = ANY($2::uuid[])', [input().id_usuario, [studyId, otherStudy]])).rows).toHaveLength(2);
  });

  it('preserva email opcional, campos RF08, conta original e rejeita dados extras com 400', async () => {
    const accountBefore = await fixture.app.get(UsersService).findById(input().id_usuario);
    for (const body of [{ ...input(), name: ' ' }, { ...input(), email: 'inválido' }, { ...input(), status: 'Incluído' }, { ...input(), id_usuario: undefined, name: '' }]) {
      const before = await snapshot();
      await request(api()).post(path()).set('Authorization', auth()).send(body).expect(body.id_usuario ? 400 : 422);
      expect(await snapshot()).toEqual(before);
    }
    await request(api()).post(path()).set('Authorization', auth()).send({ name: 'Sem email', id_usuario: input().id_usuario }).expect(201)
      .expect(({ body }) => expect(body.email).toBeNull());
    expect(await fixture.app.get(UsersService).findById(input().id_usuario)).toEqual(accountBefore);
  });

  it('retorna 401/403 sem sessão/permissão e preserva a regra existente do proprietário', async () => {
    for (const token of ['', 'invalid', accounts.Administrador.token, accounts.Participante.token, otherResearcher.token]) {
      const before = await snapshot();
      await request(api()).post(path()).set('Authorization', `Bearer ${token}`).send(input()).expect(!token || token === 'invalid' ? 401 : 403);
      expect(await snapshot()).toEqual(before);
    }
    await request(api()).post(path()).set('Authorization', auth('Pesquisador')).send(input()).expect(201);
  });

  it.each(['planejamento', 'execução', 'encerrado'])('nega Coordenador no estado %s sem gravação', async (status) => {
    await db().query('UPDATE estudos SET status = $2 WHERE id_estudo = $1', [studyId, status]);
    const before = await snapshot();
    await request(api()).post(path()).set('Authorization', auth()).send(input()).expect(403);
    expect(await snapshot()).toEqual(before);
  });

  it('regressão RF08–RF11: avalia, registra RF10, inclui e preserva vínculo', async () => {
    const candidate = await request(api()).post(path()).set('Authorization', auth()).send(input()).expect(201);
    const candidatePath = `${path()}/${candidate.body.id}`;
    await request(api()).post(`${candidatePath}/eligibility-assessments`).set('Authorization', auth())
      .send({ evaluations: [{ criterionId, result: 'Atende' }] }).expect(201);
    await request(api()).post(`${candidatePath}/consents`).set('Authorization', auth()).send({ status: 'Registrado', termVersion: 'v1' }).expect(201);
    await request(api()).post(`${candidatePath}/include`).set('Authorization', auth()).expect(201);
    expect((await db().query('SELECT id_usuario::text, status_recrutamento FROM candidatos WHERE id_candidato = $1', [candidate.body.id])).rows)
      .toEqual([{ id_usuario: input().id_usuario, status_recrutamento: 'Incluído' }]);
    await request(api()).get('/me/studies').set('Authorization', auth('Participante')).expect(200)
      .expect(({ body }) => expect(body.some((item: { study: { id: string } }) => item.study.id === studyId)).toBe(true));
  });

  it.each(['Em avaliação', 'Elegível', 'Incluído'])('D10: legado %s segue consultável sem avançar RF09/RF10/RF11', async (status) => {
    const legacy = await db().query<{ id: string }>(
      'INSERT INTO candidatos (id_estudo, nome, email, status_recrutamento) VALUES ($1, $2, $3, $4) RETURNING id_candidato::text AS id',
      [studyId, accounts.Participante.user.name, accounts.Participante.user.email, status],
    );
    const candidateId = legacy.rows[0]!.id;
    await db().query("INSERT INTO avaliacoes_elegibilidade (id_candidato, id_criterio, resultado, id_avaliador) VALUES ($1, $2, 'Atende', $3)", [candidateId, criterionId, accounts.Coordenador.user.id]);
    await db().query("INSERT INTO consentimentos (id_candidato, status, versao_termo, id_registrado_por) VALUES ($1, 'Registrado', 'v0', $2)", [candidateId, accounts.Coordenador.user.id]);
    if (status === 'Incluído') await db().query('INSERT INTO participacoes_estudo (id_candidato) VALUES ($1)', [candidateId]);
    const before = await snapshot();
    const candidatePath = `${path()}/${candidateId}`;
    await request(api()).get(path()).set('Authorization', auth()).expect(200)
      .expect(({ body }) => expect(body).toEqual([expect.objectContaining({ id: candidateId, id_usuario: null, status })]));
    for (const endpoint of ['consents', 'eligibility-assessments']) {
      await request(api()).get(`${candidatePath}/${endpoint}`).set('Authorization', auth()).expect(200);
    }
    for (const [endpoint, body] of [
      ['eligibility-assessments', { evaluations: [{ criterionId, result: 'Não atende' }] }],
      ['consents', { status: 'Revogado', termVersion: 'v1' }], ['include', {}],
    ] as const) {
      await request(api()).post(`${candidatePath}/${endpoint}`).set('Authorization', auth()).send(body).expect(422)
        .expect(({ body }) => expect(body.codigo).toBe('CANDIDATO_SEM_VINCULO'));
      expect(await snapshot()).toEqual(before);
    }
    await request(api()).get('/me/studies').set('Authorization', auth('Participante')).expect(200)
      .expect(({ body }) => expect(body.some((item: { study: { id: string } }) => item.study.id === studyId)).toBe(false));
  });

  it('Swagger publica o vínculo obrigatório, resposta anulável e códigos HTTP reais', async () => {
    await request(api()).get('/api/').expect(200);
    const response = await request(api()).get('/api-json').expect(200);
    const schemas = response.body.components.schemas;
    expect(schemas.CreateCandidateRequestDto.required).toEqual(expect.arrayContaining(['id_usuario', 'name']));
    expect(schemas.CreateCandidateRequestDto.properties.id_usuario.format).toBe('uuid');
    expect(schemas.CandidateResponseDto.properties.id_usuario).toMatchObject({ format: 'uuid', nullable: true });
    const operation = response.body.paths['/studies/{studyId}/candidates'].post;
    for (const code of ['201', '400', '401', '403', '404', '409', '422']) expect(operation.responses).toHaveProperty(code);
  });

  it('não reconcilia legado automaticamente mesmo com nome e email iguais aos da conta', async () => {
    const participant = accounts.Participante.user;
    const legacy = await db().query<{ id: string }>(
      'INSERT INTO candidatos (id_estudo, nome, email) VALUES ($1, $2, $3) RETURNING id_candidato::text AS id',
      [studyId, participant.name, participant.email],
    );
    const before = (await db().query('SELECT * FROM candidatos WHERE id_candidato = $1', [legacy.rows[0]!.id])).rows;
    await request(api()).post(path()).set('Authorization', auth()).send({ name: participant.name, email: participant.email }).expect(422);
    expect((await db().query('SELECT * FROM candidatos WHERE id_estudo = $1', [studyId])).rows).toEqual(before);
    const created = await request(api()).post(path()).set('Authorization', auth()).send({ id_usuario: participant.id, name: participant.name, email: participant.email }).expect(201);
    expect(created.body.id).not.toBe(legacy.rows[0]!.id);
    expect((await db().query('SELECT * FROM candidatos WHERE id_candidato = $1', [legacy.rows[0]!.id])).rows).toEqual(before);
    expect((await db().query('SELECT id_usuario::text FROM candidatos WHERE id_candidato = $1', [created.body.id])).rows).toEqual([{ id_usuario: participant.id }]);
  });
});
