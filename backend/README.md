# ClinicalStudyPB — API

API REST desenvolvida em TypeScript e NestJS, com persistência em PostgreSQL.

## Documentação da API

Com o backend em execução, acesse a interface Swagger UI em [`http://localhost:3000/api`](http://localhost:3000/api). A especificação OpenAPI em JSON está disponível em [`http://localhost:3000/api-json`](http://localhost:3000/api-json). Se a variável `PORT` estiver configurada, substitua `3000` pela porta escolhida.

As rotas protegidas usam autenticação HTTP Bearer com o token JWT retornado por `POST /auth/login`. Na Swagger UI, execute o login, copie `accessToken` e use **Authorize** para informá-lo como Bearer token. Os recursos e permissões documentados refletem os guards aplicados nos controllers.

## Pré-requisitos

- Node.js 24 LTS (indicado também em `.nvmrc`).
- npm, incluído com o Node.js.
- PostgreSQL para execução local da API.

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

Para formatar o código, execute:

```bash
npm run format
```

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
│   │   ├── criteria.controller.ts
│   │   └── visits.controller.ts
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

A pasta `src/` contém a implementação da API, organizada por responsabilidades. `auth/` trata autenticação e sessões, `database/` gerencia o pool PostgreSQL, `users/` implementa o CRUD de usuários e `studies/` implementa estudos clínicos associados ao pesquisador autenticado. A pasta `migrations/` evolui o schema versionado; `scripts/` aplica migrations e cria dados fictícios apenas quando explicitamente habilitado.

## Visitas previstas

As rotas abaixo exigem autenticação de pesquisador e aceitam apenas estudos pertencentes ao pesquisador autenticado:

- `GET /studies/:studyId/visits` e `GET /studies/:studyId/visits/:visitId`: listar e consultar visitas previstas.
- `POST /studies/:studyId/visits`: cadastrar visita com `name` e `order` obrigatórios; `intervalDays` e `description` são opcionais.
- `GET /studies/:studyId/visits/:visitId/activities`: listar as atividades de uma visita.
- `POST /studies/:studyId/visits/:visitId/activities`: cadastrar atividade com `name` e `type` obrigatórios; `description` é opcional.

O identificador do estudo e o identificador da visita são validados como UUIDs. A ordem da visita deve ser única dentro do estudo, e a atividade só pode ser associada a uma visita do estudo informado.
Os corpos de cadastro são validados pelos DTOs com `class-validator` e `class-transformer`, usando `ValidationPipe` local às rotas de criação. Campos desconhecidos são rejeitados; textos são removidos de espaços nas pontas antes da validação.
