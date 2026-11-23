# Plano de Levantamento — Task S3-QA-02

## Contexto analisado na `main`

A `main` atual aponta para o merge do Pull Request **#32** e já contém:

- Contratos de API RF12–RF18 em [contratos-api-rf12-rf18.md](./contratos-api-rf12-rf18.md).
- Matriz de acesso em [matriz-acesso-e-identificacao-participante-rf12-rf18.md](./matriz-acesso-e-identificacao-participante-rf12-rf18.md).
- Endpoints E01–E10 implementados no Backend.
- Testes E2E para participantes e visitas agendadas.
- Testes E2E para autoatendimento do participante.
- Prototipação Web ainda predominantemente local/demonstrativa.
- Serviços Mobile RF17/RF18 ainda definidos como placeholders indisponíveis.

Na Sprint 1, os testes foram organizados por unidade, integração e rastreabilidade funcional. Na Sprint 2, consolidaram-se:

- Jest/Supertest no Backend.
- Vitest/Testing Library no Web.
- Jest + React Native Testing Library no Mobile.
- Cypress E2E com PostgreSQL.
- Checklists por RF e relatórios de cobertura.

---

## Resumo por Camada — RF12 a RF18

| RF | Backend | Web | Mobile |
|---|---|---|---|
| **RF12 — Agendamento** | `GET E01`, `POST E02`, `GET E03`, `GET X02`, `GET X03`. Cria `visitas` com situação `Agendada`. Valida participação ativa, pertencimento ao estudo, período civil e duplicidade. | Existe `/coordenador/visitas` e modais locais. **Integração real com E01/E02/E03/X02/X03 ainda não encontrada.** A tela usa dados locais e status próprios, como `Confirmada` e `Aguardando`. | Não aplicável. A especificação atribui RF12 ao Web. |
| **RF13 — Situação da visita** | `PATCH /studies/:studyId/scheduled-visits/:scheduledVisitId/status`. Destinos válidos: `Realizada`, `Ausente`, `Cancelada`. Agendada não é destino permitido. | Existe modal de atualização em `/coordenador/visitas`, mas ainda usa estados locais diferentes do contrato. **Integração com E04 pendente.** | Não aplicável diretamente. As situações podem aparecer no histórico do participante pelo RF18. |
| **RF14 — Resultados fictícios** | `GET E05` e `POST E06`. Somente Pesquisador proprietário; visita deve estar `Realizada`. Sem correção posterior e sem duplicidade. | RF14 não tem implementação funcional identificada. A tela pode ser representada em integrações futuras do painel do Pesquisador/Coordenador. | Não aplicável. O Mobile não recebe resultados de avaliação em RF18. |
| **RF15 — Histórico** | `GET /studies/:studyId/participants/:participationId/history`. Equipes autorizadas recebem participação, visitas e resultados. | Não há integração identificada com E07. `/coordenador/relatorios` contém apenas dados locais de exemplo. | Não aplicável diretamente; o histórico próprio é apresentado pelo E10/RF18. |
| **RF16 — Retirada** | `POST .../participants/:participationId/withdrawal`. Atualiza participação para `Retirado`, data e motivo; preserva histórico. | A tela apresenta resumos locais, mas não há confirmação funcional integrada ao E08. | Não aplicável para retirada direta. Participante não pode registrar retirada nesta sprint; retirada voluntária é RF20. |
| **RF17 — Estudos do participante** | `GET /me/studies`, identificando por `candidatos.id_usuario = request.user.sub`. | Não aplicável. A funcionalidade pertence ao Mobile. | A tela Home já mostra o estado vazio e a estrutura visual, mas `participantStudiesService` é um placeholder; **E09 ainda não é consumido**. |
| **RF18 — Próximas visitas/histórico** | `GET /me/visits?scope=upcoming|history&studyId=`. Retorna somente dados próprios do participante. | Não aplicável diretamente. | Existem telas de abas Próximas/Histórico e `VisitsContext`, mas o serviço de dados é placeholder. **Integração com E10 pendente.** |

---

# A. Massa de Dados Fictícios Padronizada

## A1. Perfis e contas

| ID da massa | Perfil | Estado | E-mail | Senha | Uso esperado |
|---|---|---|---|---|---|
| `USR_PESQ_PROP` | Pesquisador | Ativo | `pesquisador.prop@clinicalstudypb.test` | `Senha123!` | Proprietário dos estudos próprios. |
| `USR_PESQ_OUTRO` | Pesquisador | Ativo | `pesquisador.outro@clinicalstudypb.test` | `Senha123!` | Pesquisador sem propriedade dos estudos alheios. |
| `USR_PESQ_INATIVO` | Pesquisador | Inativo | `pesquisador.inativo@clinicalstudypb.test` | `Senha123!` | Autorização negada por conta inativa. |
| `USR_COORD` | Coordenador | Ativo | `coordenador@clinicalstudypb.test` | `Senha123!` | Acesso à equipe conforme estado do estudo. |
| `USR_COORD_INATIVO` | Coordenador | Inativo | `coordenador.inativo@clinicalstudypb.test` | `Senha123!` | Autorização negada por conta inativa. |
| `USR_ADMIN` | Administrador | Ativo | `admin@clinicalstudypb.test` | `Senha123!` | Nenhuma rota RF12–RF18 permite este perfil. |
| `USR_PART_COM_PART_01` | Participante | Ativo | `bianca@clinicalstudypb.test` | `Senha123!` | Conta vinculada a `PART_COM_PART_01`. |
| `USR_PART_RETIRADO` | Participante | Ativo | `participante.retirado@clinicalstudypb.test` | `Senha123!` | Conta vinculada à participação retirada. |
| `USR_PART_CONCLUIDO` | Participante | Ativo | `participante.concluido@clinicalstudypb.test` | `Senha123!` | Conta vinculada à participação concluída. |
| `USR_PART_SEM_PART_01` | Participante | Ativo | `sem.participacao@clinicalstudypb.test` | `Senha123!` | Não possui participação vinculada. |
| `USR_PART_INATIVO` | Participante | Inativo | `participante.inativo@clinicalstudypb.test` | `Senha123!` | Acesso RF17/RF18 negado. |
| `USR_SEM_AUTH` | — | — | — | — | Nenhum token enviado. |

---

## A2. Estudos

