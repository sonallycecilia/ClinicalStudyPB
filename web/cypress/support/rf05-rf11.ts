const API_URL = Cypress.expose('apiUrl') ?? 'http://localhost:3000';

export const accounts = {
  researcher: { email: 'marina.costa@clinicalstudypb.test', password: 'Demo123!' },
  coordinator: { email: 'rafael.lima@clinicalstudypb.test', password: 'Demo123!' },
  administrator: { email: 'ana.souza@clinicalstudypb.test', password: 'Admin123!' },
};

export const missingId = '00000000-0000-4000-8000-000000000099';

type HttpMethod = 'GET' | 'POST' | 'PATCH';
type ApiResult<T> = Cypress.Response<T>;
export type Session = { accessToken: string; user: { id: string } };
export type Study = {
  id: string;
  title: string;
  status: string;
  participantLimit: number;
  participantsLinked: number;
};
export type Criterion = {
  id: string;
  studyId: string;
  type: 'Inclusão' | 'Exclusão';
  description: string;
  active: boolean;
};
export type Visit = { id: string; studyId: string; name: string; order: number };
export type Activity = { id: string; visitId: string; name: string; type: string };
export type Candidate = { id: string; studyId: string; id_usuario: string | null; name: string; email: string | null; status: string };
export type ParticipantAccount = { id: string; name: string; email: string; role: string; status: string };
export type Assessment = {
  candidateId: string;
  studyId: string;
  status: string;
  evaluations: { criterionId: string; result: string }[];
};
export type Consent = {
  candidateId: string;
  studyId: string;
  status: string | null;
  registrarId: string | null;
  termVersion: string | null;
};
export type Inclusion = {
  candidateId: string;
  studyId: string;
  participationStatus: string;
  participantsLinked: number;
  participantLimit: number;
  code?: string;
};
export type CandidateFixture = {
  token: string;
  study: Study;
  inclusion: Criterion;
  exclusion: Criterion;
  candidate: Candidate;
};

