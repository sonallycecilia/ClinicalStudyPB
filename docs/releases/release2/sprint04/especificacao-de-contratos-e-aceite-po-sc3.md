# ClinicalStudyPB — Especificação de Contartos e Aceite da SC3

**Release 2 · execução na Sprint 4 · responsável: Letícia · 3h previstas.** Liberação de contrato para o vínculo entre candidato e conta. Sem esse vínculo, a inclusão feita na web pode ocupar uma vaga enquanto o aplicativo do participante continua sem localizar o estudo.

> **Versão: 1.1**
**Status: Em revisão** (este documento ainda pode ser contestado e alterado mediante conflitos com regras omitidas)

---

| Task no Azure Boards | Pai | Prioridade da task | Entrega |
|---|---|---|---|
| S3C-PO-01 · 2h | S3C-PBI07 | 1 | Contratos corretivos, registro de decisões e critérios de regressão |
| S3C-PO-02 · 1h | S3C-PBI04 | 1 | Texto do termo simulado, regras de apresentação e contrato de aceite |

---

## Ata e contratos corretivos

<!-- SC3-PO-01-->

A numeração abaixo é uma proposta de correspondência do PO atual ([Letícia](https://github.com/daCruzZzLeticia)). 

> **OBS:** D1-10 são as decisões tomadas para os problemas encontrados entre a srpint 2 e 3. Originalmente, a decisão seria em conjunto na week meeting (14/11). Tendo em vista adversidades e falta de tempo para reunião extra entre os dias 22 a 27, é sugerido a Ata abaixo.


#### a. Ata de decisões · D01–D10

As deliberações abaixo orientam a execução da contingência da Sprint 3 na Sprint 4.

> Enquanto estiver em revisão, qualquer outro papel pode conferir as decisões, aprovando-as ou não. [Abrir chamado de contestação (issue)](https://github.com/sonallycecilia/ClinicalStudyPB/issues).


| Item | Tema | Deliberação |
|---|---|---|
| D01 | Abrangência do termo | O participante aceita o termo de cada estudo em que foi incluído. |
| D02 | Canal do termo | O participante consulta e aceita o termo exclusivamente no aplicativo Mobile. |
| D03 | Associação da conta | O Coordenador seleciona uma conta existente de Participante. O seletor mostra nome e e-mail completo, ambos somente leitura. A criação da conta cabe ao Administrador. |
| D04 | Operações auditadas | Registrar somente operações de mudança de situação, abrangendo transição de estado do estudo, inclusão, agendamento, mudança de situação da visita, registro de resultado e retirada. |
| D05 | Conteúdo da auditoria | Usar os campos atuais da tabela para autor, ação, entidade, identificador, data e hora e detalhes com os estados anterior e novo. O evento identifica o autor por ID e omite nome, e-mail, IP e dados do cliente. |
| D06 | Recrutamento e participação | Manter separados o estado de recrutamento do candidato e o estado da participação. A interface obtém “Retirado” do registro de participação. |
| D07 | Priorização da sprint | Item descartado. O planejamento da Sprint 4 já definiu o escopo e as prioridades. |
| D08 | Dados complementares | O fluxo após o aceite dispensa coleta de dados complementares, como data de nascimento e escolaridade. |
| D09 | Visita prevista com agendamento | Permitir edição somente de nome, intervalo e descrição. Bloquear alterações de ordem e de atividades nessa visita. Preservar os agendamentos e o histórico existentes. |
| D10 | Candidatos legados sem conta | Manter os cadastros existentes como legado. Nas novas etapas que dependem de conta, permitir somente consulta. Esses cadastros ficam fora de RF17–RF18. |

---

#### b. Vínculo entre candidato, conta e estudo

O Administrador cria e ativa a conta de Participante em RF01. Durante o cadastro de um novo candidato em RF08, o Coordenador identifica a conta pelo nome e pelo e-mail e seleciona seu identificador. O servidor verifica se a conta está ativa, se tem o perfil Participante e se o Coordenador pode atuar naquele estudo. A seleção associa a conta ao candidato sem alterar o cadastro do usuário.

O estudo passa a constar no aplicativo da conta vinculada após a inclusão por RF11. O aplicativo usa a sessão autenticada para consultar estudos e visitas. Para candidatos antigos sem vínculo, aplica-se D10. A equipe preserva os registros sem migrá-los nem associá-los por nome ou e-mail.

---

#### c. Contratos de integração

O plano identifica os caminhos `GET /studies/:id/visits` e `/me/consents`. Os demais caminhos, campos ilustrativos e códigos HTTP abaixo são propostas para conferência com os controladores e o Swagger. Os exemplos usam IDs fictícios e mostram somente os campos relevantes à correção. Todas as operações exigem sessão válida (401 se ausente ou expirada).

| Operação e perfil | Exemplo de entrada | Sucesso esperado | Erros a tratar |
|---|---|---|---|
| POST /users · administrador | {"nome":"Ana Demo","email":"ana@example.test","perfil":"Participante"} | 201, conta criada com identificador 21 | 403 para outro perfil, 409 para e-mail já usado |
| GET /users/eligible-participants · coordenador | Sem corpo | 200, lista de contas ativas elegíveis. A API retorna o identificador da conta, o nome e o e-mail completo. O seletor exibe nome e e-mail em modo somente leitura. Lista vazia retorna [] | 403 para perfil sem permissão |
| POST /studies/7/candidates · coordenador do estudo | {"id_usuario":21} além dos campos atuais de RF08 | 201, candidato persistido com estudo 7 e conta 21, conforme o contrato de associação aprovado em D03 | 422 para vínculo ausente, conta inexistente, inativa ou de outro perfil. 403 fora do estudo |
| GET /studies/7/visits · pesquisador ou coordenador autorizado | Sem corpo | 200, visitas previstas com IDs e atividades para seleção em RF12 | 403 para coordenador de outro estudo |
| PATCH /studies/7/visits/31 · pesquisador responsável | {"nome":"Retorno de acompanhamento"} | 200, visita 31 atualizada. Se já houver agendamentos, somente campos descritivos (nome, intervalo e descrição) podem ser alterados; a ordem fica bloqueada, conforme D09. Atividades e agendamentos anteriores continuam vinculados | 403 para coordenador, 404 para visita alheia ao estudo 7, 422 para valor inválido ou campo não permitido |
| POST /studies/7/visits/31/activities · pesquisador responsável | {"nome":"Questionário simulado"} | 201, atividade adicionada à visita sem agendamentos e visível após recarga, junto às anteriores | 403 sem permissão, 404 para visita fora do estudo, 422 para nome vazio ou visita já agendada |

Exemplo de erro de negócio proposto para RF08: `{"codigo":"CONTA_PARTICIPANTE_INVALIDA","mensagem":"Selecione uma conta de participante ativa.","campo":"id_usuario"}`. A web mantém o formulário preenchido para correção. O servidor rejeita o mesmo pedido quando enviado diretamente à API.

---

#### d. Roteiro de aceite para QA e PO

Usar contas e estudos fictícios. Registrar requisito, cenário, responsável, resultado observado e evidência da execução na matriz de QA.

| Cenário | Ação e resultado esperado |
|---|---|
| D03 · Cadastro e inclusão | Selecionar uma conta ativa com nome e e-mail visíveis e somente leitura. Cadastrar, avaliar, registrar o consentimento RF10 e incluir pela RF11 na última vaga. A inclusão consome uma vaga e mantém o vínculo com a conta selecionada. |
| RF08–RF11 · Bloqueios | Tentar cadastrar sem vínculo ou incluir candidato inelegível, sem RF10, sem vaga ou em estudo encerrado. Em cada tentativa, conferir a rejeição e a preservação das vagas e do estado anterior. |
| RF06/RF12 · Permissões | O Coordenador lê o protocolo do próprio estudo e agenda para participante incluído. A API recusa edição do protocolo pelo Coordenador e acesso a estudo alheio. |
| D09 · Edição | Em visita já agendada, alterar nome, intervalo e descrição e conferir os dados após recarga. Tentar reordenar a visita ou alterar suas atividades. A API recusa essas operações e preserva agenda e histórico. |
| D04–D05 · Auditoria | Conferir um evento por mudança de situação, com os campos definidos em D05. Uma edição puramente descritiva não gera evento. Simular falha na gravação do evento e verificar que a transição também foi revertida. |
| D06 · Retirada | Retirar uma participação ativa. A participação passa a Retirado e o estado de recrutamento do candidato continua Incluído. |
| D10 · Legado | Consultar candidato antigo sem conta e tentar avançar em etapa que exige vínculo. O cadastro continua consultável, a operação é bloqueada e o candidato não aparece no aplicativo de outro participante. |
| RF17–RF18 · Isolamento | Alternar entre duas contas no mesmo aparelho. Cada pessoa vê somente seus estudos e visitas. Conferir se as identidades usadas no Figma, nos mocks e no seed correspondem ao roteiro. |

---

## Termo simulado de primeiro acesso

<!-- SC3-PO-02-->

RF10 registra o consentimento durante o recrutamento na Web e é pré-condição para inclusão por RF11. Depois da inclusão, o participante acessa o aplicativo e confirma a leitura do termo simulado daquele estudo. Adiar a leitura mantém o acesso ao conteúdo do estudo pendente e preserva a inclusão e o registro de RF10. Após o aceite, o aplicativo libera o estudo diretamente, sem solicitar dados complementares.

#### a. Texto proposto para a tela

> **Termo simulado de acesso ao estudo — [nome do estudo]**  
> Versão [1.0]  
> O ClinicalStudyPB é um projeto acadêmico que utiliza dados fictícios. Neste aplicativo, você pode consultar sua participação e acompanhar suas visitas ao estudo [nome do estudo]. Ao selecionar “Li e aceito”, você confirma que leu esta versão do termo simulado. O sistema registra sua confirmação, o estudo, a versão e o momento do aceite. Se preferir decidir depois, você poderá retornar a esta tela no próximo acesso.

**Ações:** “Li e aceito” e “Agora não”. Na recusa, exibir “O acesso a este estudo continua pendente. Você pode ler o termo novamente quando quiser.” Disponibilizar retorno à seleção de estudos ou saída da conta.

> Ação "Agora não" pode ser contestada.

#### b. Consulta, gravação e retorno

| Operação · participante autenticado | Solicitação proposta | Resposta proposta |
|---|---|---|
| GET /me/consents?estudo_id=7 | Consultar o estado do termo antes de abrir o conteúdo do estudo | 200 com estudo, versão vigente, texto e estado pendente ou aceito. Quando aceito, retornar também o instante confirmado |
| POST /me/consents | {"estudo_id":7,"versao":"1.0"} | 201 no primeiro aceite. Exemplo: {"estudo_id":7,"versao":"1.0","estado":"aceito","aceito_em":"2026-11-26T12:00:00Z"}. Reenvio retorna 200 com o registro e instante originais |

O servidor identifica a pessoa pela sessão, verifica sua inclusão no estudo e atribui o instante. A combinação conta, estudo e versão identifica um único aceite, inclusive em envios simultâneos. Para ambas as operações, sessão expirada retorna 401 e estudo sem vínculo retorna 403. No envio, versão ausente retorna 422. Se o termo mudou durante a leitura, a proposta é retornar 409 e apresentar a versão vigente para nova leitura.

| Caso de aceite | Comportamento esperado |
|---|---|
| Primeiro acesso, sem aceite | Mostrar nome do estudo, texto, versão e ações. Manter o conteúdo desse estudo bloqueado. |
| Recusa seguida de novo login | Manter pendente. Reapresentar o termo, sem registrar aceite nem retirada. |
| Aceite seguido de novo login | Liberar o estudo após confirmação do servidor. No retorno, abrir diretamente o conteúdo para a mesma versão. |
| Toque duplo ou resposta perdida | Consultar novamente o estado. Se o servidor já gravou, recuperar o mesmo aceite. Se continuar pendente, permitir nova tentativa. |
| Falha de rede na consulta | Exibir “Não foi possível verificar seu aceite” e a ação “Tentar novamente”. Liberar o conteúdo após a verificação. |
| Nova versão, outro estudo ou troca de conta | Consultar o termo aplicável à combinação atual. Um aceite anterior só vale para sua conta, estudo e versão. |

**Validação prevista.** S3C-BE-05 cobre persistência e reenvio. S3C-MOB-01 cobre apresentação, bloqueio e retorno. S4-MOB-06 e S4-QA-03 cobrem componente e integração. Para verificar D01, usar uma conta incluída em dois estudos, aceitar o primeiro termo e conferir que o segundo continua pendente.


