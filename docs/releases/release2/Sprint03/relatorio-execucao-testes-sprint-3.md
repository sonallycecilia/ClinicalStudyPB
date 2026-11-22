# Relatório de execução e rastreabilidade de testes — Sprint 3

> **Critério de registro:** este relatório reúne os resultados informados para as rodadas de Backend e os comandos executados para Mobile neste ambiente. Os horários exatos das três rodadas de Backend não foram preservados; elas aparecem na ordem cronológica relatada. Onde a invocação literal do comando não está registrada, isso é indicado explicitamente.

## 1. Identificação e Contexto da Execução

- **Sprint:** 3.
- **Branch executada:** `test/sprint-3-qa-leticia`.
- **Baseline da `main`:** `f3a9132` (merge PR #32).
- **HEAD da branch durante o registro:** `b801580` (`test(S3-QA-03): amplia testes de integração E2E para RF12–RF18`).
- **Histórico local:** clone não raso; contém as mudanças Mobile dos PRs #27, #29 e #30.
- **Ambiente-alvo:** Backend NestJS com PostgreSQL via Docker Compose; PostgreSQL publicado em `127.0.0.1:5433` (container `5432`), API em `127.0.0.1:3000`; Web em `127.0.0.1:5173`; Mobile React Native/Expo com Jest e React Native Testing Library. A primeira rodada E2E ocorreu com o PostgreSQL indisponível; ele foi iniciado para as rodadas seguintes.
- **Rastreabilidade:** este relatório complementa o [plano de testes e massa de dados RF12–RF18](./plano-testes-massa-dados-rf12-rf18.md).
- **Commits de QA na branch:** `9f195ca` (S3-QA-02: plano e massa) e `b801580` (S3-QA-03: testes E2E).

## 2. Resumo Geral por Task / Camada

| Task / camada | Comando executado ou referência | Suítes / testes | Aprovados | Falhas / bloqueios | Status atual |
|---|---|---:|---:|---|---|
| **S3-QA-02 — plano e massa** | Não se aplica: entrega documental registrada no commit `9f195ca`; nenhuma execução de testes foi registrada para essa task. | N/A | N/A | Não é uma rodada de testes. | **Entregável documental presente**; não classificado como aprovação de testes. |
| **S3-QA-03 — Backend unitários e lint** | Scripts correspondentes em `backend/package.json`: `lint` e `test`. A invocação literal e os argumentos não foram preservados. | Suítes: não registrado; **76 testes** | **76/76** | Nenhuma na rodada final informada. | **Passou**. |
| **S3-QA-03 — Backend E2E E01–E10 / RF12–RF18** | Script `test:e2e` de `backend/package.json`; argumentos literais não registrados. Também foi informado `git diff --check`. | **2/2 suítes**, **29 testes** | **29/29** na rodada final | Rodada 1 bloqueada por `ECONNREFUSED`; rodada 2 com **28/29** e colisão de massa. | **Passou após correção e reexecução**. |
| **S3-QA-03 — Web RF12–RF16** | Nenhum comando de integração Web foi registrado para esta execução. | N/A | N/A | Integração real continua pendente; as telas usam dados locais/demonstrativos conforme o plano. | **Bloqueado / não executado** para integração real. |
| **S3-QA-05 — Mobile UI e regressão de login** | `npm.cmd --prefix mobile test -- --runInBand`; `npm.cmd --prefix mobile run typecheck`; `npm.cmd --prefix mobile run lint`. | **10 suítes**, **71 testes** | **10/10**, **71/71**; typecheck e lint aprovados | Primeira tentativa do Jest não iniciou porque `jest` não era reconhecido; após instalar dependências travadas, a suíte executou. | **Passou** para os componentes e a regressão existentes. |
| **S3-QA-05 — Mobile integrado E09/E10** | Não executável contra os serviços Mobile atuais. | N/A | N/A | `participantStudiesApi.ts` e `participantVisitsApi.ts` são placeholders e não consomem E09/E10. | **Bloqueado** até a integração real. |

## 3. Histórico Cronológico de Execuções — Falhas, Correções e Reexecuções

Os resultados de Backend abaixo estão registrados na sequência das rodadas, mas sem data/hora de execução recuperável.

### Rodada 1 — Backend / S3-QA-03

- Lint passou e os testes unitários passaram: **76/76**.
- Os **29 testes E2E**, nas suítes [participant-visits.e2e-spec.ts](../../../../backend/test/participant-visits.e2e-spec.ts) e [participant-self-service.e2e-spec.ts](../../../../backend/test/participant-self-service.e2e-spec.ts), não chegaram às assertions: falharam ao conectar ao PostgreSQL em `localhost:5433` (`ECONNREFUSED`).
- **Diagnóstico registrado:** PostgreSQL/Docker Compose indisponível. Esta rodada indica bloqueio de ambiente, não falha funcional comprovada pelas assertions.
- **Ação para a rodada seguinte:** iniciar o PostgreSQL do Compose em `localhost:5433`.

### Rodada 2 — Backend / S3-QA-03

- Com PostgreSQL disponível, **28/29 testes E2E passaram**.
- Um cenário novo falhou por colisão de massa: a validação de `observation` reutilizava uma visita prevista que já estava agendada.
- **Ação para a rodada seguinte:** isolar o dado usado pelo cenário, evitando reaproveitar a visita prevista já agendada.

### Rodada 3 — Backend / S3-QA-03

- Após o isolamento da massa, passaram **2/2 suítes E2E (29/29 testes)**, **76/76 testes unitários**, lint e `git diff --check`.
- Os erros de banco observados nos logs durante cenários de rollback são provocados intencionalmente e validados pelos testes; não foram registrados como falhas residuais.
- **Resultado:** rodada final aprovada para a cobertura Backend executada.

### Rodada 4 — Mobile / S3-QA-05 — 2026-11-22

- O rastreio local identificou o merge do PR #27 (`43da7862`, 16/11), o commit de estudos `36c30ff5` (16/11) e o commit de visitas `c9bd8864` / merge PR #30 (18/11); o PR #29 (`e2d83d2`) integra a entrega de estudos. O histórico local não contém referência a `S3-MOB-06`.
- **Primeira tentativa:** `npm.cmd --prefix mobile test -- --runInBand` não iniciou porque `jest` não era reconhecido no ambiente.
- **Ação tomada:** `npm.cmd ci --prefix mobile` instalou as dependências do lockfile; não foi alterado código-fonte para destravar o teste.
- **Reexecução:** Jest + React Native Testing Library passou em **10/10 suítes e 71/71 testes**; `typecheck` e `lint` também passaram.
- **Limite de escopo:** isso valida os componentes e a regressão já cobertos por mocks. Não valida chamadas reais E09/E10, pois [participantStudiesApi.ts](../../../../mobile/src/studies/participantStudiesApi.ts) e [participantVisitsApi.ts](../../../../mobile/src/visits/participantVisitsApi.ts) ainda lançam erros de serviço indisponível.
- A pendência P-01, sobre o vínculo `candidatos.id_usuario`, permanece documentada; a tela Mobile não distingue ausência de participação de candidato sem vínculo.

## 4. Detalhamento por Requisito — RF12 a RF18

| Requisito | Validado no Backend | Web / Mobile e bloqueios | Evidências |
|---|---|---|---|
| **RF12 — Agendamento (E01–E03)** | Coberto na rodada E2E aprovada: consulta, filtros, criação de agendamento, validação de vínculo/limite, concorrência e datas. | Integração real Web com E01–E03 continua pendente segundo o plano. | [participant-visits.e2e-spec.ts](../../../../backend/test/participant-visits.e2e-spec.ts); [visits.service.spec.ts](../../../../backend/src/studies/visits.service.spec.ts); [visits.dto.spec.ts](../../../../backend/src/studies/visits.dto.spec.ts). |
| **RF13 — Situação da visita (E04)** | Coberto na rodada E2E aprovada: transições, autorização, concorrência e rollback. Os erros de banco nos testes de rollback são esperados e validados. | Integração real Web com E04 pendente; o plano registra estados locais diferentes do contrato. | [participant-visits.e2e-spec.ts](../../../../backend/test/participant-visits.e2e-spec.ts); [visits.service.spec.ts](../../../../backend/src/studies/visits.service.spec.ts). |
| **RF14 — Resultados (E05–E06)** | Coberto na rodada E2E aprovada: leitura/ordem de atividades, registro, autorização, duplicidade e rollback. | Não há integração funcional Web registrada para RF14. | [participant-visits.e2e-spec.ts](../../../../backend/test/participant-visits.e2e-spec.ts); [assessment-results.service.spec.ts](../../../../backend/src/studies/assessment-results.service.spec.ts). |
| **RF15 — Histórico da equipe (E07)** | Coberto na rodada E2E aprovada: histórico cronológico, histórico sem visitas, visitas sem resultados e isolamento/autorização. | Integração Web com E07 não identificada no plano; a tela de relatórios contém dados locais de exemplo. | [participant-visits.e2e-spec.ts](../../../../backend/test/participant-visits.e2e-spec.ts); [visits.service.spec.ts](../../../../backend/src/studies/visits.service.spec.ts). |
| **RF16 — Retirada (E08)** | Coberto na rodada E2E aprovada: retirada e preservação de visitas/resultados, permissões, validações, concorrência e rollback. | Confirmação visual e envio real de E08 pela Web continuam pendentes. | [participant-visits.e2e-spec.ts](../../../../backend/test/participant-visits.e2e-spec.ts); [candidates.service.spec.ts](../../../../backend/src/studies/candidates.service.spec.ts). |
| **RF17 — Estudos do participante (E09)** | Coberto na rodada E2E aprovada para estudos próprios, estados de participação, lista vazia e autorização/validação. A semântica de candidato sem vínculo prevê `[]` enquanto P-01 não for resolvido. | Testes Mobile aprovam apresentação com dados mockados, estado vazio, erro/repetição e proteção de sessão. A consulta real E09 está bloqueada pelo placeholder; P-01 não está validado com integração de cadastro real. | [participant-self-service.e2e-spec.ts](../../../../backend/test/participant-self-service.e2e-spec.ts); [participant-self-service.service.spec.ts](../../../../backend/src/studies/participant-self-service.service.spec.ts); [HomeScreen.test.tsx](../../../../mobile/src/screens/__tests__/HomeScreen.test.tsx); [participantStudiesApi.test.ts](../../../../mobile/src/studies/__tests__/participantStudiesApi.test.ts). |
| **RF18 — Próximas visitas e histórico próprio (E10)** | Coberto na rodada E2E aprovada para `upcoming`/`history`, estados, ordenação, isolamento e validação/autorização. | Testes Mobile cobrem telas, escopos vazios, erros simulados e repetição; serviço real E10 permanece bloqueado pelo placeholder. O contrato não expõe `observation` nem resultados de avaliação. | [participant-self-service.e2e-spec.ts](../../../../backend/test/participant-self-service.e2e-spec.ts); [participant-visits.service.spec.ts](../../../../backend/src/studies/participant-visits.service.spec.ts); [visits-navigation.test.tsx](../../../../mobile/src/routes/__tests__/visits-navigation.test.tsx); [VisitsContext.test.tsx](../../../../mobile/src/visits/__tests__/VisitsContext.test.tsx); [participantVisitsApi.test.ts](../../../../mobile/src/visits/__tests__/participantVisitsApi.test.ts). |

Os totais unitários de Backend são globais (**76 testes**) e não foram particionados por RF nas evidências desta execução.

## 5. Roteiro de Revalidação — Pendências e Desbloqueios Futuros

### Mobile — E09 / RF17 e E10 / RF18

- [ ] Integrar `participantStudiesApi.ts` com E09 e `participantVisitsApi.ts` com E10 quando a implementação estiver disponível na `main`.
- [ ] Revalidar RF17 com participação vinculada e sem participação; validar candidato sem vínculo conforme P-01 (`candidatos.id_usuario`) e o retorno previsto `[]`, sem associar por nome/e-mail.
- [ ] Revalidar RF18 em `upcoming` e `history`, com visitas próprias e sem visitas no escopo; verificar estados/ordenação conforme o contrato e que resultados de avaliação/`observation` não sejam expostos.
- [ ] Simular falha de rede e repetir a consulta; confirmar o comportamento implementado, sem estabelecer mensagens/estados que não estejam no código ou contrato.
- [ ] Revalidar expiração de sessão (`401`): descarte do token e retorno ao fluxo de login, além da regressão já coberta pelo `AuthContext`.
- [ ] Executar novamente Jest, `typecheck` e lint após a integração.

### Web — RF12–RF16 / E01–E08

- [ ] Aguardar substituição dos dados locais/demonstrativos das telas Web por integração real.
- [ ] Revalidar fluxos E01–E08 por RF, incluindo autorização, validações e estados descritos no plano.
- [ ] Registrar separadamente falhas de interface, serviço e ambiente; não contar os testes de Backend aprovados como evidência de integração Web.

### Backend — E01–E10 / RF12–RF18

- [ ] Antes dos E2E, confirmar PostgreSQL Compose saudável em `localhost:5433`.
- [ ] Reexecutar lint, testes unitários, as duas suítes E2E e `git diff --check` após mudanças de Backend.
- [ ] Distinguir logs de falha esperados e assertados nos cenários de rollback de falhas não previstas.

### Template para novas rodadas

```text
### Rodada — [identificador]
- Data/Hora:
- Commit/Branch:
- Escopo:
- Comando(s):
- Resultado:
- Falhas/Bloqueios:
- Ação tomada:
```