export function api<T>(
  method: HttpMethod,
  path: string,
  token?: string,
  body?: object | string | null,
): Cypress.Chainable<ApiResult<T>> {
  return cy.request<T>({
    method,
    url: `${API_URL}${path}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    failOnStatusCode: false,
  });
}

export function login(account: keyof typeof accounts = 'researcher'): Cypress.Chainable<Session> {
  const credentials = accounts[account];
  return api<Session>('POST', '/auth/login', undefined, credentials).then((response) => {
    expect(response.status, `login for ${credentials.email}`).to.equal(201);
    return response.body;
  });
}

export function createStudy(token: string, participantLimit = 5): Cypress.Chainable<Study> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return api<Study>('POST', '/studies', token, {
    title: `Estudo Cypress RF ${suffix}`,
    objective: 'Validar requisitos funcionais com testes Cypress integrados.',
    startDate: '2099-01-01',
    endDate: '2099-12-31',
    participantLimit,
    participantsLinked: 0,
  }).then((response) => {
    expect(response.status, 'study creation').to.equal(201);
    return response.body;
  });
}

export function transitionStudy(token: string, studyId: string, status: string): Cypress.Chainable<ApiResult<Study>> {
  return api<Study>('PATCH', `/studies/${studyId}/status`, token, { status });
}

export function createRecruitingStudy(token: string, participantLimit = 5): Cypress.Chainable<Study> {
  return createStudy(token, participantLimit).then((study) =>
    transitionStudy(token, study.id, 'recrutamento').then((response) => {
      expect(response.status, 'move study to recruitment').to.equal(200);
      return response.body;
    }));
}

export function createCriterion(
  token: string,
  studyId: string,
  type: 'Inclusão' | 'Exclusão',
  description = `Critério ${type} ${Date.now()}`,
  active = true,
): Cypress.Chainable<Criterion> {
  return api<Criterion>('POST', `/studies/${studyId}/criteria`, token, { type, description, active })
    .then((response) => {
      expect(response.status, `create ${type} criterion`).to.equal(201);
      return response.body;
    });
}

export function createParticipantAccount(
  name = `Participante Cypress ${Date.now()}`,
): Cypress.Chainable<ParticipantAccount> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  return login('administrator').then(({ accessToken: adminToken }) =>
    api<ParticipantAccount>('POST', '/users', adminToken, {
      name,
      email: `cypress.${suffix}@example.test`,
      phone: '83999990000',
      role: 'Participante',
      password: 'SenhaTeste123!',
    }).then(({ status, body }) => {
      expect(status, 'create active participant account for Cypress').to.equal(201);
      expect(body).to.include({ role: 'Participante', status: 'Ativo' });
      expect(body.id).to.be.a('string');
      return body;
    }));
}

export function createCandidate(token: string, studyId: string, name = `Candidato Cypress ${Date.now()}`): Cypress.Chainable<Candidate> {
  return createParticipantAccount(name).then((account) =>
    api<Candidate>('POST', `/studies/${studyId}/candidates`, token, {
      id_usuario: account.id,
      name,
      email: account.email,
    }).then((response) => {
      expect(response.status, 'candidate creation').to.equal(201);
      expect(response.body.id_usuario, 'candidate account association').to.equal(account.id);
      return response.body;
    }));
}

export function createCandidateFixture(
  token: string,
  participantLimit = 5,
): Cypress.Chainable<CandidateFixture> {
  return createRecruitingStudy(token, participantLimit).then((study) =>
    createCriterion(token, study.id, 'Inclusão').then((inclusion) =>
      createCriterion(token, study.id, 'Exclusão').then((exclusion) =>
        createCandidate(token, study.id).then((candidate) => ({
          token, study, inclusion, exclusion, candidate,
        })))));
}

export function evaluateCandidate(
  token: string,
  studyId: string,
  candidateId: string,
  inclusion: Criterion,
  exclusion: Criterion,
  inclusionResult = 'Atende',
  exclusionResult = 'Não atende',
): Cypress.Chainable<ApiResult<Assessment>> {
  return api<Assessment>(
    'POST',
    `/studies/${studyId}/candidates/${candidateId}/eligibility-assessments`,
    token,
    { evaluations: [
      { criterionId: inclusion.id, result: inclusionResult },
      { criterionId: exclusion.id, result: exclusionResult },
    ] },
  );
}

export function recordConsent(
  token: string,
  studyId: string,
  candidateId: string,
  status = 'Registrado',
): Cypress.Chainable<ApiResult<Consent>> {
  return api<Consent>('POST', `/studies/${studyId}/candidates/${candidateId}/consents`, token, {
    status,
    termVersion: 'termo-cypress-v1',
  });
}

export function makeCandidateEligible(fixture: CandidateFixture): Cypress.Chainable<CandidateFixture> {
  const { token, study, candidate, inclusion, exclusion } = fixture;
  return evaluateCandidate(token, study.id, candidate.id, inclusion, exclusion).then((response) => {
    expect(response.status).to.equal(201);
    expect(response.body.status).to.equal('Elegível');
    return recordConsent(token, study.id, candidate.id).then((consentResponse) => {
      expect(consentResponse.status).to.equal(201);
      return fixture;
    });
  });
}

export function assertInclusionUnchanged(
  token: string,
  studyId: string,
  candidateId: string,
  expectedStatus: string,
  linked: number,
){
  return api<Study>('GET', `/studies/${studyId}`, token).then((studyResponse) => {
    expect(studyResponse.body.participantsLinked).to.equal(linked);
    api<Candidate[]>('GET', `/studies/${studyId}/candidates`, token).then((candidateResponse) => {
      const candidate = candidateResponse.body.find((item) => item.id === candidateId);
      expect(candidate, 'candidate remains in its study').to.exist;
      expect(candidate?.status).to.equal(expectedStatus);
    });
  });
}
