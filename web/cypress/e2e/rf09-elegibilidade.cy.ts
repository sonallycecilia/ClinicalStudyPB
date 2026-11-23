import {
  api, createCandidateFixture, evaluateCandidate, login, missingId,
} from '../support/rf05-rf11';
import type { Assessment } from '../support/rf05-rf11';

describe('RF09 — avaliação de elegibilidade', () => {
  it('CT-RF09-01: considera elegível quem atende inclusão e não atende exclusão', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then(({ study, inclusion, exclusion, candidate }) => {
        evaluateCandidate(accessToken, study.id, candidate.id, inclusion, exclusion).then(({ status, body }) => {
          expect(status).to.equal(201);
          expect(body.status).to.equal('Elegível');
        });
      });
    });
  });

  it('CT-RF09-02: considera inelegível quem falha inclusão ou atende exclusão', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then(({ study, inclusion, exclusion, candidate }) => {
        evaluateCandidate(accessToken, study.id, candidate.id, inclusion, exclusion, 'Não atende', 'Não atende')
          .then(({ body }) => expect(body.status).to.equal('Inelegível'));
        createCandidateFixture(accessToken).then((second) => {
          evaluateCandidate(accessToken, second.study.id, second.candidate.id, second.inclusion, second.exclusion, 'Atende', 'Atende')
            .then(({ body }) => expect(body.status).to.equal('Inelegível'));
        });
      });
    });
  });

  it('CT-RF09-03: mantém o candidato Em avaliação quando há respostas pendentes', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then(({ study, inclusion, exclusion, candidate }) => {
        evaluateCandidate(accessToken, study.id, candidate.id, inclusion, exclusion, 'Pendente', 'Não atende')
          .then(({ body }) => expect(body.status).to.equal('Em avaliação'));
      });
    });
  });

  it('CT-RF09-04: retorna avaliação vazia antes da primeira avaliação e consulta as respostas persistidas', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then(({ study, inclusion, exclusion, candidate }) => {
        const path = `/studies/${study.id}/candidates/${candidate.id}/eligibility-assessments`;
        api<Assessment>('GET', path, accessToken).then(({ status, body }) => {
          expect(status).to.equal(200);
          expect(body.evaluations).to.deep.equal([]);
        });
        evaluateCandidate(accessToken, study.id, candidate.id, inclusion, exclusion).then((saved) => {
          api<Assessment>('GET', path, accessToken).then((current) => {
            expect(current.status).to.equal(200);
            expect(current.body).to.deep.equal(saved.body);
          });
        });
      });
    });
  });

  it('CT-RF09-05: rejeita avaliações incompletas, duplicadas ou ligadas a critérios inválidos', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then(({ study, inclusion, candidate }) => {
        const path = `/studies/${study.id}/candidates/${candidate.id}/eligibility-assessments`;
        api('POST', path, accessToken, {
          evaluations: [{ criterionId: inclusion.id, result: 'Atende' }],
        }).its('status').should('equal', 400);
        api('POST', path, accessToken, { evaluations: [
          { criterionId: inclusion.id, result: 'Atende' },
          { criterionId: inclusion.id, result: 'Não atende' },
        ] }).its('status').should('equal', 400);
        api('POST', path, accessToken, {
          evaluations: [{ criterionId: missingId, result: 'Atende' }],
        }).its('status').should('equal', 400);
      });
    });
  });

  it('CT-RF09-06: bloqueia consulta ou avaliação de candidato inexistente, sem sessão ou sem permissão', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then(({ study, candidate, inclusion }) => {
        const path = `/studies/${study.id}/candidates/${candidate.id}/eligibility-assessments`;
        api('GET', `/studies/${study.id}/candidates/${missingId}/eligibility-assessments`, accessToken)
          .its('status').should('equal', 404);
        api('GET', path).its('status').should('equal', 401);
        api('POST', path, undefined, { evaluations: [] }).its('status').should('equal', 401);
        login('administrator').then(({ accessToken: adminToken }) => {
          api('POST', path, adminToken, {
            evaluations: [{ criterionId: inclusion.id, result: 'Atende' }],
          }).its('status').should('equal', 403);
        });
      });
    });
  });
});