| ID da massa | Atributo | Valores |
|---|---|---|
| `EST_EXEC_01` | Proprietário | `USR_PESQ_PROP` |
|  | Estado | `execução` |
|  | Título | `Qualidade do sono` |
|  | Período | `2026-04-01` a `2026-12-31` |
|  | Limite | `30`, vinculados `5` |
| `EST_RECRUTAMENTO_01` | Proprietário | `USR_PESQ_PROP` |
|  | Estado | `recrutamento` |
|  | Título | `Estudo de pressão arterial` |
|  | Período | `2026-01-01` a `2026-12-31` |
| `EST_ENCERRADO_01` | Proprietário | `USR_PESQ_PROP` |
|  | Estado | `encerrado` |
|  | Título | `Estudo encerrado fictício` |
| `EST_PLANEJAMENTO_01` | Proprietário | `USR_PESQ_PROP` |
|  | Estado | `planejamento` |
| `EST_OUTRO_PESQUISADOR` | Proprietário | `USR_PESQ_OUTRO` |
|  | Estado | `execução` |

---

## A3. Participantes e participações

| ID da massa | Participante/candidato | Conta vinculada em `candidatos.id_usuario` | Participação | Estudo | Estado |
|---|---|---|---|---|---|
| `PART_COM_PART_01` | Bianca Oliveira | `USR_PART_COM_PART_01` | `PARTICIPACAO_ATIVA_01` | `EST_EXEC_01` | `Ativo` |
| `PART_RETIRADO_01` | Marcos Souza | `USR_PART_RETIRADO` | `PARTICIPACAO_RETIRADA_01` | `EST_EXEC_01` | `Retirado`, retirada em `2026-11-20`, motivo realista |
| `PART_CONCLUIDO_01` | Ana Lima | `USR_PART_CONCLUIDO` | `PARTICIPACAO_CONCLUIDA_01` | `EST_EXEC_01` | `Concluído` |
| `PART_SEM_PART_01` | João Nascimento | `USR_PART_SEM_PART_01` | Nenhuma | Nenhum | Candidato sem registro em `participacoes_estudo` |
| `PART_SEM_VINCULO_01` | Carla Mendes | Nenhuma | `PARTICIPACAO_SEM_VINCULO_01` | `EST_EXEC_01` | Participação ativa sem `candidatos.id_usuario`; caso P-01 |
| `PART_OUTRO_ESTUDO_01` | Paulo Rocha | Conta participante própria, distinta de `USR_PART_COM_PART_01` | `PARTICIPACAO_OUTRO_ESTUDO_01` | `EST_OUTRO_PESQUISADOR` | `Ativo` |

As contas `USR_PART_RETIRADO`, `USR_PART_CONCLUIDO` e `USR_PART_COM_PART_01` devem ser vinculadas às respectivas participações por `candidatos.id_usuario`. `PART_SEM_PART_01` não possui participação; `PART_SEM_VINCULO_01` possui participação ativa, mas não possui vínculo com uma conta Participante.

---

## A4. Visitas previstas e agendadas

| ID da massa | Tipo | Situação | Participação | Visita prevista | Estudo | Atributos |
|---|---|---|---|---|---|---|
| `VP_CONSULTA_01` | Visita prevista | — | — | Próprio ID | `EST_EXEC_01` | `Consulta inicial`, ordem `1`, intervalo `14` |
| `VP_RETORNO_01` | Visita prevista | — | — | Próprio ID | `EST_EXEC_01` | `Retorno`, ordem `2`, intervalo `14` |
| `VP_ATIVIDADE_01` | Visita prevista | — | — | Próprio ID | `EST_EXEC_01` | Atividade `Coleta de sinais vitais`, tipo `Exame` |
| `VIS_AGEND_FUTURA_01` | Agendada | `Agendada` | `PARTICIPACAO_ATIVA_01` | `VP_CONSULTA_01` | `EST_EXEC_01` | Instante posterior ao atual; elegível para `scope=upcoming` |
| `VIS_AGEND_PASSADA_01` | Agendada | `Agendada` | `PARTICIPACAO_ATIVA_01` | `VP_RETORNO_01` | `EST_EXEC_01` | Instante anterior ao atual; não aparece em `upcoming` nem em `history` |
| `VIS_REALIZADA_01` | Agendada | `Realizada` | `PARTICIPACAO_ATIVA_01` | `VP_CONSULTA_01` | `EST_EXEC_01` | `realizedAt` obrigatório e válido |
| `VIS_AUSENTE_01` | Agendada | `Ausente` | `PARTICIPACAO_ATIVA_01` | `VP_RETORNO_01` | `EST_EXEC_01` | Sem `realizedAt` |
| `VIS_CANCELADA_01` | Agendada | `Cancelada` | `PARTICIPACAO_ATIVA_01` | `VP_RETORNO_01` | `EST_EXEC_01` | Sem `realizedAt` |
| `VIS_FUTURA_RETIRADO_01` | Agendada | `Agendada` | `PARTICIPACAO_RETIRADA_01` | `VP_RETORNO_01` | `EST_EXEC_01` | Instante futuro; permanece elegível para `scope=upcoming` |
| `VIS_FINAL_REABERTA_01` | Novo agendamento | `Agendada` | `PARTICIPACAO_ATIVA_01` | `VP_RETORNO_01` | `EST_EXEC_01` | Criado a partir de agendamento final `Ausente` ou `Cancelada` |

### Atividades e resultados

| ID da massa | Campo | Valor |
|---|---|---|
| `AT_EXAME_01` | `activityId` | ID da atividade vinculada à visita prevista |
| `RES_VALIDO_01` | `value` | `120/80` |
|  | `unit` | `mmHg` |
|  | `observation` | `Valor fictício para fins acadêmicos.` |
| `RES_VALOR_VAZIO` | `value` | Espaços em branco |
| `RES_UNIT_51` | `unit` | String com 51 caracteres |
| `RES_DUPLICADO_01` | Mesma visita/agendamento e atividade já registrados | Deve retornar 409 |
| `RES_ATIVIDADE_OUTRA_VISITA` | Atividade pertencente a outra visita prevista | Deve retornar 400 `ACTIVITY_NOT_IN_VISIT` |

---

# B. Plano de Testes por Requisito

## RF12 — Agendar visitas para participantes incluídos

### Objetivo e Camadas Afetadas

- **Backend:** E01, E02, E03, X02 e X03.
- **Web:** `/coordenador/visitas` e tela de seleção/agendamento.
- **Mobile:** não aplicável.

### Pré-condições

