# Relatório de cobertura e qualidade dos testes automatizados — RF01 a RF11

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

## 3. Cenários e regras — RF01 a RF11

### Rastreabilidade dos testes Cypress

A tabela relaciona cada caso Cypress ao requisito e resume o comportamento verificado. **OK** indica aprovação em uma execução comprovada; **Não verificado** significa que não há resultado de aprovação confirmado, e não deve ser interpretado como falha.


No total, **53 dos 53 casos** têm aprovação registrada;

| ID do teste | Requisito | O que faz | Resultado |
|---|---|---|---|
| `CYP-RF01-01` | RF01 — Cadastrar e gerenciar usuários | Cadastra, pesquisa, edita e exclui usuário como Administrador. | ✅ OK |
| `CYP-RF02-01` | RF02 — Autenticar e encerrar sessão | Redireciona para o login quando não há sessão. | ✅ OK |
| `CYP-RF02-02` | RF02 — Autenticar e encerrar sessão | Rejeita credenciais inválidas. | ✅ OK |
| `CYP-RF02-03` | RF02 — Autenticar e encerrar sessão | Mantém a sessão após recarregar e a revoga ao sair. | ✅ OK |
| `CYP-RF03-01` | RF03 — Restringir funcionalidades por perfil | Impede que Pesquisador acesse a administração de usuários. | ✅ OK |
| `CYP-RF03-02` | RF03 — Restringir funcionalidades por perfil | Verifica menu do Coordenador e restrição de páginas de outros perfis. | ✅ OK |
| `CYP-RF04-01` | RF04 — Cadastrar estudos | Cadastra estudo, consulta e confirma persistência após recarregar. | ✅ OK |
| `CYP-RF04-02` | RF04 — Cadastrar estudos | Edita estudo e confirma persistência das alterações após recarregar. | ✅ OK |
| `CYP-RF04-03` | RF04 — Cadastrar estudos | Rejeita data de término anterior à data de início. | ✅ OK |
| `CYP-RF04-04` | RF04 — Cadastrar estudos | Rejeita participantes vinculados acima do limite do estudo. |✅ OK |
| `CT-RF05-01` | RF05 — Gerenciar critérios de elegibilidade | Cadastra critérios de inclusão e exclusão vinculados ao estudo. | ✅ OK |
| `CT-RF05-02` | RF05 — Gerenciar critérios de elegibilidade | Consulta critérios sem misturar os de outros estudos. | ✅ OK |
| `CT-RF05-03` | RF05 — Gerenciar critérios de elegibilidade | Rejeita tipo ausente ou descrição vazia. | ✅ OK |
| `CT-RF05-04` | RF05 — Gerenciar critérios de elegibilidade | Rejeita estudo inexistente e vínculo de critério incompatível. | ✅ OK |
| `CT-RF05-05` | RF05 — Gerenciar critérios de elegibilidade | Bloqueia consulta/cadastro sem autenticação ou sem permissão. | ✅ OK |
| `CYP-RF05-06-01` | RF05 — Gerenciar critérios de elegibilidade | Cadastra, edita e consulta critérios persistidos pelo fluxo web. |✅ OK |
| `CT-RF06-01` | RF06 — Gerenciar visitas e atividades previstas | Cadastra visitas e atividades com vínculos corretos. | ✅ OK |
| `CT-RF06-02` | RF06 — Gerenciar visitas e atividades previstas | Consulta visitas ordenadas e atividades associadas à visita correta. | ✅ OK |
| `CT-RF06-03` | RF06 — Gerenciar visitas e atividades previstas | Rejeita visita ou atividade sem campos obrigatórios válidos. | ✅ OK |
| `CT-RF06-04` | RF06 — Gerenciar visitas e atividades previstas | Rejeita vínculos com estudo/visita inexistente ou incompatível. | ✅ OK |
| `CT-RF06-05` | RF06 — Gerenciar visitas e atividades previstas | Bloqueia consulta/cadastro sem autenticação ou sem permissão. | ✅ OK |
| `CYP-RF06-07-01` | RF06 — Gerenciar visitas e atividades previstas | Persiste visitas e atividades, valida ordem e bloqueia alteração após encerramento. | ✅ OK |
| `CT-RF07-01` | RF07 — Gerenciar estados do estudo | Cria estudo no estado inicial Planejamento. | ✅ OK |
| `CT-RF07-02` | RF07 — Gerenciar estados do estudo | Permite a sequência de transições válidas. | ✅ OK |
| `CT-RF07-03` | RF07 — Gerenciar estados do estudo | Rejeita transições inválidas sem alterar o estado anterior. | ✅ OK |
| `CT-RF07-04` | RF07 — Gerenciar estados do estudo | Confirma consulta do estado persistido após cada transição. | ✅ OK |
| `CT-RF07-05` | RF07 — Gerenciar estados do estudo | Bloqueia alteração de estudo inexistente, sem sessão ou sem permissão. | ✅ OK |
| `CT-RF08-01` | RF08 — Cadastrar candidatos | Cadastra candidato válido vinculado ao estudo selecionado. | ✅ OK |
| `CT-RF08-02` | RF08 — Cadastrar candidatos | Lista candidatos por estudo sem incluir candidatos de outro estudo. | ✅ OK |
| `CT-RF08-03` | RF08 — Cadastrar candidatos | Rejeita cadastro sem nome ou com e-mail inválido. | ✅ OK |
| `CT-RF08-04` | RF08 — Cadastrar candidatos | Rejeita cadastro associado a estudo inexistente. | ✅ OK |
| `CT-RF08-05` | RF08 — Cadastrar candidatos | Bloqueia cadastro/consulta sem sessão ou sem permissão. | ✅ OK |
| `CT-RF09-01` | RF09 — Avaliar elegibilidade | Considera elegível quem atende inclusão e não atende exclusão. | ✅ OK |
| `CT-RF09-02` | RF09 — Avaliar elegibilidade | Considera inelegível quem falha inclusão ou atende exclusão. | ✅ OK |
| `CT-RF09-03` | RF09 — Avaliar elegibilidade | Mantém candidato Em avaliação quando há respostas pendentes. | ✅ OK |
| `CT-RF09-04` | RF09 — Avaliar elegibilidade | Consulta avaliação vazia e respostas persistidas do candidato. | ✅ OK |
| `CT-RF09-05` | RF09 — Avaliar elegibilidade | Rejeita avaliações incompletas, duplicadas ou ligadas a critérios inválidos. | ✅ OK |
| `CT-RF09-06` | RF09 — Avaliar elegibilidade | Bloqueia avaliação/consulta de candidato inexistente, sem sessão ou sem permissão. | ✅ OK |
| `CT-RF10-01` | RF10 — Registrar consentimento simulado | Registra consentimento com vínculo e identidade do Pesquisador. | ✅ OK |
| `CT-RF10-02` | RF10 — Registrar consentimento simulado | Consulta consentimento registrado ou indica ausência de registro. | ✅ OK |
| `CT-RF10-03` | RF10 — Registrar consentimento simulado | Rejeita campos obrigatórios ausentes ou inválidos. | ✅ OK |
| `CT-RF10-04` | RF10 — Registrar consentimento simulado | Impede registro para candidato inexistente ou sem autorização. | ✅ OK |
| `CT-RF11-01` | RF11 — Incluir candidatos no estudo | Inclui candidato elegível, consentido e com vaga disponível. | ✅ OK |
| `CT-RF11-02A` | RF11 — Incluir candidatos no estudo | Impede inclusão quando o candidato não atende critério de inclusão. | ✅ OK |
| `CT-RF11-02B` | RF11 — Incluir candidatos no estudo | Impede inclusão quando o candidato atende critério de exclusão. | ✅ OK |
| `CT-RF11-03` | RF11 — Incluir candidatos no estudo | Impede inclusão sem consentimento registrado. | ✅ OK |
| `CT-RF11-04` | RF11 — Incluir candidatos no estudo | Impede inclusão quando o limite de participantes foi atingido. | ✅ OK |
| `CT-RF11-05` | RF11 — Incluir candidatos no estudo | Rejeita candidato/estudo inexistente e perfil sem permissão. | ✅ OK |
| `CT-RF11-06` | RF11 — Incluir candidatos no estudo | Confirma preservação do estado e contador quando a inclusão é recusada por falta de consentimento. | ✅ OK |
| `CT-RF11-07` | RF11 — Incluir candidatos no estudo | Verifica que inclusões concorrentes não excedem a última vaga. | ✅ OK |
| `CT-RF11-08` | RF11 — Incluir candidatos no estudo | Impede incluir o mesmo candidato duas vezes. | ✅ OK |
| `CT-RF11-09A` | RF11 — Incluir candidatos no estudo | Valida permissão do Coordenador em estudo na fase de recrutamento. | ✅ OK |
| `CT-RF11-09B` | RF11 — Incluir candidatos no estudo | Bloqueia Coordenador quando o estudo está fora da fase de recrutamento. | ✅ OK |


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