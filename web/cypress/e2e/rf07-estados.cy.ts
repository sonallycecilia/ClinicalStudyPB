import { api, createStudy, login, missingId, transitionStudy } from '../support/rf05-rf11';
import type { Study } from '../support/rf05-rf11';

describe('RF07 — estados do estudo', () => {
  it('CT-RF07-01: cria estudo no estado inicial Planejamento', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => expect(study.status).to.equal('planejamento'));
    });
  });

  it('CT-RF07-02: permite as transições válidas em sequência', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        transitionStudy(accessToken, study.id, 'recrutamento').its('status').should('equal', 200);
        transitionStudy(accessToken, study.id, 'execução').its('status').should('equal', 200);
        transitionStudy(accessToken, study.id, 'encerrado').its('status').should('equal', 200);
      });
    });
  });

  it('CT-RF07-03: rejeita transições inválidas e preserva o estado anterior', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        transitionStudy(accessToken, study.id, 'execução').its('status').should('equal', 400);
        api<Study>('GET', `/studies/${study.id}`, accessToken).its('body.status').should('equal', 'planejamento');
        transitionStudy(accessToken, study.id, 'recrutamento').then(() => {
          transitionStudy(accessToken, study.id, 'planejamento').its('status').should('equal', 400);
          api<Study>('GET', `/studies/${study.id}`, accessToken).its('body.status').should('equal', 'recrutamento');
        });
      });
    });
  });

  it('CT-RF07-04: consulta o estado persistido após cada transição', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        transitionStudy(accessToken, study.id, 'recrutamento').then(() => {
          api<Study>('GET', `/studies/${study.id}`, accessToken).its('body.status').should('equal', 'recrutamento');
          transitionStudy(accessToken, study.id, 'execução').then(() => {
            api<Study>('GET', `/studies/${study.id}`, accessToken).its('body.status').should('equal', 'execução');
          });
        });
      });
    });
  });

  it('CT-RF07-05: impede alterações em estudo inexistente, sem sessão ou sem autorização', () => {
    login().then(({ accessToken }) => {
      createStudy(accessToken).then((study) => {
        transitionStudy(accessToken, missingId, 'recrutamento').its('status').should('equal', 404);
        transitionStudy('', study.id, 'recrutamento').its('status').should('equal', 401);
        login('coordinator').then(({ accessToken: coordinatorToken }) => {
          transitionStudy(coordinatorToken, study.id, 'recrutamento').its('status').should('equal', 403);
        });
      });
    });
  });
});