- API disponível e PostgreSQL inicializado.
- Estudo `EST_EXEC_01` em `execução`.
- Participação ativa `PARTICIPACAO_ATIVA_01`, pertencente a `PART_COM_PART_01`.
- Visita prevista `VP_CONSULTA_01` no mesmo estudo.
- Participações retiradas/concluídas disponíveis.
- `USR_PESQ_PROP`, `USR_PESQ_OUTRO`, `USR_COORD`, `USR_ADMIN`, `USR_PART_COM_PART_01`.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF12-P-01 | `[Backend]` | `USR_PESQ_PROP`, `EST_EXEC_01`, `PART_COM_PART_01`, `VP_CONSULTA_01` | `POST /studies/:studyId/scheduled-visits` com UUIDs válidos e `scheduledAt` dentro dos limites da inclusão/término. | 201; situação `Agendada`; resposta contém `participationId`, `plannedVisitId`, `scheduledAt`, `observation` normalizada. |
| RF12-P-02 | `[Backend]` | `USR_COORD`, `EST_RECRUTAMENTO_01` | Coordenador lista participantes E01 e visita prevista X02/X03 e agenda em E02. | 200 nas consultas e 201 no agendamento. |
| RF12-P-03 | `[Backend]` | `VIS_CANCELADA_01` | Agenda novamente a mesma visita prevista após uma situação `Cancelada`. | Novo registro criado com `Agendada`. |
| RF12-P-04 | `[Backend]` | `VIS_AUSENTE_01` | Agenda novamente após `Ausente`. | Novo registro criado sem violar a regra de estado final. |
| RF12-P-05 | `[Web]` | Dados locais atuais da tela | Abrir `/coordenador/visitas`, informar participante, estudo, data/horário e confirmar. | Modal fechada e nova linha exibida. **Não considerar integração real até o consumo de E01/E02/E03.** |
| RF12-P-06 | `[Backend]` | Agendamento com data civil passada válida | Agenda com instante passado cujo dia civil seja posterior à inclusão e anterior ou igual ao término. | 201. |
| RF12-P-07 | `[Backend]` | Agendamento sem `observation` ou com string vazia | Enviar sem campo ou com espaços. | 201 com `observation: null`. |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF12-N-01 | `[Backend]` | Corpo incompleto | Omitir `participationId`, `plannedVisitId` ou `scheduledAt`. | 400 do ValidationPipe. |
| RF12-N-02 | `[Backend]` | IDs inválidos ou campo extra | Enviar strings fora de UUID ou propriedade não definida. | 400. |
| RF12-N-03 | `[Backend]` | `scheduledAt` sem fuso | Enviar `2026-11-24T09:00:00` sem offset. | 400. |
| RF12-N-04 | `[Backend]` | `EST_ENCERRADO_01` | Tentar agendar. | 400, `code: STUDY_CLOSED`. |
| RF12-N-05 | `[Backend]` | `PART_RETIRADO_01` / `PARTICIPACAO_RETIRADA_01` | Tentar agendar visita. | 400, `code: PARTICIPATION_NOT_ACTIVE`. |
| RF12-N-06 | `[Backend]` | `PART_CONCLUIDO_01` / `PARTICIPACAO_CONCLUIDA_01` | Tentar agendar visita. | 400, `code: PARTICIPATION_NOT_ACTIVE`. |
| RF12-N-07 | `[Backend]` | Data antes da inclusão ou depois do término | Enviar `scheduledAt` fora do intervalo. | 400, `code: SCHEDULE_OUT_OF_RANGE`. |
| RF12-N-08 | `[Backend]` | Participação de outro estudo | Usar participação/alocação incompatível com `EST_EXEC_01`. | 404 ou recusa de pertencimento correspondente. |
| RF12-N-09 | `[Backend]` | `VP_RETORNO_01` já agendada | Enviar novo agendamento enquanto existe registro `Agendada` ou `Realizada`. | 409, `code: VISIT_ALREADY_SCHEDULED`. |
| RF12-N-10 | `[Backend]` | `observation` com mais de 2000 caracteres | Enviar texto excedente. | 400. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF12-A-01 | `[Backend]` | `USR_SEM_AUTH` | Chamar E01/E02/E03/X02/X03 sem Bearer. | 401 em todas as rotas RF12. |
| RF12-A-02 | `[Backend]` | `USR_ADMIN` | Chamar E01/E02/E03/X02/X03 com token de Administrador. | 403 em todas as rotas RF12. |
| RF12-A-03 | `[Backend]` | `USR_PESQ_OUTRO`, `EST_EXEC_01` | Consultar e tentar escrever no estudo pertencente a `USR_PESQ_PROP`. | 403 em E02 e consultas/leituras protegidas pelo proprietário. |
| RF12-A-04 | `[Backend]` | `USR_PESQ_PROP`, `EST_PLANEJAMENTO_01` | Consultar participantes/visitas e tentar agendar. | Consulta P1 permitida; escrita P2 permitida para Pesquisador proprietário, pois o estudo não está encerrado. |
| RF12-A-05 | `[Backend]` | `USR_COORD`, `EST_PLANEJAMENTO_01` | Consultar participantes/visitas e tentar agendar. | 403: Coordenador não possui acesso de consulta nem escrita em `planejamento`. |
| RF12-A-06 | `[Backend]` | `USR_COORD`, `EST_EXEC_01` | Consultar E01/E03/X02/X03 e executar E02. | 200 nas consultas e 201 no agendamento. |
| RF12-A-07 | `[Backend]` | `USR_PART_COM_PART_01` | Chamar uma rota da equipe com token Participante. | 403 pelo `RolesGuard`. |
| RF12-A-08 | `[Backend]` | `USR_PESQ_INATIVO` | Consultar ou escrever em seu estudo com conta inativa. | 401 pela conta inativa. |

### Critérios de Aceite

- **Validável agora no Backend:** participação ativa, visita prevista e estudo pertencem ao mesmo contexto; somente Coordenador ativo ou Pesquisador proprietário escreve em estudo permitido; a resposta persiste `Agendada`; datas respeitam inclusão, término e `America/Sao_Paulo`; duplicidade `Agendada`/`Realizada` retorna 409.
- **Pendente na integração Web:** seleção real de participante e visita prevista, preenchimento dos campos E02 e consumo de E01/E03/X02/X03.
- Ausência/cancelamento permitem novo agendamento conforme a transição aprovada.

### Evidências Esperadas

