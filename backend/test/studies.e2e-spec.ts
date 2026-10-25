import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const sample = {
  title: 'Acompanhamento da qualidade de sono',
  objective: 'Analisar hábitos de sono com dados fictícios de participantes.',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  participantLimit: 30,
  participantsLinked: 0,
};

describe('Studies (e2e)', () => {
  let app: INestApplication<App>;
  let researcherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const researcher = await request(app.getHttpServer()).post('/auth/login')
      .send({ email: 'marina.costa@clinicalstudypb.test', password: 'Demo123!' }).expect(201);
    researcherToken = researcher.body.accessToken as string;
    const admin = await request(app.getHttpServer()).post('/auth/login')
      .send({ email: 'ana.souza@clinicalstudypb.test', password: 'Admin123!' }).expect(201);
    adminToken = admin.body.accessToken as string;
  });

  it('nega acesso sem token e a perfis não pesquisadores', async () => {
    await request(app.getHttpServer()).get('/studies').expect(401);
    await request(app.getHttpServer()).get('/studies')
      .set('Authorization', `Bearer ${adminToken}`).expect(403);
  });

  it('lista, cadastra, consulta e atualiza estudo via HTTP', async () => {
    await request(app.getHttpServer()).get('/studies')
      .set('Authorization', `Bearer ${researcherToken}`).expect(200)
      .expect(({ body }) => { if (!Array.isArray(body) || body.length !== 3) throw Error('Seed esperado'); });
    const created = await request(app.getHttpServer()).post('/studies')
      .set('Authorization', `Bearer ${researcherToken}`).send(sample).expect(201);
    expect(created.body.id).toBeDefined();
    expect(created.body.researcher).toBe('Marina Costa');
    expect(created.body.researcherId).toBe('usr-researcher');
    await request(app.getHttpServer()).get(`/studies/${created.body.id}`)
      .set('Authorization', `Bearer ${researcherToken}`).expect(200);
    await request(app.getHttpServer()).patch(`/studies/${created.body.id}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ title: 'Título alterado' }).expect(200)
      .expect(({ body }) => { if (body.title !== 'Título alterado') throw Error('Edição não persistiu na sessão'); });
    await request(app.getHttpServer()).post('/studies')
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({ ...sample, participantLimit: 0 }).expect(400);
  });

  afterAll(async () => { await app?.close(); });
});
