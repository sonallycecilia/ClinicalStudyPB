import 'reflect-metadata';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionsService } from '../auth/sessions.service.js';
import { createAccessToken } from '../auth/token.util.js';
import type { PublicUser, UserRole } from '../users/user.types.js';
import { UsersService } from '../users/users.service.js';
import { DatabaseService } from '../database/database.service.js';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesService } from './candidates.service.js';
import { StudiesService } from './studies.service.js';
import { StudyStatus } from './study.types.js';
import type { Candidate } from './candidates.types.js';

const studyId = '00000000-0000-4000-8000-000000000010';
const candidateId = '00000000-0000-4000-8000-000000000011';
const path = `/studies/${studyId}/candidates`;
function account(id: number, role: UserRole): PublicUser {
  return { id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, name: role,
    email: `${id}@example.test`, phone: '83999990000', role, status: 'Ativo', createdAt: '2026-11-08T12:00:00Z' };
}
const researcher = account(1, 'Pesquisador');
const otherResearcher = account(2, 'Pesquisador');
const coordinator = account(3, 'Coordenador');
const admin = account(4, 'Administrador');
const participant = account(5, 'Participante');
const baseStudy = { id: studyId, code: 'EST-001', title: 'Estudo de sono', objective: 'Avaliar sono',
  researcherId: researcher.id, researcher: researcher.name, status: StudyStatus.Recrutamento,
  startDate: '2026-01-01', endDate: '2099-01-01', participantLimit: 10, participantsLinked: 0,
  kind: 'Estudo observacional', symbol: 'activity' };