- Payload E02 com status 201.
- SQL ou log demonstrando bloqueio serializado da participação.
- Logs de 400/403/404/409.
- Print Web do fluxo local e, quando integrado, da resposta persistida após reload.
- **Estado pendente:** evidência da integração real Web/E01–E03/X02–X03.

---

## RF13 — Registrar realização, ausência ou cancelamento

### Objetivo e Camadas Afetadas

- **Backend:** E03 e E04.
- **Web:** `/coordenador/visitas`, modal de atualização.
- **Mobile:** não aplicável para alteração direta.

### Pré-condições

- `VIS_AGEND_FUTURA_01`, `VIS_REALIZADA_01`, `VIS_AUSENTE_01`, `VIS_CANCELADA_01`.
- Participações ativa e retirada.
- Estudos em recrutamento, execução e encerrado.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF13-P-01 | `[Backend]` | `VIS_AGEND_FUTURA_01` | `PATCH` para `Realizada`, com `realizedAt` válido. | 200; situação `Realizada`; `realizedAt` preservado em UTC na resposta. |
| RF13-P-02 | `[Backend]` | `VIS_AGEND_FUTURA_01` | `PATCH` para `Ausente`, sem `realizedAt`, com observação opcional. | 200; situação `Ausente`; `realizedAt: null`. |
| RF13-P-03 | `[Backend]` | `VIS_AGEND_FUTURA_01` | `PATCH` para `Cancelada`, observação omitida. | 200; situação `Cancelada`; observação anterior preservada se omissa. |
| RF13-P-04 | `[Backend]` | `VIS_CANCELADA_01` | Criar novo agendamento para remarcar. | Novo registro permitido com `Agendada`. |
| RF13-P-05 | `[Web]` | Dados locais da tela | Selecionar uma visita e atualizar situação. | Visualização refletindo o novo estado. **Integração E04 pendente.** |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF13-N-01 | `[Backend]` | `VIS_AGEND_FUTURA_01`, corpo `status: Agendada` | Enviar PATCH E04 com destino `Agendada`. | 400. `Agendada` não é destino permitido. |
| RF13-N-02 | `[Backend]` | `VIS_AGEND_FUTURA_01`, `status: Realizada` | Enviar PATCH sem `realizedAt`. | 400. |
| RF13-N-03 | `[Backend]` | `VIS_AGEND_FUTURA_01`, `status: Realizada` | Enviar `realizedAt` futuro. | 400, `REALIZED_AT_INVALID`. |
| RF13-N-04 | `[Backend]` | `VIS_REALIZADA_01` | Enviar `realizedAt` anterior à data de inclusão. | 400, `REALIZED_AT_INVALID`. |
| RF13-N-05 | `[Backend]` | `VIS_AGEND_FUTURA_01`, `status: Ausente/Cancelada` | Enviar `realizedAt` em uma destas situações. | 400. |
| RF13-N-06 | `[Backend]` | `VIS_REALIZADA_01` | Tentar alterar para `Cancelada` ou outro estado final. | 400, `VISIT_STATUS_FINAL`. |
| RF13-N-07 | `[Backend]` | `EST_ENCERRADO_01`, agendamento pertencente ao estudo | Tentar PATCH E04. | 400, `STUDY_CLOSED`. |
| RF13-N-08 | `[Backend]` | `PARTICIPACAO_RETIRADA_01` | Tentar atualizar visita dessa participação. | 400, `PARTICIPATION_NOT_ACTIVE`. |
| RF13-N-09 | `[Backend]` | Visita pertencente a outro estudo | Enviar o ID da visita na rota de `EST_EXEC_01`. | 404 `Visita agendada não encontrada neste estudo`. |
| RF13-N-10 | `[Backend]` | Observação com mais de 2000 caracteres | Enviar PATCH E04 com observação excedente. | 400. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF13-A-01 | `[Backend]` | `USR_SEM_AUTH`, `VIS_AGEND_FUTURA_01` | Chamar E04 sem Bearer. | 401. |
| RF13-A-02 | `[Backend]` | `USR_ADMIN` ou `USR_PART_COM_PART_01`, `VIS_AGEND_FUTURA_01` | Tentar atualizar situação com perfil não permitido. | 403 pelo `RolesGuard`. |
| RF13-A-03 | `[Backend]` | `USR_PESQ_OUTRO`, agendamento de `EST_EXEC_01` | Tentar atualizar agendamento de estudo alheio. | 403. |
| RF13-A-04 | `[Backend]` | `USR_PESQ_PROP`, estudo próprio não encerrado | Atualizar `VIS_AGEND_FUTURA_01`. | 200. |
| RF13-A-05 | `[Backend]` | `USR_COORD`, `EST_RECRUTAMENTO_01` ou `EST_EXEC_01` | Atualizar agendamento permitido. | 200. |
| RF13-A-06 | `[Backend]` | `USR_COORD`, `EST_PLANEJAMENTO_01` | Tentar atualizar agendamento. | 403 por estado não permitido para Coordenador. |
| RF13-A-07 | `[Backend]` | `USR_COORD`, `EST_ENCERRADO_01` | Tentar atualizar agendamento. | 403 por estado não permitido para Coordenador. |

### Critérios de Aceite

- **Validável agora no Backend:** destinos são somente `Realizada`, `Ausente` e `Cancelada`; estados finais não podem ser alterados; `realizedAt` existe somente em `Realizada`; concorrência é serializada; observação omitida é preservada.
- **Pendente na integração Web:** alteração da situação da visita pela tela `/coordenador/visitas`, substituindo os estados locais atuais por `Agendada`, `Realizada`, `Ausente` e `Cancelada`.
- Estudo encerrado e participação não ativa são recusados.

### Evidências Esperadas

- Payload PATCH e resposta 200.
- Códigos `VISIT_STATUS_FINAL`, `REALIZED_AT_INVALID`, `PARTICIPATION_NOT_ACTIVE`.
- Comparação antes/depois dos estados.
- Logs de concorrência.
- Evidência Web local ou integração pendente de E04.

---

## RF14 — Registrar resultados fictícios das avaliações previstas

### Objetivo e Camadas Afetadas

- **Backend:** E05 e E06.
- **Web:** `[A confirmar com PO / Pendente de implementação]` formulário para seleção de visita realizada e atividades.
- **Mobile:** não aplicável.

### Pré-condições

