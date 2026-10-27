# ClinicalStudyPB — Testes Automatizados

## 1. Objetivo e visão geral

Este documento centraliza as instruções, o escopo e os resultados conhecidos dos testes automatizados dos módulos web, mobile e backend do ClinicalStudyPB. Os dados utilizados nos exemplos e testes são fictícios; o sistema não realiza diagnósticos nem decisões clínicas automatizadas.

Os níveis de teste têm objetivos diferentes:

- **Unitários:** verificam funções, serviços e regras isoladas, normalmente com dependências simuladas.
- **Componentes:** verificam renderização, acessibilidade e interações de telas da interface.
- **Integração de módulos:** verifica comunicação entre componentes e serviços reais. Uma chamada `fetch` simulada valida o fluxo do frontend, mas não comprova integração com uma API em execução.
- **E2E:** exercita fluxos pela aplicação em execução, cobrindo interfaces e serviços reais incluídos no ambiente do teste.

Os comandos abaixo são executados a partir da raiz usando `npm --prefix <módulo> ...`, exceto quando explicitamente indicado. Os resultados históricos foram mantidos com indicação de sua origem; os testes não foram reexecutados durante esta consolidação.

## 2. Testes do Web

### Tecnologias e configuração

O `web/package.json` declara Vitest, React Testing Library, `@testing-library/jest-dom`, jsdom e Cypress. A aplicação utiliza TypeScript, React e Vite. O lockfile disponível é `web/package-lock.json`; o workflow configura Node.js `24.15.0`.

O Vitest usa o ambiente `jsdom` e inclui `src/**/*.test.ts` e `src/**/*.test.tsx`, conforme `web/vite.config.ts`.

### Arquivos e escopo

Os dez arquivos Vitest cobrem:

| Arquivo | Escopo |
|---|---|
| `web/src/auth/AuthContext.test.tsx` | Sessão persistida, login, logout, indisponibilidade da API e resposta `401`. |
| `web/src/studies/studyForm.test.ts` | Extração de algarismos e entradas vazias. |
| `web/src/studies/studiesApi.test.ts` | Listagem, criação e atualização de estudos; erros HTTP e falhas de conexão. |
| `web/src/integration/webFlows.integration.test.tsx` | Fluxos de autenticação, autorização, estudos e usuários com respostas HTTP simuladas. |
| `web/src/security/access.test.ts` | Menus, rotas autorizadas, bloqueios por perfil e página inicial. |
| `web/src/pages/UsersPage.test.tsx` | Listagem, busca, filtros, validação, cadastro, edição, exclusão e erros. |
| `web/src/pages/StudiesPage.test.tsx` | Listagem, busca, validação, cadastro, edição, detalhes e erros. |
| `web/src/pages/StatusPages.test.tsx` | Páginas de acesso negado e não encontrado. |
| `web/src/pages/LoginPage.test.tsx` | Campos de login, acessibilidade, senha, submissão, navegação e erros. |
| `web/src/pages/coordenatorPage.test.tsx` | Interações locais de painel, candidatos, visitas, reagendamentos e relatórios. |

O arquivo `web/cypress.config.ts` configura dois specs E2E:

| Arquivo | Escopo |
|---|---|
| `web/cypress/e2e/fluxo-acesso-usuarios.cy.ts` | Acesso sem sessão, credenciais inválidas, permissões, administração de usuários e persistência/revogação de sessão. |
| `web/cypress/e2e/fluxo-cadastro-estudo.cy.ts` | Cadastro e edição de estudos, persistência após recarregar e validações de datas e limites. |

Os testes Vitest que simulam `fetch` ou o cliente de API exercitam o comportamento do frontend e as requisições esperadas, mas **não** acessam uma API real. Os cenários Cypress, por sua vez, usam a interface web, a API real e o PostgreSQL; não exercitam o aplicativo mobile.

### Pré-requisitos e instalação

- Node.js e npm; o workflow web usa Node.js `24.15.0`.
- Para os testes E2E, Cypress instalado e os serviços web e API disponíveis em `http://localhost:5173` e `http://localhost:3000`.
- Para os fluxos E2E, PostgreSQL preparado pelas migrations e com os usuários fictícios de demonstração.

Instalação limpa a partir da raiz:

```powershell
npm --prefix web ci
```

### Comandos

```powershell
npm --prefix web test
npm --prefix web run cypress:run
npm --prefix web run cypress:open
npm --prefix web run build
```

Os scripts correspondem, respectivamente, à suíte Vitest, execução Cypress headless, interface do Cypress e checagem TypeScript seguida do build de produção Vite.

### Preparação dos serviços para Cypress

Na raiz do repositório, inicie o ambiente configurado pelo Compose:

```powershell
docker compose up --build
```

