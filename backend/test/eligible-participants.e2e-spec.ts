import request from 'supertest';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { databaseTestApp } from './database-test-app.js';
import { UsersService } from '../src/users/users.service.js';
import { USER_ROLES } from '../src/users/user.types.js';
import type { PublicUser, UserRole } from '../src/users/user.types.js';

describe('Consulta de contas Participante ativas — S3C-BE-01 (E2E)', () => {
  let fixture: Awaited<ReturnType<typeof databaseTestApp>>;
  const tokens = {} as Record<UserRole, string>;
  const users = {} as Record<UserRole, PublicUser>;
  const path = '/users/eligible-participants';
  const input = { name: 'Pessoa Participante', phone: '83999990000', password: 'Senha123!' };
  const api = () => fixture.app.getHttpServer();
  const authorization = (role: UserRole) => 'Bearer ' + tokens[role];
  const minimalAccount = (user: PublicUser) => ({ id: user.id, name: user.name, email: user.email });

  async function login(email: string) {
    const response = await request(api()).post('/auth/login').send({ email, password: input.password }).expect(201);
    return response.body.accessToken as string;
  }

  async function createAccount(email: string, role: UserRole = 'Participante'): Promise<PublicUser> {
    const response = await request(api()).post('/users').set('Authorization', authorization('Administrador'))
      .send({ ...input, email, role }).expect(201);
    return response.body as PublicUser;
  }

  beforeAll(async () => {
    fixture = await databaseTestApp();
    // Somente o Administrador inicial é criado diretamente; as demais contas passam pela API real.
    users.Administrador = await fixture.app.get(UsersService).create({ ...input, email: 'admin@example.test', role: 'Administrador' });
    tokens.Administrador = await login(users.Administrador.email);
    for (const role of USER_ROLES.filter((role) => role !== 'Administrador')) {
      users[role] = await createAccount(role.toLowerCase() + '@example.test', role);
      tokens[role] = await login(users[role].email);
    }
  });

  afterAll(async () => { await fixture?.app.close(); await fixture?.cleanup(); });

  it('retorna somente Participantes ativos criados pelo Admin e somente os campos mínimos', async () => {
    const active = await createAccount('outro-participante@example.test');
    const inactive = await createAccount('inativo@example.test');
    try {
      await request(api()).patch('/users/' + inactive.id).set('Authorization', authorization('Administrador'))
        .send({ status: 'Inativo' }).expect(200);
      const response = await request(api()).get(path).set('Authorization', authorization('Coordenador')).expect(200);
      // A igualdade exata também impede exposição de telefone, senha/hash/salt, perfil ou metadados.
      expect(response.body).toEqual([minimalAccount(users.Participante), minimalAccount(active)]);
      // Nomes iguais continuam selecionáveis pelo UUID e distinguíveis pelo e-mail.
      expect(response.body[0].name).toBe(response.body[1].name);
      expect(response.body[0].id).not.toBe(response.body[1].id);
    } finally {
      for (const user of [active, inactive]) {
        await request(api()).delete('/users/' + user.id).set('Authorization', authorization('Administrador')).expect(200);
      }
    }
  });

  it('retorna 200 e [] quando não existem contas Participante ativas', async () => {
    await request(api()).patch('/users/' + users.Participante.id).set('Authorization', authorization('Administrador'))
      .send({ status: 'Inativo' }).expect(200);
    try {
      await request(api()).get(path).set('Authorization', authorization('Coordenador')).expect(200, []);
    } finally {
      await request(api()).patch('/users/' + users.Participante.id).set('Authorization', authorization('Administrador'))
        .send({ status: 'Ativo' }).expect(200);
      tokens.Participante = await login(users.Participante.email);
    }
  });

  it.each(USER_ROLES)('aplica a permissão da consulta ao perfil %s', async (role) => {
    const response = await request(api()).get(path).set('Authorization', authorization(role))
      .expect(role === 'Coordenador' ? 200 : 403);
    if (role === 'Coordenador') expect(response.body).toEqual([minimalAccount(users.Participante)]);
  });

  it('bloqueia acesso sem token ou com token inválido', async () => {
    await request(api()).get(path).expect(401);
    await request(api()).get(path).set('Authorization', 'Bearer invalido').expect(401);
  });

  it('mantém a listagem administrativa e a consulta individual bloqueadas para o Coordenador', async () => {
    await request(api()).get('/users').set('Authorization', authorization('Coordenador')).expect(403);
    await request(api()).get('/users/' + users.Participante.id).set('Authorization', authorization('Coordenador')).expect(403);
    await request(api()).get('/users').set('Authorization', authorization('Administrador')).expect(200);
  });

  it('revoga o acesso de um Coordenador inativado ou com perfil alterado', async () => {
    const coordinator = await createAccount('permissao-coordenador@example.test', 'Coordenador');
    const token = await login(coordinator.email);
    try {
      await request(api()).get(path).set('Authorization', 'Bearer ' + token).expect(200);
      await request(api()).patch('/users/' + coordinator.id).set('Authorization', authorization('Administrador'))
        .send({ role: 'Pesquisador' }).expect(200);
      await request(api()).get(path).set('Authorization', 'Bearer ' + token).expect(403);
      await request(api()).patch('/users/' + coordinator.id).set('Authorization', authorization('Administrador'))
        .send({ role: 'Coordenador', status: 'Inativo' }).expect(200);
      await request(api()).get(path).set('Authorization', 'Bearer ' + token).expect(401);
    } finally {
      await request(api()).delete('/users/' + coordinator.id).set('Authorization', authorization('Administrador')).expect(200);
    }
  });

  it('documenta no OpenAPI o contrato mínimo, autenticação e respostas de acesso', () => {
    const config = new DocumentBuilder().addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearer').build();
    const document = SwaggerModule.createDocument(fixture.app, config);
    const operation = document.paths[path]?.get;
    expect(operation?.security).toEqual([{ bearer: [] }]);
    expect(operation?.responses).toEqual(expect.objectContaining({
      '200': expect.objectContaining({ content: { 'application/json': { schema: {
        type: 'array', items: { $ref: '#/components/schemas/EligibleParticipantAccountResponseDto' },
      } } } }),
      '401': expect.any(Object),
      '403': expect.any(Object),
      '500': expect.any(Object),
    }));
    const schema = document.components?.schemas?.EligibleParticipantAccountResponseDto;
    expect(schema).toEqual(expect.objectContaining({
      required: ['id', 'name', 'email'],
      properties: { id: expect.any(Object), name: expect.any(Object), email: expect.any(Object) },
    }));
  });
});
