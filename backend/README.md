# ClinicalStudyPB — API

API REST desenvolvida em TypeScript e NestJS, com persistência em PostgreSQL e testes automatizados utilizando Jest e Supertest.

## Documentação da API

Com o backend em execução, acesse a interface Swagger UI em [`http://localhost:3000/api`](http://localhost:3000/api). A especificação OpenAPI em JSON está disponível em [`http://localhost:3000/api-json`](http://localhost:3000/api-json). Se a variável `PORT` estiver configurada, substitua `3000` pela porta escolhida.

As rotas protegidas usam autenticação HTTP Bearer com o token JWT retornado por `POST /auth/login`. Na Swagger UI, execute o login, copie `accessToken` e use **Authorize** para informá-lo como Bearer token. Os recursos e permissões documentados refletem os guards aplicados nos controllers.

## Pré-requisitos

- Node.js 24 LTS (indicado também em `.nvmrc`).
- npm, incluído com o Node.js.
- PostgreSQL para executar os testes E2E localmente.

Execute os comandos abaixo dentro da pasta `backend/`.

## Instalação e desenvolvimento

```powershell
npm ci
Copy-Item .env.example .env
npm run start:dev
```

Em Linux/macOS, use `cp .env.example .env`.
O arquivo `.env` é opcional e não deve ser versionado.

A rota `GET /` em `http://localhost:3000` retorna `Hello World!`.
A variável `PORT` permite alterar a porta; o valor padrão é `3000`.

## Verificações e testes

Os seguintes comandos permitem verificar a qualidade e o funcionamento do backend:

| Comando | Finalidade |
|---|---|
| `npm run build` | Compila o projeto TypeScript/NestJS. |
| `npm run lint` | Analisa o código em busca de problemas identificáveis pelo linter. |
| `npm test` | Executa os testes unitários. |
| `npm run test:e2e` | Executa os testes end-to-end (E2E). |
| `npm run test:cov` | Executa os testes unitários e gera o relatório de cobertura correspondente. |
| `npm run test:coverage:all` | Executa os testes unitários e E2E em conjunto e gera a cobertura consolidada. |

Para formatar o código, execute:

```bash
npm run format
```

### Testes E2E e PostgreSQL

Os testes E2E utilizam um banco PostgreSQL acessado pela variável de ambiente `DATABASE_URL`.

A configuração dos testes cria um schema isolado para a execução, aplica as migrações necessárias e remove o schema ao finalizar. Dessa forma, os testes não precisam utilizar as tabelas de negócio do banco de desenvolvimento.

Antes de executar os testes E2E localmente, verifique se o PostgreSQL está disponível e se `DATABASE_URL` aponta para um banco de testes adequado.

Exemplo de configuração no PowerShell, substituindo os valores pelos dados do ambiente de testes:

```powershell
$env:DATABASE_URL = "postgres://usuario:senha@localhost:5432/banco_teste"
npm run test:e2e -- --runInBand
```

**Atenção:** utilize apenas um banco destinado a testes. Não configure a URL de um banco de produção ou de um ambiente com dados importantes.

## Resultados dos testes e cobertura

Registro histórico: na execução consolidada da versão anterior da API, foram obtidos os seguintes resultados. Esses números não validam automaticamente a integração atual; execute novamente a suíte após aplicar as migrations e o módulo de estudos:

| Indicador | Resultado |
|---|---:|
| Suítes de testes aprovadas | 7 de 7 |
| Testes aprovados | 27 de 27 |
| Cobertura de statements | 88,26% |
| Cobertura de branches | 84,21% |
| Cobertura de funções | 97,87% |
| **Cobertura de linhas** | **90,71%** |

A execução incluiu testes unitários e E2E, utilizando a configuração `jest-coverage.config.cjs`. A coleta de cobertura considera os arquivos TypeScript de produção em `src/`, excluindo arquivos de teste (`*.spec.ts`), o ponto de entrada `main.ts` e módulos NestJS (`*.module.ts`).

O percentual de 90,71% corresponde ao conjunto de arquivos incluídos nessa configuração. A verificação do requisito mínimo de 80% deve considerar o escopo de código de negócio definido na especificação do projeto.

O Jest apresenta o relatório no terminal e gera os arquivos de cobertura no diretório `coverage/`.

Os resultados acima são um registro histórico de uma execução local da versão anterior da API. A integração atual adiciona a migration `003_create_estudos.sql` e novos testes para estudos; execute novamente `npm test`, `npm run test:e2e` e `npm run test:coverage:all` antes de utilizar números de cobertura como evidência da versão integrada. Esses resultados históricos não representam, por si só, uma execução bem-sucedida no GitHub Actions.

## Integração contínua (CI) com GitHub Actions

A pipeline de integração contínua tem como objetivo automatizar as verificações do backend para identificar problemas antes da integração das alterações ao projeto.

O workflow previsto para o repositório é:

`.github/workflows/backend-ci.yml`

### Etapas da pipeline

1. **Checkout:** obtém o código do repositório.
2. **Configuração do Node.js:** prepara a versão utilizada pelo backend.
3. **Instalação:** executa `npm ci` para instalar as dependências.
4. **Lint:** executa `npm run lint`.
5. **Build:** executa `npm run build`.
6. **Testes unitários:** executa a suíte unitária do Jest.
7. **Testes E2E:** executa os testes de integração HTTP com PostgreSQL.
8. **Cobertura consolidada:** executa `npm run test:coverage:all`.

### PostgreSQL no CI

No GitHub Actions, a pipeline utiliza um serviço PostgreSQL temporário para os testes E2E. A variável `DATABASE_URL` aponta para esse serviço, com credenciais específicas de teste.

Esse ambiente é independente do banco instalado no computador dos integrantes da equipe. O banco temporário é disponibilizado durante a execução do job e descartado ao final, evitando a dependência de um banco local compartilhado.

O workflow deve ser validado no GitHub Actions para confirmar que todas as etapas, incluindo a conexão com PostgreSQL, as migrações e os testes E2E, funcionam no ambiente de CI.

## Execução do build

Para gerar a versão compilada:

```bash
npm run build
```

Para executar a aplicação compilada:

```bash
npm run start:prod
```

## Estrutura principal

```text
backend/
├── migrations/
│   ├── 001_create_usuarios.sql
│   ├── 002_create_sessoes.sql
│   └── 003_create_estudos.sql
├── scripts/
│   ├── migrate.mjs
│   └── seed-demo.mjs
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── auth/
│   ├── database/
│   ├── studies/
│   └── users/
├── test/
│   ├── app.e2e-spec.ts
│   ├── access.e2e-spec.ts
│   ├── studies.e2e-spec.ts
│   ├── database-test-app.ts
│   └── jest-e2e.config.cjs
├── jest.config.cjs
├── jest-coverage.config.cjs
└── package.json
```

A pasta `src/` contém a implementação da API, organizada por responsabilidades. `auth/` trata autenticação e sessões, `database/` gerencia o pool PostgreSQL, `users/` implementa o CRUD de usuários e `studies/` implementa estudos clínicos associados ao pesquisador autenticado. A pasta `migrations/` evolui o schema versionado; `scripts/` aplica migrations e cria dados fictícios apenas quando explicitamente habilitado. A pasta `test/` contém os testes E2E e os recursos de apoio à configuração do banco de testes.

Os arquivos de configuração do Jest definem a execução dos testes unitários, dos testes E2E e da cobertura consolidada.
