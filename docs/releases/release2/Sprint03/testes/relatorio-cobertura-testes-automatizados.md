# Relatório de cobertura e qualidade dos testes automatizados — RF12 a RF18

**Projeto:** ClinicalStudyPB  
**Release:** 2 — Sprint 3  
**Versão analisada:** branch `feature/s3-po-05-diagramas-rf12-rf18`, HEAD `aff8634`. A árvore de código é idêntica à de `origin/main` em `7e48a5b` (merge do PR #37, 23/11/2026).  
**Data das execuções desta análise:** 23/11/2026

Este relatório reúne três fontes de evidência. Cada resultado indica a fonte, a data e o commit:

1. **Execuções desta análise (23/11/2026):** realizadas sobre o HEAD `aff8634` e sobre uma cópia isolada de `origin/main` em `7e48a5b`, com o mesmo código.
2. **Relatório da QA (22/11/2026):** [relatório de execução da Sprint 3](./relatorio-execucao-testes-sprint-3.md), branch `test/sprint-3-qa-leticia`, commit `6af58f6`. Entre esse commit e o código final, o backend e o Web diferem apenas pelo arquivo de teste `users.controller.spec.ts`, que a QA já descreve como parte daquela execução. Os resultados de backend e Web da QA, portanto, correspondem ao código final. Os resultados de Mobile da QA são anteriores à integração do PR #37 e não valem para a versão final.
3. **Validação Mobile contra a API real (22/11/2026):** [s3-mob-03-validacao.json](../evidencias/s3-mob-03-validacao.json).

## 1. Resultado executivo

| Suíte/comando | Resultado | Fonte |
|---|---|---|
| Backend unitário | 23 suítes, 240 testes aprovados. | Esta análise, 23/11, HEAD `aff8634`. |
| Backend E2E PostgreSQL | 10 suítes, 108 testes aprovados. | Esta análise, 23/11, `origin/main` `7e48a5b`, PostgreSQL 17 do Compose. |
| Backend combinado | 33 suítes, 348 testes aprovados; lint e build aprovados. | QA, 22/11, `6af58f6` (`test:coverage:all`). Os totais coincidem com a soma das duas execuções acima. |
| Backend lint | Aprovado. | Esta análise, 23/11, HEAD `aff8634`. |
| Web Vitest | 45 arquivos, 755 testes aprovados. | Esta análise, 23/11, HEAD `aff8634`, com `VITE_API_URL` definido apenas no processo. Resultado igual ao da QA em 22/11. |
| Web TypeScript e build | TypeScript sem erros (`tsc --noEmit`). O build Vite foi aprovado pela QA. | TypeScript: esta análise, 23/11. Build: QA, 22/11. |
| Mobile Jest | 14 suítes, 127 testes aprovados. | Esta análise, 23/11, HEAD `aff8634`. |
| Mobile TypeScript e lint | Ambos aprovados. | Esta análise, 23/11, HEAD `aff8634`. |
| Mobile export Expo (build) | **Falha registrada:** a configuração Expo não declara plataformas e `expo export --platform all` não gera o pacote. | QA, 22/11. Não reexecutado; a configuração continua sem a chave `platforms`. |
| Cypress Web E2E | 11 specs, 54 testes aprovados, incluindo o novo fluxo RF12 → RF13. | QA, 22/11, `6af58f6`. Não reexecutado nesta análise. |
| E2E Mobile | **Não disponível.** Não há Maestro, Detox ou Appium configurado. | Verificado em `mobile/package.json`. |
| Validação Mobile contra API real | Aprovada no Expo Web, com consulta autenticada a `/me/studies` e `/me/visits?scope=upcoming`. | Registro de 22/11 (`s3-mob-03-validacao.json`). |
| CI / GitHub Actions | **Não verificado.** Os resultados das execuções no GitHub não estavam acessíveis nesta análise. A configuração dos workflows é descrita na seção 4.4. | — |

**Resultado geral:** todas as suítes automatizadas executadas foram aprovadas. A suíte E2E do backend valida RF12 a RF18 com PostgreSQL real, e o Cypress valida o fluxo Web de agendamento e atualização de situação com Web, API e banco reais.

Três limitações permanecem:

- Não existe teste E2E Mobile automatizado.
- O export do Mobile falha no CI.
- O fluxo real do participante continua bloqueado pela pendência **P-01**: os testes que comprovam RF17 e RF18 com dados inseridos diretamente no banco não substituem o fluxo de cadastro pelo sistema.

Durante os testes E2E de rollback, o PostgreSQL registra erros provocados intencionalmente. Os cenários foram aprovados; esses registros não representam falhas da suíte.

## 2. Cobertura de código

Os percentuais de cobertura medem o código executado pelos testes. Eles não representam a porcentagem de requisitos concluídos nem a quantidade de testes aprovados.

### Backend

Não havia relatório de cobertura salvo no repositório: a pasta `coverage/` é ignorada pelo Git. Esta análise não reexecutou `test:coverage:all`, porque o comando inclui a suíte E2E sobre o banco persistente do Compose. Os números abaixo vêm da execução da QA em 22/11 (`6af58f6`), com `npm.cmd --prefix backend run test:coverage:all`:

| Métrica | Cobertura |
|---|---:|
| Lines — código de negócio | 94,46% (836/885) |
| Lines — relatório Jest bruto, incluindo modelos Swagger/DTOs | 95,60% |
| Statements | Não disponível |
| Branches | Não disponível |
| Functions | Não disponível |

O cálculo de "código de negócio" da QA exclui modelos Swagger e DTOs, entidades, módulos e configuração, código gerado, `main.ts` e migrations, e mantém os arquivos `*.types.ts`.

| Área | Linhas cobertas / instrumentadas | Cobertura de linhas |
|---|---:|---:|
| Aplicação | 6/6 | 100,00% |
| Autenticação | 78/81 | 96,30% |
| Persistência | 24/27 | 88,89% |
| Estudos | 643/685 | 93,87% |
| Usuários | 85/86 | 98,84% |
| **Total do código de negócio** | **836/885** | **94,46%** |

- **Meta da Sprint 3:** o planejamento exige cobertura mínima de 80% das linhas do código de negócio do backend. A evidência da QA atende à meta, e nenhum arquivo de negócio ficou abaixo de 80%.
- **Menor cobertura:** `database.service.ts`, com 88,89% de linhas.
- **Melhoria registrada:** `users.controller.ts` tinha 76,59% de linhas na Sprint 2. Com o novo [users.controller.spec.ts](../../../../../backend/src/users/users.controller.spec.ts), passou a 100%.

### Web

**Cobertura percentual não disponível.** Não há relatório salvo, e a tentativa desta análise de gerar a cobertura V8 falhou: o pacote `@vitest/coverage-v8` consta no lockfile do Web, mas não está instalado no `node_modules` local, e a instalação de dependências estava fora do escopo. O relatório da QA também não registra cobertura Web, e o workflow Web não executa cobertura. Os percentuais Web da Sprint 2 não foram reaproveitados.

### Mobile

Cobertura gerada nesta análise em 23/11, HEAD `aff8634`, com `npx jest --runInBand --coverage`:

| Métrica | Cobertura |
|---|---:|
| Statements | 94,69% (625/660) |
| Branches | 86,52% (520/601) |
| Functions | 92,67% (177/191) |
| Lines | 97,19% (520/535) |

**Limitação de escopo:** o Mobile não define `collectCoverageFrom`. Por isso o Jest mede apenas os arquivos carregados por algum teste (71 arquivos), e um arquivo que nenhum teste importa não entra no denominador.

Arquivos com menor cobertura de linhas:

| Arquivo | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `src/components/Field.tsx` | 50,00% | 66,66% | 33,33% | 66,66% |
| `src/components/DashboardScaffold.tsx` | 78,94% | 76,19% | 66,66% | 86,66% |
| `src/screens/LoginScreen.tsx` | 89,18% | 81,81% | 72,72% | 89,28% |
| `src/components/VisitDatePicker.tsx` | 91,17% | 95,23% | 80,00% | 89,28% |
| `src/screens/VisitActionScreen.tsx` | 89,65% | 78,57% | 81,81% | 90,90% |

Serviços e contextos de RF17 e RF18:

| Arquivo | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `src/api/http.ts` | 93,10% | 87,50% | 100% | 95,65% |
| `src/auth/AuthContext.tsx` | 96,22% | 86,53% | 100% | 100% |
| `src/studies/participantStudiesApi.ts` | 100% | 94,11% | 100% | 100% |
| `src/studies/useParticipantStudies.ts` | 95,23% | 91,66% | 100% | 100% |
| `src/visits/participantVisitsApi.ts` | 100% | 100% | 100% | 100% |
| `src/visits/VisitsContext.tsx` | 96,77% | 84,61% | 100% | 100% |
| `src/auth/tokenStorage.ts` | 100% | 100% | 100% | 100% |

### Oportunidades de melhoria

- Configurar `coverageThreshold` no backend, para que a meta de 80% bloqueie o CI, e publicar o relatório de cobertura como artefato.
- Incluir cobertura no workflow Web e garantir que `@vitest/coverage-v8` esteja instalado.
- Definir `collectCoverageFrom` no Mobile, para medir também arquivos que nenhum teste importa.
- Ampliar os testes de `Field.tsx` e `DashboardScaffold.tsx` no Mobile e os branches de `LoginScreen.tsx`.

## 3. Cenários e regras — RF12 a RF18

### Rastreabilidade dos testes

As suítes da Sprint 3 não usam identificadores `CT-`/`CYP-` nos títulos dos testes, ao contrário das suítes Cypress da Sprint 2. Por isso, a tabela identifica cada teste pelo arquivo e pelo rótulo de contrato (E01–E10) presente no título. Os identificadores `CT-RF12-01` em diante pertencem ao [checklist RF12–RF18](./checklist-rf12-rf18.md) e não existem no código.

**OK** indica aprovação em execução comprovada; a fonte aparece na coluna. **Não verificado** indica ausência de execução registrada, o que não significa falha.

| ID do teste | Requisito | O que verifica | Resultado |
|---|---|---|---|
| `participant-visits.e2e` — E01 | RF12 | Lista participantes, aplica o filtro de situação e restringe o acesso à equipe autorizada. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E01–E03 | RF12 | Valida autenticação, filtros e estados de acesso. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E02 | RF12 | Cria agendamentos, valida vínculos e limites, impede duplicidade e permite remarcar ausências ou cancelamentos. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E02 | RF12 | Serializa agendamentos concorrentes da mesma participação e visita prevista. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E02 | RF12 | Compara a data com os dias civis de Brasília nos limites de inclusão e encerramento. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E03 | RF12 | Lista visitas com filtros, isola por estudo e aplica filtros inclusivos pelo dia civil de Brasília. | ✅ OK (E2E, 23/11) |
| `rf12-rf13-agendamento-situacao.cy.ts` | RF12, RF13 | Agenda pela interface, registra Realizada e confirma a persistência após recarregar. | ✅ OK (Cypress, QA 22/11) |
| `participant-visits.e2e` — E04 | RF13 | Atualiza para estados finais e preserva a observação omitida. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E04 | RF13 | Valida presença, data futura e dia civil de `realizedAt`. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E04 | RF13 | Aplica participação ativa, isolamento, autorização e estados permitidos do estudo. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E04 | RF13 | Serializa atualizações concorrentes e reverte quando uma restrição do PostgreSQL falha. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — X02/X03 | RF12–RF14 | Permite leitura de visitas previstas e atividades ao Coordenador, sem liberar escrita. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E05 | RF14 | Lista atividades na ordem de cadastro, com resultados e leitura do Coordenador. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E06 | RF14 | Registra resultado, persiste os campos e converte duplicidade em 409. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E06 | RF14 | Aplica situação da visita, vínculos com a atividade e perfis autorizados. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E06 | RF14 | Impede resultados em estudo encerrado e em visita de outro estudo. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E06 | RF14 | Serializa registros concorrentes e reverte falhas reais de trigger. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E07 | RF15 | Retorna participação, visitas em ordem cronológica e resultados vinculados. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E07 | RF15 | Mantém histórico sem visitas e visitas sem resultados. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E07 | RF15 | Aplica perfis, estados do estudo para o Coordenador e isolamento. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E08 | RF16 | Retira o participante e preserva visitas, resultados e demais registros. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E08 | RF16 | Autoriza Coordenador ativo em estudo permitido e rejeita perfis não autorizados. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E08 | RF16 | Valida estudo, participação, estado, data e motivo. | ✅ OK (E2E, 23/11) |
| `participant-visits.e2e` — E08 | RF16 | Serializa retiradas concorrentes e reverte falhas na transação. | ✅ OK (E2E, 23/11) |
| `participant-self-service.e2e` — E09 | RF17 | Lista as participações próprias nos três estados, ordena e retorna vazio sem vínculo. | ✅ OK (E2E, 23/11) |
| `participant-self-service.e2e` — E10 | RF18 | Aplica escopos temporais, estados, ordenação, isolamento e integridade dos vínculos, sem expor observação, resultados ou e-mail. | ✅ OK (E2E, 23/11) |
| `participant-self-service.e2e` — E09/E10 | RF17, RF18 | Exige autenticação e perfil Participante e valida os parâmetros da consulta. | ✅ OK (E2E, 23/11) |
| `participant-visits.dto.spec.ts` | RF12–RF16 | Valida os corpos E02, E04, E06 e de retirada, e os filtros de E01/E03. | ✅ OK (unitário, 23/11) |
| `participant-visits.service.spec.ts`, `assessment-results.service.spec.ts`, `visits.service.spec.ts` | RF12–RF16 | Regras de negócio dos serviços com o banco simulado. | ✅ OK (unitário, 23/11) |
| `participant-self-service.service.spec.ts`, `participant-self-service.dto.spec.ts` | RF17, RF18 | Consultas do participante e validação dos parâmetros. | ✅ OK (unitário, 23/11) |
| `ScheduleVisitForm.test.tsx` | RF12 | Formulário de agendamento: obrigatórios, data anterior à inclusão, limites, envio duplicado e erros da API. | ✅ OK (Vitest, 23/11) |
| `VisitStatusForm.test.tsx` | RF13 | Situação da visita: data de realização, situação final somente leitura, conflito e erros. | ✅ OK (Vitest, 23/11) |
| `VisitResultsPanel.test.tsx` | RF14 | Registro e consulta de resultados, validação, duplicidade e modo somente leitura. | ✅ OK (Vitest, 23/11) |
| `ParticipantHistoryPanel.test.tsx` | RF15, RF16 | Histórico cronológico, histórico vazio, falhas e retirada preservando o histórico. | ✅ OK (Vitest, 23/11) |
| `WithdrawalForm.test.tsx` | RF16 | Motivo obrigatório, período da data, confirmação e recusa do backend. | ✅ OK (Vitest, 23/11) |
| `ParticipantsPage.test.tsx` | RF12–RF16 | Participantes incluídos por estudo, seleção, histórico e retirada na rota do Coordenador. | ✅ OK (Vitest, 23/11) |
| `scheduledVisitsApi.test.ts` (`web/src/visits`), `participantsApi.test.ts` | RF12–RF16 | Caminhos e corpos de E01–E08, códigos 400/401/403/404/409/500 e falha de rede. | ✅ OK (Vitest, 23/11) |
| `participantsRoutes.test.tsx`, `access.test.ts` | RF12–RF16 | Acesso do Coordenador e bloqueio de Pesquisador, Administrador e de quem não tem sessão. | ✅ OK (Vitest, 23/11) |
| `authenticatedQueries.test.tsx` | RF17, RF18 | E09/E10 com o token restaurado, falhas 404/500/503/rede/timeout, 401 concorrente e descarte de respostas após troca de sessão. | ✅ OK (Jest, 23/11) |
| `participantStudiesApi.test.ts` | RF17 | Consulta somente E09, aceita `[]` e rejeita respostas fora do contrato. | ✅ OK (Jest, 23/11) |
| `HomeScreen.test.tsx`, `studies-navigation.test.tsx` | RF17 | Lista, detalhes, vazio, erro com nova tentativa, 401 e isolamento entre sessões. | ✅ OK (Jest, 23/11) |
| `participantVisitsApi.test.ts`, `VisitsContext.test.tsx`, `visits-navigation.test.tsx` | RF18 | E10 por escopo, ordenação, vazio, erro, troca de escopo ou sessão e navegação protegida. | ✅ OK (Jest, 23/11) |
| `AuthContext.test.tsx`, `auth-navigation.test.tsx`, `LoginScreen.test.tsx`, `tokenStorage.test.ts`, `api.test.ts` | Autenticação Mobile | Login exclusivo do Participante, armazenamento seguro, restauração por `/auth/me` e logout. | ✅ OK (Jest, 23/11) |
| `s3-mob-03-validacao.json` | RF17 | Exibição de dados reais de E09 no Expo Web, com Bearer. | ✅ OK (validação registrada em 22/11) |
| E2E Mobile login → E09 → E10 | RF17, RF18 | Fluxo automatizado contra API e banco reais. | Não verificado: ferramenta inexistente. |
| Cypress RF14–RF16 | RF14–RF16 | Resultados, histórico e retirada ponta a ponta pela interface Web. | Não verificado: sem spec. |
| Cadastro → vínculo `id_usuario` → consulta no app | P-01 | Fluxo real do participante. | Não verificado: vínculo não implementado. |

Os testes abrangem os principais fluxos funcionais:

- **RF12:** agendamento com validação de vínculo, período, duplicidade, concorrência e permissões.
- **RF13:** transições para Realizada, Ausente e Cancelada, data de realização, situação final, concorrência e rollback.
- **RF14:** registro e consulta de resultados, vínculo com a atividade, duplicidade, estado da visita e do estudo, concorrência e rollback.
- **RF15:** histórico cronológico, históricos vazios e autorização.
- **RF16:** retirada com preservação do histórico, validações, concorrência e rollback.
- **RF17 e RF18:** consultas `/me/*` com isolamento e autorização no backend; serviços e telas Mobile com respostas simuladas; uma validação manual registrada contra a API real.

O vínculo entre conta e candidato usado nos testes E2E de RF17 e RF18 é inserido diretamente no banco pela própria suíte. Esses testes comprovam a regra de consulta, mas não o fluxo de cadastro (P-01). A rastreabilidade por cenário está no [checklist RF12–RF18](./checklist-rf12-rf18.md).

## 4. Testes implementados e melhorias

### 4.1 Backend

Suítes criadas ou ampliadas na Sprint 3:

- `test/participant-visits.e2e-spec.ts`: E01–E08 e X02/X03, com concorrência, fuso de Brasília e rollback por falha real de restrição ou trigger do PostgreSQL.
- `test/participant-self-service.e2e-spec.ts`: E09 e E10, com os três estados de participação, escopos, ordenação, isolamento e ocultação de campos internos.
- `test/activity-order-migration.e2e-spec.ts` e `test/schema-constraints.e2e-spec.ts`: migration de ordem das atividades (`017_activity_order.sql`) e restrições do schema.
- Unitários: `participant-visits.service.spec.ts`, `participant-visits.dto.spec.ts`, `assessment-results.service.spec.ts`, `participant-self-service.service.spec.ts`, `participant-self-service.dto.spec.ts` e `users.controller.spec.ts`.

**Defeitos encontrados e corrigidos durante a sprint**, conforme o relatório da QA:

- Colisão de massa no cenário de validação de `observation`: o cenário reutilizava uma visita prevista já agendada. A massa foi isolada.
- Imagem Docker do backend desatualizada, sem a coluna `atividades_visita.ordem`, causando 3 falhas Cypress. Resolvido ao reconstruir a imagem, sem mudança de código.

### 4.2 Web

Suítes da Sprint 3:

- Em `web/src/visits/`: `ScheduleVisitForm`, `VisitStatusForm`, `VisitResultsPanel`, `ParticipantHistoryPanel`, `WithdrawalForm`, `StudyScheduledVisitsSection` e `scheduledVisitsApi`.
- Em `web/src/participants/`: `ParticipantSummary`, `followUpStudies`, `participantsApi`, `participantsRoutes` e `scheduledVisitsApi`.
- Ampliações de `ParticipantsPage.test.tsx`, `coordenatorPage.test.tsx` e `access.test.ts`.

**Cypress:** o novo spec `rf12-rf13-agendamento-situacao.cy.ts` prepara os dados pela API real e executa agendamento e atualização da situação pela interface. Também existem specs de regressão `rf05` a `rf11`.

**Limitações:**

- Não há spec Cypress para RF14, RF15 e RF16.
- Não há script de lint nem configuração ESLint no Web.
- O `web/.env` local registrado pela QA tinha `VITE_API_URL` duplicado, o que quebrava testes. As execuções usaram a variável apenas no processo.

### 4.3 Mobile

Suítes da Sprint 3:

- `authenticatedQueries.test.tsx`, `studies-navigation.test.tsx`, `consent-navigation.test.tsx`, `ConsentContext.test.tsx`.
- Ampliações de `participantStudiesApi.test.ts`, `participantVisitsApi.test.ts`, `VisitsContext.test.tsx`, `visits-navigation.test.tsx`, `HomeScreen.test.tsx` e `auth-navigation.test.tsx`.

O total passou de 10 suítes e 72 testes (QA, 22/11, antes do PR #37) para 14 suítes e 127 testes (esta análise, 23/11).

**Limitações:**

- Todos os testes Jest usam respostas simuladas da API.
- Não existe E2E Mobile automatizado.
- O export Expo falha no CI.
- `VisitsContext.tsx` acrescenta um local fictício às visitas de demonstração da conta Participante do seed (ver o README da Release 2, seção 8).

### 4.4 QA/DevOps

| Workflow | Verificações | Lacunas |
|---|---|---|
| [backend-ci.yml](../../../../../.github/workflows/backend-ci.yml) | PostgreSQL 17, `npm ci`, lint, build e `test:coverage:all` (Node 24.15.0). | Sem `coverageThreshold` e sem publicação do relatório. |
| [web-ci.yml](../../../../../.github/workflows/web-ci.yml) | Vitest e build; Cypress com PostgreSQL e API (Node 24.15.0). | Sem lint e sem cobertura Web. |
| [mobile-ci.yml](../../../../../.github/workflows/mobile-ci.yml) | Jest, lint, typecheck e `expo export --platform all` (Node 22). | O export falha por falta de plataformas na configuração Expo (registro da QA). |

Os workflows usam filtros por caminho. O resultado das execuções no GitHub Actions não foi verificado nesta análise.

## 5. Comandos executados

### Nesta análise — 23/11/2026

| Comando | Versão | Resultado |
|---|---|---|
| `npm test` (em `backend/`) | HEAD `aff8634` e `origin/main` `7e48a5b` | 23 suítes, 240 testes aprovados. |
| `DATABASE_URL=<PostgreSQL do Compose, porta 5433> npm run test:e2e -- --runInBand` (em `backend/`) | `origin/main` `7e48a5b` | 10 suítes, 108 testes aprovados. Cada suíte usa um schema temporário; nenhum permaneceu no banco. |
| `npm run lint` (em `backend/`) | HEAD `aff8634` | Aprovado, sem alterar arquivos. |
| `VITE_API_URL=http://localhost:3000 npx vitest run --reporter=dot --maxWorkers=1` (em `web/`) | HEAD `aff8634` | 45 arquivos, 755 testes aprovados. |
| `npx vitest run` (em `web/`) | `origin/main` `7e48a5b` | 45 arquivos, 755 testes aprovados. |
| `npx tsc --noEmit` (em `web/`) | HEAD `aff8634` | Aprovado. |
| `npx vitest run --coverage` (em `web/`) | HEAD `aff8634` | Não executado: dependência `@vitest/coverage-v8` ausente no `node_modules` local. |
| `npx jest --runInBand --coverage` (em `mobile/`) | HEAD `aff8634` | 14 suítes, 127 testes aprovados; cobertura da seção 2. |
| `npm run typecheck` e `npm run lint` (em `mobile/`) | HEAD `aff8634` | Aprovados. |

As execuções em `origin/main` `7e48a5b` ocorreram numa cópia isolada do repositório, com dependências instaladas pelos lockfiles e removida em seguida.

### Registrados pela QA — 22/11/2026, `6af58f6`

| Comando | Resultado |
|---|---|
| `npm.cmd --prefix backend run test:coverage:all` | 33 suítes, 348 testes aprovados; cobertura da seção 2. |
| `npm.cmd --prefix web run cypress:run -- --browser electron` | 11 specs, 54 testes aprovados. |
| `npm.cmd --prefix web run build` | Aprovado. |
| `npx expo export --platform all` (passo do CI Mobile) | Falhou: nenhuma plataforma configurada. |

## 6. Referências

- [Checklist RF12–RF18](./checklist-rf12-rf18.md): cenários por requisito, evidências e pendência P-01.
- [Relatório de execução e rastreabilidade da Sprint 3](./relatorio-execucao-testes-sprint-3.md) e [plano de testes e massa de dados](./plano-testes-massa-dados-rf12-rf18.md).
- [Contratos da API RF12–RF18](../contratos-api-rf12-rf18.md).
- [Configuração de cobertura Jest do backend](../../../../../backend/jest-coverage.config.cjs) e [configuração E2E](../../../../../backend/test/jest-e2e.config.cjs).
- [Configuração Vitest/V8 do Web](../../../../../web/vite.config.ts) e [configuração do Cypress](../../../../../web/cypress.config.ts).
- [Configuração Jest do Mobile](../../../../../mobile/package.json) (preset `jest-expo`).
- [Relatório da Sprint 2](../../../release1/sprint02/testes/relatorio-cobertura-testes-automatizados.md), usado como modelo.
