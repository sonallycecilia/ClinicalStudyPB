import { api, createStudy, login, missingId } from '../support/rf05-rf11';
import type { Activity, Visit } from '../support/rf05-rf11';

describe('RF06 — visitas e atividades previstas', () => {
  it('CT-RF06-01: cadastra visitas e atividades corretamente vinculadas', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        api<Visit>('POST', `/studies/${study.id}/visits`, accessToken, {
          name: 'Visita inicial', order: 1,
        }).then((visit) => {
          expect(visit.status).to.equal(201);
          expect(visit.body.studyId).to.equal(study.id);
          api<Activity>('POST', `/studies/${study.id}/visits/${visit.body.id}/activities`, accessToken, {
            name: 'Coleta inicial', type: 'Exame', description: 'Coleta fictícia',
          }).then((activity) => {
            expect(activity.status).to.equal(201);
            expect(activity.body.visitId).to.equal(visit.body.id);
          });
        });
      });
    });
  });

  it('CT-RF06-02: consulta visitas ordenadas e atividades associadas à visita correta', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        api<Visit>('POST', `/studies/${study.id}/visits`, accessToken, { name: 'Visita final', order: 2 })
          .then(() => api<Visit>('POST', `/studies/${study.id}/visits`, accessToken, { name: 'Visita inicial', order: 1 })
            .then((firstVisit) => {
              api<Activity>('POST', `/studies/${study.id}/visits/${firstVisit.body.id}/activities`, accessToken, {
                name: 'Coleta', type: 'Exame',
              }).then((activity) => {
                api<Visit[]>('GET', `/studies/${study.id}/visits`, accessToken).then(({ body }) => {
                  expect(body.map(({ order }) => order)).to.deep.equal([1, 2]);
                });
                api<Activity[]>('GET', `/studies/${study.id}/visits/${firstVisit.body.id}/activities`, accessToken)
                  .then(({ body }) => expect(body).to.deep.equal([activity.body]));
              });
            }));
      });
    });
  });

  it('CT-RF06-03: impede cadastro de visita ou atividade sem campos obrigatórios válidos', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        api('POST', `/studies/${study.id}/visits`, accessToken, { name: ' ', order: 1 })
          .its('status').should('equal', 400);
        api('POST', `/studies/${study.id}/visits`, accessToken, { name: 'Visita', order: 0 })
          .its('status').should('equal', 400);
        api<Visit>('POST', `/studies/${study.id}/visits`, accessToken, { name: 'Visita', order: 1 }).then((visit) => {
          api('POST', `/studies/${study.id}/visits/${visit.body.id}/activities`, accessToken, {
            name: 'Atividade sem tipo',
          }).its('status').should('equal', 400);
        });
      });
    });
  });

  it('CT-RF06-04: impede vínculos com estudo ou visita inexistente ou incompatível', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        createStudy(accessToken).then((otherStudy) => {
          api('POST', `/studies/${missingId}/visits`, accessToken, { name: 'Visita', order: 1 })
            .its('status').should('equal', 404);
          api<Visit>('POST', `/studies/${otherStudy.id}/visits`, accessToken, { name: 'Visita', order: 1 })
            .then((otherVisit) => {
              api('GET', `/studies/${study.id}/visits/${otherVisit.body.id}`, accessToken)
                .its('status').should('equal', 404);
              api('POST', `/studies/${study.id}/visits/${missingId}/activities`, accessToken, {
                name: 'Atividade', type: 'Exame',
              }).its('status').should('equal', 404);
            });
        });
      });
    });
  });

  it('CT-RF06-05: bloqueia consulta e cadastro sem autenticação ou para perfil sem autorização', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        api('GET', `/studies/${study.id}/visits`).its('status').should('equal', 401);
        api('POST', `/studies/${study.id}/visits`, undefined, { name: 'Visita', order: 1 })
          .its('status').should('equal', 401);
        login('coordinator').then(({ accessToken: coordinatorToken }) => {
          api('GET', `/studies/${study.id}/visits`, coordinatorToken).its('status').should('equal', 403);
        });
      });
    });
  });
});
