# ClinicalStudyPB — API

API REST em TypeScript e NestJS, com testes em Jest e Supertest.

## Pré-requisitos

- Node.js 24 LTS (indicado também em `.nvmrc`).
- npm, incluído com o Node.js.

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

## Verificações

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:cov
```

Para formatar o código, execute `npm run format`.

## Execução do build

```powershell
npm run build
npm run start:prod
```

## Estrutura

```text
src/
  main.ts                 # Inicialização da aplicação
  app.module.ts           # Módulo principal
  app.controller.ts       # Rota inicial
  app.service.ts          # Serviço inicial
  app.controller.spec.ts  # Teste unitário
test/
  app.e2e-spec.ts          # Teste HTTP com Supertest
```

A conexão PostgreSQL, as funcionalidades de negócio e a documentação
Swagger serão configuradas nas próximas tarefas.
