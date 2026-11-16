# Contratos da API — RF12 a RF18

| Item | Valor |
|---|---|
| **Projeto** | ClinicalStudyPB — Sistema de Gestão de Estudos Clínicos |
| **Release / Sprint** | Release 2 — Sprint 3 (10/11/2026 a 23/11/2026) |
| **Task** | S3-PO-03 — Documentar contratos da API para RF12–RF18 |
| **Responsável** | Zeton (Líder técnico / Gerente) |
| **Versão** | 0.1 — proposta para validação da equipe (15/11/2026) |
| **Situação** | Todos os contratos de RF12–RF18 estão **planejados**: nenhum endpoint desses requisitos existe no código atual. |

> **Como ler este documento.** Cada informação está marcada como:
> **[Existente]** — verificado no código do repositório;
> **[Planejado]** — contrato a ser implementado na Sprint 3;
> **[Proposta]** — detalhe técnico não definido pela especificação nem pelo backlog, sugerido aqui e pendente de validação (seção 13);
> **[Adiado]** — melhoria do Plano de Contingência adiada para a Sprint 4, citada apenas como dependência futura.

---

## Sumário

1. [Objetivo](#1-objetivo)
2. [Referências](#2-referências)
3. [Contexto e premissas técnicas](#3-contexto-e-premissas-técnicas)
4. [Resumo dos requisitos RF12–RF18](#4-resumo-dos-requisitos-rf12rf18)
5. [Convenções comuns a todos os contratos](#5-convenções-comuns-a-todos-os-contratos)
6. [Autenticação e autorização](#6-autenticação-e-autorização)
7. [Modelos de dados compartilhados](#7-modelos-de-dados-compartilhados)
8. [Contratos REST por requisito](#8-contratos-rest-por-requisito)
9. [Códigos HTTP e tratamento de erros](#9-códigos-http-e-tratamento-de-erros)
10. [Dependências entre endpoints e tasks](#10-dependências-entre-endpoints-e-tasks)
11. [Orientações para mocks e desenvolvimento paralelo](#11-orientações-para-mocks-e-desenvolvimento-paralelo)
12. [Relação com o Plano de Contingência](#12-relação-com-o-plano-de-contingência)
13. [Decisões técnicas e propostas para validação](#13-decisões-técnicas-e-propostas-para-validação)
14. [Pendências identificadas](#14-pendências-identificadas)
15. [Histórico de versões](#15-histórico-de-versões)

---

## 1. Objetivo

Definir um contrato comum entre Backend, Web e Mobile para RF12–RF18, para que os três possam ser desenvolvidos em paralelo, usando respostas simuladas enquanto os endpoints não estiverem prontos.

O documento não implementa funcionalidades. Os pontos que dependem de aprovação estão destacados na seção 13 e não devem ser tratados como definitivos.

## 2. Referências

| Fonte | Uso |
|---|---|
| Especificação oficial *ProjetoES2-2026.2* | Texto de RF12–RF18, perfis de usuário e interface (Web/Mobile) de cada requisito. |
| *ClinicalStudyPB — Plano de Trabalho*, backlog da Sprint 3 | Descrição das tasks S3-BE-02 a S3-BE-07, S3-W1, S3-W2 e S3-MOB, incluindo S3-MOB-02. |
| `docs/releases/release2/Plano_Contingencia_ClinicalStudyPB_Sprint3.docx` | Problemas e impactos técnicos levantados. Consultado sem modificação (seção 12). |
| `docs/releases/release1/README.md`, `arquitetura-e-integracao.md`, `usuarios-e-controle-de-acesso.md` | Arquitetura, perfis e pendências conhecidas da Release 1. |
| `backend/migrations/011`–`014` | Tabelas `participacoes_estudo`, `visitas`, `resultados_avaliacao` e `solicitacoes_visita`. |
| `backend/src/auth`, `backend/src/studies`, `backend/src/swagger/api.models.ts` | Padrões de rotas, guards, DTOs, validações e erros já implementados. |

## 3. Contexto e premissas técnicas

### 3.1 Decisões da Weekly Meeting (S3-PO-02) respeitadas neste documento

1. A Sprint 3 mantém o foco nas entregas originais de RF12–RF18.
2. As correções e melhorias adicionais do Plano de Contingência foram **adiadas para a Sprint 4** e não fazem parte destes contratos (seção 12).
3. A task **S3-MOB-02 — Concluir autenticação Mobile e implementar restauração segura da sessão** faz parte do planejamento atual. Ela não deve ser confundida com a proposta de contingência **S3C-MOB-02** (harmonização dos dados demonstrativos), que foi adiada.

### 3.2 Estado atual do código [Existente]

| Item | Situação verificada |
|---|---|
| Tabelas de RF12–RF16 | Existem (`participacoes_estudo`, `visitas`, `resultados_avaliacao`). **Nenhum endpoint as utiliza**, exceto a inclusão (RF11), que cria `participacoes_estudo`. |
| Endpoints de RF12–RF18 | **Não existem.** Os controllers atuais são `auth`, `users`, `studies`, `criteria`, `visits` (visitas **previstas**, RF06) e `candidates`. |
| Telas Web do Coordenador | `coordenatorPage.tsx` (Visitas, Reagendamentos, Painel) usa dados fixos em `useState`. A substituição pela API está prevista em S3-W2-07. |
| Mobile | Somente login, tela inicial e logout. A sessão fica em memória e o login aceita os quatro perfis; S3-MOB-02 corrige esses dois pontos. |
| Vínculo conta–participante | Coluna `candidatos.id_usuario` existe, mas **o cadastro de candidatos nunca a preenche** (ver P-01, seção 14). |
| Auditoria | Tabela `auditoria` existe sem uso. O registro de auditoria foi adiado e não está nestes contratos. |

### 3.3 Premissas

- O backend continua sendo uma única API NestJS, consumida pela Web e pelo Mobile.
- Os nomes das tabelas e colunas não mudam. Os contratos reutilizam o schema existente, e **nenhuma migration é necessária** para os contratos deste documento.
- Os exemplos usam dados fictícios.

## 4. Resumo dos requisitos RF12–RF18

Texto da especificação oficial, perfis conforme a figura de perfis da especificação e tasks do backlog da Sprint 3.

| RF | Texto da especificação | Interface | Perfil na especificação | Tasks da Sprint 3 | Endpoints |
|---|---|---|---|---|---|
| RF12 | Agendar visitas para os participantes incluídos. | Web | Coordenador | S3-BE-02, S3-W1-02/03/04, S3-W2-02 | E01, E02, E03, X02, X03 |
| RF13 | Registrar a realização, ausência ou cancelamento de visitas. | Web | Coordenador | S3-BE-03, S3-W2-03 | E03, E04 |
| RF14 | Registrar resultados fictícios das avaliações previstas. | Web | Pesquisador | S3-BE-04, S3-W2-04 | E05, E06 |
| RF15 | Consultar o histórico de visitas e avaliações de um participante. | Web | Pesquisador e Coordenador | S3-BE-05, S3-W2-05 | E07 |
| RF16 | Registrar a retirada de um participante do estudo. | Web | Coordenador | S3-BE-06, S3-W2-06 | E08 |
| RF17 | Permitir ao participante consultar os estudos em que está incluído. | Mobile | Participante | S3-BE-07, S3-MOB-03, S3-MOB-05 | E09, X01 |
| RF18 | Exibir as próximas visitas e seu histórico de comparecimento. | Mobile | Participante | S3-BE-07, S3-MOB-04, S3-MOB-05 | E10, X01 |

> A figura da especificação também atribui ao Participante, junto ao RF18, “acompanhar solicitações e decisões”. As solicitações de confirmação e reagendamento pertencem a RF19–RF20 (Sprint 4) e **não** estão neste documento.

### 4.1 Índice de endpoints

| ID | Método | Rota | RF | Situação |
|---|---|---|---|---|
| X01 | `GET` | `/auth/me` | RF17–RF18 (sessão) | [Existente] |
| X02 | `GET` | `/studies/:studyId/visits` | RF12 | [Existente] — acesso do Coordenador pendente (D-01) |
| X03 | `GET` | `/studies/:studyId/visits/:visitId/activities` | RF12, RF14 | [Existente] — acesso do Coordenador pendente (D-01) |
| E01 | `GET` | `/studies/:studyId/participants` | RF12, RF15, RF16 | [Planejado] |
| E02 | `POST` | `/studies/:studyId/scheduled-visits` | RF12 | [Planejado] |
| E03 | `GET` | `/studies/:studyId/scheduled-visits` | RF12, RF13 | [Planejado] |
| E04 | `PATCH` | `/studies/:studyId/scheduled-visits/:scheduledVisitId/status` | RF13 | [Planejado] |
| E05 | `GET` | `/studies/:studyId/scheduled-visits/:scheduledVisitId/results` | RF14 | [Planejado] |
| E06 | `POST` | `/studies/:studyId/scheduled-visits/:scheduledVisitId/results` | RF14 | [Planejado] |
| E07 | `GET` | `/studies/:studyId/participants/:participationId/history` | RF15 | [Planejado] |
| E08 | `POST` | `/studies/:studyId/participants/:participationId/withdrawal` | RF16 | [Planejado] |
| E09 | `GET` | `/me/studies` | RF17 | [Planejado] |
| E10 | `GET` | `/me/visits` | RF18 | [Planejado] |

São **13 endpoints**: 3 existentes reutilizados e 10 planejados. Os existentes não mudam, exceto pela possível ampliação de perfil prevista em D-01.

## 5. Convenções comuns a todos os contratos

Convenções extraídas do código existente [Existente], salvo indicação em contrário.

| Aspecto | Convenção |
|---|---|
| Prefixo e aninhamento | Recursos de estudo aninhados em `/studies/:studyId/...`, como `candidates`, `criteria` e `visits`. |
| Nomes de recurso | Inglês, plural, `kebab-case` (`scheduled-visits`). **[Proposta]** `scheduled-visits` designa a tabela `visitas` (visitas **agendadas**), para não confundir com `/visits`, que já designa visitas **previstas** (RF06). |
| Campos JSON | Inglês, `camelCase` (`studyId`, `participationId`, `registeredAt`). |
| Valores de domínio | Em português, iguais às constraints do banco (`Agendada`, `Realizada`, `Ativo`, `Retirado`). Estado do estudo em minúsculas (`planejamento`, `recrutamento`, `execução`, `encerrado`). |
| Identificadores | UUID em string. Parâmetros de rota validados com `ParseUUIDPipe`; UUID inválido resulta em 400. |
| Datas sem hora | `YYYY-MM-DD` (`startDate`, `includedAt`). |
| Data e hora | **[Proposta]** ISO 8601 em UTC (`2026-11-20T12:00:00.000Z`) nas respostas; nas requisições, ISO 8601 com fuso (`2026-11-20T09:00:00-03:00` ou `...Z`). Os campos existentes (`registeredAt`) usam hoje o formato textual do PostgreSQL (`2026-11-06 14:03:22.123+00`). Ver D-11. |
| Corpo das requisições | JSON validado por DTO `class-validator` com `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`. Textos com `trim`, e texto opcional vazio convertido em `null`, como nos DTOs de visitas previstas. |
| Textos livres | Observação e descrição com até 2000 caracteres (padrão dos DTOs atuais). |
| Listas | Sem paginação, como nas listagens atuais. Ordenação definida em cada contrato. |
| Códigos de sucesso | `GET` resulta em 200, `POST` em 201 (padrão NestJS, igual ao `POST .../include`) e `PATCH` em 200. |
| Erros | Formato padrão NestJS `{ statusCode, message, error }`. Recusas de domínio podem incluir `code`, como em `CandidateInclusionErrorResponseDto` (RF11). |
| Documentação | Cada endpoint planejado deve ter decorators Swagger (`@ApiOperation`, `@ApiParam`, `@ApiBody`, respostas de erro), como nos controllers atuais. |

## 6. Autenticação e autorização

### 6.1 Mecanismo existente [Existente]

| Item | Comportamento atual |
|---|---|
| Token | JWT HS256 assinado pelo backend (`token.util.ts`), com `sub` (id do usuário), `email`, `role`, `jti`, `iat` e `exp`. Validade de **1 hora**. |
| Envio | Cabeçalho `Authorization: Bearer <accessToken>`. |
| Sessão | `AccessTokenGuard` confere a assinatura, a sessão ativa em `sessoes` (por `jti`) e a conta: conta inativa resulta em 401. O perfil é relido do banco a cada requisição. |
| Perfil | `@Roles(...)` + `RolesGuard`. Perfil não autorizado resulta em **403** “Seu perfil não tem permissão para este recurso.” |
| Login / sessão / logout | `POST /auth/login` → `{ accessToken, user }`; `GET /auth/me` → usuário público; `POST /auth/logout` revoga a sessão. **Não serão criados novos endpoints de autenticação.** |
| Renovação | Não há refresh token. Após 1 hora, nova autenticação é necessária. |

### 6.2 Regras de acesso dos contratos planejados [Proposta]

Toda rota planejada usa `@UseGuards(AccessTokenGuard, RolesGuard)` e `@ApiBearerAuth('bearer')`.

| Regra | Aplicação | Definição |
|---|---|---|
| **A-EQUIPE-LEITURA** | E01, E03, E05, E07 | **Pesquisador** ativo **proprietário** do estudo, em qualquer estado; ou **Coordenador** ativo, em estudo `recrutamento`, `execução` ou `encerrado`. |
| **A-EQUIPE-ESCRITA** | E02, E04, E08 | **Coordenador** ativo, em estudo `recrutamento` ou `execução`; ou **Pesquisador** ativo **proprietário** do estudo não encerrado. Estudo encerrado resulta em 400 “Não é possível alterar um estudo encerrado.” |
| **A-PESQUISADOR-ESCRITA** | E06 | **Pesquisador** ativo **proprietário** do estudo não encerrado (RF14 é do Pesquisador na especificação). Inclusão do Coordenador pendente (D-04). |
| **A-PARTICIPANTE** | E09, E10 | Somente perfil **Participante** ativo. A identidade vem **exclusivamente** de `request.user.sub` (seção 6.3). |

Fundamentação: o padrão “Pesquisador proprietário ou Coordenador ativo condicionado ao estado do estudo” já existe em RF08–RF11 (`assertCandidateStudyAccess`, `assertInclusionStudyAccess`). O schema não tem vínculo entre Coordenador e estudo, então o Coordenador acessa todos os estudos nos estados permitidos, como hoje no recrutamento (D-10). Os estados permitidos estão em D-03.

### 6.3 Regras de segurança de RF17–RF18 [Planejado]

1. O participante é identificado **somente** pelo token: `usuarios.id_usuario = request.user.sub` → `candidatos.id_usuario` → `candidatos.id_candidato` → `participacoes_estudo.id_candidato`.
2. As rotas `/me/*` **não aceitam** `userId`, `candidateId` ou `participationId` como parâmetro. O único filtro opcional (`studyId` em E10) é aplicado **depois** da restrição ao próprio participante. Um estudo sem participação do usuário resulta em 404, sem revelar se o estudo existe.
3. As respostas não expõem: dados de outros participantes, e-mail, telefone, avaliações de elegibilidade, consentimentos, observações internas da equipe, resultados de avaliação, ids de avaliadores e contadores de vagas.
4. Perfis da equipe (Pesquisador, Coordenador, Administrador) recebem 403 em `/me/*`, e o Participante recebe 403 em todas as rotas da equipe. As operações de escrita da Sprint 3 não estão disponíveis ao Participante.

### 6.4 Dependência com S3-MOB-02 (autenticação Mobile)

| Etapa do aplicativo | Contrato usado | Observação |
|---|---|---|
| Login | `POST /auth/login` [Existente] | O app deve aceitar somente `user.role === 'Participante'`. Para outro perfil, deve chamar `POST /auth/logout` e exibir uma mensagem. A API também recusa esses perfis nas rotas `/me/*` (403). |
| Restauração da sessão | `GET /auth/me` (X01) [Existente] | Ao reabrir o app, o token salvo de forma segura é validado por X01 antes de liberar as telas protegidas. 401 resulta em descartar o token e voltar ao login. Falha de rede deve permitir nova tentativa, sem descartar o token. |
| Consultas | E09, E10 | Sempre com o token da sessão restaurada. Qualquer 401 encerra a sessão local. |
| Logout | `POST /auth/logout` [Existente] | Remove o token do armazenamento seguro mesmo se a chamada falhar. |

A S3-PO-03 não cria endpoints de autenticação. A implementação do armazenamento seguro é responsabilidade de S3-MOB-02.

## 7. Modelos de dados compartilhados

Estruturas reutilizadas por vários endpoints, todas **[Planejado]**. Os tipos seguem a notação TypeScript.

### 7.1 `Participant` — participação no estudo (tabela `participacoes_estudo` + `candidatos.nome`)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `participationId` | `string` (uuid) | `id_participacao` | Identificador da participação. |
| `candidateId` | `string` (uuid) | `id_candidato` | Candidato que originou a participação. |
| `studyId` | `string` (uuid) | `candidatos.id_estudo` | Estudo. |
| `name` | `string` | `candidatos.nome` | Nome do participante. |
| `participationStatus` | `'Ativo' \| 'Retirado' \| 'Concluído'` | `status` | Estado da participação (não confundir com `status_recrutamento` do candidato). |
| `includedAt` | `string` (date) | `data_inclusao` | Data de inclusão (RF11). |
| `withdrawnAt` | `string` (date) \| `null` | `data_retirada` | Data da retirada (RF16). |
| `withdrawalReason` | `string` \| `null` | `motivo_retirada` | Motivo da retirada (RF16). |

### 7.2 `ScheduledVisit` — visita agendada (tabela `visitas`)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `id` | `string` (uuid) | `id_visita` | Identificador da visita agendada. |
| `studyId` | `string` (uuid) | via visita prevista | Estudo. |
| `participationId` | `string` (uuid) | `id_participacao` | Participação. |
| `participantName` | `string` | `candidatos.nome` | Nome do participante (para listagens da equipe). |
| `plannedVisitId` | `string` (uuid) | `id_visita_prevista` | Visita prevista (RF06). |
| `plannedVisitName` | `string` | `visitas_previstas.nome` | Nome da visita prevista. |
| `plannedVisitOrder` | `integer` | `visitas_previstas.ordem` | Ordem da visita prevista no protocolo. |
| `scheduledAt` | `string` (date-time) | `data_agendada` | Data e hora agendadas. |
| `status` | `'Agendada' \| 'Realizada' \| 'Ausente' \| 'Cancelada'` | `status` | Situação da visita. |
| `realizedAt` | `string` (date-time) \| `null` | `data_realizacao` | Obrigatório quando `Realizada` (constraint `visitas_realizacao_coerente`). |
| `observation` | `string` \| `null` | `observacao` | Observação da equipe. |
| `createdAt` | `string` (date-time) | `criado_em` | Momento do agendamento. |

### 7.3 `AssessmentResult` — resultado fictício (tabela `resultados_avaliacao`)

| Campo | Tipo | Origem | Descrição |
|---|---|---|---|
| `id` | `string` (uuid) | `id_resultado` | Identificador do resultado. |
| `scheduledVisitId` | `string` (uuid) | `id_visita` | Visita agendada. |
| `activityId` | `string` (uuid) | `id_atividade` | Atividade prevista (RF06). |
| `value` | `string` | `valor_ficticio` | Valor fictício registrado. |
| `unit` | `string` \| `null` | `unidade` | Unidade (até 50 caracteres). |
| `observation` | `string` \| `null` | `observacao` | Observação. |
| `registeredAt` | `string` (date-time) | `registrado_em` | Momento do registro. |
| `registrarId` | `string` (uuid) | `id_registrado_por` | Usuário que registrou. |

## 8. Contratos REST por requisito

Todos os contratos usam o mesmo modelo: **Identificação → Definição HTTP → Segurança → Requisição → Resposta → Erros → Observações técnicas**. Os erros de autenticação e de validação de parâmetros, comuns a todos, estão detalhados na seção 9 e referenciados como **ERR-COMUNS**.

### 8.0 Contratos existentes reutilizados

#### X01 — Consultar o usuário da sessão atual [Existente]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF17, RF18 (pré-requisito da sessão Mobile; usado por S3-MOB-02) |
| Objetivo | Validar o token salvo e obter os dados públicos da conta ao reabrir o aplicativo. |
| Funcionamento | Retorna a conta associada ao `sub` do token, desde que a sessão esteja ativa. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /auth/me` |
| Parâmetros de rota / query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória (`AccessTokenGuard`). |
| Perfis | Todos os perfis autenticados. O Mobile deve aceitar somente `Participante`. |
| Restrição de registros | Somente a própria conta. |

**Requisição** — sem corpo.

**Resposta — 200 OK** (`PublicUserResponseDto`)

```json
{
  "id": "b7a1c2d3-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  "name": "Bianca Oliveira",
  "email": "participante@exemplo.test",
  "phone": "(83) 99999-0000",
  "role": "Participante",
  "status": "Ativo",
  "createdAt": "2026-10-01 12:00:00+00"
}
```

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 401 | Token ausente, inválido, expirado, sessão revogada ou conta inativa | ERR-COMUNS |
| 404 | Conta da sessão não encontrada | Mensagem do `UsersService` |

**Observações técnicas** — sem alteração nesta sprint. `createdAt` usa o formato atual do backend (D-11).

---

#### X02 — Listar visitas previstas do estudo [Existente]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF12 (seleção da visita prevista no agendamento) |
| Objetivo | Listar as visitas previstas (RF06) que podem ser agendadas. |
| Funcionamento | Retorna as visitas previstas do estudo, ordenadas por `order`. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /studies/:studyId/visits` |
| Parâmetros de rota | `studyId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis hoje | **Somente Pesquisador proprietário** (`@Roles('Pesquisador')`). |
| Pendência | O agendamento (RF12, S3-W2-02) é feito pelo Coordenador, que hoje recebe 403. Ver **D-01**. |

**Requisição** — sem corpo.

**Resposta — 200 OK** (`PlannedVisitResponseDto[]`)

```json
[
  {
    "id": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
    "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
    "name": "Consulta inicial",
    "order": 1,
    "intervalDays": null,
    "description": "Realizada após a inclusão."
  }
]
```

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | `studyId` não é UUID | ERR-COMUNS |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Perfil não autorizado ou estudo de outro pesquisador | “Seu perfil não tem permissão para este recurso.” / mensagem do `StudiesService` |
| 404 | Estudo não encontrado | “Estudo não encontrado.” |

**Observações técnicas** — contrato inalterado. Somente a regra de perfil pode mudar, conforme D-01.

---

#### X03 — Listar atividades de uma visita prevista [Existente]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF12, RF14 (atividades da visita prevista) |
| Objetivo | Listar as atividades previstas, para exibição no agendamento e base dos resultados. |
| Funcionamento | Retorna as atividades da visita prevista do estudo. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /studies/:studyId/visits/:visitId/activities` |
| Parâmetros de rota | `studyId` (uuid), `visitId` (uuid da visita **prevista**) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis hoje | Somente Pesquisador proprietário. |
| Pendência | Acesso do Coordenador (D-01). Para RF14, o formulário usa E05, que já retorna as atividades. |

**Requisição** — sem corpo.

**Resposta — 200 OK** (`VisitActivityResponseDto[]`)

```json
[
  {
    "id": "6e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c",
    "visitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
    "name": "Coleta de sinais vitais",
    "description": "Aferir pressão arterial e frequência cardíaca.",
    "type": "Exame"
  }
]
```

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | UUID inválido | ERR-COMUNS |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Perfil não autorizado | “Seu perfil não tem permissão para este recurso.” |
| 404 | Estudo ou visita prevista inexistente | “Estudo não encontrado.” / “Visita prevista não encontrada neste estudo.” |

**Observações técnicas** — contrato inalterado.

---

### 8.1 RF12 — Agendar visitas para os participantes incluídos

#### E01 — Listar participantes incluídos no estudo [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF12, RF15, RF16 |
| Objetivo | Listar as participações do estudo, para selecionar o participante no agendamento, no histórico e na retirada. |
| Funcionamento | Retorna as participações (`participacoes_estudo`) dos candidatos do estudo. Corresponde a “consultar participantes incluídos no estudo” de S3-BE-02 e à listagem de S3-W1-02. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /studies/:studyId/participants` |
| Parâmetros de rota | `studyId` (uuid) |
| Parâmetros de query | `status` (opcional): `Ativo`, `Retirado` ou `Concluído`. Sem filtro, retorna todos. |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-LEITURA** |
| Restrição de registros | Somente participações de candidatos com `id_estudo = :studyId`. |

**Requisição** — sem corpo. DTO de query planejado: `ListParticipantsQueryDto { status?: 'Ativo' | 'Retirado' | 'Concluído' }` com `@IsOptional() @IsIn([...])`.

**Resposta — 200 OK** (`Participant[]`, seção 7.1), ordenada por `name` e depois `includedAt`.

```json
[
  {
    "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
    "candidateId": "9d2e7f40-1c3b-4a5d-8e6f-7a8b9c0d1e2f",
    "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
    "name": "Bianca Oliveira",
    "participationStatus": "Ativo",
    "includedAt": "2026-11-06",
    "withdrawnAt": null,
    "withdrawalReason": null
  }
]
```

Sem participações, retorna `[]` com 200.

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | `studyId` inválido ou `status` fora da lista | ERR-COMUNS |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Participante/Administrador; pesquisador não proprietário; Coordenador com estudo em `planejamento` | “Seu perfil não tem permissão para este recurso.” / “O Coordenador só pode consultar participantes de estudos em recrutamento, execução ou encerrados.” |
| 404 | Estudo inexistente | “Estudo não encontrado.” |

**Observações técnicas**
- Não retorna e-mail nem dados da conta (minimização), pois as telas de acompanhamento precisam apenas do nome.
- Base para o componente de seleção de participante de S3-W1-03.

---

#### E02 — Agendar visita para uma participação [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF12 |
| Objetivo | Agendar uma visita prevista para um participante ativo. |
| Funcionamento | Cria um registro em `visitas` com `status = 'Agendada'`, vinculando a participação à visita prevista correspondente (S3-BE-02). |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `POST /studies/:studyId/scheduled-visits` |
| Parâmetros de rota | `studyId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>`, `Content-Type: application/json` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-ESCRITA** |
| Restrição de registros | Participação e visita prevista devem pertencer ao estudo da rota. |

**Requisição** — `CreateScheduledVisitRequestDto`

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `participationId` | `string` (uuid) | Sim | `@IsUUID()` |
| `plannedVisitId` | `string` (uuid) | Sim | `@IsUUID()` |
| `scheduledAt` | `string` (date-time) | Sim | `@IsISO8601({ strict: true })`, com fuso. Não pode ser anterior à `data_inclusao` da participação nem posterior a `data_fim` do estudo (ver D-06 para datas passadas). |
| `observation` | `string` \| `null` | Não | `trim`; vazio vira `null`; até 2000 caracteres. |

```json
{
  "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
  "plannedVisitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
  "scheduledAt": "2026-11-24T09:00:00-03:00",
  "observation": "Trazer exames anteriores."
}
```

**Resposta — 201 Created** (`ScheduledVisit`, seção 7.2)

```json
{
  "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
  "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
  "participantName": "Bianca Oliveira",
  "plannedVisitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
  "plannedVisitName": "Consulta inicial",
  "plannedVisitOrder": 1,
  "scheduledAt": "2026-11-24T12:00:00.000Z",
  "status": "Agendada",
  "realizedAt": null,
  "observation": "Trazer exames anteriores.",
  "createdAt": "2026-11-16T13:20:41.512Z"
}
```

**Erros**

| Código | `code` (proposta) | Situação | Mensagem |
|---|---|---|---|
| 400 | — | Corpo inválido (campos ausentes, UUID inválido, data sem fuso, campo extra) | Lista do `ValidationPipe` (ERR-COMUNS) |
| 400 | `STUDY_CLOSED` | Estudo encerrado | “Não é possível alterar um estudo encerrado.” |
| 400 | `PARTICIPATION_NOT_ACTIVE` | Participação `Retirado` ou `Concluído` | “Somente participantes ativos podem ter visitas agendadas.” |
| 400 | `SCHEDULE_OUT_OF_RANGE` | `scheduledAt` antes da inclusão ou depois do término do estudo | “A data agendada deve estar entre a inclusão do participante e o término do estudo.” |
| 401 | — | Sessão inválida | ERR-COMUNS |
| 403 | — | Perfil ou estado do estudo não permitido | conforme regra A-EQUIPE-ESCRITA |
| 404 | — | Estudo, participação ou visita prevista não pertence ao estudo | “Estudo não encontrado.” / “Participante não encontrado neste estudo.” / “Visita prevista não encontrada neste estudo.” |
| 409 | `VISIT_ALREADY_SCHEDULED` | Já existe visita `Agendada` ou `Realizada` para a mesma participação e visita prevista | “Esta visita prevista já está agendada ou realizada para o participante.” |

```json
{
  "statusCode": 409,
  "message": "Esta visita prevista já está agendada ou realizada para o participante.",
  "error": "Conflict",
  "code": "VISIT_ALREADY_SCHEDULED"
}
```

**Observações técnicas**
- Não há constraint única no banco para participação + visita prevista. A verificação de duplicidade deve ocorrer em transação, com bloqueio da participação (`SELECT ... FOR UPDATE`), seguindo o padrão da inclusão (RF11).
- Depois de `Ausente` ou `Cancelada`, a mesma visita prevista pode ser agendada novamente.
- Depende de E01 (escolha da participação) e de X02/X03 (escolha da visita prevista, ver D-01).

---

#### E03 — Listar visitas agendadas do estudo [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF12, RF13 |
| Objetivo | Consultar as visitas agendadas para acompanhar e atualizar sua situação. |
| Funcionamento | Lista registros de `visitas` cujas visitas previstas pertencem ao estudo. Substitui os dados fixos da tela “Visitas e avaliações” (S3-W2-03, S3-W2-07). |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /studies/:studyId/scheduled-visits` |
| Parâmetros de rota | `studyId` (uuid) |
| Parâmetros de query | `participationId` (uuid, opcional); `status` (opcional: `Agendada`, `Realizada`, `Ausente`, `Cancelada`); `from` e `to` (opcionais, `YYYY-MM-DD`, inclusivos, aplicados a `scheduledAt`). |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-LEITURA** |
| Restrição de registros | Somente visitas cuja visita prevista pertence ao estudo. `participationId` de outro estudo resulta em 404. |

**Requisição** — sem corpo. DTO de query: `ListScheduledVisitsQueryDto` (`@IsOptional() @IsUUID()`, `@IsIn([...])`, `@Matches(/^\d{4}-\d{2}-\d{2}$/)`). `from` maior que `to` resulta em 400.

**Resposta — 200 OK** (`ScheduledVisit[]`), ordenada por `scheduledAt` crescente.

```json
[
  {
    "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
    "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
    "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
    "participantName": "Bianca Oliveira",
    "plannedVisitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
    "plannedVisitName": "Consulta inicial",
    "plannedVisitOrder": 1,
    "scheduledAt": "2026-11-24T12:00:00.000Z",
    "status": "Agendada",
    "realizedAt": null,
    "observation": "Trazer exames anteriores.",
    "createdAt": "2026-11-16T13:20:41.512Z"
  }
]
```

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | UUID ou filtros inválidos; `from` > `to` | ERR-COMUNS / “O período informado é inválido.” |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Perfil ou estado não permitido | conforme regra A-EQUIPE-LEITURA |
| 404 | Estudo inexistente; `participationId` não pertence ao estudo | “Estudo não encontrado.” / “Participante não encontrado neste estudo.” |

**Observações técnicas** — a tela de agenda do Coordenador consulta um estudo por vez (filtro de estudo). Uma visão consolidada de vários estudos não é exigida por RF12–RF13 e fica fora deste contrato.

---

### 8.2 RF13 — Registrar a realização, ausência ou cancelamento de visitas

#### E04 — Atualizar a situação da visita agendada [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF13 |
| Objetivo | Registrar a visita como `Realizada`, `Ausente` ou `Cancelada`. |
| Funcionamento | Atualiza `visitas.status`, `data_realizacao` e `observacao` de uma visita `Agendada` (S3-BE-03). |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `PATCH /studies/:studyId/scheduled-visits/:scheduledVisitId/status` |
| Parâmetros de rota | `studyId` (uuid), `scheduledVisitId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>`, `Content-Type: application/json` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-ESCRITA** |
| Restrição de registros | A visita deve pertencer ao estudo da rota. |

**Requisição** — `UpdateScheduledVisitStatusRequestDto`

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `status` | `'Realizada' \| 'Ausente' \| 'Cancelada'` | Sim | `@IsIn([...])`. `Agendada` não é aceito como destino. |
| `realizedAt` | `string` (date-time) | Somente se `Realizada` | `@ValidateIf(status === 'Realizada') @IsISO8601({ strict: true })`. Não pode ser futuro nem anterior à inclusão. Para `Ausente` e `Cancelada` deve ser omitido; se enviado, resulta em 400. |
| `observation` | `string` \| `null` | Não | `trim`; até 2000 caracteres. Se omitido, mantém o valor atual. |

```json
{
  "status": "Realizada",
  "realizedAt": "2026-11-24T09:40:00-03:00",
  "observation": "Participante compareceu no horário."
}
```

**Resposta — 200 OK** (`ScheduledVisit` atualizado)

```json
{
  "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
  "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
  "participantName": "Bianca Oliveira",
  "plannedVisitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
  "plannedVisitName": "Consulta inicial",
  "plannedVisitOrder": 1,
  "scheduledAt": "2026-11-24T12:00:00.000Z",
  "status": "Realizada",
  "realizedAt": "2026-11-24T12:40:00.000Z",
  "observation": "Participante compareceu no horário.",
  "createdAt": "2026-11-16T13:20:41.512Z"
}
```

**Erros**

| Código | `code` (proposta) | Situação | Mensagem |
|---|---|---|---|
| 400 | — | Corpo inválido; `realizedAt` ausente com `Realizada` ou presente com outro estado | ERR-COMUNS / “Informe a data de realização somente para visitas realizadas.” |
| 400 | `VISIT_STATUS_FINAL` | Visita já está `Realizada`, `Ausente` ou `Cancelada` | “Transição de \"Realizada\" para \"Cancelada\" não permitida.” (formato igual ao do RF07) |
| 400 | `REALIZED_AT_INVALID` | `realizedAt` futuro ou anterior à inclusão | “A data de realização é inválida.” |
| 400 | `STUDY_CLOSED` | Estudo encerrado | “Não é possível alterar um estudo encerrado.” |
| 400 | `PARTICIPATION_NOT_ACTIVE` | Participação não ativa | “Somente visitas de participantes ativos podem ser atualizadas.” |
| 401 | — | Sessão inválida | ERR-COMUNS |
| 403 | — | Perfil ou estado não permitido | conforme regra A-EQUIPE-ESCRITA |
| 404 | — | Visita agendada não pertence ao estudo | “Visita agendada não encontrada neste estudo.” |

**Observações técnicas**
- Transições **[Proposta]**: `Agendada → Realizada | Ausente | Cancelada`. As três situações finais não mudam (D-05). Para remarcar, cria-se novo agendamento (E02).
- A atualização deve condicionar `WHERE status = 'Agendada'` para evitar corrida, como em `transitionStatus` do RF07.

---

### 8.3 RF14 — Registrar resultados fictícios das avaliações previstas

#### E05 — Consultar atividades e resultados de uma visita agendada [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF14 |
| Objetivo | Exibir as atividades previstas da visita com o resultado já registrado, quando houver (S3-W2-04). |
| Funcionamento | Junta `atividades_visita` da visita prevista com `resultados_avaliacao` da visita agendada. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /studies/:studyId/scheduled-visits/:scheduledVisitId/results` |
| Parâmetros de rota | `studyId` (uuid), `scheduledVisitId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-LEITURA** |
| Restrição de registros | A visita agendada deve pertencer ao estudo. |

**Requisição** — sem corpo.

**Resposta — 200 OK** (`ScheduledVisitResults`)

| Campo | Tipo | Descrição |
|---|---|---|
| `scheduledVisitId` | `string` (uuid) | Visita agendada. |
| `plannedVisitId` | `string` (uuid) | Visita prevista. |
| `status` | situação da visita | Indica se o registro é permitido (`Realizada`). |
| `activities` | `array` | Uma entrada por atividade prevista, na ordem de cadastro. |
| `activities[].activityId` | `string` (uuid) | Atividade. |
| `activities[].name`, `type`, `description` | `string`, `string`, `string \| null` | Dados da atividade (RF06). |
| `activities[].result` | `AssessmentResult \| null` | Resultado registrado, ou `null`. |

```json
{
  "scheduledVisitId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "plannedVisitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
  "status": "Realizada",
  "activities": [
    {
      "activityId": "6e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c",
      "name": "Coleta de sinais vitais",
      "type": "Exame",
      "description": "Aferir pressão arterial e frequência cardíaca.",
      "result": null
    }
  ]
}
```

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | UUID inválido | ERR-COMUNS |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Perfil ou estado não permitido | conforme regra A-EQUIPE-LEITURA |
| 404 | Visita agendada não pertence ao estudo | “Visita agendada não encontrada neste estudo.” |

**Observações técnicas** — com este endpoint, o formulário de RF14 não precisa de X03.

---

#### E06 — Registrar resultado fictício de uma atividade [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF14 |
| Objetivo | Registrar o resultado fictício de uma atividade prevista em uma visita realizada. |
| Funcionamento | Cria um registro em `resultados_avaliacao` com `id_registrado_por = request.user.sub` (S3-BE-04). |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `POST /studies/:studyId/scheduled-visits/:scheduledVisitId/results` |
| Parâmetros de rota | `studyId` (uuid), `scheduledVisitId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>`, `Content-Type: application/json` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador')`. Inclusão do Coordenador pendente (D-04). |
| Regra | **A-PESQUISADOR-ESCRITA** |
| Restrição de registros | A visita agendada deve pertencer ao estudo, e a atividade à visita prevista dessa visita. |

**Requisição** — `RegisterAssessmentResultRequestDto`

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `activityId` | `string` (uuid) | Sim | `@IsUUID()` |
| `value` | `string` | Sim | `trim`; 1 a 200 caracteres. **[Proposta]** limite de 200 (a coluna é `TEXT`). |
| `unit` | `string` \| `null` | Não | `trim`; vazio vira `null`; até 50 caracteres (`VARCHAR(50)`). |
| `observation` | `string` \| `null` | Não | `trim`; vazio vira `null`; até 2000 caracteres. |

```json
{
  "activityId": "6e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c",
  "value": "120/80",
  "unit": "mmHg",
  "observation": "Valor fictício para fins acadêmicos."
}
```

**Resposta — 201 Created** (`AssessmentResult`)

```json
{
  "id": "0f1e2d3c-4b5a-4968-8776-655443322110",
  "scheduledVisitId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "activityId": "6e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c",
  "value": "120/80",
  "unit": "mmHg",
  "observation": "Valor fictício para fins acadêmicos.",
  "registeredAt": "2026-11-24T13:05:10.200Z",
  "registrarId": "2c4e6a8b-1d3f-4b5d-9e7f-1a3c5e7b9d2f"
}
```

**Erros**

| Código | `code` (proposta) | Situação | Mensagem |
|---|---|---|---|
| 400 | — | Corpo inválido | ERR-COMUNS |
| 400 | `VISIT_NOT_REALIZED` | Visita não está `Realizada` | “Registre resultados somente em visitas realizadas.” |
| 400 | `ACTIVITY_NOT_IN_VISIT` | Atividade não pertence à visita prevista da visita agendada | “A atividade não pertence à visita prevista agendada.” |
| 400 | `STUDY_CLOSED` | Estudo encerrado | “Não é possível alterar um estudo encerrado.” |
| 401 | — | Sessão inválida | ERR-COMUNS |
| 403 | — | Perfil não autorizado ou pesquisador não proprietário | “Seu perfil não tem permissão para este recurso.” / “Você não tem permissão para alterar este estudo.” |
| 404 | — | Visita agendada não pertence ao estudo | “Visita agendada não encontrada neste estudo.” |
| 409 | `RESULT_ALREADY_REGISTERED` | Já existe resultado para a visita e a atividade (`resultados_visita_atividade_unico`) | “Já existe resultado registrado para esta atividade nesta visita.” |

**Observações técnicas** — a correção de resultados já registrados não é exigida por RF14 e não faz parte deste contrato (D-08).

---

### 8.4 RF15 — Consultar o histórico de visitas e avaliações de um participante

#### E07 — Consultar histórico do participante [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF15 |
| Objetivo | Reunir visitas agendadas, datas, situações e resultados de uma participação (S3-BE-05, S3-W2-05). |
| Funcionamento | Retorna os dados da participação e suas visitas em ordem cronológica, cada uma com os resultados registrados. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /studies/:studyId/participants/:participationId/history` |
| Parâmetros de rota | `studyId` (uuid), `participationId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-LEITURA**, incluindo estudos encerrados (consulta). |
| Restrição de registros | A participação deve pertencer ao estudo. O Participante consulta o próprio histórico por E10, não por esta rota. |

**Requisição** — sem corpo.

**Resposta — 200 OK** (`ParticipantHistory`)

| Campo | Tipo | Descrição |
|---|---|---|
| `participant` | `Participant` (7.1) | Dados da participação. |
| `visits` | `array` | `ScheduledVisit` (7.2) + `results: AssessmentResult[]` com `activityName` e `activityType`. Ordenadas por `scheduledAt` crescente. |

```json
{
  "participant": {
    "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
    "candidateId": "9d2e7f40-1c3b-4a5d-8e6f-7a8b9c0d1e2f",
    "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
    "name": "Bianca Oliveira",
    "participationStatus": "Ativo",
    "includedAt": "2026-11-06",
    "withdrawnAt": null,
    "withdrawalReason": null
  },
  "visits": [
    {
      "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
      "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
      "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
      "participantName": "Bianca Oliveira",
      "plannedVisitId": "5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
      "plannedVisitName": "Consulta inicial",
      "plannedVisitOrder": 1,
      "scheduledAt": "2026-11-24T12:00:00.000Z",
      "status": "Realizada",
      "realizedAt": "2026-11-24T12:40:00.000Z",
      "observation": "Participante compareceu no horário.",
      "createdAt": "2026-11-16T13:20:41.512Z",
      "results": [
        {
          "id": "0f1e2d3c-4b5a-4968-8776-655443322110",
          "scheduledVisitId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
          "activityId": "6e5d4c3b-2a19-4f8e-9d7c-6b5a4f3e2d1c",
          "activityName": "Coleta de sinais vitais",
          "activityType": "Exame",
          "value": "120/80",
          "unit": "mmHg",
          "observation": "Valor fictício para fins acadêmicos.",
          "registeredAt": "2026-11-24T13:05:10.200Z",
          "registrarId": "2c4e6a8b-1d3f-4b5d-9e7f-1a3c5e7b9d2f"
        }
      ]
    }
  ]
}
```

Sem visitas, retorna `visits: []` com 200. O histórico vazio não é erro.

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | UUID inválido | ERR-COMUNS |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Perfil ou estado não permitido | conforme regra A-EQUIPE-LEITURA |
| 404 | Participação não pertence ao estudo | “Participante não encontrado neste estudo.” |

**Observações técnicas** — o histórico é preservado após a retirada (S3-BE-06), e visitas canceladas continuam listadas.

---

### 8.5 RF16 — Registrar a retirada de um participante do estudo

#### E08 — Registrar retirada da participação [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF16 |
| Objetivo | Registrar a retirada de um participante ativo, com data e motivo (S3-BE-06, S3-W2-06). |
| Funcionamento | Atualiza `participacoes_estudo` para `status = 'Retirado'`, preenchendo `data_retirada` e `motivo_retirada`. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `POST /studies/:studyId/participants/:participationId/withdrawal` |
| Parâmetros de rota | `studyId` (uuid), `participationId` (uuid) |
| Parâmetros de query | Nenhum |
| Headers | `Authorization: Bearer <accessToken>`, `Content-Type: application/json` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Pesquisador', 'Coordenador')` |
| Regra | **A-EQUIPE-ESCRITA** |
| Restrição de registros | A participação deve pertencer ao estudo. |

**Requisição** — `RegisterWithdrawalRequestDto`

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `withdrawalDate` | `string` (date) | Sim | `YYYY-MM-DD` válido; não anterior a `includedAt` (constraint `participacoes_datas_validas`) nem posterior à data atual. |
| `reason` | `string` | Sim | `trim`; 3 a 2000 caracteres. **[Proposta]** obrigatório, pois S3-W2-06 pede “solicitar motivo e data”, embora a coluna aceite `NULL`. |

```json
{
  "withdrawalDate": "2026-11-27",
  "reason": "Participante solicitou desligamento por motivos pessoais."
}
```

**Resposta — 201 Created** (`Participant` atualizado)

```json
{
  "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
  "candidateId": "9d2e7f40-1c3b-4a5d-8e6f-7a8b9c0d1e2f",
  "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
  "name": "Bianca Oliveira",
  "participationStatus": "Retirado",
  "includedAt": "2026-11-06",
  "withdrawnAt": "2026-11-27",
  "withdrawalReason": "Participante solicitou desligamento por motivos pessoais."
}
```

**Erros**

| Código | `code` (proposta) | Situação | Mensagem |
|---|---|---|---|
| 400 | — | Corpo inválido | ERR-COMUNS |
| 400 | `PARTICIPATION_NOT_ACTIVE` | Participação já `Retirado` ou `Concluído` | “Somente participantes ativos podem ser retirados do estudo.” |
| 400 | `WITHDRAWAL_DATE_INVALID` | Data anterior à inclusão ou futura | “A data de retirada deve estar entre a inclusão e a data atual.” |
| 400 | `STUDY_CLOSED` | Estudo encerrado | “Não é possível alterar um estudo encerrado.” |
| 401 | — | Sessão inválida | ERR-COMUNS |
| 403 | — | Perfil ou estado não permitido | conforme regra A-EQUIPE-ESCRITA |
| 404 | — | Participação não pertence ao estudo | “Participante não encontrado neste estudo.” |

**Observações técnicas**
- A atualização deve ocorrer em transação, com `WHERE status = 'Ativo'`.
- O histórico (visitas e resultados) é preservado. Não há exclusão de dados.
- Efeitos colaterais pendentes de decisão (D-07): cancelamento das visitas `Agendada` futuras, contador `participantes_vinculados` e `status_recrutamento` do candidato. Até a decisão, a implementação **não** altera esses dados.

---

### 8.6 RF17 — Permitir ao participante consultar os estudos em que está incluído

#### E09 — Listar estudos do participante autenticado [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF17 |
| Objetivo | Listar os estudos em que o usuário autenticado possui participação (S3-BE-07, S3-MOB-03). |
| Funcionamento | Resolve as participações por `candidatos.id_usuario = request.user.sub` e retorna os dados essenciais do estudo e da participação. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /me/studies` |
| Parâmetros de rota | Nenhum |
| Parâmetros de query | Nenhum. Identificadores de usuário, candidato ou participação **não são aceitos**. |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Participante')` |
| Regra | **A-PARTICIPANTE** (seção 6.3) |
| Restrição de registros | Somente participações vinculadas à conta do token. |

**Requisição** — sem corpo.

**Resposta — 200 OK** (`ParticipantStudy[]`), ordenada por `includedAt` decrescente.

| Campo | Tipo | Descrição |
|---|---|---|
| `participationId` | `string` (uuid) | Participação do próprio usuário. |
| `participationStatus` | `'Ativo' \| 'Retirado' \| 'Concluído'` | Estado da participação. |
| `includedAt` | `string` (date) | Data de inclusão. |
| `withdrawnAt` | `string` (date) \| `null` | Data de retirada. |
| `study.id` | `string` (uuid) | Estudo. |
| `study.code` | `string` | Código (`EST-001`). |
| `study.title` | `string` | Título. |
| `study.objective` | `string` | Objetivo. |
| `study.startDate` / `study.endDate` | `string` (date) | Período do estudo. |
| `study.status` | `'planejamento' \| 'recrutamento' \| 'execução' \| 'encerrado'` | Estado do estudo (RF07). |
| `study.researcher` | `string` | Nome do pesquisador responsável. |

```json
[
  {
    "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
    "participationStatus": "Ativo",
    "includedAt": "2026-11-06",
    "withdrawnAt": null,
    "study": {
      "id": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
      "code": "EST-001",
      "title": "Qualidade do sono",
      "objective": "Investigar padrões de sono e acompanhar indicadores da qualidade do sono dos participantes.",
      "startDate": "2026-04-01",
      "endDate": "2026-11-28",
      "status": "execução",
      "researcher": "Marina Costa"
    }
  }
]
```

Sem participações, retorna `[]` com 200. O Mobile exibe o estado vazio (S3-MOB-03).

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 401 | Token ausente, inválido, expirado ou conta inativa | ERR-COMUNS |
| 403 | Perfil diferente de Participante | “Seu perfil não tem permissão para este recurso.” |

**Observações técnicas**
- **[Proposta]** retorna também participações `Retirado` e `Concluído`, identificadas pelo campo de estado, para que o participante veja o histórico de vínculo (D-09).
- Não retorna `participantLimit`, `participantsLinked`, `researcherId` nem dados de outros participantes.
- **Atenção à pendência P-01:** o cadastro atual de candidatos não preenche `candidatos.id_usuario`. Sem esse vínculo, o endpoint retorna `[]` para qualquer participante real.

---

### 8.7 RF18 — Exibir as próximas visitas e seu histórico de comparecimento

#### E10 — Listar visitas do participante autenticado [Planejado]

**Identificação**

| Item | Valor |
|---|---|
| RF | RF18 |
| Objetivo | Exibir ao participante as próximas visitas e o histórico de comparecimento (S3-BE-07, S3-MOB-04). |
| Funcionamento | Lista as visitas (`visitas`) das participações do usuário do token, separadas por escopo. |

**Definição HTTP**

| Item | Valor |
|---|---|
| Método e rota | `GET /me/visits` |
| Parâmetros de rota | Nenhum |
| Parâmetros de query | `scope` (obrigatório): `upcoming` (próximas) ou `history` (histórico de comparecimento). `studyId` (uuid, opcional): restringe a um estudo em que o usuário participa. |
| Headers | `Authorization: Bearer <accessToken>` |

**Segurança**

| Item | Valor |
|---|---|
| Autenticação | Obrigatória. |
| Perfis | `@Roles('Participante')` |
| Regra | **A-PARTICIPANTE** (seção 6.3) |
| Restrição de registros | Somente visitas das participações do próprio usuário. `studyId` sem participação do usuário resulta em 404. |

**Requisição** — sem corpo. DTO de query: `ListMyVisitsQueryDto { scope: 'upcoming' | 'history'; studyId?: string }`.

| Escopo | Critério **[Proposta]** | Ordenação |
|---|---|---|
| `upcoming` | `status = 'Agendada'` (inclusive datas já passadas e ainda não registradas pela equipe) | `scheduledAt` crescente |
| `history` | `status IN ('Realizada', 'Ausente', 'Cancelada')` | `scheduledAt` decrescente |

**Resposta — 200 OK** (`ParticipantVisit[]`)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` (uuid) | Visita agendada. |
| `participationId` | `string` (uuid) | Participação do próprio usuário. |
| `studyId` | `string` (uuid) | Estudo. |
| `studyTitle` | `string` | Título do estudo. |
| `plannedVisitName` | `string` | Nome da visita prevista. |
| `plannedVisitOrder` | `integer` | Ordem no protocolo. |
| `scheduledAt` | `string` (date-time) | Data e hora agendadas. |
| `status` | `'Agendada' \| 'Realizada' \| 'Ausente' \| 'Cancelada'` | Situação (comparecimento). |
| `realizedAt` | `string` (date-time) \| `null` | Data de realização. |

```json
[
  {
    "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
    "participationId": "3f6c9a12-8b4d-4e21-9c37-1a2b3c4d5e6f",
    "studyId": "e34e7889-4221-4a63-9f15-5e4d60c5955b",
    "studyTitle": "Qualidade do sono",
    "plannedVisitName": "Consulta inicial",
    "plannedVisitOrder": 1,
    "scheduledAt": "2026-11-24T12:00:00.000Z",
    "status": "Agendada",
    "realizedAt": null
  }
]
```

Sem visitas no escopo, retorna `[]` com 200.

**Erros**

| Código | Situação | Mensagem |
|---|---|---|
| 400 | `scope` ausente ou inválido; `studyId` inválido | ERR-COMUNS |
| 401 | Sessão inválida | ERR-COMUNS |
| 403 | Perfil diferente de Participante | “Seu perfil não tem permissão para este recurso.” |
| 404 | `studyId` sem participação do usuário | “Estudo não encontrado entre as suas participações.” |

**Observações técnicas**
- Não retorna `observation` (anotação interna da equipe) nem resultados de avaliação. RF18 trata de visitas e comparecimento.
- Mesma dependência de P-01 descrita em E09.
- As ações sobre as visitas (confirmar presença, pedir reagendamento) pertencem a RF19 (Sprint 4).

## 9. Códigos HTTP e tratamento de erros

### 9.1 Formato do erro [Existente]

```json
{ "statusCode": 400, "message": "Mensagem em português.", "error": "Bad Request" }
```

Para recusas de domínio, **[Proposta]** incluir `code`, como em `CandidateInclusionErrorResponseDto`:

```json
{ "statusCode": 400, "message": "Somente participantes ativos podem ter visitas agendadas.", "error": "Bad Request", "code": "PARTICIPATION_NOT_ACTIVE" }
```

### 9.2 ERR-COMUNS — erros compartilhados por todos os endpoints

| Código | Origem | Mensagem atual [Existente] |
|---|---|---|
| 400 | `ParseUUIDPipe` (parâmetro de rota inválido) | “Validation failed (uuid is expected)” |
| 400 | `ValidationPipe` (corpo ou query inválidos, campo não permitido) | `message` é uma **lista** de textos técnicos em inglês (ex.: `"scheduledAt must be a valid ISO 8601 date string"`). A Web e o Mobile devem exibir texto próprio em português, apontando o campo, como já faz `visitsApi.ts`. |
| 401 | Sem cabeçalho `Bearer` | “Faça login para acessar este recurso.” |
| 401 | Token inválido, expirado ou sessão revogada | “Token inválido ou expirado. Entre novamente.” |
| 401 | Conta inativa | “Esta conta está inativa. Entre em contato com a administração.” |
| 403 | Perfil fora de `@Roles` | “Seu perfil não tem permissão para este recurso.” |
| 500 | Erro inesperado | Mensagem genérica do NestJS. Os clientes devem exibir mensagem própria, sem detalhes técnicos. |

### 9.3 Códigos de domínio propostos

| `code` | HTTP | Endpoints |
|---|---|---|
| `STUDY_CLOSED` | 400 | E02, E04, E06, E08 |
| `PARTICIPATION_NOT_ACTIVE` | 400 | E02, E04, E08 |
| `SCHEDULE_OUT_OF_RANGE` | 400 | E02 |
| `VISIT_ALREADY_SCHEDULED` | 409 | E02 |
| `VISIT_STATUS_FINAL` | 400 | E04 |
| `REALIZED_AT_INVALID` | 400 | E04 |
| `VISIT_NOT_REALIZED` | 400 | E06 |
| `ACTIVITY_NOT_IN_VISIT` | 400 | E06 |
| `RESULT_ALREADY_REGISTERED` | 409 | E06 |
| `WITHDRAWAL_DATE_INVALID` | 400 | E08 |

### 9.4 Orientação aos clientes

| Situação | Web | Mobile |
|---|---|---|
| 401 | `AuthContext` já encerra a sessão. | Descartar o token seguro e voltar ao login (S3-MOB-02). |
| 403 | Mensagem de acesso não permitido; manter os dados preenchidos. | Mensagem de acesso não permitido; encerrar a sessão se o perfil não for Participante. |
| 400 / 409 | Exibir `message` (português) junto ao formulário, sem perder os dados digitados. | Não aplicável (somente leitura). |
| Falha de rede / 5xx | Mensagem genérica e opção de tentar novamente. | Idem; não descartar o token por falha de rede. |

## 10. Dependências entre endpoints e tasks

### 10.1 Dependências entre endpoints

| Endpoint | Depende de | Observação |
|---|---|---|
| E01 | Inclusão RF11 [Existente] | Participações nascem em `POST /studies/:studyId/candidates/:candidateId/include`. |
| E02 | E01, X02, X03 | X02/X03 dependem de D-01 para o Coordenador. |
| E03 | E02 | — |
| E04 | E02/E03 | — |
| E05 | E02, E04 | O registro exige visita `Realizada`. |
| E06 | E05 | — |
| E07 | E01, E03, E06 | Agrega os dados de RF12–RF14. |
| E08 | E01 | Efeitos sobre as visitas dependem de D-07. |
| E09 | X01, login [Existente], vínculo `candidatos.id_usuario` | Ver P-01. |
| E10 | E09, E02/E04 | Ver P-01. |

### 10.2 Mapeamento para as tasks da Sprint 3

| Task | Responsável | Endpoints |
|---|---|---|
| S3-BE-02 | Laryssa | E01, E02, E03 (+ D-01) |
| S3-BE-03 | Laryssa | E04 |
| S3-BE-04 | Laryssa | E05, E06 |
| S3-BE-05 | Laryssa | E07 |
| S3-BE-06 | Laryssa | E08 |
| S3-BE-07 | Laryssa | E09, E10 |
| S3-BE-08 | Laryssa | Testes e Swagger de E01–E10 |
| S3-W1-02, S3-W1-03, S3-W1-04 | Marcella | E01, E07 (seleção do participante e ligação com os fluxos) |
| S3-W2-02 | Sonally | E01, E02, X02, X03 |
| S3-W2-03 | Sonally | E03, E04 |
| S3-W2-04 | Sonally | E05, E06 |
| S3-W2-05 | Sonally | E07 |
| S3-W2-06 | Sonally | E08 |
| S3-MOB-02 | Lethycia | `POST /auth/login`, X01, `POST /auth/logout` |
| S3-MOB-03, S3-MOB-04, S3-MOB-05 | Lethycia | E09, E10 |
| S3-QA-03 | Letícia | E01–E10 (integração, isolamento entre participantes, permissões) |
| S3-QA-06 | Letícia | E2E Web (E02 → E04) e E2E Mobile (login → E09 → E10) |

## 11. Orientações para mocks e desenvolvimento paralelo

- Os exemplos JSON deste documento são a fonte única para mocks na Web e no Mobile. Os identificadores repetem-se entre os exemplos para permitir encadear os fluxos (estudo → participação → visita agendada → resultado).
- Os clientes devem tratar todos os códigos listados em cada contrato, inclusive listas vazias (`[]`) com 200.
- Datas e horas: os clientes enviam ISO 8601 com fuso e exibem no fuso local (`America/Fortaleza` / `America/Recife`, UTC−3).
- Qualquer alteração de contrato durante a implementação deve atualizar este documento e o Swagger no mesmo PR.

## 12. Relação com o Plano de Contingência

O Plano de Contingência (`docs/releases/release2/Plano_Contingencia_ClinicalStudyPB_Sprint3.docx`) foi consultado e **não foi modificado nem copiado**. Por decisão da Weekly Meeting, as propostas abaixo foram **adiadas para a Sprint 4** e **não** fazem parte destes contratos:

| Proposta adiada | Relação com RF12–RF18 |
|---|---|
| S3C-PBI01 — Vínculo do candidato à conta de Participante (S3C-BE-01, S3C-BE-02, S3C-W2-01, S3C-W1-01) | **Impacta RF17–RF18** (P-01): os contratos E09–E10 já pressupõem o vínculo. |
| S3C-PBI02 — Leitura de visitas previstas pelo Coordenador (S3C-BE-03, S3C-QA-01) | **Impacta RF12** (D-01): o agendamento precisa da visita prevista. |
| S3C-PBI03 — Edição de visitas previstas e atividades posteriores | Sem impacto direto nos contratos. |
| S3C-PBI04 — Termo de consentimento do participante | Sem contrato nesta sprint. As rotas `/me/*` não exigem termo. |
| S3C-PBI05 — Auditoria e matriz de rastreabilidade | Os contratos não gravam a tabela `auditoria`. |
| S3C-PBI06 — Dados demonstrativos (**S3C-MOB-02**) | Sem impacto. Não confundir com **S3-MOB-02** (autenticação Mobile), que está no planejamento atual e é dependência de E09–E10. |

## 13. Decisões técnicas e propostas para validação

As propostas abaixo **não estão aprovadas**. A recomendação é aplicada nos contratos até que a equipe decida.

| ID | Questão | Recomendação aplicada | Alternativa / consequência |
|---|---|---|---|
| D-01 | Como o Coordenador obtém as visitas previstas no agendamento (RF12)? | Ampliar **somente a leitura** de X02 e X03 ao Coordenador, nos estados de A-EQUIPE-LEITURA, dentro de S3-BE-02. A descrição de S3-BE-02 já exige vincular o agendamento à visita prevista, e S3-W2-02 exige selecioná-la. | É o mesmo ajuste da proposta adiada S3C-BE-03. **A equipe precisa confirmar se o considera parte do escopo original de S3-BE-02.** Sem ele, o Coordenador não consegue agendar e RF12 fica restrito ao Pesquisador proprietário. |
| D-02 | Formato de rotas das visitas agendadas | `/studies/:studyId/scheduled-visits` | Aninhar em `/participants/:participationId/visits` deixaria as rotas mais longas e sem listagem por estudo. |
| D-03 | Estados do estudo permitidos ao Coordenador | Leitura: `recrutamento`, `execução`, `encerrado`. Escrita: `recrutamento`, `execução`. | Hoje o Coordenador só atua em `recrutamento` (RF08–RF11). Sem `execução`, o acompanhamento para quando o estudo avança. |
| D-04 | Perfis de cada operação | RF12, RF13 e RF16: Coordenador e Pesquisador proprietário (padrão de RF08–RF11). RF14: somente Pesquisador. RF15: ambos. | A especificação associa RF12, RF13 e RF16 ao Coordenador e RF14 ao Pesquisador. Excluir o Pesquisador de RF12/13/16 ou incluir o Coordenador em RF14 muda apenas `@Roles`. |
| D-05 | Transições da situação da visita | `Agendada → Realizada / Ausente / Cancelada`; estados finais imutáveis; remarcar = novo agendamento. | Permitir correção exigiria regra adicional e reflete no histórico (RF15). |
| D-06 | `scheduledAt` no passado | Permitido, desde que entre a inclusão e o término do estudo (facilita registrar visitas já ocorridas e dados demonstrativos). | Exigir data futura impede registrar retroativamente. |
| D-07 | Efeitos da retirada | Nenhum efeito automático até a decisão. | Opções: cancelar as visitas `Agendada` futuras (evita que o participante as veja em E10); decrementar `participantes_vinculados` (libera vaga); mudar `status_recrutamento`. Cada opção altera regras de RF11. |
| D-08 | Correção de resultados (RF14) | Não prevista: segundo registro resulta em 409. | Uma rota `PATCH` adicional, se a equipe julgar necessário. |
| D-09 | RF17 inclui participações encerradas ou retiradas? | Sim, com `participationStatus`. | Retornar só `Ativo` simplifica a tela, mas esconde o histórico de vínculo. |
| D-10 | Vínculo Coordenador–estudo | Mantido o comportamento atual: o Coordenador acessa todos os estudos nos estados permitidos. | Restringir exigiria nova tabela (fora do escopo). |
| D-11 | Formato de data e hora | ISO 8601 UTC nas respostas novas. | O backend atual responde timestamps no formato textual do PostgreSQL. Padronizar todos os endpoints exige ajuste nos existentes, fora desta task. |
| D-12 | Códigos de domínio (`code`) | Adotar nas recusas de RF12–RF16. | Sem `code`, os clientes dependem do texto da mensagem. |

## 14. Pendências identificadas

| ID | Pendência | Impacto | Encaminhamento sugerido |
|---|---|---|---|
| **P-01** | **O cadastro de candidatos não preenche `candidatos.id_usuario`** (`CandidatesService.create` grava só estudo, nome e e-mail). A correção (S3C-PBI01) foi adiada para a Sprint 4. | **Alto.** E09 e E10 funcionam conforme o contrato, mas retornam `[]` para participantes cadastrados pela interface. A demonstração e o E2E Mobile de RF17–RF18 (S3-QA-06) ficam sem dados. | Decisão da equipe: (a) na Sprint 3, preencher o vínculo apenas nos dados de teste e demonstração (fixtures e seed), sem alterar o cadastro; ou (b) antecipar S3C-BE-02/S3C-W2-01, revendo a decisão da Weekly Meeting. Os contratos E09–E10 não mudam em nenhuma das opções. |
| **P-02** | D-01: acesso do Coordenador às visitas previstas. | **Alto** para RF12 pelo Coordenador. | Confirmar se a ampliação de leitura faz parte de S3-BE-02. |
| P-03 | O login Mobile aceita qualquer perfil e a sessão fica em memória. | Médio | Resolvido por S3-MOB-02. As rotas `/me/*` recusam outros perfis (403) de qualquer forma. |
| P-04 | Sem refresh token: a sessão expira em 1 hora. | Baixo | Restaurar a sessão por X01 e pedir novo login após 401. Nenhum endpoint novo nesta sprint. |
| P-05 | Mensagens do `ValidationPipe` em inglês. | Baixo | Os clientes traduzem por campo (padrão de `visitsApi.ts`). |
| P-06 | D-03 a D-12 sem aprovação. | Médio | Validar com a equipe antes do início de S3-BE-02. |
| P-07 | RF18 na figura da especificação inclui “acompanhar solicitações e decisões”. | Baixo | Coberto por RF19–RF20 na Sprint 4 (`solicitacoes_visita`). |

## 15. Histórico de versões

| Versão | Data | Autor | Descrição |
|---|---|---|---|
| 0.1 | 15/11/2026 | Zeton (S3-PO-03) | Versão inicial: 10 contratos planejados (E01–E10), 3 existentes reutilizados (X01–X03), decisões D-01 a D-12 e pendências P-01 a P-07, para validação da equipe. |
