# Checklist de Testes Funcionais — RF12 a RF18

**Projeto:** ClinicalStudyPB  
**Release:** 2 — Sprint 3  
**Responsável:** QA  
**Período:** 10/11/2026 a 23/11/2026

## Critério de marcação

Um item está marcado com `[x]` somente quando há registro de execução aprovada que cobre aquele cenário. A existência de um teste automatizado, sem execução registrada, não basta para marcar o item. Itens sem evidência, bloqueados ou com comportamento divergente permanecem `[ ]`, com o motivo indicado.

| Sigla | Evidência de execução |
|---|---|
| **E2E-BE** | Testes E2E do backend com PostgreSQL real (Docker Compose, porta 5433), executados em 23/11/2026 sobre `origin/main` `7e48a5b`: 10 suítes, 108 testes aprovados. Suítes principais: [participant-visits.e2e-spec.ts](../../../../../backend/test/participant-visits.e2e-spec.ts) e [participant-self-service.e2e-spec.ts](../../../../../backend/test/participant-self-service.e2e-spec.ts). |
| **UNIT-BE** | Testes unitários do backend executados em 23/11/2026 no HEAD `aff8634`: 23 suítes, 240 testes aprovados. |
| **WEB** | Vitest executado em 23/11/2026 no HEAD `aff8634`: 45 arquivos, 755 testes aprovados. A API é simulada nesses testes. |
| **MOB** | Jest e React Native Testing Library executados em 23/11/2026 no HEAD `aff8634`: 14 suítes, 127 testes aprovados. As respostas da API são simuladas. |
| **CYP-QA** | Cypress executado pela QA em 22/11/2026 (branch `test/sprint-3-qa-leticia`, `6af58f6`): 11 specs, 54 testes aprovados, contra Web, API e PostgreSQL reais. Fonte: [relatório de execução da Sprint 3](./relatorio-execucao-testes-sprint-3.md). Não foi reexecutado nesta análise. |
| **MOB-REAL** | Validação do Mobile no Expo Web contra a API real, registrada em 22/11/2026: [s3-mob-03-validacao.json](../evidencias/s3-mob-03-validacao.json). |
| **API-MANUAL** | Chamadas HTTP manuais à API local em 23/11/2026, com contas fictícias do seed. |

