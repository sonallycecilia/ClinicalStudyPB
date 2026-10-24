import request from 'supertest';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { USER_ROLES } from '../src/users/user.types.js';
import type { PublicUser, UserRole } from '../src/users/user.types.js';

describe('PostgreSQL, sessões e permissões (E2E)', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  const tokens = {} as Record<UserRole, string>;
  const users = {} as Record<UserRole, PublicUser>;
  const input = { name: 'Pessoa Teste', email: 'nova@example.test', phone: '83999990000', password: 'Senha123!', role: 'Pesquisador' as const };
  const api = () => fixture.app.getHttpServer();
  const admin = () => 'Bearer ' + tokens.Administrador;
  async function login(email: string, password = 'Senha123!') {
    return (await request(api()).post('/auth/login').send({ email, password }).expect(201)).body.accessToken as string;
  }
  beforeAll(async () => {
    fixture = await databaseTestApp();
    for (const [index, role] of USER_ROLES.entries()) {
      users[role] = await fixture.app.get(UsersService).create({ ...input, email: 'perfil' + index + '@example.test', role });
      tokens[role] = await login(users[role].email);
    }
  });
  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });

  it('nega todas as operações sem sessão', async () => {
    await request(api()).get('/auth/me').expect(401);
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const path = method === 'patch' || method === 'delete' ? '/users/' + users.Pesquisador.id : '/users';
      await request(api())[method](path).send(input).expect(401);
    }
  });
  it.each(USER_ROLES)('revisa consulta própria e CRUD para %s', async (role) => {
    await request(api()).get('/auth/me').set('Authorization', 'Bearer ' + tokens[role]).expect(200)
      .expect((response) => { expect(response.body.role).toBe(role); expect(response.body).not.toHaveProperty('passwordHash'); });
    if (role === 'Administrador') {
      await request(api()).get('/users').set('Authorization', admin()).expect(200);
      return;
    }
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const path = method === 'patch' || method === 'delete' ? '/users/' + users.Pesquisador.id : '/users';
      await request(api())[method](path).set('Authorization', 'Bearer ' + tokens[role]).send(input).expect(403);
    }
    await request(api()).get('/users/' + users.Administrador.id).set('Authorization', 'Bearer ' + tokens[role]).expect(403);
  });
  it('persiste cadastro, consulta e edição após reiniciar a aplicação', async () => {
    const created = await request(api()).post('/users').set('Authorization', admin()).send({ ...input, email: ' NOVA@example.test ' }).expect(201);
    const id = created.body.id as string;
    expect(created.body).not.toHaveProperty('passwordHash');
    await request(api()).post('/users').set('Authorization', admin()).send({ ...input, email: 'NOVA@example.test' }).expect(409);
    await request(api()).patch('/users/' + id).set('Authorization', admin()).send({ name: 'Nome Editado', email: 'editada@example.test', phone: '83988880000', role: 'Coordenador' }).expect(200);
    await fixture.app.close(); fixture.app = await fixture.open();
    await request(api()).get('/users/' + id).set('Authorization', admin()).expect(200).expect((response) => {
      expect(response.body).toMatchObject({ name: 'Nome Editado', email: 'editada@example.test', role: 'Coordenador' });
    });
    const token = await login('editada@example.test');
    await request(api()).delete('/users/' + id).set('Authorization', admin()).expect(200);
    await request(api()).get('/users/' + id).set('Authorization', admin()).expect(404);
    await request(api()).get('/auth/me').set('Authorization', 'Bearer ' + token).expect(401);
    await request(api()).post('/auth/login').send({ email: 'editada@example.test', password: 'Senha123!' }).expect(401);
  });
  it('protege a própria conta administrativa e valida UUID e dados', async () => {
    const path = '/users/' + users.Administrador.id;
    await request(api()).patch(path).set('Authorization', admin()).send({ status: 'Inativo' }).expect(403);
    await request(api()).patch(path).set('Authorization', admin()).send({ role: 'Participante' }).expect(403);
    await request(api()).delete(path).set('Authorization', admin()).expect(403);
    await request(api()).get('/users/invalido').set('Authorization', admin()).expect(400);
    await request(api()).post('/users').set('Authorization', admin()).send({ ...input, role: 'Outro' }).expect(400);
    await request(api()).post('/users').set('Authorization', admin()).send({ ...input, password: 'curta' }).expect(400);
  });
  it('atualiza permissões imediatamente quando o perfil muda', async () => {
    const created = await request(api()).post('/users').set('Authorization', admin()).send({ ...input, email: 'permissoes@example.test', role: 'Administrador' }).expect(201);
    const token = await login('permissoes@example.test');
    await request(api()).get('/users').set('Authorization', 'Bearer ' + token).expect(200);
    await request(api()).patch('/users/' + created.body.id).set('Authorization', admin()).send({ role: 'Participante' }).expect(200);
    await request(api()).get('/users').set('Authorization', 'Bearer ' + token).expect(403);
    await request(api()).delete('/users/' + created.body.id).set('Authorization', admin()).expect(200);
  });
  it('revoga sessões ao trocar senha ou inativar, inclusive após reativar', async () => {
    const created = await request(api()).post('/users').set('Authorization', admin()).send(input).expect(201);
    const path = '/users/' + created.body.id;
    const first = await login(input.email);
    await request(api()).patch(path).set('Authorization', admin()).send({ password: 'NovaSenha123!' }).expect(200);
    await request(api()).get('/auth/me').set('Authorization', 'Bearer ' + first).expect(401);
    await request(api()).post('/auth/login').send({ email: input.email, password: input.password }).expect(401);
    const second = await login(input.email, 'NovaSenha123!');
    await request(api()).patch(path).set('Authorization', admin()).send({ status: 'Inativo' }).expect(200);
    await request(api()).post('/auth/login').send({ email: input.email, password: 'NovaSenha123!' }).expect(401);
    await request(api()).patch(path).set('Authorization', admin()).send({ status: 'Ativo' }).expect(200);
    await request(api()).get('/auth/me').set('Authorization', 'Bearer ' + second).expect(401);
    await request(api()).delete(path).set('Authorization', admin()).expect(200);
  });
  it.each(USER_ROLES)('logout invalida apenas a sessão encerrada de %s e persiste após reinício', async (role) => {
    const first = await login(users[role].email);
    const other = await login(users[role].email);
    expect(first).not.toBe(other);
    await request(api()).post('/auth/logout').set('Authorization', 'Bearer ' + first).expect(201);
    await fixture.app.close(); fixture.app = await fixture.open();
    await request(api()).get('/auth/me').set('Authorization', 'Bearer ' + first).expect(401);
    await request(api()).get('/users').set('Authorization', 'Bearer ' + first).expect(401);
    await request(api()).get('/auth/me').set('Authorization', 'Bearer ' + other).expect(200);
    await request(api()).post('/auth/logout').set('Authorization', 'Bearer ' + other).expect(201);
  });
});
