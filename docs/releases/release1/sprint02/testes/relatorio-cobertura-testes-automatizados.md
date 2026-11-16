# Relatório de cobertura e qualidade dos testes automatizados — RF05 a RF11

**Projeto:** ClinicalStudyPB  
**Branch:** `test/sprint-2-qa-integration`  
**Data da execução:** 09/11/2026

## 1. Resultado executivo

| Suíte/comando | Resultado |
|---|---|
| Backend unitário | 17 suítes, 143 testes aprovados. |
| Backend E2E PostgreSQL | 6 suítes, 62 testes aprovados. |
| Backend combinado | 23 suítes, 205 testes aprovados. |
| Cobertura backend combinada | 92,63% statements, 82,80% branches, 99,32% functions e 94,73% lines. |
| Frontend | 32 arquivos, 569 testes aprovados. |
| Build frontend | Aprovado: TypeScript e Vite de produção. |
| Build backend | Aprovado: build NestJS. |

**Resultado geral:** todas as suítes backend e frontend foram aprovadas. A execução E2E utilizou PostgreSQL e validou os fluxos integrados.

Durante os testes de inclusão, foram registrados erros PostgreSQL `23514`, provocados intencionalmente para verificar o rollback de transações. Os cenários foram aprovados, portanto esses registros não representam falhas da suíte.

## 2. Cobertura de código

### Backend

Cobertura consolidada de `npm --prefix backend run test:coverage:all`:

| Métrica | Cobertura |
|---|---:|
| Statements | 92,63% |
| Branches | 82,80% |
| Functions | 99,32% |
| Lines | 94,73% |

Principais lacunas identificadas:

| Arquivo/área | Statements | Branches | Lines | Observação |
|---|---:|---:|---:|---|
| `users.controller.ts` | 77,08% | 84,41% | 76,59% | Métodos e caminhos de resposta ainda não exercitados. |
| `database.service.ts` | 84,37% | 77,77% | 88,88% | Inicialização e alguns caminhos operacionais do pool. |
| `token.util.ts` | 83,87% | 79,31% | 92,59% | Condições e linhas de utilitários de token. |
| `sessions.service.ts` | 90,00% | 66,66% | 100% | Branches de controle de sessão. |
| `candidates.service.ts` | 90,90% | 88,37% | 95,00% | Caminhos específicos de processamento e tratamento de erros. |
| `criteria.service.ts` | 88,40% | 82,08% | 93,54% | Condições de validação e tratamento. |
| `studies.service.ts` | 89,16% | 86,50% | 91,15% | Fluxos alternativos e condições de negócio. |

Os controllers de autenticação, estudos, critérios, visitas e candidatos apresentam 100% de statements e functions, embora ainda existam branches não exercitados.

A cobertura de funções está próxima de 100%, mas permanecem oportunidades de ampliar a cobertura de decisões condicionais e caminhos alternativos. Não é necessário criar testes artificiais apenas para elevar percentuais.

### Frontend

Cobertura V8, considerando `web/src/**/*.{ts,tsx}` e excluindo `src/types.ts`:

| Métrica | Cobertura |
|---|---:|
| Statements | 98,83% |
| Branches | 94,83% |
| Functions | 89,21% |
| Lines | 98,83% |

Resultados das áreas priorizadas:

| Arquivo/área | Resultado | Observação |
|---|---|---|
| `main.tsx` | 100% | Montagem da aplicação e redirecionamento. |
| `localUsers.ts` | 100% | CRUD, armazenamento e tratamento de dados inválidos; módulo legado/deprecated. |
| `AuthContext.tsx` | 100% statements/lines; 93,54% branches; 85,71% functions | Permanecem caminhos de sessão não exercitados. |
| `App.tsx` | 100% | Rotas públicas, protegidas e inexistentes. |
| `AppLayout.tsx` | 100% | Menu, perfil, logout e estados de erro. |
| `StudyStatusDialog.tsx` | 100% statements/functions/lines; 94,11% branches | Permanecem alguns branches. |

Outras oportunidades estão em `ProtectedRoute.tsx`, `CandidateFormPage.tsx`, `UsersPage.tsx`, `coordenatorPage.tsx` e em alguns formulários e adaptadores.

`src/types.ts` permanece excluído por conter apenas declarações TypeScript, sem lógica executável.

## 3. Cenários e regras — RF05 a RF11

Os testes abrangem os principais fluxos funcionais:

- **RF05:** cadastro, consulta e atualização de critérios de elegibilidade.
- **RF06 e RF07:** visitas previstas, atividades e gerenciamento de estados.
- **RF08:** cadastro e gerenciamento de candidatos.
- **RF09:** avaliação de elegibilidade e respostas aos critérios.
- **RF10:** registro e consulta de consentimentos.
- **RF11:** inclusão de candidatos, verificações de elegibilidade, consentimento, disponibilidade de vagas e atomicidade das operações.

A execução E2E aprovada fornece evidências de integração com PostgreSQL, incluindo persistência, autorização, validações e rollback.

A rastreabilidade dos cenários e suas evidências permanece no `checklist-rf05-rf11.md`.

## 4. Testes implementados e melhorias

### Backend

Suítes criadas ou ampliadas:

- `database.service.spec.ts`: commit, rollback, falhas simultâneas, liberação de conexão e comportamento sem pool.
- `candidates.assessment.service.spec.ts`: atualização de respostas em reavaliações.
- `visits.service.spec.ts`: tratamento de constraints, inserts sem retorno e inconsistências entre visitas e estudos.

A suíte de banco também foi executada isoladamente, com **4/4 testes aprovados**.

### Frontend

Novas suítes:

- `main.test.tsx`
- `App.test.tsx`
- `localUsers.test.ts`
- `AppLayout.test.tsx`
- `StudyStatusDialog.test.tsx`

Também foram ampliados os testes de `AuthContext`, contemplando autenticação inválida, perfil Participante, expiração de token, falhas de logout e sincronização entre abas.

A execução serial eliminou os problemas intermitentes de timeout observados anteriormente. O teste de integração Web RF09 → RF10 → RF11 também foi mantido.


## 5. Comandos executados

| Comando | Resultado |
|---|---|
| `npm --prefix backend run test:e2e -- --runInBand` | 6 suítes, 62 testes aprovados. |
| `npm --prefix backend run test:coverage:all` | 23 suítes, 205 testes aprovados; cobertura consolidada gerada. |
| `npm --prefix backend test -- --runInBand src/database/database.service.spec.ts` | 1 suíte, 4 testes aprovados. |
| `npm --prefix backend run build` | Aprovado. |
| `npm --prefix web test -- --coverage --reporter=dot --maxWorkers=1` | 32 arquivos, 569 testes aprovados. |
| `npm --prefix web run build` | Aprovado. |

## 6. Referências

- [Checklist RF05–RF11](./checklist-rf05-rf11.md): rastreabilidade dos cenários, evidências e decisões pendentes.
- [Configuração de cobertura Jest](../../../../../backend/jest-coverage.config.cjs).
- [Configuração Vitest/V8](../../../../../web/vite.config.ts).