Nos testes **E2E-BE**, o vínculo entre a conta Participante e o candidato é inserido diretamente no banco. Esses testes comprovam as regras da API, mas não comprovam o fluxo de cadastro pelo sistema (ver [P-01](#p-01--associação-entre-usuário-e-candidato)).

## RF12 — Agendamento de Visitas

- [x] **CT-RF12-01:** Agendar visita para participante com participação ativa, com situação inicial Agendada. — *E2E-BE; CYP-QA (`rf12-rf13-agendamento-situacao.cy.ts`).*
- [x] **CT-RF12-02:** Associar a visita à participação e à visita prevista corretas, rejeitando visita prevista de outro estudo. — *E2E-BE.*
- [x] **CT-RF12-03:** Persistir data e horário e consultar a agenda do estudo com filtros, sem misturar dados de outros estudos. — *E2E-BE; CYP-QA (persistência confirmada após recarregar a página).*
- [x] **CT-RF12-04:** Impedir cadastro com campos obrigatórios ausentes, UUID inválido ou propriedade não prevista. — *UNIT-BE (`participant-visits.dto.spec.ts`).*
- [x] **CT-RF12-05:** Impedir data de agendamento anterior à inclusão ou posterior ao término do estudo, considerando o dia civil de Brasília. — *E2E-BE.*
- [x] **CT-RF12-06:** Impedir agendamento para participação Retirada ou Concluída (`PARTICIPATION_NOT_ACTIVE`). — *E2E-BE.*
- [x] **CT-RF12-07:** Impedir agendamento duplicado da mesma visita prevista, inclusive em requisições concorrentes, e permitir remarcar após Ausente ou Cancelada. — *E2E-BE.*
- [x] **CT-RF12-08:** Impedir acesso sem autenticação e por perfis ou estudos não autorizados. — *E2E-BE; WEB (`participantsRoutes.test.tsx`).*
- [x] **CT-RF12-09:** Validar o formulário Web de agendamento: campos obrigatórios, data anterior à inclusão, limite da observação e envio duplicado. — *WEB (`ScheduleVisitForm.test.tsx`).*

## RF13 — Situação das Visitas

- [x] **CT-RF13-01:** Registrar visita como Realizada, com data de realização. — *E2E-BE; CYP-QA.*
- [x] **CT-RF13-02:** Registrar visita como Ausente. — *E2E-BE.*
- [x] **CT-RF13-03:** Registrar visita como Cancelada. — *E2E-BE.*
- [x] **CT-RF13-04:** Exigir data de realização para Realizada e rejeitar data futura ou fora do período (`REALIZED_AT_INVALID`). — *E2E-BE; WEB (`VisitStatusForm.test.tsx`).*
- [x] **CT-RF13-05:** Consultar a situação atualizada após a alteração. — *E2E-BE; CYP-QA (situação mantida após recarregar a página).*
- [x] **CT-RF13-06:** Rejeitar alteração de visita que já está em situação final (`VISIT_STATUS_FINAL`). — *E2E-BE.*
- [x] **CT-RF13-07:** Serializar atualizações concorrentes e reverter a operação quando uma restrição do PostgreSQL falhar. — *E2E-BE.*
- [x] **CT-RF13-08:** Aplicar autorização, participação ativa, isolamento por estudo e estados permitidos do estudo. — *E2E-BE.*

## RF14 — Resultados das Avaliações

- [x] **CT-RF14-01:** Registrar resultado fictício de atividade prevista em visita Realizada. — *E2E-BE.*
- [x] **CT-RF14-02:** Persistir valor, unidade, observação e responsável pelo registro, conforme o contrato. — *E2E-BE.*
- [x] **CT-RF14-03:** Impedir vínculo com atividade que não pertence à visita prevista (`ACTIVITY_NOT_IN_VISIT`). — *E2E-BE.*
- [x] **CT-RF14-04:** Impedir resultado duplicado para a mesma visita e atividade (HTTP 409), inclusive em requisições concorrentes. — *E2E-BE.*
- [x] **CT-RF14-05:** Consultar as atividades na ordem de cadastro, com os resultados já registrados. — *E2E-BE.*
- [x] **CT-RF14-06:** Impedir registro em visita não realizada, em estudo encerrado ou com visita de outro estudo. — *E2E-BE.*
- [x] **CT-RF14-07:** Validar campos obrigatórios e limites do resultado. — *UNIT-BE (`participant-visits.dto.spec.ts`); WEB (`VisitResultsPanel.test.tsx`).*
- [x] **CT-RF14-08:** Permitir registro somente aos perfis autorizados; Coordenador apenas consulta. — *E2E-BE; WEB (`VisitResultsPanel.test.tsx`).*

## RF15 — Histórico de Visitas e Avaliações

- [x] **CT-RF15-01:** Consultar o histórico de um participante do estudo. — *E2E-BE.*
- [x] **CT-RF15-02:** Exibir visitas com datas agendadas e de realização. — *E2E-BE; WEB (`ParticipantHistoryPanel.test.tsx`).*
- [x] **CT-RF15-03:** Exibir a situação de cada visita e da participação. — *E2E-BE; WEB.*
- [x] **CT-RF15-04:** Exibir os resultados das avaliações vinculados a cada visita. — *E2E-BE; WEB.*
- [x] **CT-RF15-05:** Ordenar os registros de forma cronológica. — *E2E-BE; WEB.*
- [x] **CT-RF15-06:** Tratar histórico sem visitas e visitas sem resultados. — *E2E-BE; WEB.*
- [x] **CT-RF15-07:** Restringir o acesso por perfil, estado do estudo e isolamento entre estudos. — *E2E-BE.*
- [ ] **CT-RF15-08:** Consultar o histórico pela interface Web, ponta a ponta, contra API e PostgreSQL reais. — *Não verificado: não há spec Cypress para RF15.*

## RF16 — Retirada de Participantes

- [x] **CT-RF16-01:** Registrar a retirada de uma participação ativa. — *E2E-BE.*
- [x] **CT-RF16-02:** Persistir situação Retirado, data e motivo da retirada. — *E2E-BE.*
- [x] **CT-RF16-03:** Preservar visitas, resultados e demais registros anteriores. — *E2E-BE.*
- [x] **CT-RF16-04:** Impedir a operação para estudo ou participação inexistente, ou com data ou motivo inválidos. — *E2E-BE; UNIT-BE.*
- [x] **CT-RF16-05:** Impedir retirada por perfis não autorizados; permitir ao Coordenador ativo em estudo permitido. — *E2E-BE.*
- [x] **CT-RF16-06:** Rejeitar nova retirada quando a participação já não está ativa. — *E2E-BE; WEB (`WithdrawalForm.test.tsx`).*
- [x] **CT-RF16-07:** Serializar retiradas concorrentes e reverter falhas durante a transação. — *E2E-BE.*
- [x] **CT-RF16-08:** Exigir motivo e confirmação na interface Web antes de enviar, sem oferecer a ação em estudo encerrado ou para participante concluído. — *WEB (`WithdrawalForm.test.tsx`, `ParticipantsPage.test.tsx`).*
- [ ] **CT-RF16-09:** Registrar a retirada pela interface Web, ponta a ponta, contra API e PostgreSQL reais. — *Não verificado: não há spec Cypress para RF16.*

## RF17 — Consulta dos Estudos do Participante no Mobile

- [x] **CT-RF17-01:** Autenticar conta Participante ativa e recusar outros perfis e contas inativas no aplicativo. — *MOB (`AuthContext.test.tsx`, `LoginScreen.test.tsx`); API-MANUAL (login do Participante respondeu 201).*
- [x] **CT-RF17-02:** Consultar `GET /me/studies` somente com o token da sessão, sem enviar identificador do participante. — *E2E-BE; MOB (`authenticatedQueries.test.tsx`, `participantStudiesApi.test.ts`).*
- [x] **CT-RF17-03:** Exibir no aplicativo os dados reais retornados pela API (título, objetivo, situação do estudo e da participação). — *MOB-REAL. Limitação: o vínculo da conta usada foi criado fora do fluxo de cadastro do sistema (P-01).*
- [x] **CT-RF17-04:** Tratar participante sem estudos como lista vazia (`200 []`). — *E2E-BE; MOB (`HomeScreen.test.tsx`); API-MANUAL.*
- [x] **CT-RF17-05:** Tratar falha de rede e timeout, preservando a sessão e permitindo nova tentativa. — *MOB (`authenticatedQueries.test.tsx`, respostas simuladas).*
- [x] **CT-RF17-06:** Tratar sessão expirada (401), removendo os dados e retornando ao login. — *MOB (`studies-navigation.test.tsx`, respostas simuladas); API-MANUAL (`/me/studies` sem token respondeu 401).*
- [x] **CT-RF17-07:** Isolar os dados entre participantes e descartar respostas de uma sessão anterior. — *E2E-BE; MOB (`HomeScreen.test.tsx`, `studies-navigation.test.tsx`).*
- [x] **CT-RF17-08:** Bloquear o acesso de outros perfis aos endpoints `/me/*` (403). — *E2E-BE; API-MANUAL (Coordenador recebeu 403).*
- [ ] **CT-RF17-09:** Executar fluxo E2E Mobile automatizado login → estudos contra API e PostgreSQL reais. — *Não disponível: não há ferramenta de E2E Mobile configurada (Maestro, Detox ou Appium).*

## RF18 — Próximas Visitas e Histórico no Mobile

- [x] **CT-RF18-01:** Consultar as próximas visitas (`scope=upcoming`). — *E2E-BE; MOB (`participantVisitsApi.test.ts`).*
- [x] **CT-RF18-02:** Consultar o histórico de comparecimento (`scope=history`), incluindo Realizada, Ausente e Cancelada. — *E2E-BE; MOB.*
- [x] **CT-RF18-03:** Exibir estudo, visita, data e situação na lista e nos detalhes. — *MOB (`visits-navigation.test.tsx`, respostas simuladas).*
- [x] **CT-RF18-04:** Ordenar próximas visitas em ordem crescente e o histórico em ordem decrescente. — *E2E-BE; MOB.*
- [x] **CT-RF18-05:** Tratar ausência de visitas em cada escopo. — *E2E-BE; MOB.*
- [x] **CT-RF18-06:** Tratar falha de rede com nova tentativa, sem substituir por dados locais. — *MOB (`VisitsContext.test.tsx`, `visits-navigation.test.tsx`).*
- [x] **CT-RF18-07:** Tratar sessão inválida ou expirada (401) em consultas concorrentes, limpando a sessão uma única vez. — *MOB (`authenticatedQueries.test.tsx`).*
- [x] **CT-RF18-08:** Isolar as visitas entre participantes, sem expor observações internas nem resultados de avaliação. — *E2E-BE.*
- [x] **CT-RF18-09:** Rejeitar consulta sem `scope` ou com parâmetro não permitido (400). — *E2E-BE; API-MANUAL.*
- [ ] **CT-RF18-10:** Exibir em algum escopo uma visita Agendada cuja data já passou. — *Comportamento atual divergente: a API e o aplicativo excluem essa visita de "próximas" e ela não entra no "histórico". Registrado como problema conhecido.*
- [ ] **CT-RF18-11:** Exibir no aplicativo visitas reais retornadas pela API. — *Não verificado: o registro MOB-REAL consulta `scope=upcoming`, mas suas verificações descrevem apenas os estudos.*
- [ ] **CT-RF18-12:** Executar fluxo E2E Mobile automatizado login → próximas visitas → histórico contra API e PostgreSQL reais. — *Não disponível: não há ferramenta de E2E Mobile configurada.*

## P-01 — Associação entre usuário e candidato

A P-01 não é um requisito funcional. Ela é um ponto de integração do qual dependem o RF17 e o RF18: a API identifica o participante autenticado por `usuarios.id_usuario` → `candidatos.id_usuario` → `participacoes_estudo.id_candidato`.

**Situação verificada em 23/11/2026:** o cadastro de candidatos (`CandidatesService.create`) grava somente estudo, nome e e-mail, sem `id_usuario`. Não há tela nem endpoint que estabeleça o vínculo. No banco local do Compose havia 2 candidatos, nenhum vinculado a uma conta, e a conta Participante do seed recebeu `200 []` em `/me/studies` e `/me/visits`.

- [ ] **CT-P01-01:** Gravar `candidatos.id_usuario` ao cadastrar ou vincular um candidato pelo fluxo do sistema. — *Não implementado (verificado no código).*
- [x] **CT-P01-02:** Identificar o participante autenticado a partir de `usuarios.id_usuario` e `candidatos.id_usuario`, sem usar identificadores enviados pelo cliente. — *E2E-BE, com vínculo inserido diretamente no banco.*
- [x] **CT-P01-03:** Relacionar a conta às participações por `participacoes_estudo.id_candidato`, nos estados Ativo, Retirado e Concluído. — *E2E-BE, com vínculo inserido diretamente no banco.*
- [x] **CT-P01-04:** Retornar lista vazia para conta sem vínculo, sem expor dados de outros candidatos. — *E2E-BE; API-MANUAL.*
- [x] **CT-P01-05:** Isolar estudos e visitas entre contas Participante distintas. — *E2E-BE, com vínculo inserido diretamente no banco.*
- [ ] **CT-P01-06:** Não associar participante por nome ou e-mail. — *Verificado apenas por inspeção do código; não há teste específico.*
- [ ] **CT-P01-07:** Consultar estudos e visitas no aplicativo após o fluxo real cadastro → elegibilidade → consentimento → inclusão → login do participante. — *Bloqueado por CT-P01-01.*