- Estudo próprio não encerrado.
- Visita `Realizada`.
- Participação ativa.
- Pelo menos uma atividade vinculada à visita prevista.
- Pesquisador proprietário ativo.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF14-P-01 | `[Backend]` | `VIS_REALIZADA_01`, `AT_EXAME_01` | GET E05. | 200; atividade listada na ordem persistida; `result: null`. |
| RF14-P-02 | `[Backend]` | `RES_VALIDO_01` | POST E06 com `activityId`, `value`, `unit` e `observation`. | 201; `registrarId` é o usuário autenticado. |
| RF14-P-03 | `[Backend]` | Resultado sem `unit` e sem `observation` | Registrar somente `activityId` e `value`. | 201; campos opcionais como `null`. |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF14-N-01 | `[Backend]` | `VIS_REALIZADA_01`, `AT_EXAME_01`, `RES_VALOR_VAZIO` | POST E06 com `value` contendo somente espaços. | 400 pelo `ValidationPipe`. |
| RF14-N-02 | `[Backend]` | `unit` com 51 caracteres | POST E06 com `unit` excedendo 50 caracteres. | 400 pelo `ValidationPipe`. |
| RF14-N-03 | `[Backend]` | Observação com mais de 2000 caracteres | POST E06 com observação excedente. | 400 pelo `ValidationPipe`. |
| RF14-N-04 | `[Backend]` | `VIS_AGEND_FUTURA_01`, `AT_EXAME_01` | POST E06 em visita não realizada. | 400, `VISIT_NOT_REALIZED`. |
| RF14-N-05 | `[Backend]` | `VIS_REALIZADA_01`, `RES_ATIVIDADE_OUTRA_VISITA` | POST E06 com atividade que não pertence à visita prevista. | 400, `ACTIVITY_NOT_IN_VISIT`. |
| RF14-N-06 | `[Backend]` | `EST_ENCERRADO_01`, visita realizada vinculada ao estudo | POST E06 com Pesquisador proprietário. | 400, `STUDY_CLOSED`. |
| RF14-N-07 | `[Backend]` | `RES_DUPLICADO_01` | Registrar novamente o mesmo resultado para a mesma visita e atividade. | 409, `RESULT_ALREADY_REGISTERED`. |
| RF14-N-08 | `[Backend]` | Visita agendada de `EST_OUTRO_PESQUISADOR` | Chamar E05/E06 com ID na rota de `EST_EXEC_01`. | 404. |
| RF14-N-09 | `[Backend]` | Corpo com campo extra | POST E06 incluindo propriedade não definida pelo DTO. | 400 pelo `ValidationPipe`. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF14-A-01 | `[Backend]` | `USR_PESQ_PROP`, `EST_EXEC_01`, `VIS_REALIZADA_01` | Chamar E05 e E06 como proprietário ativo. | E05 retorna 200; E06 permite 201 em estudo não encerrado. |
| RF14-A-02 | `[Backend]` | `USR_PESQ_OUTRO`, `EST_EXEC_01` | Tentar E05/E06 no estudo de outro Pesquisador. | 403. |
| RF14-A-03 | `[Backend]` | `USR_COORD`, `EST_EXEC_01` | Consultar E05 e tentar E06. | E05 permite 200 em estado C1; E06 retorna 403 pelo perfil. |
| RF14-A-04 | `[Backend]` | `USR_ADMIN` ou `USR_PART_COM_PART_01` | Chamar E05/E06. | 403 pelo `RolesGuard`. |
| RF14-A-05 | `[Backend]` | `USR_SEM_AUTH`, `VIS_REALIZADA_01` | Chamar E05/E06 sem Bearer. | 401. |
| RF14-A-06 | `[Backend]` | `USR_PESQ_INATIVO`, `EST_EXEC_01` | Chamar E05/E06 com conta inativa. | 401 pela conta inativa. |

### Critérios de Aceite

- **Validável agora no Backend:** somente Pesquisador proprietário ativo registra resultados; a visita está `Realizada`; a atividade pertence à visita prevista; não existe correção/substituição; duplicidade retorna 409.
- **Pendente na integração Web:** formulário operacional que consulte E05 e envie E06.
- Coordenador permanece somente no acesso de consulta E05.

### Evidências Esperadas

- 200 de E05 com a lista de atividades.
- 201 de E06 com `registrarId`.
- Registro único por visita/agendamento e atividade.
- 400/403/409 correspondentes.
- `[A confirmar com PO / Pendente de implementação]` print ou protótipo Web do formulário.

---

## RF15 — Consultar histórico de visitas e avaliações

### Objetivo e Camadas Afetadas

- **Backend:** E07.
- **Web:** tela/perfil do participante; integração ainda não identificada.
- **Mobile:** o próprio histórico é parcialmente coberto por E10/RF18.

### Pré-condições

- Participação ativa com visitas variadas.
- Participação retirada com histórico preservado.
- Participação sem visitas.
- Pesquisador proprietário e Coordenador ativo.
- Outros participantes para testar isolamento.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF15-P-01 | `[Backend]` | `PART_COM_PART_01`, `PARTICIPACAO_ATIVA_01`, `VIS_REALIZADA_01` | Pesquisador proprietário chama E07 da participação ativa. | 200; participação e visitas em `scheduledAt` crescente; resultados aninhados. |
| RF15-P-02 | `[Backend]` | `PART_COM_PART_01`, `VIS_CANCELADA_01` | Coordenador chama E07 da participação no estudo permitido. | 200; visita cancelada permanece no histórico. |
| RF15-P-03 | `[Backend]` | Participação ativa sem agendamentos | Chamar E07 da participação. | 200 com `visits: []`, não 404. |
| RF15-P-04 | `[Backend]` | Visita agendada sem resultado | Chamar E07 da participação. | 200 com a visita e `results: []`. |
| RF15-P-05 | `[Backend]` | `PART_RETIRADO_01`, `PARTICIPACAO_RETIRADA_01` | Consultar histórico após registrar retirada. | 200; histórico preservado e participação mostra `Retirado`. |
| RF15-P-06 | `[Backend]` | `USR_PESQ_PROP` e `USR_COORD`, `EST_EXEC_01` | Consultar E07 com cada perfil permitido. | Ambos recebem 200. |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF15-N-01 | `[Backend]` | `PARTICIPACAO_ATIVA_01` | Chamar E07 com `studyId` ou `participationId` fora do formato UUID. | 400. |
| RF15-N-02 | `[Backend]` | `PART_OUTRO_ESTUDO_01`, `EST_EXEC_01` | Usar participação estrangeira na rota de `EST_EXEC_01`. | 404 `Participante não encontrado neste estudo`. |
| RF15-N-03 | `[Backend]` | Participação inexistente | Chamar E07 com UUID válido não persistido. | 404. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF15-A-01 | `[Backend]` | `USR_SEM_AUTH`, `PARTICIPACAO_ATIVA_01` | Chamar E07 sem Bearer. | 401. |
| RF15-A-02 | `[Backend]` | `USR_ADMIN` ou `USR_PART_COM_PART_01` | Chamar E07 com perfil não permitido. | 403. |
| RF15-A-03 | `[Backend]` | `USR_PESQ_OUTRO`, `EST_EXEC_01` | Consultar histórico do estudo alheio. | 403. |
| RF15-A-04 | `[Backend]` | `USR_PESQ_PROP`, qualquer estado do estudo próprio | Chamar E07. | 200 em consulta P1, inclusive em estudo encerrado. |
| RF15-A-05 | `[Backend]` | `USR_COORD`, `EST_RECRUTAMENTO_01`, `EST_EXEC_01` ou `EST_ENCERRADO_01` | Chamar E07 em cada estado permitido. | 200. |
| RF15-A-06 | `[Backend]` | `USR_COORD`, `EST_PLANEJAMENTO_01` | Chamar E07. | 403. |

