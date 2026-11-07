# Testes automatizados do ClinicalStudyPB

Este documento centraliza as orientações de testes do projeto e registra o estado conhecido das suítes de web, mobile e backend. As informações aqui reunidas foram consolidadas a partir dos artefatos do repositório e do histórico de execução do projeto; sempre que uma verificação foi registrada em um momento anterior, ela é identificada como resultado histórico e não como execução atual.

## 1. Visão geral

O ClinicalStudyPB usa a estratégia recomendada pela especificação e pelo plano da equipe:

- Web: Vitest + Testing Library, com testes de componentes e integração focados em frontend.
- Web E2E: Cypress para fluxos em navegador com a API real e PostgreSQL.
- Mobile: Jest + React Native Testing Library.
- Backend: Jest + Supertest para unitários e testes de integração/E2E.
- CI: GitHub Actions, com workflows específicos por componente.

Os dados de demonstração são fictícios. O sistema não realiza diagnósticos nem decisões clínicas automatizadas.

## 2. Testes Web

### 2.1. Tecnologias e configuração

A aplicação web usa TypeScript, React e Vite. O arquivo `web/package.json` inclui:

- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`
- `cypress`

O Vite usa `jsdom` para os testes e considera arquivos com padrão `src/**/*.test.ts` e `src/**/*.test.tsx`.

O workflow web usa Node.js `24.15.0` e o lockfile do projeto é `web/package-lock.json`.

### 2.2. Arquivos e escopo

Os testes Vitest cobrem cenários de autenticação, autorização, usuários, estudos e páginas de status:

| Arquivo | Escopo |
|---|---|
| `web/src/auth/AuthContext.test.tsx` | sessão persistida, login, logout, indisponibilidade da API e resposta `401` |
| `web/src/studies/studyForm.test.ts` | extração de dígitos e entradas vazias |
| `web/src/studies/studiesApi.test.ts` | listagem, criação e atualização de estudos; erro HTTP e falha de conexão |
| `web/src/integration/webFlows.integration.test.tsx` | fluxos de autenticação, autorização, usuários e estudos com respostas HTTP simuladas |
| `web/src/security/access.test.ts` | menus, rotas, bloqueios por perfil e página inicial |
| `web/src/pages/UsersPage.test.tsx` | listagem, busca, filtros, validação, cadastro, edição, exclusão e erros |
| `web/src/pages/StudiesPage.test.tsx` | listagem, busca, validação, cadastro, edição, detalhes e erros |
| `web/src/pages/StatusPages.test.tsx` | páginas de acesso negado e não encontrado |
| `web/src/pages/LoginPage.test.tsx` | login, acessibilidade, senha, submissão, navegação e erros |
| `web/src/pages/coordenatorPage.test.tsx` | interações locais do painel, candidatos, visitas, reagendamentos e relatórios |

Os specs E2E do Cypress ficam em `web/cypress/e2e/` e configuram fluxos reais de navegador:

| Arquivo | Escopo |
|---|---|
| `web/cypress/e2e/fluxo-acesso-usuarios.cy.ts` | acesso sem sessão, credenciais inválidas, permissões, administração de usuários e persistência/revogação de sessão |
| `web/cypress/e2e/fluxo-cadastro-estudo.cy.ts` | cadastro e edição de estudos, persistência após reload e validações de datas e limites |

Observação importante: os testes Vitest que simulam `fetch` ou o cliente de API validam o comportamento do frontend e as requisições esperadas, mas não acessam uma API real em execução. Já os testes Cypress usam a interface web, a API real e o PostgreSQL.

### 2.3. Pré-requisitos e instalação

- Node.js 24 (`backend/.nvmrc` e workflow web usam `24.15.0`)
- npm
- PostgreSQL disponível para os testes E2E
- backend em execução para os fluxos Cypress
- browser moderno para execução manual

Há uma divergência histórica entre as instruções: um documento sugeria `npm install` para o web e outro `npm ci`. Verificação no repositório: o projeto inclui `web/package-lock.json` e o script raiz usa `npm install --prefix web` em `npm run setup`, enquanto a app web também aceita `npm ci` quando o lockfile estiver sincronizado. Em outras palavras:

- se o lock estiver consistente, `npm ci` é o caminho mais reprodutível;
- se a dependência foi adicionada ou o lock foi reconciliado manualmente, o comando do projeto é `npm install` dentro de `web/`.

Instalação limpa a partir da raiz:

```powershell
npm --prefix web ci
```

Quando a dependência Cypress foi adicionada e o lock ainda não estava sincronizado, o fluxo mais seguro foi:

```powershell
cd web
npm install
npx cypress verify
```

### 2.4. Comandos de execução

```powershell
npm --prefix web test
npm --prefix web run cypress:run
npm --prefix web run cypress:open
npm --prefix web run build
```

Os comandos executam, respectivamente:

- suíte Vitest
- Cypress em modo headless
- interface do Cypress
- build de produção do Vite (`tsc --noEmit` + `vite build`)

### 2.5. Preparação dos serviços para Cypress

A partir da raiz do repositório:

```powershell
docker compose up --build
```

O Compose inicia PostgreSQL, executa migrations e seed do backend e levanta a API e a web. Aguarde os serviços ficarem disponíveis em:

- `http://localhost:5173` — web
- `http://localhost:3000` — API
- `localhost:5433` — PostgreSQL publicado no host

