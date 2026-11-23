import { api, createCandidate, createRecruitingStudy, login, missingId } from '../support/rf05-rf11';
import type { Candidate } from '../support/rf05-rf11';

describe('RF08 — cadastro de candidatos', () => {
  it('CT-RF08-01: cadastra candidato com dados válidos vinculado ao estudo selecionado', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        createCandidate(accessToken, study.id, 'Candidato vinculado').then((candidate) => {
          expect(candidate).to.include({ studyId: study.id, name: 'Candidato vinculado' });
          expect(candidate.email).to.match(/@example\.test$/);
        });
      });
    });
  });

  it('CT-RF08-02: lista candidatos por estudo sem incluir candidatos de outro estudo', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        createRecruitingStudy(accessToken).then((otherStudy) => {
          createCandidate(accessToken, study.id, 'Candidato do primeiro estudo').then((candidate) => {
            createCandidate(accessToken, otherStudy.id, 'Candidato do segundo estudo').then((otherCandidate) => {
              api<Candidate[]>('GET', `/studies/${study.id}/candidates`, accessToken).then(({ body }) => {
                expect(body.map(({ id }) => id)).to.deep.equal([candidate.id]);
                expect(body.every((item) => item.studyId === study.id)).to.equal(true);
              });
              api<Candidate[]>('GET', `/studies/${otherStudy.id}/candidates`, accessToken)
                .its('body.0.id').should('equal', otherCandidate.id);
            });
          });
        });
      });
    });
  });

  it('CT-RF08-03: impede cadastro sem nome ou com e-mail inválido', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        api('POST', `/studies/${study.id}/candidates`, accessToken, { name: '   ' })
          .its('status').should('equal', 400);
        api('POST', `/studies/${study.id}/candidates`, accessToken, {
          name: 'Candidato válido', email: 'email-invalido',
        }).its('status').should('equal', 400);
      });
    });
  });

  it('CT-RF08-04: impede cadastro de candidato em estudo inexistente', () => {
    login().then(({ accessToken }) => {
      api('POST', `/studies/${missingId}/candidates`, accessToken, { name: 'Candidato' })
        .its('status').should('equal', 404);
    });
  });

  it('CT-RF08-05: bloqueia cadastro e consulta sem sessão ou sem autorização', () => {
    login().then(({ accessToken }) => {
      createRecruitingStudy(accessToken).then((study) => {
        api('GET', `/studies/${study.id}/candidates`).its('status').should('equal', 401);
        api('POST', `/studies/${study.id}/candidates`, undefined, { name: 'Candidato' })
          .its('status').should('equal', 401);
        login('administrator').then(({ accessToken: adminToken }) => {
          api('POST', `/studies/${study.id}/candidates`, adminToken, { name: 'Candidato' })
            .its('status').should('equal', 403);
        });
      });
    });
  });
});
