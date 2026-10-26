/**
 * Task 3209 — Cypress: fluxo de acesso e usuários.
 * Os testes exigem o backend e o banco de demonstração disponíveis; não usam o fallback local.
 */
const API_URL = Cypress.expose('apiUrl') ?? 'http://localhost:3000';
const adminEmail = 'ana.souza@clinicalstudypb.test';
const researcherEmail = 'marina.costa@clinicalstudypb.test';
const coordinatorEmail = 'rafael.lima@clinicalstudypb.test';
const demoAdminPassword = 'Admin123!';
const demoPassword = 'Demo123!';

function visitWithCleanBrowser(path = '/login') {
  cy.visit(path, {
    onBeforeLoad(window) {
      window.localStorage.clear();
      window.sessionStorage.clear();
    },
  });
}

function login(email: string, password: string) {
  cy.get('input[autocomplete="username"]').should('be.visible').type(email);
  cy.get('input[autocomplete="current-password"]').should('be.visible').type(password, { log: false });
  cy.contains('button', 'Entrar').click();
}

describe('Task 3209 — fluxo de acesso e usuários', () => {
  beforeEach(() => {
    // Falha rapidamente se a API não estiver disponível, evitando passar por contas locais de demonstração.
    cy.request({ url: `${API_URL}/`, failOnStatusCode: false }).its('status').should('eq', 200);
    visitWithCleanBrowser();
  });

  it('redireciona para o login quando alguém tenta abrir uma rota protegida sem sessão', () => {
    cy.visit('/usuarios');
    cy.location('pathname').should('eq', '/login');
    cy.get('h1').should('contain.text', 'Acesse sua conta');
  });

  it('mostra mensagem de erro para credenciais inválidas', () => {
    login('nao-existe@clinicalstudypb.test', 'SenhaErrada123!');
    cy.get('[role="alert"]')
      .should('be.visible')
      .and('contain.text', 'E-mail ou senha inválidos');
    cy.location('pathname').should('eq', '/login');
  });

  it('impede o Pesquisador de acessar a administração de usuários', () => {
    login(researcherEmail, demoPassword);
    cy.location('pathname', { timeout: 10000 }).should('eq', '/estudos');
    cy.visit('/usuarios');
    cy.location('pathname').should('eq', '/403');
    cy.get('h1').should('contain.text', 'Acesso não permitido');
  });

  it('mostra os menus do Coordenador e bloqueia páginas de outros perfis', () => {
    login(coordinatorEmail, demoPassword);
    cy.location('pathname', { timeout: 10000 }).should('eq', '/coordenador/painel');
    cy.get('nav[aria-label="Menu do perfil Coordenador"]')
      .should('contain.text', 'Painel do coordenador')
      .and('contain.text', 'Candidatos e participantes')
      .and('contain.text', 'Visitas e avaliações')
      .and('contain.text', 'Reagendamentos')
      .and('contain.text', 'Relatórios');
    cy.visit('/estudos');
    cy.location('pathname').should('eq', '/403');
  });

  it('permite ao Administrador cadastrar, pesquisar, editar e excluir um usuário', () => {
    const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const userName = `Usuário Cypress ${uniqueId}`;
    const userEmail = `cypress.${uniqueId}@example.test`;

    login(adminEmail, demoAdminPassword);
    cy.location('pathname', { timeout: 10000 }).should('eq', '/usuarios');
    cy.get('h1').should('contain.text', 'Administração de usuários');
    cy.get('nav[aria-label="Menu do perfil Administrador"]')
      .should('contain.text', 'Administração de usuários');
    cy.contains('td', 'Marina Costa').should('be.visible');

    cy.contains('button', 'Novo usuário').click();
    cy.get('[role="dialog"]').should('be.visible').within(() => {
      cy.contains('label', 'Nome completo').find('input').type(userName);
      cy.contains('label', 'E-mail').find('input').type(userEmail);
      cy.contains('label', 'Telefone').find('input').type('(83) 98765-4321');
      cy.get('input[autocomplete="new-password"]').type('Cypress123!');
      cy.contains('label', 'Perfil de acesso').find('select').select('Pesquisador');
      cy.contains('button', 'Cadastrar usuário').click();
    });

    cy.contains('[role="status"]', 'Usuário cadastrado com sucesso.').should('be.visible');
    cy.contains('tr', userEmail).should('be.visible').and('contain.text', userName);

    cy.get('input[placeholder="Buscar por nome ou e-mail"]').type(userEmail);
    cy.contains('tr', userEmail).should('be.visible');
    cy.get('tbody tr').should('have.length', 1);
    cy.get('input[placeholder="Buscar por nome ou e-mail"]').clear();

    const updatedName = `${userName} atualizado`;
    cy.contains('tr', userEmail).within(() => cy.contains('button', 'Editar').click());
    cy.get('[role="dialog"]').should('contain.text', 'Informações da conta').within(() => {
      cy.contains('label', 'Nome completo').find('input').clear().type(updatedName);
      cy.contains('button', 'Salvar alterações').click();
    });
    cy.contains('[role="status"]', 'Alterações salvas com sucesso.').should('be.visible');
    cy.contains('tr', userEmail).should('contain.text', updatedName);

    cy.contains('tr', userEmail).within(() => cy.contains('button', 'Excluir').click());
    cy.get('[role="dialog"]').should('contain.text', 'Excluir usuário?')
      .and('contain.text', userName)
      .within(() => cy.contains('button', 'Excluir usuário').click());
    cy.contains('tr', userEmail).should('not.exist');
    cy.contains('[role="status"]', 'Conta excluída com sucesso.').should('be.visible');
  });

  it('mantém a sessão após recarregar e revoga a sessão no servidor ao sair', () => {
    cy.intercept('POST', `${API_URL}/auth/logout`).as('serverLogout');
    login(adminEmail, demoAdminPassword);
    cy.location('pathname', { timeout: 10000 }).should('eq', '/usuarios');
    cy.window().its('localStorage').invoke('getItem', 'clinicalstudy.session').should('not.be.null');
    cy.window().then((window) => {
      const session = JSON.parse(window.localStorage.getItem('clinicalstudy.session') ?? '{}') as { accessToken?: string };
      expect(session.accessToken).to.be.a('string');
      cy.wrap(session.accessToken).as('oldToken');
    });

    cy.reload();
    cy.location('pathname').should('eq', '/usuarios');
    cy.get('button[aria-label="Sair da conta"]').click();
    cy.location('pathname').should('eq', '/login');
    cy.wait('@serverLogout').its('response.statusCode').should('eq', 201);
    cy.window().its('localStorage').invoke('getItem', 'clinicalstudy.session').should('be.null');
    cy.get('@oldToken').then((token) => {
      cy.request({
        method: 'GET', url: `${API_URL}/auth/me`, failOnStatusCode: false,
        headers: { Authorization: `Bearer ${token}` },
      }).its('status').should('eq', 401);
    });
  });
});
