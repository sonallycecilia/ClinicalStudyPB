/**
 * Fluxos de critérios e visitas no browser com a API e o PostgreSQL reais.
 */
const API_URL = Cypress.expose('apiUrl') ?? 'http://localhost:3000';
const researcherEmail = 'marina.costa@clinicalstudypb.test';
const researcherPassword = 'Demo123!';

function loginAsResearcher() {
  cy.request({ url: `${API_URL}/`, failOnStatusCode: false }).its('status').should('eq', 200);
  cy.visit('/login', {
    onBeforeLoad(window) {
      window.localStorage.clear();
      window.sessionStorage.clear();
    },
  });
  cy.get('input[autocomplete="username"]').type(researcherEmail);
  cy.get('input[autocomplete="current-password"]').type(researcherPassword, { log: false });
  cy.contains('button', 'Entrar').click();
  cy.location('pathname', { timeout: 10000 }).should('eq', '/estudos');
  cy.contains('h2', 'Meus estudos', { timeout: 10000 }).should('be.visible');
}

function fillStudyForm(title: string) {
  cy.get('[role="dialog"]').within(() => {
    cy.contains('label', 'Título do estudo').find('input').clear().type(title);
    cy.contains('label', 'Objetivo').find('input').clear().type(
      'Validar critérios e visitas previstas com persistência no PostgreSQL.',
    );
    cy.contains('label', 'Pesquisador responsável').find('select')
      .should('be.disabled').and('have.value', 'Marina Costa');
    cy.contains('label', 'Data de início').find('input').clear().type('2099-01-10');
    cy.contains('label', 'Data de término').find('input').clear().type('2099-02-10');
    cy.contains('label', 'Limite de participantes').find('input').clear().type('30');
    cy.contains('label', 'Participantes já vinculados').find('input').clear().type('0');
  });
}

function openStudyDetails(title: string) {
  cy.contains('.study-card', title).within(() => {
    cy.get('button[aria-label^="Ações de"]').click();
  });
  cy.contains('button', 'Ver detalhes').click();
  cy.contains('h1', title).should('be.visible');
}