### Critérios de Aceite

- **Validável agora no Backend:** histórico pertence à combinação estudo + participação; participação sem visitas retorna `visits: []`; visitas canceladas permanecem; retirada não apaga dados; participante não usa E07.
- **Pendente na integração Web:** apresentação integrada do histórico em uma tela da equipe.
- Participante não usa E07.

### Evidências Esperadas

- Payload E07 completo.
- Ausência/presença de resultados conforme os dados.
- 404 de isolamento.
- `[A confirmar com PO / Pendente de implementação]` tela Web de histórico integrada.

---

## RF16 — Registrar retirada de participante

### Objetivo e Camadas Afetadas

- **Backend:** E08.
- **Web:** painel do Coordenador/Pesquisador e fluxo de retirada.
- **Mobile:** não aplicável para retirada direta nesta sprint.

### Pré-condições

- Participação ativa.
- Estudo em recrutamento ou execução.
- Participação com visitas e resultados opcionalmente registrados.
- Usuário equipe autorizado.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF16-P-01 | `[Backend]` | `USR_PESQ_PROP`, `EST_EXEC_01`, `PART_COM_PART_01`, `PARTICIPACAO_ATIVA_01` | POST E08 com `withdrawalDate` válida e motivo. | 201; `participationStatus: Retirado`, `withdrawnAt` e `withdrawalReason`. |
| RF16-P-02 | `[Backend]` | `USR_COORD`, `EST_RECRUTAMENTO_01` ou `EST_EXEC_01`, `PART_COM_PART_01` | POST E08 como Coordenador ativo em estado permitido. | 201 em estudo em recrutamento ou execução. |
| RF16-P-03 | `[Backend]` | `PARTICIPACAO_ATIVA_01`, `VIS_REALIZADA_01`, `RES_VALIDO_01` | Registrar retirada e consultar o histórico E07. | Visitas e resultados existentes são preservados; somente participação é alterada. |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF16-N-01 | `[Backend]` | `PART_COM_PART_01`, `withdrawalDate` anterior à inclusão | POST E08 com data inválida. | 400, `WITHDRAWAL_DATE_INVALID`. |
| RF16-N-02 | `[Backend]` | `PART_COM_PART_01`, data posterior à atual | POST E08 com data futura. | 400, `WITHDRAWAL_DATE_INVALID`. |
| RF16-N-03 | `[Backend]` | `reason` vazio ou só espaços | POST E08 com motivo normalizado vazio. | 400 pelo `ValidationPipe`. |
| RF16-N-04 | `[Backend]` | Campo extra ou corpo incompleto | Omitir `withdrawalDate`/`reason` ou enviar campo não definido. | 400 pelo `ValidationPipe`. |
| RF16-N-05 | `[Backend]` | `PART_RETIRADO_01`, `PARTICIPACAO_RETIRADA_01` | Tentar novo POST E08. | 400, `PARTICIPATION_NOT_ACTIVE`. |
| RF16-N-06 | `[Backend]` | `PART_CONCLUIDO_01`, `PARTICIPACAO_CONCLUIDA_01` | Tentar POST E08. | 400, `PARTICIPATION_NOT_ACTIVE`. |
| RF16-N-07 | `[Backend]` | `EST_ENCERRADO_01`, participação ativa pertencente ao estudo | Tentar POST E08. | 400, `STUDY_CLOSED`. |
| RF16-N-08 | `[Backend]` | `PART_OUTRO_ESTUDO_01`, `EST_EXEC_01` | Usar participação estrangeira na rota do estudo. | 404 `Participante não encontrado neste estudo`. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF16-A-01 | `[Backend]` | `USR_PESQ_PROP`, `EST_EXEC_01`, `PART_COM_PART_01` | POST E08 como proprietário ativo. | 201. |
| RF16-A-02 | `[Backend]` | `USR_PESQ_OUTRO`, `EST_EXEC_01` | Tentar retirar participante em estudo alheio. | 403. |
| RF16-A-03 | `[Backend]` | `USR_COORD`, `EST_RECRUTAMENTO_01` ou `EST_EXEC_01` | POST E08 em estado C2 permitido. | 201. |
| RF16-A-04 | `[Backend]` | `USR_COORD`, `EST_PLANEJAMENTO_01` ou `EST_ENCERRADO_01` | Tentar retirar participante. | 403 por estado não permitido para Coordenador; encerrado não é escrita C2. |
| RF16-A-05 | `[Backend]` | `USR_ADMIN` ou `USR_PART_COM_PART_01` | Chamar E08. | 403 pelo `RolesGuard`. |
| RF16-A-06 | `[Backend]` | `USR_SEM_AUTH`, `PART_COM_PART_01` | Chamar E08 sem Bearer. | 401. |

### Critérios de Aceite

- **Validável agora no Backend:** alteração ocorre somente em participação ativa; data está entre inclusão e data atual; motivo não fica vazio; visitas, resultados e demais dados permanecem preservados.
- **Pendente na integração Web:** confirmação visual e envio de E08 pela tela da equipe.
- Participante não registra retirada diretamente nesta sprint.

### Evidências Esperadas

