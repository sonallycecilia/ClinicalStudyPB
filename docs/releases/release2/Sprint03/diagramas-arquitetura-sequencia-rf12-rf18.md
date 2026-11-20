# Diagramas de arquitetura e sequência — RF12 a RF18

| Item | Valor |
|---|---|
| **Projeto** | ClinicalStudyPB — Sistema de Gestão de Estudos Clínicos |
| **Release / Sprint** | Release 2 — Sprint 3 (10/11/2026 a 23/11/2026) |
| **Task** | S3-PO-05 — Atualizar diagramas de arquitetura e sequência |
| **Responsável** | Zeton (Líder técnico / Gerente) |
| **Base** | S3-PO-03 [`contratos-api-rf12-rf18.md`](./contratos-api-rf12-rf18.md) · S3-PO-04 [`matriz-acesso-e-identificacao-participante-rf12-rf18.md`](./matriz-acesso-e-identificacao-participante-rf12-rf18.md) |
| **Código analisado** | Branch `feat/proposta-contrato-api-e-matriz-acesso`, commit `3649b91` (inclui o PR #27, autenticação Mobile) |
| **Versão** | 1.1 — 20/11/2026 |

### Legenda usada em todo o documento

| Marca | Significado |
|---|---|
| **[Existente]** | Componente ou comportamento confirmado no código do commit analisado. |
| **[Planejado]** | Aprovado para implementação na Sprint 3, ainda não implementado. |
| **[Adiado]** | Fora do escopo da Sprint 3 (Plano de Contingência ou Sprint 4). |
| **D-xx** | Decisão técnica aprovada (seção 5). |

Nos diagramas `flowchart`: borda contínua indica existente, borda tracejada indica planejado e fundo cinza indica adiado.

---

## Sumário

1. [Identificação](#1-identificação)
2. [Objetivo](#2-objetivo)
3. [Referências](#3-referências)
4. [Estado atual da arquitetura](#4-estado-atual-da-arquitetura)
5. [Decisões técnicas aprovadas — D-01 a D-13](#5-decisões-técnicas-aprovadas--d-01-a-d-13)
6. [Diagrama geral de arquitetura](#6-diagrama-geral-de-arquitetura)
7. [Diagrama do modelo persistente](#7-diagrama-do-modelo-persistente)
8. [Sequência RF12–RF13 — agendamento e situação das visitas](#8-sequência-rf12rf13--agendamento-e-situação-das-visitas)
9. [Sequência RF14 — registro de resultados](#9-sequência-rf14--registro-de-resultados)
10. [Sequência RF15 — histórico do participante](#10-sequência-rf15--histórico-do-participante)
11. [Sequência RF16 — retirada do participante](#11-sequência-rf16--retirada-do-participante)
12. [Sequência RF17–RF18 — identificação e acompanhamento pelo Mobile](#12-sequência-rf17rf18--identificação-e-acompanhamento-pelo-mobile)
13. [Fluxos alternativos e respostas de erro](#13-fluxos-alternativos-e-respostas-de-erro)
14. [Alterações estruturais necessárias](#14-alterações-estruturais-necessárias)
15. [Limitações e observações](#15-limitações-e-observações)
16. [Histórico de versões](#16-histórico-de-versões)

---

## 1. Identificação

Este documento é a entrega da S3-PO-05. Ele representa visualmente a comunicação entre Web, Mobile, API NestJS e PostgreSQL nos fluxos de RF12–RF18, de acordo com:

- os contratos da S3-PO-03 (endpoints X01–X03 e E01–E10);
- a matriz de acesso e o fluxo de identificação da S3-PO-04;
- as decisões D-01 a D-13, **aprovadas pela equipe** após a S3-PO-04.

## 2. Objetivo

Servir como referência arquitetural única para a implementação e a integração da Sprint 3, deixando explícito:

- o que já existe no código e o que ainda será implementado;
- por quais camadas cada requisição passa e em que ordem as verificações ocorrem;
- quais tabelas existentes cada fluxo lê ou grava, sem novas estruturas.

## 3. Referências

| Fonte | Uso |
|---|---|
| Especificação *ProjetoES2-2026.2* | RF12–RF18, perfis e interfaces. |
| *Plano de Trabalho*, backlog da Sprint 3 | Descrição de S3-PO-05 e das tasks S3-BE, S3-W1, S3-W2, S3-MOB e S3-QA. |
| S3-PO-03 — `contratos-api-rf12-rf18.md` | Rotas, corpos, respostas, códigos de erro e decisões D-01 a D-13 (seção 13). |
| S3-PO-04 — `matriz-acesso-e-identificacao-participante-rf12-rf18.md` | Perfis, condições P1–P3, C1–C2 e T1–T2, fluxo de identificação e limitações L-01 a L-06. |
| `docs/releases/release2/Plano_Contingencia_ClinicalStudyPB.docx` | Contingências adiadas (consulta, sem alteração). |
| `docs/releases/release1/README.md`, seção 2.1 | Padrão dos diagramas da Release 1 (atores “Aplicação Web”, “API NestJS” e “PostgreSQL”). |
| `backend/migrations/001`–`016` | Tabelas, chaves e constraints. |
| `backend/src/auth`, `backend/src/studies` | Guards, decorators, controllers e services existentes. |
| `mobile/src/auth`, `mobile/src/app/_layout.tsx` | Autenticação Mobile implementada pela S3-MOB-02. |

## 4. Estado atual da arquitetura

### 4.1 Backend [Existente]

| Camada | Componentes no código |
|---|---|
| Entrada HTTP | NestJS (`main.ts`), CORS para a Web e Swagger em `/api`. |
| Autenticação | `AccessTokenGuard`: JWT HS256 (`token.util.ts`), sessão ativa em `sessoes` (`SessionsService`) e conta `Ativo`, com o perfil relido do banco. |
| Autorização | `@Roles(...)` + `RolesGuard` (403 por perfil). |
| Validação | `ParseUUIDPipe` em parâmetros; `ValidationPipe` com DTOs de `swagger/api.models.ts`. |
| Controllers | `AuthController`, `UsersController`, `StudiesController`, `CriteriaController`, `VisitsController` (visitas **previstas**, RF06) e `CandidatesController`. |
| Services | `StudiesService` (inclui `assertStudyCanBeModified`, `assertCandidateStudyAccess` e `assertInclusionStudyAccess`), `VisitsService`, `CandidatesService`, `CriteriaService`, `UsersService` e `AuthService`. |
| Persistência | `DatabaseService` (driver `pg`, SQL explícito, `transaction()`), sem ORM. |
| RF12–RF18 | **Nenhum endpoint implementado.** As tabelas `visitas`, `resultados_avaliacao` e `solicitacoes_visita` não são usadas por nenhum service. `participacoes_estudo` só é gravada pela inclusão (RF11). |

### 4.2 Web [Existente]

| Item | Situação |
|---|---|
| Pesquisador | `StudiesPage` (estudos, critérios, visitas previstas e estado do estudo) integrada à API. |
| Coordenador | `coordenatorPage.tsx`: o recrutamento (RF08–RF11) está integrado à API. **Visitas, painel e reagendamentos usam dados fixos** em `useState`; a substituição está prevista em S3-W2-02 a S3-W2-07. |
| Participante | Recusado na Web. |

### 4.3 Mobile

| Item | Situação |
|---|---|
| Login e logout (`POST /auth/login`, `POST /auth/logout`) | [Existente] |
| **S3-MOB-02 — restauração segura da sessão** | **[Existente]** (PR #27): `tokenStorage.ts` grava o token com `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Ao abrir, o `AuthContext.restore()` chama `GET /auth/me`. Um **401** limpa a sessão local. **5xx, 408 ou 429** mantêm o token e oferecem nova tentativa (`SessionScreen`). Perfil diferente de Participante ou conta inativa fazem o app limpar a sessão local e revogar o token no servidor. As rotas protegidas (`Stack.Protected`) exigem `role = Participante` e `status = Ativo`. |
| Estudos e visitas do participante (RF17–RF18) | [Planejado] S3-MOB-03 a S3-MOB-05. Ainda não existe cliente HTTP para `/me/*`. A tela inicial mostra apenas os dados da conta. |

## 5. Decisões técnicas aprovadas — D-01 a D-13

A equipe **aprovou** as recomendações D-01 a D-12 da seção 13 da S3-PO-03. As marcações “pendente” dessas decisões na S3-PO-03 e na S3-PO-04 estão **superadas** por essa aprovação; D-13 foi aprovada e registrada nesta versão. A aprovação vale para a regra, mas a implementação continua **[Planejado]**.

| Decisão | Regra aprovada |
|---|---|
| D-01 | O Coordenador recebe **somente leitura** de X02 (`GET /studies/:studyId/visits`) e X03 (`GET /studies/:studyId/visits/:visitId/activities`) nos estados de A-EQUIPE-LEITURA, como parte de S3-BE-02/S3-W2-02. Não cadastra, não edita e não remove visitas previstas. |
| D-02 | As visitas agendadas usam `/studies/:studyId/scheduled-visits`. |
| D-03 | O Coordenador consulta em `recrutamento`, `execução` e `encerrado`, e escreve em `recrutamento` e `execução`. Escrita em estudo encerrado resulta em 400 “Não é possível alterar um estudo encerrado.” |
| D-04 | RF12, RF13 e RF16: Coordenador e Pesquisador proprietário. RF14: somente Pesquisador proprietário. RF15: ambos. RF17–RF18: Participante. |
| D-05 | `Agendada → Realizada \| Ausente \| Cancelada`. Os estados finais são imutáveis, e remarcar exige um novo agendamento. |
| D-06 | `scheduledAt` pode estar no passado, desde que esteja entre a inclusão do participante e o término do estudo. |
| D-07 | A retirada atualiza somente o status, a data e o motivo da participação. Não cancela visitas, não altera o contador de vagas e não muda o status de recrutamento. O histórico é preservado. |
| D-08 | Não existe correção de resultado. Um registro duplicado resulta em **409**. |
| D-09 | E09 lista participações `Ativo`, `Retirado` e `Concluído`, com `participationStatus`. |
| D-10 | Não existe vínculo Coordenador–estudo. O Coordenador acessa todos os estudos nos estados permitidos. |
| D-11 | As novas respostas usam ISO 8601 em UTC (`2026-11-20T12:00:00.000Z`) e as requisições, ISO 8601 com fuso. Os endpoints existentes mantêm o formato atual. |
| D-12 | As recusas de domínio de RF12–RF16 incluem o campo `code` (por exemplo, `VISIT_ALREADY_SCHEDULED`), que é distinto do `statusCode` HTTP. |
| D-13 | `America/Sao_Paulo` é o fuso oficial para regras de negócio que dependem de datas civis. Em E02, o dia de `scheduledAt` nesse fuso é comparado inclusivamente a `data_inclusao` e `data_fim`; em E03, `from` e `to` filtram inclusivamente por esse dia civil. Instantes continuam armazenados e retornados em UTC (D-11). |

**Itens não abrangidos por esta aprovação:**

- As contingências do Plano continuam **[Adiado]** (seção 15.3).
- A pendência **P-01** da S3-PO-03, que corresponde à L-01 da S3-PO-04 (preenchimento de `candidatos.id_usuario`), **continua em aberto** (seção 15.1).
- Os pontos A-01 e A-02 da S3-PO-04 foram representados conforme a orientação desta task: o Participante não acessa resultados, e o Coordenador consulta resultados sem registrá-los.

## 6. Diagrama geral de arquitetura

```mermaid
flowchart LR
    subgraph WEB["Aplicação Web — React + Vite"]
        direction TB
        WP["Pesquisador<br/>StudiesPage + telas de acompanhamento"]
        WC["Coordenador<br/>coordenatorPage — visitas, histórico e retirada"]
        WAPI["Clientes de API RF12–RF16<br/>S3-W1-02..04 · S3-W2-02..07"]
        WP --> WAPI
        WC --> WAPI
    end

    subgraph MOB["Aplicativo Mobile — React Native + Expo"]
        direction TB
        ML["LoginScreen / SessionScreen<br/>AuthContext"]
        MS["tokenStorage<br/>expo-secure-store"]
        MH["Telas de estudos e visitas<br/>S3-MOB-03..05"]
        ML <--> MS
        ML --> MH
    end

    subgraph API["API NestJS"]
        direction TB
        G1["AccessTokenGuard<br/>JWT + sessão + conta ativa"]
        G2["RolesGuard + @Roles"]
        PIPE["ParseUUIDPipe / ValidationPipe"]
        CA["AuthController<br/>/auth/login · /auth/me · /auth/logout"]
        CV["VisitsController — visitas previstas<br/>GET X02/X03"]
        CN["Controllers RF12–RF16<br/>/participants · /scheduled-visits"]
        CM["Controller de autoatendimento<br/>/me/studies · /me/visits"]
        SS["StudiesService<br/>propriedade e estado do estudo"]
        SN["Services RF12–RF16<br/>regras D-03..D-08 · erros com code D-12"]
        SI["Resolução da identidade<br/>candidatos.id_usuario = sub"]
        DBS["DatabaseService — pg"]
        G1 --> G2 --> PIPE
        PIPE --> CA
        PIPE --> CV
        PIPE --> CN
        PIPE --> CM
        CV --> SS
        CN --> SS
        CN --> SN
        CM --> SI
        SS --> DBS
        SN --> DBS
        SI --> DBS
        CA --> DBS
    end

    subgraph PG["PostgreSQL"]
        direction TB
        T1[("usuarios · sessoes")]
        T2[("estudos · visitas_previstas · atividades_visita")]
        T3[("candidatos · participacoes_estudo")]
        T4[("visitas · resultados_avaliacao")]
        T5[("solicitacoes_visita — RF19–RF20")]
    end

    WAPI -- "HTTPS JSON + Bearer" --> G1
    ML -- "POST /auth/login · GET /auth/me" --> G1
    MH -- "GET /me/studies · GET /me/visits" --> G1
    DBS --> T1
    DBS --> T2
    DBS --> T3
    DBS --> T4
    DBS -.-> T5

    classDef existente stroke:#2e7d32,stroke-width:2px
    classDef planejado stroke:#1565c0,stroke-width:2px,stroke-dasharray:6 4
    classDef adiado fill:#e0e0e0,stroke:#757575,color:#424242
    class WP,ML,MS,G1,G2,PIPE,CA,CV,SS,DBS,T1,T2,T3,T4 existente
    class WC,WAPI,MH,CN,CM,SN,SI planejado
    class T5 adiado
```

**Leitura do diagrama:**

- **[Existente]**:
  - autenticação, guards e pipes;
  - `AuthController` e `VisitsController` (com leitura restrita ao Pesquisador; a ampliação ao Coordenador é **[Planejado]**, D-01);
  - `StudiesService` e `DatabaseService`;
  - todas as tabelas;
  - login e sessão segura no Mobile.
- **[Planejado]**:
  - controllers e services de RF12–RF16;
  - controller `/me` e resolução da identidade;
  - telas Web de acompanhamento com dados da API;
  - telas Mobile de estudos e visitas.

  Os nomes dos controllers planejados são indicativos e serão definidos em S3-BE-02 a S3-BE-07.
- `T4` existe no schema, mas só será lido e gravado pelos services planejados.
- `solicitacoes_visita` existe no schema e não é usada na Sprint 3 (ligação tracejada).

## 7. Diagrama do modelo persistente

Tabelas reais (migrations 001, 003, 006–008, 011–014 e 016), sem tabelas ou colunas novas. Por legibilidade, são mostrados apenas os campos relevantes para RF12–RF18.

```mermaid
erDiagram
    usuarios ||--o{ estudos : "id_pesquisador"
    usuarios |o--o{ candidatos : "id_usuario (nullable)"
    estudos ||--o{ candidatos : "id_estudo"
    candidatos ||--o| participacoes_estudo : "id_candidato UNIQUE"
    estudos ||--o{ visitas_previstas : "id_estudo"
    visitas_previstas ||--o{ atividades_visita : "id_visita_prevista"
    participacoes_estudo ||--o{ visitas : "id_participacao"
    visitas_previstas ||--o{ visitas : "id_visita_prevista"
    visitas ||--o{ resultados_avaliacao : "id_visita (CASCADE)"
    atividades_visita ||--o{ resultados_avaliacao : "id_atividade"
    usuarios ||--o{ resultados_avaliacao : "id_registrado_por"
    visitas ||--o{ solicitacoes_visita : "id_visita (CASCADE)"
    usuarios ||--o{ solicitacoes_visita : "id_usuario"

    usuarios {
        uuid id_usuario PK
        varchar email UK
        varchar perfil "Administrador | Pesquisador | Coordenador | Participante"
        varchar status "Ativo | Inativo"
    }
    estudos {
        uuid id_estudo PK
        uuid id_pesquisador FK
        date data_inicio
        date data_fim
        varchar status "planejamento | recrutamento | execução | encerrado"
    }
    candidatos {
        uuid id_candidato PK
        uuid id_estudo FK
        uuid id_usuario FK "nullable, SET NULL, UNIQUE com id_estudo"
        varchar status_recrutamento
    }
    participacoes_estudo {
        uuid id_participacao PK
        uuid id_candidato FK "UNIQUE"
        date data_inclusao
        varchar status "Ativo | Retirado | Concluído"
        date data_retirada "obrigatória se Retirado"
        text motivo_retirada
    }
    visitas_previstas {
        uuid id_visita_prevista PK
        uuid id_estudo FK
        varchar nome
        int ordem "UNIQUE com id_estudo"
        int intervalo_dias
    }
    atividades_visita {
        uuid id_atividade PK
        uuid id_visita_prevista FK
        varchar nome
        varchar tipo
    }
    visitas {
        uuid id_visita PK
        uuid id_participacao FK
        uuid id_visita_prevista FK
        timestamptz data_agendada
        timestamptz data_realizacao "obrigatória se Realizada"
        varchar status "Agendada | Realizada | Ausente | Cancelada"
        text observacao
        timestamptz criado_em
    }
    resultados_avaliacao {
        uuid id_resultado PK
        uuid id_visita FK
        uuid id_atividade FK
        uuid id_registrado_por FK
        text valor_ficticio
        varchar unidade
        text observacao
        timestamptz registrado_em
    }
    solicitacoes_visita {
        uuid id_solicitacao PK
        uuid id_visita FK
        uuid id_usuario FK
        varchar tipo "Confirmação | Reagendamento"
        varchar status "Pendente | Aceita | Recusada | Cancelada"
    }
```

### 7.1 Visitas previstas × visitas agendadas

| Tabela | Significado | Quem grava | Endpoints |
|---|---|---|---|
| `visitas_previstas` + `atividades_visita` | **Protocolo** do estudo: quais visitas e atividades existem (RF06). | Pesquisador proprietário [Existente] | X02, X03 (leitura; o Coordenador lê por D-01) |
| `visitas` | **Agenda real** de cada participante: uma ocorrência de uma visita prevista para uma participação (RF12–RF13). | Coordenador / Pesquisador proprietário [Planejado] | E02, E03, E04, E10 |
| `resultados_avaliacao` | Resultado de **uma atividade prevista** dentro de **uma visita agendada** (RF14). | Pesquisador proprietário [Planejado] | E05, E06, E07 |

### 7.2 Constraints relevantes para os fluxos [Existente]

| Constraint / regra do schema | Efeito nos fluxos |
|---|---|
| `participacoes_retirada_coerente` | `Retirado` exige `data_retirada`; os demais estados exigem que ela seja nula (E08). |
| `participacoes_datas_validas` | `data_retirada >= data_inclusao` (E08). |
| `visitas_realizacao_coerente` | `Realizada` exige `data_realizacao` (E04). |
| `resultados_visita_atividade_unico` | Um resultado por visita e atividade. Um segundo registro resulta em 409 (E06, D-08). |
| `candidatos_estudo_usuario_unico` | Uma conta tem no máximo um candidato por estudo (E09/E10). |
| `participacoes_estudo.id_candidato UNIQUE` | No máximo uma participação por candidato. |
| **Ausente no schema** | Unicidade de participação + visita prevista em `visitas`. A verificação de duplicidade de E02 fica no service, com bloqueio em transação. |
| **Ausente no schema** | Garantia de que `visitas.id_visita_prevista` e `visitas.id_participacao` pertencem ao **mesmo estudo**. O service de E02 valida os dois vínculos. |

## 8. Sequência RF12–RF13 — agendamento e situação das visitas

Regras aplicadas: **D-01, D-02, D-03, D-04, D-05, D-06, D-11, D-12**. Todos os endpoints de RF12–RF13 estão **[Planejado]**. X02 e X03 existem, e a leitura pelo Coordenador é **[Planejado]** (D-01).

```mermaid
sequenceDiagram
    autonumber
    actor U as Coordenador ou Pesquisador proprietário
    participant Web as Aplicação Web
    participant API as API NestJS — guards + controllers
    participant SVC as Services — StudiesService e RF12–RF13
    participant DB as PostgreSQL

    U->>Web: Abre o acompanhamento do estudo
    Web->>API: GET /studies/:studyId/participants (E01)
    API->>SVC: AccessTokenGuard + RolesGuard + acesso ao estudo
    Note over SVC: Pesquisador deve ser proprietário. Coordenador em<br/>recrutamento, execução ou encerrado (D-03, D-10)
    SVC->>DB: participacoes_estudo JOIN candidatos WHERE id_estudo
    DB-->>Web: 200 Participant[]

    Web->>API: GET /studies/:studyId/visits (X02)
    Note over API: X02/X03 existentes. Leitura pelo Coordenador aprovada (D-01).<br/>Sem cadastro ou edição de visitas previstas pelo Coordenador
    API->>DB: visitas_previstas WHERE id_estudo ORDER BY ordem
    DB-->>Web: 200 PlannedVisit[]
    opt Exibir atividades da visita prevista
        Web->>API: GET /studies/:studyId/visits/:visitId/activities (X03)
        API->>DB: atividades_visita WHERE id_visita_prevista
        DB-->>Web: 200 VisitActivity[]
    end

    U->>Web: Seleciona participação, visita prevista e data/hora
    Web->>API: POST /studies/:studyId/scheduled-visits (E02)<br/>participationId, plannedVisitId, scheduledAt ISO com fuso (D-11)
    API->>SVC: Perfil Coordenador ou Pesquisador (D-04)
    alt Estudo encerrado
        SVC-->>Web: 400 code STUDY_CLOSED — Não é possível alterar um estudo encerrado.
    else Coordenador com estudo fora de recrutamento ou execução
        SVC-->>Web: 403
    else Participação ou visita prevista de outro estudo
        SVC-->>Web: 404 Participante ou Visita prevista não encontrada neste estudo
    else Participação não Ativo
        SVC-->>Web: 400 code PARTICIPATION_NOT_ACTIVE
    else dia civil de scheduledAt em Brasília fora de inclusão até término do estudo (D-06, D-13)
        SVC-->>Web: 400 code SCHEDULE_OUT_OF_RANGE
    else Válido
        SVC->>DB: BEGIN + SELECT participação FOR UPDATE
        SVC->>DB: Existe visita Agendada ou Realizada para participação + visita prevista?
        alt Já existe
            SVC-->>Web: 409 code VISIT_ALREADY_SCHEDULED
        else Não existe
            SVC->>DB: INSERT INTO visitas status Agendada + COMMIT
            DB-->>SVC: id_visita
            SVC-->>Web: 201 ScheduledVisit — datas ISO 8601 UTC (D-11)
        end
    end

    Web->>API: GET /studies/:studyId/scheduled-visits?participationId=... (E03)
    API->>DB: visitas JOIN visitas_previstas WHERE id_estudo ORDER BY data_agendada
    DB-->>Web: 200 ScheduledVisit[]

    U->>Web: Registra o resultado da visita: Realizada, Ausente ou Cancelada
    Web->>API: PATCH /studies/:studyId/scheduled-visits/:id/status (E04)
    API->>SVC: Mesmo acesso de escrita (D-03, D-04)
    alt Visita não pertence ao estudo
        SVC-->>Web: 404 Visita agendada não encontrada neste estudo.
    else Situação atual diferente de Agendada (D-05)
        SVC-->>Web: 400 code VISIT_STATUS_FINAL
    else Realizada sem realizedAt, ou realizedAt futuro ou anterior à inclusão
        SVC-->>Web: 400 code REALIZED_AT_INVALID
    else Transição válida
        SVC->>DB: UPDATE visitas SET status, data_realizacao, observacao<br/>WHERE id_visita AND status = Agendada
        SVC-->>Web: 200 ScheduledVisit atualizado
    end
    Note over Web,DB: Para remarcar, cria-se um NOVO agendamento (E02).<br/>A visita finalizada não é alterada (D-05)
```

### 8.1 Transições da situação da visita (D-05)

```mermaid
flowchart LR
    N(("E02")) -->|"INSERT"| A["Agendada"]
    A -->|"E04"| R["Realizada<br/>exige realizedAt"]
    A -->|"E04"| AU["Ausente"]
    A -->|"E04"| C["Cancelada"]
    AU -.->|"remarcação = novo E02"| N
    C -.->|"remarcação = novo E02"| N
    classDef final fill:#eeeeee,stroke:#616161
    class R,AU,C final
```

`Realizada`, `Ausente` e `Cancelada` são finais. Uma nova tentativa de E04 sobre elas resulta em 400 `VISIT_STATUS_FINAL`. Depois de `Realizada`, o mesmo par participação + visita prevista não pode ser agendado de novo (409).

## 9. Sequência RF14 — registro de resultados

Regras aplicadas: **D-04** (somente o Pesquisador proprietário registra), **D-08**, **D-11** e **D-12**. E05 e E06 estão **[Planejado]**.

```mermaid
sequenceDiagram
    autonumber
    actor P as Pesquisador proprietário
    actor C as Coordenador
    participant Web as Aplicação Web
    participant API as API NestJS — guards + controllers
    participant SVC as Services — RF14
    participant DB as PostgreSQL

    P->>Web: Abre uma visita agendada do estudo
    Web->>API: GET /studies/:studyId/scheduled-visits/:id/results (E05)
    API->>SVC: Leitura — Pesquisador proprietário ou Coordenador (D-03)
    SVC->>DB: atividades_visita da visita prevista LEFT JOIN resultados_avaliacao
    DB-->>Web: 200 activities[] com result ou null

    P->>Web: Preenche valor fictício, unidade e observação
    Web->>API: POST /studies/:studyId/scheduled-visits/:id/results (E06)
    API->>API: RolesGuard — somente Pesquisador (D-04)
    API->>SVC: Verifica propriedade do estudo e estudo não encerrado
    alt Estudo de outro pesquisador
        SVC-->>Web: 403 Você não tem permissão para alterar este estudo.
    else Estudo encerrado
        SVC-->>Web: 400 code STUDY_CLOSED
    else Visita agendada não pertence ao estudo
        SVC-->>Web: 404 Visita agendada não encontrada neste estudo.
    else Visita não está Realizada
        SVC-->>Web: 400 code VISIT_NOT_REALIZED
    else Atividade não pertence à visita prevista da visita
        SVC-->>Web: 400 code ACTIVITY_NOT_IN_VISIT
    else Válido
        SVC->>DB: INSERT INTO resultados_avaliacao<br/>id_registrado_por = request.user.sub
        alt Viola resultados_visita_atividade_unico (D-08)
            DB-->>SVC: unique_violation
            SVC-->>Web: 409 code RESULT_ALREADY_REGISTERED
        else Inserido
            DB-->>SVC: id_resultado, registrado_em
            SVC-->>Web: 201 AssessmentResult — registeredAt ISO 8601 UTC
        end
    end

    C->>Web: Consulta os resultados da visita
    Web->>API: GET .../results (E05)
    API-->>Web: 200 — o Coordenador consulta
    C-->>Web: Tentativa de registrar resultado
    Web->>API: POST .../results (E06)
    API-->>Web: 403 Seu perfil não tem permissão para este recurso.
    Note over Web,DB: Não existe PATCH de resultado nesta sprint (D-08)
```

## 10. Sequência RF15 — histórico do participante

Regras aplicadas: **D-03**, **D-04** e **D-11**. E07 está **[Planejado]**.

```mermaid
sequenceDiagram
    autonumber
    actor U as Pesquisador proprietário ou Coordenador
    participant Web as Aplicação Web
    participant API as API NestJS — guards + controllers
    participant SVC as Services — RF15
    participant DB as PostgreSQL

    U->>Web: Seleciona uma participação (lista de E01)
    Web->>API: GET /studies/:studyId/participants/:participationId/history (E07)
    API->>SVC: AccessTokenGuard + RolesGuard (Pesquisador, Coordenador)
    alt Pesquisador não proprietário
        SVC-->>Web: 403
    else Coordenador com estudo em planejamento (D-03)
        SVC-->>Web: 403
    else Participação não pertence ao estudo
        SVC-->>Web: 404 Participante não encontrado neste estudo.
    else Autorizado — inclusive estudo encerrado (consulta)
        SVC->>DB: participacoes_estudo JOIN candidatos (dados da participação)
        SVC->>DB: visitas JOIN visitas_previstas WHERE id_participacao<br/>ORDER BY data_agendada ASC
        SVC->>DB: resultados_avaliacao JOIN atividades_visita<br/>WHERE id_visita IN (visitas da participação)
        DB-->>SVC: Linhas de participação, visitas e resultados
        SVC->>SVC: Agrupa os resultados por visita, em ordem cronológica
        SVC-->>Web: 200 participant + visits[] com results[] (visits [] se vazio)
    end
```

## 11. Sequência RF16 — retirada do participante

Regras aplicadas: **D-03**, **D-04**, **D-07**, **D-11** e **D-12**. E08 está **[Planejado]**.

```mermaid
sequenceDiagram
    autonumber
    actor U as Coordenador ou Pesquisador proprietário
    participant Web as Aplicação Web
    participant API as API NestJS — guards + controllers
    participant SVC as Services — RF16
    participant DB as PostgreSQL

    U->>Web: Seleciona a participação e informa data e motivo
    Web->>API: POST /studies/:studyId/participants/:participationId/withdrawal (E08)
    API->>SVC: Perfil Coordenador ou Pesquisador (D-04)
    alt Estudo encerrado
        SVC-->>Web: 400 code STUDY_CLOSED
    else Sem acesso de escrita ao estudo (D-03 ou propriedade)
        SVC-->>Web: 403
    else Participação não pertence ao estudo
        SVC-->>Web: 404 Participante não encontrado neste estudo.
    else Data anterior à inclusão ou futura
        SVC-->>Web: 400 code WITHDRAWAL_DATE_INVALID
    else Válido
        SVC->>DB: UPDATE participacoes_estudo<br/>SET status = Retirado, data_retirada, motivo_retirada<br/>WHERE id_participacao AND status = Ativo
        alt Nenhuma linha atualizada — participação já Retirado ou Concluído
            SVC-->>Web: 400 code PARTICIPATION_NOT_ACTIVE
        else Atualizada
            DB-->>SVC: Participação atualizada
            SVC-->>Web: 201 Participant — participationStatus Retirado
        end
    end
    Note over SVC,DB: D-07 — nenhuma outra tabela é alterada. visitas e resultados_avaliacao<br/>são preservados. Não há cancelamento de visitas agendadas,<br/>não há alteração de estudos.participantes_vinculados<br/>e não há alteração de candidatos.status_recrutamento
```

## 12. Sequência RF17–RF18 — identificação e acompanhamento pelo Mobile

Regras aplicadas: **D-09**, **D-11** e a identificação da S3-PO-04 (seção 9).

- **[Existente]:** login, `tokenStorage`, restauração com `GET /auth/me` e as guardas de rota (S3-MOB-02).
- **[Planejado]:** E09 e E10, no backend (S3-BE-07) e no app (S3-MOB-03 a S3-MOB-05).

```mermaid
sequenceDiagram
    autonumber
    actor PT as Participante
    participant App as Aplicativo Mobile — AuthContext
    participant SEC as tokenStorage — expo-secure-store
    participant API as API NestJS — guards + controllers
    participant ID as Resolução da identidade
    participant DB as PostgreSQL

    rect rgb(232, 245, 233)
    Note over PT,DB: [Existente] Login e sessão segura (S3-MOB-02)
    PT->>App: E-mail e senha
    App->>API: POST /auth/login
    API->>DB: Valida credenciais e cria sessão (sessoes)
    API-->>App: 201 accessToken + user
    alt user.role diferente de Participante ou conta inativa
        App->>API: POST /auth/logout (revoga o token emitido)
        App-->>PT: Este aplicativo é destinado ao perfil Participante.
    else Participante ativo
        App->>SEC: save(accessToken) — WHEN_UNLOCKED_THIS_DEVICE_ONLY
        App-->>PT: Telas protegidas liberadas
    end

    Note over PT,DB: Ao reabrir o aplicativo
    App->>SEC: read()
    SEC-->>App: token ou vazio
    App->>API: GET /auth/me (X01) — Bearer token
    API->>DB: Sessão ativa (jti) e conta Ativo
    alt 401 — token expirado, inválido ou sessão revogada
        API-->>App: 401
        App->>SEC: clear()
        App-->>PT: Sua sessão expirou ou não está mais disponível. Entre novamente.
    else 5xx, 408 ou 429
        API-->>App: Falha temporária
        App-->>PT: Não foi possível verificar sua sessão — tentar novamente (token mantido)
    else 200 Participante ativo
        API-->>App: Usuário público
        App-->>PT: Telas protegidas liberadas
    end
    end

    rect rgb(227, 242, 253)
    Note over PT,DB: [Planejado] RF17 — estudos do participante (E09, D-09)
    App->>API: GET /me/studies — Bearer token, sem identificadores
    API->>API: AccessTokenGuard + RolesGuard — somente Participante
    API->>ID: request.user.sub
    ID->>DB: candidatos c JOIN participacoes_estudo p JOIN estudos e<br/>WHERE c.id_usuario = sub
    DB-->>ID: Participações Ativo, Retirado e Concluído
    ID-->>App: 200 ParticipantStudy[] com participationStatus (ou [])

    Note over PT,DB: [Planejado] RF18 — próximas visitas e histórico (E10)
    App->>API: GET /me/visits?scope=upcoming|history[&studyId]
    API->>ID: request.user.sub
    alt studyId sem participação do usuário
        ID-->>App: 404 Estudo não encontrado entre as suas participações.
    else Envio de participationId, candidateId ou userId
        API-->>App: 400 — parâmetro não permitido
    else Válido
        ID->>DB: visitas JOIN participacoes_estudo JOIN candidatos JOIN visitas_previstas<br/>WHERE c.id_usuario = sub e escopo
        DB-->>ID: Somente visitas próprias
        ID-->>App: 200 ParticipantVisit[] — sem resultados e sem observações internas
    end
    end
```

**Observações do fluxo Mobile:**

- A identidade vem **exclusivamente** de `request.user.sub`. A condição `c.id_usuario = sub` faz parte do SQL e não é um filtro aplicado em memória.
- `upcoming` retorna visitas `Agendada` em ordem crescente; `history` retorna `Realizada`, `Ausente` e `Cancelada` em ordem decrescente.
- O Participante **não recebe** `resultados_avaliacao`, `visitas.observacao`, e-mail ou dados de terceiros.
- **Dependência L-01 / P-01:** como `candidatos.id_usuario` não é preenchido pelo cadastro atual, os passos de E09/E10 retornam `[]` para participantes reais até que o vínculo exista (seção 15.1).

## 13. Fluxos alternativos e respostas de erro

| Cenário | Endpoints | HTTP | `code` (D-12) | Origem |
|---|---|---|---|---|
| Token ausente | todos | 401 | — | `AccessTokenGuard` [Existente] |
| Token inválido, expirado ou sessão revogada | todos | 401 | — | `AccessTokenGuard` [Existente] |
| Conta inativa | todos | 401 | — | `AccessTokenGuard` [Existente] |
| Perfil sem permissão (ex.: Participante em `/studies`, Coordenador em E06, equipe em `/me`) | todos | 403 | — | `RolesGuard` [Existente] |
| Pesquisador não proprietário | E01–E08 | 403 | — | Service (padrão de `StudiesService`) |
| Coordenador fora dos estados de D-03 | E01–E08, X02, X03 | 403 | — | Service [Planejado] |
| Estudo encerrado em escrita | E02, E04, E06, E08 | 400 | `STUDY_CLOSED` | Service [Planejado] |
| Estudo inexistente | E01–E08, X02, X03 | 404 | — | Service |
| Recurso de outro estudo (participação, visita, visita prevista) | E02–E08 | 404 | — | Service [Planejado] |
| Participação inexistente | E02, E07, E08 | 404 | — | Service [Planejado] |
| Participação retirada ou concluída | E02, E04, E08 | 400 | `PARTICIPATION_NOT_ACTIVE` | Service [Planejado] |
| Data de agendamento fora do período | E02 | 400 | `SCHEDULE_OUT_OF_RANGE` | D-06 |
| Agendamento duplicado | E02 | 409 | `VISIT_ALREADY_SCHEDULED` | Service + lock |
| Transição inválida | E04 | 400 | `VISIT_STATUS_FINAL` | D-05 |
| Data de realização inválida | E04 | 400 | `REALIZED_AT_INVALID` | Service |
| Resultado em visita não realizada | E06 | 400 | `VISIT_NOT_REALIZED` | Service |
| Atividade fora da visita prevista | E06 | 400 | `ACTIVITY_NOT_IN_VISIT` | Service |
| Resultado duplicado | E06 | 409 | `RESULT_ALREADY_REGISTERED` | `resultados_visita_atividade_unico` (D-08) |
| Data de retirada inválida | E08 | 400 | `WITHDRAWAL_DATE_INVALID` | `participacoes_datas_validas` + service |
| Participante sem vínculo de candidato | E09, E10 | 200 `[]` | — | S3-PO-04 |
| `studyId` sem participação do usuário | E10 | 404 | — | S3-PO-04 |
| Identificador de pessoa enviado em `/me` | E09, E10 | 400 | — | `ValidationPipe` (`forbidNonWhitelisted`) |
| Corpo ou UUID inválido | todos | 400 | — | `ParseUUIDPipe` / `ValidationPipe` [Existente] |
| Falha de persistência ou erro inesperado | todos | 500 | — | NestJS. A transação é desfeita e o cliente exibe mensagem genérica. No Mobile, o token é mantido e a ação pode ser repetida |

Formato de erro (padrão NestJS + `code` de D-12):

```json
{ "statusCode": 409, "message": "Esta visita prevista já está agendada ou realizada para o participante.", "error": "Conflict", "code": "VISIT_ALREADY_SCHEDULED" }
```

## 14. Alterações estruturais necessárias

**Nenhuma alteração estrutural no modelo persistente foi identificada como necessária para representar os fluxos de RF12–RF18. Os contratos deverão reutilizar as estruturas existentes.**

Fundamentação:

- `visitas` já contém participação, visita prevista, data agendada, data de realização, situação e observação (RF12–RF13).
- `resultados_avaliacao` já contém valor fictício, unidade, observação, autor e unicidade por visita e atividade (RF14, D-08).
- `participacoes_estudo` já contém status `Retirado`, `data_retirada` e `motivo_retirada`, com constraints de coerência (RF16, D-07).
- `candidatos.id_usuario` já permite a identificação do participante (RF17–RF18).
- As duas regras sem constraint no banco — duplicidade de agendamento e mesmo estudo entre participação e visita prevista — são garantidas no service, em transação, sem necessidade de migration.

## 15. Limitações e observações

### 15.1 Vínculo conta–participante (continua aberto)

| Aspecto | Situação |
|---|---|
| Coluna `candidatos.id_usuario` | Existe no schema. |
| Preenchimento | **Nenhum código, seed ou teste o preenche.** O cadastro de candidatos grava apenas o estudo, o nome e o e-mail. |
| Efeito | Os diagramas da seção 12 estão corretos e seguros, mas E09/E10 retornam `[]` para participantes reais. |
| O que **não** fazer | Associar por nome ou e-mail, ou aceitar identificador do Mobile. |
| Encaminhamento | A correção completa (S3C-PBI01) está **[Adiado]** para a Sprint 4. A decisão sobre usar fixtures e seed com o vínculo para testes e demonstração na Sprint 3 continua pendente (P-01). |

### 15.2 Outras observações

- Não existe vínculo Coordenador–estudo (D-10). O diagrama não representa tabela de relacionamento.
- `solicitacoes_visita` aparece apenas como estrutura existente para RF19–RF20 (Sprint 4). Nenhum fluxo desta sprint a lê ou grava.
- A tabela `auditoria` existe, mas não participa dos fluxos (auditoria adiada).
- Na Web, a sessão e o tratamento de 401 seguem o `AuthContext` existente. As telas do Coordenador com dados fixos serão substituídas por E01–E08 (S3-W2-07).

### 15.3 Contingências mantidas como [Adiado]

| Proposta | Situação |
|---|---|
| Consulta de contas Participante pelo Coordenador e vínculo no cadastro (S3C-BE-01, S3C-BE-02, S3C-W2-01, S3C-W1-01) | Adiado |
| Edição de visitas previstas e atividades (S3C-BE-04, S3C-W1-03) | Adiado. D-01 aprova **somente leitura**. |
| Termo de consentimento do participante (S3C-PBI04) | Adiado |
| Auditoria das operações (S3C-BE-06) | Adiado |
| Dados demonstrativos (**S3C-MOB-02**) | Adiado. Diferente de **S3-MOB-02**, já implementada. |

## 16. Histórico de versões

| Versão | Data | Autor | Descrição |
|---|---|---|---|
| 1.0 | 16/11/2026 | Zeton (S3-PO-05) | Diagramas de arquitetura (flowchart), modelo persistente (erDiagram), transições de visita e sequências de RF12–RF18 com as decisões D-01 a D-12 aprovadas, a S3-MOB-02 implementada (PR #27) e as limitações em aberto. |
| 1.1 | 20/11/2026 | Equipe | Registrada D-13: `America/Sao_Paulo` como referência para comparações por dia civil em E02 e E03; instantes continuam persistidos e retornados em UTC conforme D-11. |