Em outro terminal, execute:

```powershell
npm --prefix web run cypress:run
```

Importante: o PostgreSQL do Compose usa `5433` no host e `5432` dentro da rede Docker; o backend acessa o banco por `postgres:5432` no Docker e pela variável `DATABASE_URL` interna.

### 2.6. Credenciais de demonstração do Web

As contas fictícias de desenvolvimento são:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `ana.souza@clinicalstudypb.test` | `Admin123!` |
| Pesquisador | `marina.costa@clinicalstudypb.test` | `Demo123!` |
| Coordenador | `rafael.lima@clinicalstudypb.test` | `Demo123!` |

### 2.7. Workflow e resultados históricos

O workflow `.github/workflows/web-ci.yml` dispara em `pull_request` e `push` quando há alterações em `web/**` ou no workflow. Ele usa Ubuntu e Node.js `24.15.0`, executa checkout, instalação, testes e build.

Resultados registrados historicamente:

| Verificação | Resultado |
|---|---|
| Vitest | 56 testes aprovados em execução local anterior |
| Cypress | 10 testes E2E aprovados em execução anterior informada pela equipe |
| Build de produção | concluído com sucesso em execução anterior |
| CI | GitHub Actions Web CI executado com sucesso em `qa-web` |

Esses resultados são históricos e não substituem uma execução atual do ambiente.

### 2.8. Limitações conhecidas

- os testes de Coordenador validam interações locais e não demonstram integração real com endpoints;
- os testes Cypress dependem de serviços e dados de demonstração ativos;
- os fluxos Cypress não cobrem o aplicativo mobile.

## 3. Testes Mobile

### 3.1. Tecnologias e escopo

O módulo mobile usa Jest, `jest-expo` e React Native Testing Library.

Os testes existentes cobrem as telas básicas:

| Arquivo | Escopo |
|---|---|
| `mobile/src/screens/__tests__/LoginScreen.test.tsx` | comportamento básico da tela de login |
| `mobile/src/screens/__tests__/HomeScreen.test.tsx` | comportamento básico da tela inicial |

### 3.2. Pré-requisitos e comandos

O workflow do mobile usa Node.js 22. Para execução local:

```powershell
cd mobile
npm ci
npm test -- --runInBand
```

Para gerar cobertura:

```powershell
cd mobile
npm test -- --coverage --runInBand
```

Verificações complementares:

```powershell
cd mobile
npm run lint
npm run typecheck
```

### 3.3. Workflow

O arquivo `.github/workflows/mobile-ci.yml` dispara em `push` e `pull_request` para alterações em `mobile/**` ou para o próprio workflow. A pipeline configura Node.js 22, instala dependências com `npm ci`, executa testes, lint e typecheck e exporta bundles do Expo para plataformas relevantes.

## 4. Testes Backend

### 4.1. Tecnologias e configuração

O backend usa NestJS + TypeScript + Jest + Supertest. Os comandos de testes do backend ficam em `backend/package.json`:

```powershell
cd backend
npm test
npm run test:e2e
npm run test:coverage:all
```

A suíte `test:e2e` usa a configuração em `backend/test/jest-e2e.config.cjs` e está pronta para validar integrações de API com banco de dados.

### 4.2. Requisitos e banco de testes

Os testes de integração e E2E exigem:

- PostgreSQL disponível
- `DATABASE_URL` configurada
- banco com migrations aplicadas
- schema temporário ou dados isolados para cada suíte

No Compose, o banco do desenvolvimento está em `localhost:5433` com credenciais:

| Configuração | Valor |
|---|---|
| Host | `localhost` |
| Porta publicada | `5433` |
| Banco | `clinicalstudypb` |
| Usuário | `clinicalstudy` |
| Senha | `clinicalstudy_local` |

Os testes E2E criam schemas temporários exclusivos, executam as migrations e removem os schemas ao final; não usam contas de produção nem alteram as contas de desenvolvimento.

### 4.3. Comandos relevantes

```powershell
cd backend
cp .env.example .env
npm ci
npm run db:migrate
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Para o seed de demonstração em ambiente local, use:

```powershell
cd backend
$env:ALLOW_DEMO_SEED='true'
npm run db:seed:demo
```

### 4.4. Cobertura

A meta declarada no projeto é de pelo menos 80% das linhas do código de negócio do backend, excluindo código gerado e de configuração. O projeto inclui configuração de cobertura em `backend/jest-coverage.config.cjs` e no script `npm run test:coverage:all`.

A cobertura deve ser aferida em execução atual. Os percentuais registrados em históricos de execução devem ser tratados como informação de contexto e não como resultado vigente.

## 5. Referências úteis

- [Arquitetura e integração](../../arquitetura-e-integracao.md)
- [Banco de dados](../banco_de_dados/README-BD.md)
- [Usuários e controle de acesso](../../usuarios-e-controle-de-acesso.md)
- [README principal](../../../../../README.md)
- [Workflow web CI](../../../../../.github/workflows/web-ci.yml)
- [Workflow backend CI](../../../../../.github/workflows/backend-ci.yml)
- [Workflow mobile CI](../../../../../.github/workflows/mobile-ci.yml)