- Payload POST E08.
- 201 com `Retirado`.
- Registros de visitas/resultados antes e depois da retirada.
- Código 400/403/404.
- `[A confirmar com PO / Pendente de implementação]` confirmação e feedback visual Web.

---

## RF17 — Participante consulta seus estudos

### Objetivo e Camadas Afetadas

- **Backend:** E09.
- **Web:** não aplicável.
- **Mobile:** tela `HomeScreen`, `Meus Estudos Clínicos`, serviço `participantStudiesService`.

### Pré-condições

- Conta Participante ativa.
- Candidatos vinculados por `candidatos.id_usuario`.
- Participações nos estados `Ativo`, `Retirado` e `Concluído`.
- Participante sem participações.
- Participante com vínculo incorreto ou ausente.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF17-P-01 | `[Backend]` | `USR_PART_COM_PART_01`, `PART_COM_PART_01`, `PARTICIPACAO_ATIVA_01` | Autenticar e chamar `GET /me/studies`. | 200; retorna somente o estudo da participação vinculada. |
| RF17-P-02 | `[Backend]` | `USR_PART_RETIRADO`, `PART_RETIRADO_01` e `USR_PART_CONCLUIDO`, `PART_CONCLUIDO_01` | Criar participações nos três estados para contas próprias em estudos distintos e chamar E09. | 200 com `Ativo`, `Retirado` e `Concluído`, ordenados por inclusão decrescente. |
| RF17-P-03 | `[Backend]` | `USR_PART_SEM_PART_01`, `PART_SEM_PART_01` | Autenticar e chamar E09 sem participações persistidas. | 200 com `[]`. |
| RF17-P-04 | `[Mobile]` | `USR_PART_SEM_PART_01` | Após integração com E09, abrir a tela `Meus Estudos Clínicos`. | Exibe `Você ainda não participa de nenhum estudo.` |
| RF17-P-05 | `[Mobile]` | `USR_PART_COM_PART_01` | Após integração com E09, abrir a tela `HomeScreen`. | Exibe título, objetivo e estado localizado do estudo próprio. |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF17-N-01 | `[Backend]` | `USR_PART_COM_PART_01` | Chamar E09 com `userId`, `candidateId`, `participationId` ou outra query não definida. | 400 pelo `ValidationPipe`. |
| RF17-N-02 | `[Backend]` | `PART_SEM_VINCULO_01`, `PARTICIPACAO_SEM_VINCULO_01` | Não vincular o candidato à conta Participante e chamar E09 com essa conta. | 200 `[]` até P-01 ser resolvido. |
| RF17-N-03 | `[Mobile]` | Serviço `participantStudiesService` atual | Abrir `HomeScreen` antes da integração com E09. | Estado `[A confirmar com PO / Pendente de implementação]`; não mostrar dados fictícios como resposta real. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF17-A-01 | `[Backend]` | `USR_SEM_AUTH` | Chamar E09 sem Bearer. | 401. |
| RF17-A-02 | `[Backend]` | `USR_PESQ_PROP`, `USR_COORD` ou `USR_ADMIN` | Chamar E09 com outro perfil. | 403 pelo `RolesGuard`. |
| RF17-A-03 | `[Backend]` | `USR_PART_INATIVO` | Chamar E09 com conta inativa. | 401 pela conta inativa. |
| RF17-A-04 | `[Backend]` | `USR_PART_COM_PART_01` | Chamar E09 com tentativa de enviar identificadores externos em query. | Dados somente por `request.user.sub`; identificadores externos são rejeitados. |

### Critérios de Aceite

- **Validável agora no Backend:** somente perfil Participante ativo; identidade vem exclusivamente do token; participações `Ativo`, `Retirado` e `Concluído` são incluídas; participante sem participação recebe `[]`; dados de outros participantes não aparecem.
- **Pendente na integração Mobile:** consumo real de E09 pela tela `HomeScreen` e substituição do `ParticipantStudiesUnavailableError`.
- O caso P-01 continua pendente: participante sem vínculo em `candidatos.id_usuario` recebe `[]`.

### Evidências Esperadas

- Requisição `GET /me/studies` com bearer token.
- Payload sem `participantLimit`, `participantsLinked`, `researcherId` ou dados de terceiros.
- Print Mobile da lista e estado vazio.
- Evidência do P-01 quando a integração de cadastro não garante vínculo.

---

## RF18 — Próximas visitas e histórico de comparecimento

### Objetivo e Camadas Afetadas

- **Backend:** E10.
- **Web:** não aplicável diretamente.
- **Mobile:** abas Próximas/Histórico em `VisitsScreen` e `VisitsContext`.

### Pré-condições

- Conta vinculada a participações.
- Visitas futura, passada, realizada, ausente e cancelada.
- Participação retirada com visita futura.
- Participante com estudos próprios e estrangeiros.
- Serviço Mobile ainda em placeholder até integração com E10.

### Cenários Positivos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF18-P-01 | `[Backend]` | `USR_PART_COM_PART_01`, `VIS_AGEND_FUTURA_01`, `scope=upcoming` | Chamar `GET /me/visits?scope=upcoming`. | 200; somente `Agendada` com instante futuro, ordenada crescente. |
| RF18-P-02 | `[Backend]` | `USR_PART_COM_PART_01`, `VIS_REALIZADA_01`, `VIS_AUSENTE_01`, `VIS_CANCELADA_01`, `scope=history` | Chamar E10 com `scope=history`. | 200; somente estados finais, ordenados por `scheduledAt` decrescente. |
| RF18-P-03 | `[Backend]` | `USR_PART_RETIRADO`, `PARTICIPACAO_RETIRADA_01`, `VIS_FUTURA_RETIRADO_01` | Chamar E10 `scope=upcoming`. | Visita futura da participação retirada aparece. |
| RF18-P-04 | `[Backend]` | `USR_PART_COM_PART_01`, `EST_EXEC_01`, `scope=upcoming` | Chamar E10 com `studyId=EST_EXEC_01`. | 200; somente visitas da participação própria nesse estudo. |
| RF18-P-05 | `[Backend]` | `USR_PART_SEM_PART_01`, `scope=history` | Chamar E10 sem participações ou sem visitas no escopo. | 200 com `[]`. |
| RF18-P-06 | `[Mobile]` | `VIS_AGEND_FUTURA_01` | Após integração E10, abrir a aba Próximas visitas. | Exibe cartões das próximas visitas. |
| RF18-P-07 | `[Mobile]` | `VIS_REALIZADA_01`, `VIS_AUSENTE_01`, `VIS_CANCELADA_01` | Após integração E10, abrir Histórico. | Exibe os estados finais de comparecimento. |

