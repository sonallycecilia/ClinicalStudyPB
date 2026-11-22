import {
  accounts, api, createCandidate, createCriterion, evaluateCandidate, login, recordConsent, transitionStudy,
} from '../support/rf05-rf11';
import type { Candidate, Criterion, Inclusion, Study, Visit } from '../support/rf05-rf11';

interface ScheduledVisit {
  id: string;
  studyId: string;
  status: string;
  realizedAt: string | null;
}

interface Fixture {
  researcherToken: string;
  study: Study;
  participantName: string;
  plannedVisitName: string;
}

function createFixture(): Cypress.Chainable<Fixture> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const studyTitle = `S3-QA-06 RF12-RF13 ${suffix}`;
  const participantName = `Participante E2E ${suffix}`;
  const plannedVisitName = `Visita E2E ${suffix}`;

  return login('researcher').then(({ accessToken: researcherToken }) =>
    api<Study>('POST', '/studies', researcherToken, {
      title: studyTitle,
      objective: 'Validar agendamento e atualização de situação via interface Web.',
      startDate: '2020-01-01',
      endDate: '2099-12-31',
      participantLimit: 5,
      participantsLinked: 0,
    }).then(({ status, body: study }) => {
      expect(status, 'create study fixture').to.equal(201);
      return transitionStudy(researcherToken, study.id, 'recrutamento').then(({ status: transitionStatus }) => {
        expect(transitionStatus, 'put fixture study in recruitment').to.equal(200);
        return api<Visit>('POST', `/studies/${study.id}/visits`, researcherToken, {
          name: plannedVisitName,
          order: 1,
        }).then(({ status: visitStatus }) => {
          expect(visitStatus, 'create planned visit').to.equal(201);
          return createCriterion(researcherToken, study.id, 'Inclusão')
            .then((inclusion: Criterion) => createCriterion(researcherToken, study.id, 'Exclusão')
              .then((exclusion: Criterion) => createCandidate(researcherToken, study.id, participantName)
                .then((candidate: Candidate) => evaluateCandidate(
                  researcherToken, study.id, candidate.id, inclusion, exclusion,
                ).then(({ status: assessmentStatus }) => {
                  expect(assessmentStatus, 'make candidate eligible').to.equal(201);
                  return recordConsent(researcherToken, study.id, candidate.id).then(({ status: consentStatus }) => {
                    expect(consentStatus, 'record consent').to.equal(201);
                    return api<Inclusion>(
                      'POST',
                      `/studies/${study.id}/candidates/${candidate.id}/include`,
                      researcherToken,
                    ).then(({ status: inclusionStatus, body }) => {
                      expect(inclusionStatus, 'include participant').to.equal(201);
                      expect(body.participationStatus).to.equal('Ativo');
                      return { researcherToken, study, participantName, plannedVisitName };
                    });
                  });
                }))));
      });
    });
  }));
}

function localDateTimeMinutesAgo(minutes: number): string {
  const date = new Date(Date.now() - minutes * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe('S3-QA-06 — RF12 agendamento → RF13 situação (Web + API + PostgreSQL)', () => {
  it('agenda uma visita pela interface, registra Realizada e confirma a persistência após recarregar', () => {
    createFixture().then(({ researcherToken, study, participantName, plannedVisitName }) => {
      const scheduledAt = localDateTimeMinutesAgo(5);

      cy.visit('/login', {
        onBeforeLoad(window) {
          window.localStorage.clear();
          window.sessionStorage.clear();
        },
      });
      cy.get('input[autocomplete="username"]').type(accounts.coordinator.email);
      cy.get('input[autocomplete="current-password"]').type(accounts.coordinator.password, { log: false });
      cy.contains('button', 'Entrar').click();
      cy.location('pathname', { timeout: 10000 }).should('eq', '/coordenador/painel');
      cy.visit('/coordenador/visitas');
      cy.contains('h1', 'Visitas e avaliações').should('be.visible');

      cy.intercept({ method: 'POST', pathname: `/studies/${study.id}/scheduled-visits` }).as('scheduleVisit');
      cy.contains('button', 'Agendar visita').click();
      cy.get('[role="dialog"]').within(() => {
        cy.get('#schedule-study').select(study.title);
        cy.get('#schedule-participant').should('be.enabled').select(participantName);
        cy.get('#schedule-planned-visit').should('be.enabled').select(`1. ${plannedVisitName}`);
        cy.get('#schedule-date').type(scheduledAt);
        cy.contains('button', 'Agendar visita').click();
      });

      let scheduledVisitId = '';
      cy.wait('@scheduleVisit').then(({ response }) => {
        expect(response?.statusCode, 'E02 response').to.equal(201);
        const scheduled = response?.body as ScheduledVisit;
        expect(scheduled.status).to.equal('Agendada');
        expect(scheduled.studyId).to.equal(study.id);
        scheduledVisitId = scheduled.id;
      });
      cy.contains('[role="status"]', `Visita agendada com sucesso! ${participantName} · ${plannedVisitName}`).should('be.visible');
      cy.contains('table[aria-label="Agenda de visitas"] tbody tr', participantName)
        .should('contain.text', plannedVisitName)
        .and('contain.text', 'Agendada');

      cy.intercept({
        method: 'PATCH',
        pathname: `/studies/${study.id}/scheduled-visits/*/status`,
      }).as('updateVisitStatus');
      cy.contains('table[aria-label="Agenda de visitas"] tbody tr', participantName).within(() => {
        cy.contains('button', 'Atualizar situação').click();
      });
      cy.get('[role="dialog"]').within(() => {
        cy.get('input[type="radio"][value="Realizada"]').check();
        cy.get('#visit-status-realized-at').clear().type(scheduledAt);
        cy.contains('button', 'Confirmar situação').click();
      });

      cy.wait('@updateVisitStatus').then(({ response }) => {
        expect(response?.statusCode, 'E04 response').to.equal(200);
        expect(response?.body).to.include({ id: scheduledVisitId, status: 'Realizada' });
        expect(response?.body.realizedAt).to.be.a('string');
      });
      cy.contains('[role="status"]', `Situação atualizada para “Realizada”: ${participantName} · ${plannedVisitName}`)
        .should('be.visible');
      cy.contains('table[aria-label="Agenda de visitas"] tbody tr', participantName)
        .should('contain.text', 'Realizada');

      api<ScheduledVisit[]>('GET', `/studies/${study.id}/scheduled-visits`, researcherToken).then(({ status, body }) => {
        expect(status, 'E03 persistence read').to.equal(200);
        expect(body.find((visit) => visit.id === scheduledVisitId)).to.include({ status: 'Realizada' });
      });

      cy.reload();
      cy.contains('h1', 'Visitas e avaliações').should('be.visible');
      cy.contains('table[aria-label="Agenda de visitas"] tbody tr', participantName)
        .should('contain.text', plannedVisitName)
        .and('contain.text', 'Realizada');
    });
  });
});
