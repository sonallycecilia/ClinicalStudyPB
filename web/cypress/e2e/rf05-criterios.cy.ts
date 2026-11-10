import { api, createCriterion, createStudy, login, missingId } from '../support/rf05-rf11';
import type { Criterion } from '../support/rf05-rf11';

describe('RF05 — critérios de inclusão e exclusão', () => {
  it('CT-RF05-01: cadastra critérios de inclusão e exclusão vinculados ao estudo', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        createCriterion(accessToken, study.id, 'Inclusão', 'Idade mínima de 18 anos').then((inclusion) => {
          expect(inclusion).to.include({ studyId: study.id, type: 'Inclusão', active: true });
          createCriterion(accessToken, study.id, 'Exclusão', 'Condição incompatível').then((exclusion) => {
            expect(exclusion).to.include({ studyId: study.id, type: 'Exclusão', active: true });
          });
        });
      });
    });
  });

  it('CT-RF05-02: consulta critérios sem retornar critérios de outros estudos', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        createStudy(accessToken).then((otherStudy) => {
          createCriterion(accessToken, study.id, 'Inclusão', 'Idade mínima').then((criterion) => {
            createCriterion(accessToken, otherStudy.id, 'Inclusão', 'Outro estudo').then((otherCriterion) => {
              api<Criterion[]>('GET', `/studies/${study.id}/criteria`, accessToken).then(({ status, body }) => {
                expect(status).to.equal(200);
                expect(body.map(({ id }) => id)).to.deep.equal([criterion.id]);
                expect(body.every((item) => item.studyId === study.id)).to.equal(true);
              });
              api('GET', `/studies/${study.id}/criteria/${otherCriterion.id}`, accessToken)
                .its('status').should('equal', 404);
            });
          });
        });
      });
    });
  });

  it('CT-RF05-03: impede critérios com tipo ausente ou descrição vazia', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        api('POST', `/studies/${study.id}/criteria`, accessToken, { description: 'Sem tipo' })
          .its('status').should('equal', 400);
        api('POST', `/studies/${study.id}/criteria`, accessToken, { type: 'Inclusão', description: '   ' })
          .its('status').should('equal', 400);
      });
    });
  });

  it('CT-RF05-04: impede vínculo do critério com estudo inexistente ou critério de outro estudo', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        createStudy(accessToken).then((otherStudy) => {
          createCriterion(accessToken, otherStudy.id, 'Inclusão').then((criterion) => {
            api('POST', `/studies/${missingId}/criteria`, accessToken, {
              type: 'Inclusão', description: 'Critério',
            }).its('status').should('equal', 404);
            api('GET', `/studies/${study.id}/criteria/${criterion.id}`, accessToken)
              .its('status').should('equal', 404);
          });
        });
      });
    });
  });

  it('CT-RF05-05: bloqueia consulta ou cadastro sem autenticação e para perfil sem autorização', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        api('GET', `/studies/${study.id}/criteria`).its('status').should('equal', 401);
        api('POST', `/studies/${study.id}/criteria`, undefined, { type: 'Inclusão', description: 'Critério' })
          .its('status').should('equal', 401);
        login('coordinator').then(({ accessToken: coordinatorToken }) => {
          expect(coordinatorToken).to.be.a('string');
          api('POST', `/studies/${study.id}/criteria`, coordinatorToken, {
            type: 'Inclusão', description: 'Critério não autorizado',
          }).its('status').should('equal', 403);
        });
      });
    });
  });
});