describe('RF05 e RF06 — critérios, visitas e atividades', () => {
  beforeEach(() => loginAsResearcher());

  it('cadastra, edita e consulta critérios persistidos no backend', () => {
    const title = `Estudo Cypress com critérios ${Date.now()}`;
    const originalCriterion = `Participante com idade mínima ${Date.now()}`;
    const updatedCriterion = `${originalCriterion} confirmado`;

    cy.contains('button', 'Cadastrar estudo').click();
    fillStudyForm(title);
    cy.get('[role="dialog"]').contains('button', 'Cadastrar estudo').click();
    cy.get('[role="dialog"]').contains('button', 'Ver estudos').click();

    cy.contains('.study-card', title).within(() => {
      cy.get('button[aria-label^="Ações de"]').click();
    });
    cy.contains('button', 'Editar estudo').click();
    cy.contains('h4', 'Critérios de inclusão').closest('article').within(() => {
      cy.contains('.study-empty-state', 'Nenhum critério de inclusão adicionado.').should('be.visible');
      cy.contains('label', 'Novo critério de inclusão').find('textarea').type(originalCriterion);
      cy.contains('button', '+ Adicionar critério').click();
      cy.contains(originalCriterion).should('be.visible');
    });
    cy.get('[role="dialog"]').contains('button', 'Salvar alterações').click();
    cy.contains('[role="status"]', 'Estudo e critérios atualizados com sucesso.').should('be.visible');

    openStudyDetails(title);
    cy.contains('h3', 'Critérios de inclusão').closest('article').should('contain.text', originalCriterion);

    cy.contains('button', 'Editar estudo').click();
    cy.get(`[aria-label="Editar critério: ${originalCriterion}"]`).click();
    cy.contains('label', 'Editar critério de inclusão').find('textarea')
      .clear().type(updatedCriterion);
    cy.contains('button', 'Salvar critério').click();
    cy.get('[role="dialog"]').contains('button', 'Salvar alterações').click();
    cy.contains('h3', 'Critérios de inclusão').closest('article')
      .find('.study-criteria-item p').should('have.text', updatedCriterion);

    cy.reload();
    cy.get('input[placeholder="Buscar estudo..."]').type(title);
    openStudyDetails(title);
    cy.contains('h3', 'Critérios de inclusão').closest('article')
      .find('.study-criteria-item p').should('have.text', updatedCriterion);
  });

  it('persiste visitas e atividades, rejeita ordem duplicada e bloqueia cadastro após encerramento', () => {
    const title = `Estudo Cypress com visitas ${Date.now()}`;
    const visitName = `Visita inicial ${Date.now()}`;
    const activityName = `Coleta clínica ${Date.now()}`;

    cy.contains('button', 'Cadastrar estudo').click();
    fillStudyForm(title);
    cy.get('[role="dialog"]').contains('button', 'Cadastrar estudo').click();
    cy.get('[role="dialog"]').contains('button', 'Ver estudos').click();
    openStudyDetails(title);
    cy.contains('button', '+ Cadastrar visita').click();

    cy.get('[role="dialog"]').within(() => {
      cy.contains('label', 'Nome da visita').find('input').type(visitName);
      cy.contains('label', 'Descrição da visita').find('textarea').type('Consulta prevista após a inclusão.');
      cy.contains('button', '+ Adicionar atividade').click();
      cy.get('fieldset[aria-label="Atividade 1"]').within(() => {
        cy.contains('label', 'Nome da atividade').find('input').type(activityName);
        cy.contains('label', 'Tipo').find('input').type('Exame');
        cy.contains('label', 'Descrição da atividade').find('textarea').type('Registrar sinais vitais.');
      });
      cy.contains('button', 'Cadastrar visita').click();
    });

    cy.contains('[role="status"]', 'Visita cadastrada com sucesso.').should('be.visible');
    cy.contains('article.study-criteria-group', visitName).should('contain.text', 'Consulta prevista após a inclusão.');
    cy.contains('article.study-criteria-group', visitName)
      .should('contain.text', activityName)
      .and('contain.text', 'Exame')
      .and('contain.text', 'Registrar sinais vitais.');

    cy.contains('button', '+ Cadastrar visita').click();
    cy.get('[role="dialog"]').within(() => {
      cy.contains('label', 'Nome da visita').find('input').type('Tentativa com ordem repetida');
      cy.contains('label', 'Ordem').find('input').clear().type('1');
      cy.contains('button', 'Cadastrar visita').click();
      cy.get('[role="alert"]').should('contain.text', 'Já existe uma visita com essa ordem neste estudo.');
      cy.contains('button', 'Cancelar').click();
    });

    cy.window().then((window) => {
      const session = JSON.parse(window.localStorage.getItem('clinicalstudy.session') ?? '{}') as { accessToken?: string };
      expect(session.accessToken).to.be.a('string');
      return cy.request({
        method: 'GET',
        url: `${API_URL}/studies`,
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).then(({ body }) => {
        const study = (body as { id: string; title: string }[]).find((item) => item.title === title);
        expect(study, 'study created by this test').to.exist;
        return { accessToken: session.accessToken as string, studyId: study!.id };
      });
    }).then(({ accessToken, studyId }) => {
      cy.request({
        method: 'POST',
        url: `${API_URL}/studies/${studyId}/visits`,
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { name: 'Duplicata via API', order: 1 },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(409);
        expect(response.body.message).to.equal('Já existe uma visita com essa ordem neste estudo.');
      });
    });

    for (const status of ['Recrutamento', 'Execução', 'Encerrado']) {
      cy.contains('button', 'Alterar estado').click();
      cy.get('[role="dialog"]').contains('button', 'Confirmar alteração').click();
      cy.get('.study-detail-hero').contains('.study-status', status).should('be.visible');
    }

    cy.contains('button', '+ Cadastrar visita').should('not.exist');
    cy.window().then((window) => {
      const session = JSON.parse(window.localStorage.getItem('clinicalstudy.session') ?? '{}') as { accessToken?: string };
      return cy.request({
        method: 'GET',
        url: `${API_URL}/studies`,
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).then(({ body }) => {
        const study = (body as { id: string; title: string }[]).find((item) => item.title === title);
        expect(study, 'study created by this test').to.exist;
        return cy.request({
          method: 'POST',
          url: `${API_URL}/studies/${study!.id}/visits`,
          headers: { Authorization: `Bearer ${session.accessToken}` },
          body: { name: 'Visita após encerramento', order: 2 },
          failOnStatusCode: false,
        });
      });
    }).then((response) => {
      expect(response.status).to.equal(400);
      expect(response.body.message).to.equal('Não é possível alterar um estudo encerrado.');
    });
  });
});
