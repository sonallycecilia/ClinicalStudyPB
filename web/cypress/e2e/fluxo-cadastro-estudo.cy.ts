/**
 * Task 3210 — Cypress: fluxo de cadastro de estudo.
 * Esta versão valida a API/PostgreSQL real, incluindo a persistência após recarregar a página.
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

function fillStudyForm(options: {
  title: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  linked?: string;
}) {
  cy.get('[role="dialog"]').within(() => {
    cy.contains('label', 'Título do estudo').find('input').clear().type(options.title);
    cy.contains('label', 'Objetivo').find('input').clear().type(
      'Validar o fluxo automatizado de cadastro de um estudo clínico.',
    );
    // O pesquisador responsável é atribuído pelo token no backend, não editado pelo cliente.
    cy.contains('label', 'Pesquisador responsável').find('select')
      .should('be.disabled').and('have.value', 'Marina Costa');
    cy.contains('label', 'Data de início').find('input').clear().type(options.startDate ?? '2099-01-10');
    cy.contains('label', 'Data de término').find('input').clear().type(options.endDate ?? '2099-02-10');
    cy.contains('label', 'Limite de participantes').find('input').clear().type(options.limit ?? '30');
    cy.contains('label', 'Participantes já vinculados').find('input').clear().type(options.linked ?? '5');
  });
}

describe('Task 3210 — fluxo de cadastro de estudo', () => {
  beforeEach(() => loginAsResearcher());

  it('cadastra estudo no backend e mantém o registro após atualizar a página', () => {
    const title = `Estudo Cypress ${Date.now()}`;

    cy.contains('button', 'Cadastrar estudo').click();
    cy.get('[role="dialog"]').should('contain.text', 'Informações do estudo');
    fillStudyForm({ title });
    cy.get('[role="dialog"]').contains('button', 'Cadastrar estudo').click();

    cy.get('[role="dialog"]')
      .should('contain.text', 'Estudo cadastrado com sucesso!')
      .and('contain.text', title);
    cy.get('[role="dialog"]').contains('button', 'Ver estudos').click();
    cy.get('.study-card').should('contain.text', title);

    cy.reload();
    cy.get('.study-card', { timeout: 10000 }).should('contain.text', title);
    cy.get('input[placeholder="Buscar estudo..."]').type(title);
    cy.get('.study-card').should('have.length', 1).and('contain.text', title);
  });

  it('rejeita data de término anterior à data de início', () => {
    cy.contains('button', 'Cadastrar estudo').click();
    fillStudyForm({ title: `Estudo com datas inválidas ${Date.now()}`, startDate: '2099-02-10', endDate: '2099-02-01' });
    cy.get('[role="dialog"]').contains('button', 'Cadastrar estudo').click();
    cy.get('[role="alert"]').should('be.visible')
      .and('contain.text', 'A data de término deve ser igual ou posterior à data de início.');
    cy.get('[role="dialog"]').should('contain.text', 'Informações do estudo');
  });

  it('rejeita quantidade de participantes vinculados acima do limite', () => {
    cy.contains('button', 'Cadastrar estudo').click();
    fillStudyForm({ title: `Estudo acima do limite ${Date.now()}`, limit: '10', linked: '11' });
    cy.get('[role="dialog"]').contains('button', 'Cadastrar estudo').click();
    cy.get('[role="alert"]').should('be.visible')
      .and('contain.text', 'Os participantes vinculados não podem ultrapassar o limite definido.');
  });
});
