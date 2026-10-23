import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Access control (e2e) — tasks 3078 and 3094', () => {
  let app: INestApplication<App>;
  let administratorToken: string;
  let participantToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const administratorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana.souza@clinicalstudypb.test', password: 'Admin123!' })
      .expect(201);
    administratorToken = administratorLogin.body.accessToken as string;

    const participantLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bianca.oliveira@clinicalstudypb.test', password: 'Demo123!' })
      .expect(201);
    participantToken = participantLogin.body.accessToken as string;
  });

  it('nega a listagem de usuários quando não há token', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('nega usuário autenticado cujo perfil não é administrador', () => {
    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(403);
  });

  it('permite a listagem de usuários para administrador', () => {
    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${administratorToken}`)
      .expect(200)
      .expect((response) => {
        if (!Array.isArray(response.body) || response.body.length !== 4) {
          throw new Error('A API deveria retornar as quatro contas fictícias de demonstração.');
        }
      });
  });

  it('impede o administrador de inativar a própria conta', () => {
    return request(app.getHttpServer())
      .patch('/users/usr-admin')
      .set('Authorization', `Bearer ${administratorToken}`)
      .send({ status: 'Inativo' })
      .expect(403);
  });

  afterAll(async () => {
    await app?.close();
  });
});
