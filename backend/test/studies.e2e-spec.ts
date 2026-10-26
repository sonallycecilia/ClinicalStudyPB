import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
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

  it('persiste os estudos após reiniciar a aplicação', async () => {
    const created = await request(api()).post('/studies')
      .set('Authorization', bearer(researcherToken)).send({ ...sample, title: 'Estudo persistente' }).expect(201);
    await fixture.app.close();
    fixture.app = await fixture.open();
    await request(api()).get(`/studies/${created.body.id}`)
      .set('Authorization', bearer(researcherToken)).expect(200)
      .expect(({ body }) => expect(body.title).toBe('Estudo persistente'));
  });
});