describe('RF08 HTTP — controller, guards e services reais, persistência simulada', () => {
  let app: INestApplication;
  let study: typeof baseStudy;
  let candidates: Candidate[];
  let users: Map<string, PublicUser>;
  let sessionActive: boolean;
  const query = jest.fn<(sql: string, values?: unknown[]) => Promise<{ rows: object[]; rowCount: number }>>();
  const bearer = (user: PublicUser) => `Bearer ${createAccessToken(user)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CandidatesController],
      providers: [CandidatesService, StudiesService, AccessTokenGuard, RolesGuard,
        { provide: DatabaseService, useValue: { query } },
        { provide: UsersService, useValue: { findById: async (id: string) => users.get(id) } },
        { provide: SessionsService, useValue: { isActive: async () => sessionActive } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    users = new Map([researcher, otherResearcher, coordinator, admin, participant].map((user) => [user.id, { ...user }]));
    sessionActive = true;
    study = { ...baseStudy };
    candidates = [];
    query.mockReset().mockImplementation(async (sql, values = []) => {
      if (sql.includes('FROM estudos e JOIN usuarios')) {
        const rows = values[0] === study.id ? [study] : [];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes('INSERT INTO candidatos')) {
        const created: Candidate = { id: candidateId, studyId: values[0] as string, name: values[1] as string,
          email: values[2] as string | null, status: 'Em avaliação', registeredAt: '2026-11-08T12:00:00Z' };
        candidates.push(created);
        return { rows: [created], rowCount: 1 };
      }
      if (sql.includes('FROM candidatos')) {
        const rows = candidates.filter((candidate) => candidate.studyId === values[0]);
        return { rows, rowCount: rows.length };
      }
      throw new Error(`Consulta inesperada no teste: ${sql}`);
    });
  });

  it.each([researcher, coordinator])('$role cadastra e lista candidatos no estudo autorizado', async (user) => {
    const created = await request(app.getHttpServer()).post(path).set('Authorization', bearer(user))
      .send({ name: '  Ana Silva  ', email: ' ana@example.test ' }).expect(201);
    expect(created.body).toMatchObject({ studyId, name: 'Ana Silva', email: 'ana@example.test' });
    await request(app.getHttpServer()).post(path).set('Authorization', bearer(user))
      .send({ name: 'Sem e-mail' }).expect(201).expect(({ body }) => expect(body.email).toBeNull());
    await request(app.getHttpServer()).get(path).set('Authorization', bearer(user))
      .expect(200).expect(({ body }) => expect(body).toHaveLength(2));
    expect(query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO candidatos'))).toHaveLength(2);
    expect(query.mock.calls.every(([sql]) => !sql.includes('participacoes_estudo'))).toBe(true);
  });

  it('permite ao Coordenador acessar estudos em recrutamento de outro pesquisador', async () => {
    study.researcherId = otherResearcher.id;
    await request(app.getHttpServer()).post(path).set('Authorization', bearer(coordinator)).send({ name: 'Ana' }).expect(201);
    await request(app.getHttpServer()).get(path).set('Authorization', bearer(coordinator)).expect(200);
  });

  it('retorna lista vazia para estudo autorizado sem candidatos', async () => {
    await request(app.getHttpServer()).get(path).set('Authorization', bearer(coordinator))
      .expect(200).expect(({ body }) => expect(body).toEqual([]));
  });

  it.each([StudyStatus.Planejamento, StudyStatus.Execucao, StudyStatus.Encerrado])('bloqueia Coordenador fora de recrutamento: %s', async (status) => {
    study.status = status;
    for (const method of ['get', 'post'] as const) {
      await request(app.getHttpServer())[method](path).set('Authorization', bearer(coordinator)).send({ name: 'Ana' }).expect(403);
    }
    expect(query.mock.calls.every(([sql]) => !sql.includes('FROM candidatos') && !sql.includes('INSERT INTO candidatos'))).toBe(true);
  });

  it.each([StudyStatus.Planejamento, StudyStatus.Recrutamento, StudyStatus.Execucao, StudyStatus.Encerrado])('mantém propriedade do Pesquisador na fase %s', async (status) => {
    study.status = status;
    for (const method of ['get', 'post'] as const) {
      await request(app.getHttpServer())[method](path).set('Authorization', bearer(otherResearcher)).send({ name: 'Ana' }).expect(403);
    }
    expect(candidates).toEqual([]);
  });

  it.each([StudyStatus.Planejamento, StudyStatus.Execucao])('preserva cadastro do Pesquisador proprietário na fase %s', async (status) => {
    study.status = status;
    await request(app.getHttpServer()).post(path).set('Authorization', bearer(researcher)).send({ name: 'Ana' }).expect(201);
  });

  it('preserva leitura do proprietário e bloqueio de cadastro após encerramento', async () => {
    study.status = StudyStatus.Encerrado;
    await request(app.getHttpServer()).get(path).set('Authorization', bearer(researcher)).expect(200);
    await request(app.getHttpServer()).post(path).set('Authorization', bearer(researcher)).send({ name: 'Ana' }).expect(400);
    expect(candidates).toEqual([]);
  });

  it.each([admin, participant])('nega os dois endpoints ao $role', async (user) => {
    for (const method of ['get', 'post'] as const) {
      await request(app.getHttpServer())[method](path).set('Authorization', bearer(user)).send({ name: 'Ana' }).expect(403);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['get', 'post'] as const)('nega %s sem autenticação ou com token inválido/expirado', async (method) => {
    await request(app.getHttpServer())[method](path).send({ name: 'Ana' }).expect(401);
    for (const token of ['invalid', createAccessToken(coordinator, -1)]) {
      await request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${token}`).send({ name: 'Ana' }).expect(401);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('nega sessão revogada e conta inativa, e usa perfil atual em vez do perfil do token', async () => {
    const authorization = bearer(coordinator);
    sessionActive = false;
    await request(app.getHttpServer()).get(path).set('Authorization', authorization).expect(401);
    sessionActive = true;
    users.get(coordinator.id)!.status = 'Inativo';
    await request(app.getHttpServer()).get(path).set('Authorization', authorization).expect(401);
    users.get(coordinator.id)!.status = 'Ativo';
    users.get(coordinator.id)!.role = 'Participante';
    await request(app.getHttpServer()).get(path).set('Authorization', authorization).expect(403);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['get', 'consents'], ['post', 'consents'],
  ] as const)('RF10 permite consentimento e mantém %s /:candidateId/%s com sua autorização específica', async (method, endpoint) => {
    await request(app.getHttpServer())[method](`${path}/${candidateId}/${endpoint}`)
      .set('Authorization', bearer(coordinator)).send({}).expect(method === 'get' ? 404 : 400);
    if (method === 'post') expect(query).not.toHaveBeenCalled();
  });

  it.each([{}, { name: '   ' }, { name: 'Ana', email: 'invalid' }, { name: 'Ana', id_estudo: studyId },
    { name: 'Ana', role: 'Pesquisador' }, { name: 'Ana', status: 'Incluído' }])('preserva validação e rejeita campos extras: %j', async (input) => {
    await request(app.getHttpServer()).post(path).set('Authorization', bearer(coordinator)).send(input).expect(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('retorna 404 para estudo inexistente e 400 para UUID inválido', async () => {
    for (const method of ['get', 'post'] as const) {
      await request(app.getHttpServer())[method]('/studies/00000000-0000-4000-8000-000000000099/candidates')
        .set('Authorization', bearer(coordinator)).send({ name: 'Ana' }).expect(404);
      await request(app.getHttpServer())[method]('/studies/invalid/candidates')
        .set('Authorization', bearer(coordinator)).send({ name: 'Ana' }).expect(400);
    }
    expect(candidates).toEqual([]);
  });
});