O Compose aguarda o PostgreSQL, executa `npm run db:migrate` e `npm run db:seed:demo` no backend e inicia a API e o web. Aguarde os serviços estarem disponíveis nas URLs acima; em outro terminal, execute `npm --prefix web run cypress:run`. O Compose publica o PostgreSQL na porta `5433` do host para acesso local; o backend no Compose o acessa pela porta `5432` na rede interna. Evite iniciar outro Vite usando a porta `5173`.

### Resultados registrados

Estes resultados foram confirmados em execuções anteriores ou informados pela equipe. Não foram reexecutados durante esta consolidação.

| Verificação | Resultado e origem |
|---|---|
| Vitest | 56 testes aprovados em 10 arquivos; resultado de execução local anterior. |
| Cypress | 10 testes E2E aprovados em execução anterior informada pela equipe. |
| Build de produção | Concluído com sucesso após correção TypeScript; resultado local anterior. |
| GitHub Actions | A execução [Web CI #40410294393](https://github.com/sonallycecilia/ClinicalStudyPB/actions/runs/40410294393), na branch `qa-web`, terminou com sucesso em 26/10/2026. |

### Workflow e cobertura

`.github/workflows/web-ci.yml` executa em `pull_request` e `push` quando há alterações em `web/**` ou no próprio workflow. Usa Ubuntu e Node.js `24.15.0`; as etapas são checkout, configuração do Node, `npm ci`, `npm test` e `npm run build`, todas com diretório de trabalho `web`. **Cypress não faz parte deste workflow.**

Não há configuração ou medição verificável de cobertura do web. Nenhum percentual é informado.

### Limitações

Os testes das telas do Coordenador verificam interações locais e não demonstram comunicação com endpoints reais. O Cypress depende de serviços e dados de demonstração ativos. Os fluxos Cypress não cobrem o mobile.

## 3. Testes do Mobile

### Tecnologias e testes

O módulo utiliza Jest, `jest-expo` e React Native Testing Library. Há testes para duas telas:

| Arquivo | Escopo |
|---|---|
| `LoginScreen.test.tsx` | Comportamento básico da tela de login. |
| `HomeScreen.test.tsx` | Comportamento básico da tela inicial. |

Os testes verificam aspectos básicos da renderização das telas. A cobertura de cenários adicionais poderá ser ampliada conforme novas funcionalidades forem desenvolvidas.

Localização dos arquivos: os testes estão associados às telas correspondentes dentro da estrutura do aplicativo mobile.

### Pré-requisitos, instalação e comandos

São necessários Node.js em versão compatível com o CI e npm. Execute os comandos dentro de `mobile/`:

```bat
npm.cmd ci
npm.cmd test -- --runInBand
```

Para gerar relatório de cobertura e executar sequencialmente:

```bat
npm.cmd test -- --coverage --runInBand
```

Verificações complementares:

```bat
npm.cmd run lint
npx.cmd tsc --noEmit
git diff --check
```

### Workflow, resultados e cobertura

A pipeline de CI está definida em `.github/workflows/mobile-ci.yml`. Ela prepara a versão de Node.js, instala as dependências pelo lockfile, executa os testes e realiza verificações adicionais configuradas no workflow.

O resultado de `npm.cmd test -- --runInBand` foi de **2 suítes aprovadas e 2 testes aprovados**, sem falhas. A execução de cobertura com `npm.cmd test -- --coverage --runInBand` foi concluída com sucesso, com **100% de cobertura para o código contemplado pela configuração atual**.

## 4. Testes do Backend

### Tecnologias e arquivos

O `backend/package.json` declara Jest, `ts-jest`, Supertest e TypeScript, além de NestJS e PostgreSQL (`pg`). As configurações estão em:

- `backend/jest.config.cjs`: testes unitários em `src/**/*.spec.ts`.
- `backend/test/jest-e2e.config.cjs`: testes E2E em `test/**/*.e2e-spec.ts`.
- `backend/jest-coverage.config.cjs`: execução consolidada de testes unitários e E2E e coleta de cobertura.

Os arquivos unitários atuais são:

| Arquivo | Escopo |
|---|---|
| `backend/src/app.controller.spec.ts` | Resposta da rota raiz. |
| `backend/src/auth/access-token.guard.spec.ts` | Tokens inválidos/expirados, sessão revogada, conta inativa e perfil atual. |
| `backend/src/auth/auth.service.spec.ts` | Emissão de tokens, sessões e rejeição de credenciais inválidas. |
| `backend/src/auth/roles.guard.spec.ts` | Permissão e bloqueio de acesso por perfil. |
| `backend/src/studies/studies.service.spec.ts` | Consulta, criação, atualização, validação, isolamento por pesquisador e status dos estudos. |
| `backend/src/users/users.service.spec.ts` | Dados públicos, autenticação, duplicidade e conta inexistente. |

Os três arquivos E2E atuais são `backend/test/app.e2e-spec.ts` (rota raiz), `backend/test/access.e2e-spec.ts` (PostgreSQL, autenticação, sessões, usuários e permissões) e `backend/test/studies.e2e-spec.ts` (operações e isolamento de estudos persistidos no PostgreSQL). `backend/test/database-test-app.ts` cria um schema isolado por suíte, aplica as migrations nesse schema e o remove ao finalizar.

### Pré-requisitos, instalação e comandos

- Node.js na faixa `>=24.15.0 <25`, conforme `backend/package.json`, e npm.
- PostgreSQL acessível para os testes E2E e para a cobertura consolidada.
- `backend/package-lock.json` para instalação reproduzível.

Instale as dependências a partir da raiz:

```powershell
npm --prefix backend ci
```

Os comandos abaixo também partem da raiz do repositório:

| Comando | Finalidade |
|---|---|
| `npm --prefix backend run build` | Compila a API. |
| `npm --prefix backend run lint` | Executa oxlint em `src/` e `test/`. |
| `npm --prefix backend test -- --runInBand` | Executa os testes unitários sequencialmente. |
| `npm --prefix backend run test:e2e -- --runInBand` | Executa os testes E2E. |
| `npm --prefix backend run test:cov -- --runInBand` | Executa testes unitários com cobertura. |
| `npm --prefix backend run test:coverage:all` | Executa testes unitários e E2E com cobertura consolidada, em sequência. |

### PostgreSQL, `DATABASE_URL` e segurança

Os testes E2E e `test:coverage:all` precisam de `DATABASE_URL` apontando para um banco PostgreSQL **destinado exclusivamente a testes**, criado previamente. O helper E2E cria e elimina schemas temporários dentro desse banco; a URL ainda precisa conectar a um banco PostgreSQL existente.

No PowerShell, defina a variável antes dos comandos de teste:

```powershell
$env:DATABASE_URL = "postgres://usuario:senha@localhost:5432/banco_teste"
npm --prefix backend run test:e2e -- --runInBand
npm --prefix backend run test:coverage:all
```

A variável definida com `$env:` vale somente para aquela sessão do PowerShell. Substitua os valores fictícios por credenciais de um banco de teste adequado e, quando terminar, remova a variável dessa sessão com `Remove-Item Env:DATABASE_URL`.

**Nunca** aponte os testes para produção ou para um banco com dados importantes. Não use credenciais reais em documentação, exemplos ou logs.

As configurações confirmam que o PostgreSQL do workflow CI usa o banco de testes `clinicalstudypb_test` na porta `5432`. Isso não é a mesma configuração do Compose local: `compose.yaml` cria o banco de desenvolvimento `clinicalstudypb` e publica a porta interna `5432` na porta **`5433` do host**. Portanto, não se deve tratar `5432` como porta universal para conexões locais nem confundir o banco de desenvolvimento do Compose com um banco de testes. A execução local anterior informada pela equipe usou explicitamente `clinicalstudypb_test` na porta `5432`; crie/configure o banco de teste local conforme o PostgreSQL disponível no ambiente.

Para os dados de demonstração usados no Cypress, o Compose executa `npm run db:migrate` e `npm run db:seed:demo` no backend. O seed exige `ALLOW_DEMO_SEED=true` e não permite execução em ambiente `production`. Os testes E2E do backend criam seu schema temporário e aplicam diretamente os arquivos `backend/migrations/`; não dependem desse seed de demonstração.

### Resultados e cobertura

Os resultados consolidados mais recentes informados pela equipe são locais: **9 suítes aprovadas, 41 testes aprovados**, statements **88,06%**, branches **82,79%**, functions **98,55%** e linhas **90,33%**. Os percentuais globais foram conferidos nos artefatos atuais em `backend/coverage/` (`coverage-final.json` e `lcov.info`). Os testes e build não foram reexecutados durante esta consolidação.

A configuração de cobertura inclui arquivos TypeScript sob `src/` e exclui arquivos `*.spec.ts`, `src/main.ts` e módulos `*.module.ts`. Os percentuais são globais para esse escopo configurado; não demonstram automaticamente que a meta T22-C de 80% da lógica de negócio foi atingida. Essa conclusão exige comparar a configuração aos arquivos de lógica de negócio definidos pela equipe.

### Workflow backend

`.github/workflows/backend-ci.yml` executa em pull requests com alterações em `backend/**` ou no workflow, e em pushes às branches `main` e `feat/banco-de-dados` com esses caminhos. Configura Node.js `24.15.0`, instala com `npm ci`, executa `npm run lint`, `npm run build` e `npm run test:coverage:all`. Para este job, inicia um serviço PostgreSQL 17 com o banco `clinicalstudypb_test`, publicado na porta `5432`, e define `DATABASE_URL` para esse serviço. A existência dessas etapas no arquivo não é, por si só, confirmação de que uma execução recente do workflow terminou com sucesso.