### Cenários Negativos

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF18-N-01 | `[Backend]` | `USR_PART_COM_PART_01` | Chamar E10 sem `scope` ou com valor fora de `upcoming`/`history`. | 400 pelo `ValidationPipe`. |
| RF18-N-02 | `[Backend]` | `USR_PART_COM_PART_01` | Chamar E10 com `studyId` fora do formato UUID. | 400 pelo `ValidationPipe`. |
| RF18-N-03 | `[Backend]` | `USR_PART_COM_PART_01`, `EST_OUTRO_PESQUISADOR` | Chamar E10 com estudo sem participação própria. | 404 `Estudo não encontrado entre as suas participações`. |
| RF18-N-04 | `[Backend]` | `VIS_AGEND_PASSADA_01`, `scope=upcoming` | Chamar E10. | Não aparece; a visita passou e continua `Agendada`. |
| RF18-N-05 | `[Backend]` | `VIS_AGEND_PASSADA_01`, `scope=history` | Chamar E10. | Não aparece, pois não é estado final. |
| RF18-N-06 | `[Backend]` | `VIS_REALIZADA_01` | Inspecionar resposta de E10. | Não contém `observation` nem resultados de avaliação. |
| RF18-N-07 | `[Mobile]` | `scope=upcoming` e `scope=history` | Trocar rapidamente entre abas antes da conclusão das consultas. | Resultado corresponde à aba atual e não reintroduz dados da aba anterior. |

### Cenários de Autorização

| ID | Camada | Massa | Passos resumidos | Resultado esperado |
|---|---|---|---|---|
| RF18-A-01 | `[Backend]` | `USR_SEM_AUTH` | Chamar E10 sem Bearer. | 401. |
| RF18-A-02 | `[Backend]` | `USR_PESQ_PROP`, `USR_COORD` ou `USR_ADMIN` | Chamar E10 com perfil fora de Participante. | 403 pelo `RolesGuard`. |
| RF18-A-03 | `[Backend]` | `USR_PART_INATIVO` | Chamar E10 com conta inativa. | 401 pela conta inativa. |
| RF18-A-04 | `[Backend]` | `USR_PART_COM_PART_01`, `PART_OUTRO_ESTUDO_01` | Tentar `studyId` ou dados pertencentes a outra conta. | 404 para `studyId` estrangeiro ou lista própria; nunca dados alheios. |

### Critérios de Aceite

- **Validável agora no Backend:** `scope=upcoming` aceita somente `Agendada` com instante futuro; `scope=history` aceita somente `Realizada`, `Ausente` e `Cancelada`; `studyId` corresponde à participação própria; observações internas e resultados não são expostos.
- **Pendente na integração Mobile:** consumo real de E10 pelas abas Próximas/Histórico e troca do placeholder atual por dados da API.
- Participação retirada continua podendo possuir próximas visitas futuras.
- Dados alheios nunca são retornados.

### Evidências Esperadas

- Query E10 com `scope` e eventual `studyId`.
- Payload das duas abas.
- Separação temporal e estados.
- 400/404/403 correspondentes.
- Print Mobile das abas Próximas/Histórico.
- Evidência de que o placeholder foi substituído pela integração real.

---

## Pendências a confirmar

| Referência | Situação |
|---|---|
| **P-01** | O cadastro atual de candidatos não garante `candidatos.id_usuario`. RF17/RF18 dependem do vínculo com a conta para retornar dados. |
| **Integração Web RF12–RF16** | Backend e contratos estão implementados, mas as telas Web atuais usam dados locais. |
| **Integração Mobile RF17/RF18** | Tela e contextos existem, mas os serviços ainda retornam erro de implementação pendente. |
| **Fluxos RF19/RF20** | Confirmação, reagendamento e solicitação de retirada voluntária não fazem parte deste plano RF12–RF18. |
| **Correção de resultados** | Não existe operação; duplicidade deve retornar 409. |
| **Limite máximo de `reason` RF16** | Não há limite aprovado/aplicado além de a string não ficar vazia. |
| **Limite máximo de `value` RF14** | Não há limite aprovado. |
| **Layout e nomenclatura definitiva das telas Web RF12–RF16** | `[A confirmar com PO / Pendente de implementação]` até integração dos componentes existentes com os endpoints E01–E08. |
| **Estados locais da tela Web** | `/coordenador/visitas` usa estados locais como `Confirmada`, `Aguardando`, `Reagendamento` e `Concluída`, divergentes dos contratos `Agendada`, `Realizada`, `Ausente` e `Cancelada`. `[A confirmar com PO / Pendente de implementação]` |

---

## Resumo da revisão

### Ajustes realizados

- Padronizadas as tabelas de cenários Positivos, Negativos e de Autorização com `ID`, `Camada`, `Massa`, `Passos resumidos` e `Resultado esperado`.
- Acrescentada rastreabilidade explícita entre participantes, participações, visitas, contas e estudos.
- Separado o vínculo P-01 para participantes sem vínculo em `candidatos.id_usuario`.
- Adicionadas participações ativa, retirada, concluída e sem vínculo; visitas futura/passada, realizada/ausente/cancelada e futura de participante retirado.
- Alinhados estados de estudo e situação da visita aos contratos:
  - Estudos: `planejamento`, `recrutamento`, `execução`, `encerrado`.
  - Situações: `Agendada`, `Realizada`, `Ausente`, `Cancelada`.
- Alinhados códigos de domínio, HTTP e permissões por perfil aos documentos de referência.
- Separados explicitamente critérios válidos na `main` agora e critérios dependentes de integração futura.
- Mantidas as evidências esperadas por requisito.

### Dúvidas/pendências separadas para PO ou time

1. Confirmar a resolução de P-01 para preencher `candidatos.id_usuario` no cadastro real.
2. Definir quando cada tela Web RF12–RF16 será integrada aos endpoints E01–E08.
3. Confirmar a substituição dos estados locais da tela Web pelos estados da API.
4. Definir o comportamento visual da integração Mobile RF17/RF18 enquanto E09/E10 não forem consumidos.
5. Confirmar se `reason` RF16 e `value` RF14 precisam de limites máximos adicionais.
6. Confirmar o layout/nomenclatura definitivos das telas Web que representarão os fluxos RF12–RF16.
