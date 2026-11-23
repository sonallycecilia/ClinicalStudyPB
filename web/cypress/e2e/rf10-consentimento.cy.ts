import {
  api, createCandidate, createRecruitingStudy, login, missingId, recordConsent,
} from '../support/rf05-rf11';
import type { Consent } from '../support/rf05-rf11';

describe('RF10 — consentimento simulado', () => {
  it('CT-RF10-01: registra consentimento com vínculo e identidade do Pesquisador', () => {
    login().then((session) => {
      createRecruitingStudy(session.accessToken).then((study) => {
        createCandidate(session.accessToken, study.id).then((candidate) => {
          recordConsent(session.accessToken, study.id, candidate.id).then(({ status, body }) => {
            expect(status).to.equal(201);
            expect(body).to.include({
              studyId: study.id,
              candidateId: candidate.id,
              status: 'Registrado',
              termVersion: 'termo-cypress-v1',
              registrarId: session.user.id,
            });
          });
        });
      });
    });
  });

  it('CT-RF10-02: consulta o consentimento registrado ou indica que ainda não há registro', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        createCandidate(accessToken, study.id).then((candidate) => {
          const path = `/studies/${study.id}/candidates/${candidate.id}/consents`;
          api<Consent>('GET', path, accessToken).then(({ status, body }) => {
            expect(status).to.equal(200);
            expect(body).to.include({ studyId: study.id, candidateId: candidate.id, status: null });
          });
          recordConsent(accessToken, study.id, candidate.id).then((saved) => {
            api<Consent>('GET', path, accessToken).then((current) => {
              expect(current.body).to.deep.equal(saved.body);
            });
          });
        });
      });
    });
  });

  it('CT-RF10-03: rejeita campos obrigatórios ausentes ou inválidos', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        createCandidate(accessToken, study.id).then((candidate) => {
          const path = `/studies/${study.id}/candidates/${candidate.id}/consents`;
          api('POST', path, accessToken, { status: 'Aceito', termVersion: 'v1' })
            .its('status').should('equal', 400);
          api('POST', path, accessToken, { status: 'Registrado', termVersion: ' ' })
            .its('status').should('equal', 400);
          api('POST', path, accessToken, { status: 'Registrado', termVersion: 'v1', observation: 'x'.repeat(2001) })
            .its('status').should('equal', 400);
        });
      });
    });
  });

  it('CT-RF10-04: impede registro associado a candidato inexistente ou sem autorização', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        createCandidate(accessToken, study.id).then((candidate) => {
          const body = { status: 'Registrado', termVersion: 'v1' };
          api('POST', `/studies/${study.id}/candidates/${missingId}/consents`, accessToken, body)
            .its('status').should('equal', 404);
          api('POST', `/studies/${study.id}/candidates/${candidate.id}/consents`, undefined, body)
            .its('status').should('equal', 401);
          login('administrator').then(({ accessToken: adminToken }) => {
            api('POST', `/studies/${study.id}/candidates/${candidate.id}/consents`, adminToken, body)
              .its('status').should('equal', 403);
          });
        });
      });
    });
  });
});
