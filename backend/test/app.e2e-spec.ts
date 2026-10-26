import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
describe('AppController (E2E)', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  beforeAll(async () => { fixture = await databaseTestApp(); });
  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });
  it('/ (GET)', async () => { await request(fixture.app.getHttpServer()).get('/').expect(200).expect('Hello World!'); });
});
