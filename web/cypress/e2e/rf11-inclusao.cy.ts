import {
  api, assertInclusionUnchanged, createCandidate, createCandidateFixture, evaluateCandidate, login,
  makeCandidateEligible, missingId, recordConsent, transitionStudy,
} from '../support/rf05-rf11';
import type { CandidateFixture, Inclusion } from '../support/rf05-rf11';

function includeCandidate(fixture: CandidateFixture, candidateId = fixture.candidate.id) {
  return api<Inclusion>(
    'POST',
    `/studies/${fixture.study.id}/candidates/${candidateId}/include`,
    fixture.token,
  );
}

describe('RF11 — inclusão de candidatos', () => {
  it('CT-RF11-01: inclui candidato elegível, consentido e com vaga disponível', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        makeCandidateEligible(fixture).then((eligible) => {
          includeCandidate(eligible).then(({ status, body }) => {
            expect(status).to.equal(201);
            expect(body).to.include({
              candidateId: eligible.candidate.id,
              studyId: eligible.study.id,
              participationStatus: 'Ativo',
              participantsLinked: 1,
              participantLimit: eligible.study.participantLimit,
            });
          });
        });
      });
    });
  });

  it('CT-RF11-02A: impede inclusão quando candidato não atende critério de inclusão', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        const { study, candidate, inclusion, exclusion } = fixture;
        evaluateCandidate(accessToken, study.id, candidate.id, inclusion, exclusion, 'Não atende', 'Não atende')
          .then(({ body: assessment }) => {
            expect(assessment.status).to.equal('Inelegível');
            recordConsent(accessToken, study.id, candidate.id).then(() => {
              includeCandidate(fixture).then(({ status, body }) => {
                expect(status).to.equal(400);
                expect(body.code).to.equal('CANDIDATE_INELIGIBLE');
                assertInclusionUnchanged(accessToken, study.id, candidate.id, 'Inelegível', 0);
              });
            });
          });
      });
    });
  });

  it('CT-RF11-02B: impede inclusão quando candidato atende critério de exclusão', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        const { study, candidate, inclusion, exclusion } = fixture;
        evaluateCandidate(accessToken, study.id, candidate.id, inclusion, exclusion, 'Atende', 'Atende')
          .then(({ body: assessment }) => {
            expect(assessment.status).to.equal('Inelegível');
            recordConsent(accessToken, study.id, candidate.id).then(() => {
              includeCandidate(fixture).then(({ status, body }) => {
                expect(status).to.equal(400);
                expect(body.code).to.equal('CANDIDATE_INELIGIBLE');
                assertInclusionUnchanged(accessToken, study.id, candidate.id, 'Inelegível', 0);
              });
            });
          });
      });
    });
  });

  it('CT-RF11-03: impede inclusão sem consentimento registrado', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        evaluateCandidate(accessToken, fixture.study.id, fixture.candidate.id, fixture.inclusion, fixture.exclusion)
          .then(({ body: assessment }) => {
            expect(assessment.status).to.equal('Elegível');
            includeCandidate(fixture).then(({ status, body }) => {
              expect(status).to.equal(400);
              expect(body.code).to.equal('CONSENT_MISSING');
            });
          });
      });
    });
  });

  it('CT-RF11-04: impede inclusão quando o limite de participantes foi atingido', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken, 1).then((fixture) => {
        makeCandidateEligible(fixture).then((eligible) => {
          includeCandidate(eligible).then((firstInclusion) => {
            expect(firstInclusion.status).to.equal(201);
            createCandidate(accessToken, fixture.study.id, 'Candidato sem vaga').then((candidate) => {
              evaluateCandidate(accessToken, fixture.study.id, candidate.id, fixture.inclusion, fixture.exclusion)
                .then(() => recordConsent(accessToken, fixture.study.id, candidate.id)
                  .then(() => includeCandidate(fixture, candidate.id).then(({ status, body }) => {
                    expect(status).to.equal(400);
                    expect(body.code).to.equal('STUDY_FULL');
                    assertInclusionUnchanged(accessToken, fixture.study.id, candidate.id, 'Elegível', 1);
                  })));
            });
          });
        });
      });
    });
  });

  it('CT-RF11-05: impede inclusão de candidato ou estudo inexistente e de perfil sem permissão', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        makeCandidateEligible(fixture).then(() => {
          api('POST', `/studies/${fixture.study.id}/candidates/${missingId}/include`, accessToken)
            .its('status').should('equal', 404);
          api('POST', `/studies/${missingId}/candidates/${fixture.candidate.id}/include`, accessToken)
            .its('status').should('equal', 404);
          api('POST', `/studies/${fixture.study.id}/candidates/${fixture.candidate.id}/include`)
            .its('status').should('equal', 401);
          login('administrator').then(({ accessToken: adminToken }) => {
            api('POST', `/studies/${fixture.study.id}/candidates/${fixture.candidate.id}/include`, adminToken)
              .its('status').should('equal', 403);
          });
        });
      });
    });
  });

  it('CT-RF11-06: preserva estado e contador quando a inclusão falha sem consentimento', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        evaluateCandidate(accessToken, fixture.study.id, fixture.candidate.id, fixture.inclusion, fixture.exclusion)
          .then(() => {
            includeCandidate(fixture).then(({ status, body }) => {
              expect(status).to.equal(400);
              expect(body.code).to.equal('CONSENT_MISSING');
              assertInclusionUnchanged(accessToken, fixture.study.id, fixture.candidate.id, 'Elegível', 0);
            });
          });
      });
    });
  });

  it('CT-RF11-07: inclusões concorrentes não ultrapassam a última vaga', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken, 1).then((fixture) => {
        createCandidate(accessToken, fixture.study.id, 'Candidato concorrente B').then((second) => {
          makeCandidateEligible(fixture).then(() => {
            evaluateCandidate(accessToken, fixture.study.id, second.id, fixture.inclusion, fixture.exclusion)
              .then(() => recordConsent(accessToken, fixture.study.id, fixture.candidate.id)
                .then(() => recordConsent(accessToken, fixture.study.id, second.id)
                  .then(() => {
                    cy.visit('/');
                    cy.window().then((window) => Promise.all([fixture.candidate.id, second.id].map((candidateId) =>
                      window.fetch(
                        `${Cypress.expose('apiUrl') ?? 'http://localhost:3000'}/studies/${fixture.study.id}/candidates/${candidateId}/include`,
                        {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                          },
                        },
                      ).then(async (response) => ({ status: response.status, body: await response.json() })),
                    ))).then((responses) => {
                      expect(responses.map(({ status }) => status).sort()).to.deep.equal([201, 400]);
                      expect(responses.find(({ status }) => status === 400)?.body.code).to.equal('STUDY_FULL');
                      api('GET', `/studies/${fixture.study.id}`, accessToken)
                        .its('body.participantsLinked').should('equal', 1);
                    });
                  })));
          });
        });
      });
    });
  });

  it('CT-RF11-08: impede incluir duas vezes o mesmo candidato', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        makeCandidateEligible(fixture).then((eligible) => {
          includeCandidate(eligible).then((firstInclusion) => {
            expect(firstInclusion.status).to.equal(201);
            includeCandidate(eligible).then(({ status, body }) => {
              expect(status).to.equal(400);
              expect(body.code).to.equal('CANDIDATE_ALREADY_INCLUDED');
              assertInclusionUnchanged(accessToken, eligible.study.id, eligible.candidate.id, 'Incluído', 1);
            });
          });
        });
      });
    });
  });

  it('CT-RF11-09A: valida permissão do Coordenador em estudo recrutável', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        makeCandidateEligible(fixture).then((eligible) => {
          login('coordinator').then(({ accessToken: coordinatorToken }) => {
            api(
              'POST',
              `/studies/${eligible.study.id}/candidates/${eligible.candidate.id}/include`,
              coordinatorToken,
            ).then((allowed) => {
              expect(allowed.status).to.equal(201);
              assertInclusionUnchanged(accessToken, eligible.study.id, eligible.candidate.id, 'Incluído', 1);
            });
          });
        });
      });
    });
  });

  it('CT-RF11-09B: bloqueia Coordenador fora da fase de recrutamento', () => {
    login().then(({ accessToken }) => {
      createCandidateFixture(accessToken).then((fixture) => {
        createCandidate(accessToken, fixture.study.id, 'Candidato para estado inválido').then((candidate) => {
          evaluateCandidate(accessToken, fixture.study.id, candidate.id, fixture.inclusion, fixture.exclusion)
            .then(() => recordConsent(accessToken, fixture.study.id, candidate.id)
              .then(() => login('coordinator').then(({ accessToken: coordinatorToken }) => {
                transitionStudy(accessToken, fixture.study.id, 'recrutamento').then(() => {
                  transitionStudy(accessToken, fixture.study.id, 'execução').then(() => {
                    api(
                      'POST',
                      `/studies/${fixture.study.id}/candidates/${candidate.id}/include`,
                      coordinatorToken,
                    ).its('status').should('equal', 403);
                    assertInclusionUnchanged(accessToken, fixture.study.id, candidate.id, 'Elegível', 0);
                  });
                });
              })));
        });
      });
    });
  });
});
