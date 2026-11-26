# ClinicalStudyPB · Release 2 | Documento oficial de planejamento da Sprint 4

**Período:** 24/11 a 07/12/2026 · **Responsável pelo registro:** Letícia · **Estado:** planejado, aguardando execução. Documento destinado a `releases/release2/README.md`. As horas são estimativas. Resultados, links de execução e aceite serão preenchidos no fechamento.

## 1. Objetivo e escopo da sprint

Entregar o ciclo completo em que o Admin cria uma conta Participante, o coordenador vincula e inclui o candidato, o participante consulta e responde à visita no app, e o coordenador acompanha e processa seus pedidos na web. Pesquisador e coordenador consultam o progresso por estudo no painel e no relatório. Todos usam a mesma API NestJS e o mesmo PostgreSQL, com dados fictícios.

A Release 2 abrange a S3 (10–23/11, RF12–RF18 e login mobile) e a S4 (24/11–07/12, RF19–RF22 e integração). A S4 preserva RF01–RF11, testa os fluxos herdados e incorpora os sete PBIs S3C. P11 tem tratamento explícito no registro de decisões: o anexo descartou o pedido de campos complementares. A Fase 0 publica essa decisão (D08). D07 foi descartada porque o planejamento já definiu as prioridades. Se a professora solicitar implementação, o PO detalha campos, validações e impacto, reestima e registra a troca de escopo antes de assumir o trabalho.

## 2. Equipe, papéis e capacidade refatorada

| Integrante | Responsabilidade | Entrega, integração, testes e documentação | Sincronização | Review e retrospectiva | Reserva interna | Total |
|---|---|---:|---:|---:|---:|---:|
| Letícia | Líder técnica / gerente e PO; contratos, decisão dos pedidos e release | 36 | 1 | 1 | 2 | 40 |
| Lethycia | Backend; regras, persistência, autorização e testes da API | 36 | 1 | 1 | 2 | 40 |
| Sonally | Web 1; Admin, protocolo, visitas e regressão | 36 | 1 | 1 | 2 | 40 |
| Marcella | Web 2; recrutamento, painel, pedidos e relatório | 36 | 1 | 1 | 2 | 40 |
| Laryssa | Mobile; termo, sessão e ações do participante | 36 | 1 | 1 | 2 | 40 |
| Zeton | QA/DevOps; CI, E2E, cobertura e rastreabilidade | 36 | 1 | 1 | 2 | 40 |
| **Equipe (h)** | **10 dias úteis × 4h/dia × 6** | **216** | **6** | **6** | **12** | **240** |

**Viabilidade condicionada.** Há 228h de tasks e 12h de reserva. Das 216h de entrega, 39h cobrem a estimativa original dos sete PBIs S3C e 177h cobrem requisitos nativos, integração, testes e documentação. As 12h de reuniões já estão incluídas nas 228h.

O compromisso cabe se RF12–RF18, login, migrações e ambiente de testes puderem ser reaproveitados. As 36h técnicas de Lethycia já estão ocupadas; por isso Letícia assume 6h de implementação da consulta/decisão dos pedidos. A capacidade de Web 1 financia integração e regressão do caminho crítico. Se a proteção dos cadastros legados falhar ou o emulador não executar a build na Fase 0, reestimar no mesmo dia. Um excesso de 4h no backend, por exemplo, supera em 2h a reserva individual: delegar trabalho compatível com saldo real ou trocar uma atividade de menor impacto com aprovação do PO. A soma global de horas não elimina esse gargalo.

**Regra para contingência.** Manter as 12h dentro do teto, inicialmente livres de tasks. Ao surgir um incidente, identificar pessoa, PBI, defeito, estimativa e saldo; criar ou reestimar a task e descontar o mesmo valor da reserva disponível. Saldo ocioso expira no fechamento. Não lançar reserva externa nem consumir horas com tarefa fictícia. Se houver excesso, revisar primeiro polimento visual e refinamentos acessórios; preservar vínculo, controle de acesso, RF19–RF22, E2E, cobertura e evidências. Se esses critérios não couberem, registrar entrega parcial e comunicar o impacto à professora.

## 3. Backlog da sprint, PBIs e tasks

Os códigos S3C preservam o histórico. Usar o mesmo item existente na iteração S4 e manter PRs e links anteriores. Os demais pais são nomes lógicos propostos para localizar ou criar o PBI equivalente.

| Parent | Resultado aceito | Origem | Horas de tasks |
|---|---|---|---:|
| S3C-PBI01 | Vincular candidato à conta Participante | P07–P09 | 10 |
| S3C-PBI02 | Liberar leitura de visitas ao coordenador | P06 | 3 |
| S3C-PBI03 | Manter visitas e atividades existentes | P04–P05 | 8 |
| S3C-PBI04 | Aceitar termo no primeiro acesso | P01–P02 | 8 |
| S3C-PBI05 | Auditar transições e rastrear testes | P03 | 5 |
| S3C-PBI06 | Harmonizar dados demonstrativos | P10 | 1 |
| S3C-PBI07 | Registrar decisões e regredir recrutamento | P01–P11, incluindo decisão P11 | 4 |
| S4-PBI19 | Confirmar presença e solicitar reagendamento | RF19 | 14 |
| S4-PBI20 | Solicitar retirada | RF20 | 8 |
| S4-PBI21 | Consultar indicadores | RF21 | 11 |
| S4-PBI22 | Gerar relatório por estudo | RF22 | 9 |
| S4-INT | Integrar API, Web e Mobile | Transversal | 67 |
| S4-QA | Validar release em CI | Transversal | 44 |
| S4-REL | Gerir e encerrar a Release 2 | Processo e documentação | 36 |

**Total de cadastro: 64 tasks, 228h.** As horas de S4-INT, S4-QA e S4-REL atendem a vários requisitos. Cada task tem um único pai para evitar dupla contagem. A linha de 39h inclui S3C-BE-04 e S3C-PO-02, presentes no quadro de PBIs original e omitidas na distribuição anterior por papel. A tabela de origem classifica 17h em PBIs integralmente P1 (10 + 3 + 4); o texto menciona 20h críticas. Este plano usa prioridades por task e antecipa também o consentimento e a preparação da CI.

## 4. Organização do processo, cronograma em fases e burndown

| Fase e janela | Capacidade bruta da equipe | Trabalho em paralelo | Marco de saída |
|---|---:|---|---|
| 0 · Contratos · dias 1–2 (24–25/11) | 48h | PO publica a ata e os contratos corretivos, depois RF19–RF22. Registra D07 como descartada. Backend prepara seleção de conta, proteção de legados e leitura de visitas. Web prepara formulário do Admin e seletor do Coordenador. Mobile alinha seed e sessão. QA prepara CI, emulador e dados de teste novos e legados. | Ata vinculada ao plano. Demonstrar em teste que o Admin cria a conta e o Coordenador vê nome e e-mail completo somente leitura e seleciona a conta existente (D03). Conferir leitura de visitas por perfil e bloqueio de avanço do legado sem conta, que continua consultável (D10). |
| 1 · Recrutamento, termo e visitas · dias 3–5 (26, 27 e 30/11) | 72h | Backend e Mobile integram o termo por estudo. Web e Backend aplicam as regras de edição de visitas. QA prepara dois estudos para a mesma conta e uma visita já agendada, executa regressão RF08–RF11 e inicia os E2E. Backend inicia RF19 e auditoria. Web inicia painel e relatório com os contratos publicados. | Após RF10 e inclusão por RF11, aceitar o termo no Mobile libera apenas o estudo escolhido, sem pedir dados complementares. Reabrir o app confirma o aceite e mantém o outro estudo pendente (D01, D02, D08). O Coordenador agenda uma visita. Na visita já agendada, o Pesquisador consegue alterar nome, intervalo e descrição. Interface e API bloqueiam alterações de ordem e atividades (D09). |
| 2 · Integração · dias 6–8 (01–03/12) | 72h | Backend integra RF19–RF22 e auditoria. PO integra o processamento dos pedidos. Web e Mobile usam a API real. QA acompanha uma retirada, uma mudança de situação e uma edição descritiva, mede cobertura e compara painel e relatório com o seed. | Pedido enviado pelo app, processado na Web e refletido no app. A retirada altera a participação para Retirado e preserva o recrutamento como Incluído (D06). A mudança de situação gera evento com os campos atuais da tabela e a edição descritiva não gera evento (D04, D05). Registrar no SHA integrado os resultados, os totais do painel e relatório e as lacunas que precisam de regressão na fase 3. |
| 3 · Regressão e release · dias 9–10 (04 e 07/12) | 48h | Devs corrigem regressões. QA repete os E2E e vincula as evidências aos critérios da ata. Equipe demonstra o fluxo e registra review e retrospectiva. PO confere o SHA avaliado antes da publicação. | CI aprovada no SHA final, cobertura ≥80% e dois E2E aprovados. README reúne evidências das nove decisões aplicáveis e registra o descarte de D07. Após aceite, vincular README, tag e GitHub Release ao mesmo commit. |

Dia 1 a Dia 10 designam dias úteis da sprint. D01 a D10 na ata designam decisões de produto. As capacidades da tabela são brutas e incluem reuniões e reserva. Os marcos são metas de execução.  Iniciar os testes junto com cada incremento e usar exemplos de contrato para desenvolver telas antes da disponibilidade da API. Para fechar uma integração, executar com aplicação e banco reais de teste. Caminho crítico: conta do Admin → vínculo → RF10 → inclusão → sessão e aceite Mobile por estudo → visitas → ação mobile → decisão web → leitura no app → regressão final → tag. Em paralelo, a leitura de visitas desbloqueia RF12 e as consultas agregadas desbloqueiam a conciliação RF21/RF22.

**Burndown por horas restantes.** A linha ideal parte de 228h de trabalho cadastrado. A tabela mostra o saldo ideal ao fim do dia; o saldo real será extraído do Azure. A reta é referência, não uma obrigação de baixa uniforme.

| Data | 24/11 | 25/11 | 26/11 | 27/11 | 30/11 | 01/12 | 02/12 | 03/12 | 04/12 | 07/12 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Saldo ideal (h) | 205,2 | 182,4 | 159,6 | 136,8 | 114 | 91,2 | 68,4 | 45,6 | 22,8 | 0 |
| Saldo real (h) | — | — | — | — | — | — | — | — | — | — |

Cada responsável atualiza Remaining Work com sua previsão real até o fim do dia. Letícia registra data, causa e variação de escopo quando a reserva é acionada. No fechamento, anexar os gráficos Azure de **S3 e S4**, comparar previsto e realizado por sprint e explicar bloqueios, reestimativas, contribuições e ações da retro.

## 5. Estratégia de testes, cobertura e CI

| Camada | Execução e verificação | Evidência esperada |
|---|---|---|
| Backend | Jest para regras e Supertest com PostgreSQL isolado para endpoints. Cobrir estados válidos e inválidos, transações, repetição de pedido e acesso por perfil e por estudo. | Relatório de testes e cobertura de linhas globais do código de negócio, incluindo arquivos sem testes. Excluir somente código gerado e configuração; falhar abaixo de 80%. |
| Componentes | Vitest/Testing Library em React e Jest/React Native Testing Library em Expo. Verificar validação, falha da API, carregamento, estado após salvar e nova sessão. | Suítes web e mobile por PR, vinculadas às tasks. |
| E2E web | Cypress: Admin cria conta; pesquisador cria estudo e visitas; coordenador vincula, avalia, registra consentimento, inclui, agenda e registra realização. Conferir histórico e totais do mesmo estudo. | Log do cenário, captura de sucesso e de falha quando houver. |
| E2E mobile | Executar app em emulador com API de teste. Entrar como participante incluído, aceitar termo, listar visitas e confirmar presença; reabrir e conferir o estado. | Execução automatizada no dispositivo/emulador, com log e captura. |
| Integração das três camadas | Com duas visitas distintas, pedir reagendamento e retirada pelo app, processar na web e atualizar o app. Conferir estado, histórico, auditoria e agregações antes e depois. | IDs fictícios do estudo/pedidos, estados esperados e observados e evidência do mesmo SHA. |

No GitHub Actions, em PR e integração à principal: instalar dependências fixadas, criar banco isolado, aplicar migrações e seed, compilar, executar suítes e publicar relatórios. Bloquear promoção quando falharem teste, cobertura ou E2E. Reexecutar no commit final se o código mudar. QA coordena; cada autor corrige e testa sua camada.

## 6. Critérios de aceite, rastreabilidade e fechamento da Release 2

| Item / Parent | Cenário de aceite observável | Verificação principal |
|---|---|---|
| P07–P09 · S3C-PBI01 | Admin cria Participante, coordenador seleciona conta obrigatória e o app lista somente estudos e visitas dessa pessoa. API rejeita vínculo ausente ou perfil incorreto. | S3C-QA-03, S4-MOB-04, S4-QA-03 |
| P06 · S3C-PBI02 | Coordenador lê visitas previstas do próprio estudo e agenda. A edição do protocolo continua restrita. | S3C-QA-01, S4-W1-04 |
| P04–P05 · S3C-PBI03 | Sem agendamento, o pesquisador acrescenta atividade e recarrega a visita. Com agendamento, somente nome, intervalo e descrição são editáveis. API e interface bloqueiam alteração de ordem ou atividades. | S3C-W1-03, S4-W1-05 |
| P01–P02 · S3C-PBI04 | Primeiro acesso ao estudo apresenta termo somente no Mobile. O aceite libera esse estudo sem coleta de dados complementares. Recusa mantém bloqueio; aceite persistido dispensa nova apresentação da mesma versão. | S4-MOB-06, S4-QA-03 |
| P03 · S3C-PBI05 | Mudanças de estado identificam ator e entidade. Falha transacional preserva consistência. Cada RF tem cenário e evidência. | S3C-BE-06, S4-QA-05 |
| P10 · S3C-PBI06 | Nomes e perfis do protótipo, mocks e seed correspondem às contas fictícias do roteiro. | S3C-MOB-02, S4-QA-06 |
| P11 e regressão · S3C-PBI07 | Decisão de descarte dos dados adicionais registrada e confirmada; RF08–RF11 passam com vínculo obrigatório. | S3C-PO-01, S3C-QA-03 |
| RF19 · S4-PBI19 | Confirmar persiste presença prevista. Pedido com motivo/data chega ao coordenador; visita original só muda após aprovação. | S4-QA-03, S4-QA-05 |
| RF20 · S4-PBI20 | Pedido pendente visível na web; processamento autorizado atualiza o estado da participação e a consulta mobile, preservando o estado de recrutamento do candidato. Reenvio não duplica pedido. | S4-BE-02, S4-PO-07, S4-QA-05 |
| RF21 · S4-PBI21 | Coordenador e pesquisador consultam apenas estudos autorizados; seis indicadores coincidem com contagem conhecida, inclusive estudo vazio. | S4-W2-04, S4-W2-05 |
| RF22 · S4-PBI22 | Resumo, detalhe e impressão/exportação identificam o estudo correto e seus totais de recrutamento e visitas. | S4-W2-02, S4-W2-04 |
| Regressão S3 · RF12–RF18 | Agendar, registrar realização/ausência/cancelamento, avaliação, histórico e retirada; autenticar e consultar estudos e visitas no app. | S4-W1-04, S4-MOB-04, S4-QA-05 |
| Qualidade e release | CI aprovada, dois E2E automatizados, cobertura global de linhas ≥80%, demonstração das três camadas no SHA entregue. | S4-QA-04, S4-QA-05, S4-PO-06 |

**Registro de execução a completar.** Para cada linha, lançar cenário ou ID do teste, responsável, resultado, SHA, link para PR/execução/captura e defeito aberto, se houver. No fechamento, discriminar cada RF de S3 e S4 como concluído, parcial ou não implementado e justificar pendências. Registrar percentual medido, numerador/denominador, ambiente, mudanças de arquitetura/stack, links aos diagramas, Swagger, instruções de instalação, capturas web/mobile e problemas conhecidos. Acrescentar entregas, impedimentos, melhorias e burndown de cada sprint. O PO reúne aceite da review, cria a tag `release2` sobre o commit com código e documentação avaliados e publica a GitHub Release apontando para esse README. **Resultado atual: a executar.**

## Anexo operacional · Matriz por integrante e guia de cadastro para o PO

Cada linha abaixo corresponde a uma única Task. A tabela serve tanto à equipe quanto ao cadastro: copiar **Title** e **Description**, selecionar a identidade indicada em **Assigned To**, preencher prioridade, horas e atividade, e associar o PBI indicado em **Parent** pelo ID real do projeto. Selecionar a mesma área do PBI e a iteração Sprint 4. Se a configuração local omitir Priority em Task, registrar a prioridade no pai e sinalizar a da task com uma tag P1–P4. Mapear a atividade ao valor equivalente disponível no processo da equipe.

**Ordem de cadastro.** Localizar os pais da seção 3 e as tasks já abertas pelo código; mover ou atualizar cada item existente. Criar os ausentes como filhos e depois ligar as dependências entre tasks usando predecessor/successor. A coluna **Pré** indica o insumo mínimo para começar; **Libera** lista dependentes diretos. Uma task de implementação pode liberar um contrato ou endpoint testável antes do fechamento administrativo. Nos E2E, preparar scripts e fixtures desde a Fase 1 e exigir integração real para o aceite final. Prioridade 1 indica bloqueio de entrega, 2 trabalho necessário com sequência flexível, 3 alinhamento posterior e 4 melhoria adiável. “—” indica ausência de dependência direta mapeada.


### Letícia · 38h de tasks + 2h de reserva

| Title | Description | Assigned To | Priority | Remaining Work (h) | Activity | Parent | Pré | Libera |
|---|---|---|---:|---:|---|---|---|---|
| S3C-PO-01 · Fixar contratos corretivos e registrar decisões | Registrar D01–D10 conforme ata, perfis, exemplos de payload e erros por rota. Registrar a decisão de P11 e sua justificativa. Liberar primeiro o contrato do vínculo. | Letícia | 1 | 2 | Design | S3C-PBI07 | — | S4-PO-08, S3C-BE-01, S3C-BE-02, S3C-BE-03, S3C-BE-04, S3C-BE-06, S3C-W1-01, S3C-W1-02, S3C-W2-01, S4-MOB-04 |
| S3C-PO-02 · Especificar o aceite no primeiro acesso | Validar texto simulado, versão, estudo, instante de aceite e comportamento ao recusar ou retornar. Distinguir o aceite mobile do consentimento de inclusão RF10. | Letícia | 1 | 1 | Design | S3C-PBI04 | — | S3C-BE-05, S3C-MOB-01 |
| S4-PO-01 · Publicar contratos RF19–RF22 | Versionar OpenAPI com estados de pedidos, decisões do coordenador, autorização por estudo, fórmulas e denominadores do painel. Entregar exemplos por fatia para as telas. | Letícia | 1 | 4 | Design | S4-INT | — | S4-PO-03, S4-PO-04, S4-PO-07, S4-BE-01, S4-BE-02, S4-BE-03, S4-BE-04, S4-W2-01, S4-W2-02, S4-W2-03, S4-MOB-01, S4-MOB-02, S4-MOB-03 |
| S4-PO-03 · Atualizar arquitetura e diagramas | Revisar casos de uso, domínio, sequência de solicitação e arquitetura Web/Mobile–NestJS–PostgreSQL. Identificar alterações desde a Release 1. | Letícia | 2 | 4 | Documentation | S4-REL | S4-PO-01 | S4-PO-06 |
| S4-PO-04 · Revisar e integrar incrementos | Revisar PRs por fluxo, compatibilidade de DTOs e migrações. Subir os três componentes e resolver divergências de contrato com seus autores. | Letícia | 1 | 7 | Development | S4-INT | S4-PO-01 | S4-PO-06 |
| S4-PO-05 · Montar registro das duas sprints | Recuperar quadro, rotação, revisão e burndown da S3. Preencher README da R2 com estado por RF, instalação, evidências, pendências e links do README principal. | Letícia | 2 | 6 | Documentation | S4-REL | S3C-QA-02 | S4-PO-06 |
| S4-PO-07 · Implementar consulta e decisão dos pedidos | Reutilizar RF12/RF16 para listar pendências por estudo e processar uma decisão autorizada. Persistir decisão, atualizar visita ou participação uma vez e devolver estado ao app. Cobrir repetição e acesso indevido. | Letícia | 1 | 6 | Development | S4-INT | S4-PO-01 | S4-W2-04 |
| S4-PO-08 · Preparar roteiro e aceite do produto | Preparar dois estudos fictícios com resultados esperados, revisar exemplos de sucesso e erro e relacionar cada demonstração ao critério correspondente. | Letícia | 2 | 4 | Documentation | S4-REL | S3C-PO-01 | S4-PO-06 |
| S4-PO-06 · Publicar a Release 2 | Após review e aceite, conferir README e CI do SHA final, criar tag release2 e GitHub Release com resumo e link. Registrar o SHA e o endereço no quadro. | Letícia | 1 | 2 | Deployment | S4-REL | S4-QA-05, S4-PO-05, S4-PO-03, S4-PO-04, S4-PO-08, S4-PO-REV, S4-BE-REV, S4-W1-REV, S4-W2-REV, S4-MOB-REV, S4-QA-REV | — |
| S4-PO-SYNC · Sincronizar andamento e impedimentos | Distribuir 60 minutos pelos dez dias úteis (média de seis minutos por dia). Informar avanço, bloqueio e dependência ao grupo. | Letícia | 2 | 1 | Requirements | S4-REL | — | — |
| S4-PO-REV · Participar da review e retrospectiva | Demonstrar ou verificar as entregas de Letícia, registrar resultado, impedimento e ação de melhoria para a próxima sprint. | Letícia | 2 | 1 | Requirements | S4-REL | S4-QA-05 | S4-PO-06 |

### Lethycia · 38h de tasks + 2h de reserva

| Title | Description | Assigned To | Priority | Remaining Work (h) | Activity | Parent | Pré | Libera |
|---|---|---|---:|---:|---|---|---|---|
| S3C-BE-01 · Consultar contas elegíveis | Disponibilizar ao coordenador consulta de ID, nome e e-mail completo das contas Participante ativas criadas pelo Admin. Testar retorno e restrição de perfil. | Lethycia | 1 | 2 | Development | S3C-PBI01 | S3C-PO-01 | S3C-QA-03 |
| S3C-BE-02 · Exigir vínculo ao cadastrar candidato | Validar id_usuario, perfil e conta ativa no servidor. Preservar candidatos antigos sem conta e garantir somente consulta nas novas etapas que exigem vínculo. Aplicar a exigência ao novo cadastro. | Lethycia | 1 | 3 | Development | S3C-PBI01 | S3C-PO-01 | S4-BE-01, S4-BE-02, S4-W1-01, S3C-QA-03 |
| S3C-BE-03 · Autorizar leitura de visitas previstas | Ajustar GET /studies/:id/visits para coordenador autorizado no estudo. Preservar acesso do pesquisador e restrição de escrita. | Lethycia | 1 | 2 | Development | S3C-PBI02 | S3C-PO-01 | S4-W1-04, S3C-QA-01 |
| S3C-BE-04 · Editar visita e acrescentar atividades | Validar estudo, perfil e atividade no serviço de visitas. Com agendamento, permitir somente nome, intervalo e descrição. Preservar atividades e agendamentos e testar leitura após edição. | Lethycia | 2 | 3 | Development | S3C-PBI03 | S3C-PO-01 | S3C-W1-03 |
| S3C-BE-05 · Persistir aceite pelo participante | Consultar e gravar aceite do usuário autenticado em /me/consents. Identificar versão e estudo e garantir resultado estável em novo envio. | Lethycia | 1 | 3 | Development | S3C-PBI04 | S3C-PO-02 | S4-MOB-05 |
| S3C-BE-06 · Registrar auditoria transacional | Auditar somente mudanças de situação (D04). Usar os campos atuais para autor, ação, entidade, ID, data/hora e estados anterior e novo (D05). Cobrir sucesso e rollback sem evento órfão. | Lethycia | 1 | 4 | Development | S3C-PBI05 | S3C-PO-01 | S4-BE-05 |
| S4-BE-01 · Confirmar visita e criar pedido de reagendamento | Usar titularidade da sessão, validar visita futura e persistir motivo e data sugerida em solicitacoes_visita. Confirmar presença prevista preservando o registro de realização RF13. | Lethycia | 1 | 4 | Development | S4-PBI19 | S4-PO-01, S3C-BE-02 | S4-BE-05, S4-MOB-05 |
| S4-BE-02 · Receber retirada voluntária | Vincular pedido pendente à participação, disponibilizá-lo ao coordenador e impedir duplicação. Aplicar retirada efetiva no processamento RF16. | Lethycia | 1 | 3 | Development | S4-PBI20 | S4-PO-01, S3C-BE-02 | S4-BE-05, S4-MOB-05 |
| S4-BE-03 · Agregar indicadores por estudo | Calcular candidatos, incluídos, vagas, realizadas, pendentes e taxa de desistência. Testar estudo vazio, permissão e contagens sem duplicidade. | Lethycia | 1 | 4 | Development | S4-PBI21 | S4-PO-01 | S4-BE-05, S4-W2-04 |
| S4-BE-04 · Entregar relatório por estudo | Consultar resumo e detalhe de recrutamento e visitas no PostgreSQL. Validar escopo para pesquisador e coordenador e reconciliar totais com RF21. | Lethycia | 1 | 3 | Development | S4-PBI22 | S4-PO-01 | S4-BE-05, S4-W2-04 |
| S4-BE-05 · Fechar lacunas de cobertura | Consultar linhas de negócio descobertas pelo Jest. Acrescentar testes de regra e integração Supertest com banco de teste, inclusive transições inválidas e acesso entre estudos. | Lethycia | 1 | 5 | Testing | S4-QA | S4-BE-01, S4-BE-02, S4-BE-03, S4-BE-04, S3C-BE-06 | S4-QA-04 |
| S4-BE-SYNC · Sincronizar andamento e impedimentos | Distribuir 60 minutos pelos dez dias úteis (média de seis minutos por dia). Informar avanço, bloqueio e dependência ao grupo. | Lethycia | 2 | 1 | Requirements | S4-REL | — | — |
| S4-BE-REV · Participar da review e retrospectiva | Demonstrar ou verificar as entregas de Lethycia, registrar resultado, impedimento e ação de melhoria para a próxima sprint. | Lethycia | 2 | 1 | Requirements | S4-REL | S4-QA-05 | S4-PO-06 |

### Sonally · 38h de tasks + 2h de reserva

| Title | Description | Assigned To | Priority | Remaining Work (h) | Activity | Parent | Pré | Libera |
|---|---|---|---:|---:|---|---|---|---|
| S3C-W1-01 · Criar conta Participante pelo Admin | Adicionar perfil ao formulário, enviar valor aceito pelo backend e verificar login da conta criada. Exibir validação de e-mail duplicado. | Sonally | 1 | 2 | Development | S3C-PBI01 | S3C-PO-01 | S4-W1-01, S4-W1-03, S4-W1-05, S3C-QA-03 |
| S3C-W1-02 · Adicionar atividade a visita existente | Expor a ação ao pesquisador apenas em visita prevista sem agendamento. Enviar identificador da visita e manter atividades anteriores visíveis. | Sonally | 2 | 2 | Development | S3C-PBI03 | S3C-PO-01 | S3C-W1-03 |
| S3C-W1-03 · Editar visita e recarregar atividades | Preencher formulário com dados persistidos, salvar alteração e reabrir a visita. Validar erros sem perder os dados digitados. | Sonally | 2 | 3 | Development | S3C-PBI03 | S3C-W1-02, S3C-BE-04 | S4-W1-02, S4-W1-04, S4-W1-05 |
| S4-W1-01 · Validar administração e dados legados | Testar criação, ativação e vínculo a partir das telas reais com dados antigos e novos. Verificar o bloqueio de avanço dos legados sem vínculo e corrigir regressões web. | Sonally | 1 | 6 | Development | S4-INT | S3C-W1-01, S3C-BE-02 | S4-QA-05 |
| S4-W1-02 · Integrar protocolo e agenda do estudo | Verificar se critérios, visitas e atividades atualizados aparecem no agendamento RF12. Corrigir seleção de estudo e atualização da tela após salvar. | Sonally | 2 | 6 | Development | S4-INT | S3C-W1-03 | S4-QA-05 |
| S4-W1-03 · Validar vagas e estados no recrutamento | Exercitar inclusão na última vaga e bloqueio com estudo encerrado. Corrigir mensagens e comparar o estado exibido com a resposta da API. | Sonally | 2 | 5 | Development | S4-INT | S3C-W1-01 | S4-QA-05 |
| S4-W1-04 · Integrar agendamento e execução de visita | Percorrer estudo, candidato incluído, agenda, execução, avaliação e histórico RF12–RF15. Ajustar carregamento por perfil e entregar massa reproduzível ao QA. | Sonally | 1 | 7 | Development | S4-INT | S3C-W1-03, S3C-BE-03 | S4-QA-05 |
| S4-W1-05 · Testar componentes de administração e visitas | Usar Vitest e Testing Library para perfil, erro de vínculo, inclusão e edição de atividades. Cobrir estado após falha e após recarregar. | Sonally | 2 | 5 | Testing | S4-QA | S3C-W1-01, S3C-W1-03 | S4-QA-05 |
| S4-W1-SYNC · Sincronizar andamento e impedimentos | Distribuir 60 minutos pelos dez dias úteis (média de seis minutos por dia). Informar avanço, bloqueio e dependência ao grupo. | Sonally | 2 | 1 | Requirements | S4-REL | — | — |
| S4-W1-REV · Participar da review e retrospectiva | Demonstrar ou verificar as entregas de Sonally, registrar resultado, impedimento e ação de melhoria para a próxima sprint. | Sonally | 2 | 1 | Requirements | S4-REL | S4-QA-05 | S4-PO-06 |

### Marcella · 38h de tasks + 2h de reserva

| Title | Description | Assigned To | Priority | Remaining Work (h) | Activity | Parent | Pré | Libera |
|---|---|---|---:|---:|---|---|---|---|
| S3C-W2-01 · Exigir conta no formulário de candidato | Exibir nome e e-mail completo da conta existente em modo somente leitura, enviar id_usuario e bloquear submissão vazia. Conferir na API real lista elegível, erro de perfil e vínculo persistido. | Marcella | 1 | 3 | Development | S3C-PBI01 | S3C-PO-01 | S3C-QA-03 |
| S4-W2-01 · Construir painel gerencial | Substituir dados estáticos de CoordinatorDashboardPage.tsx. Exibir seis indicadores, troca de estudo, carregamento, ausência de registros e erro recuperável. | Marcella | 1 | 7 | Development | S4-PBI21 | S4-PO-01 | S4-W2-04, S4-W2-05 |
| S4-W2-02 · Gerar e imprimir relatório | Montar resumo e detalhe por estudo para coordenador e pesquisador. Entregar impressão ou exportação acordada. Validar título, estudo, totais e paginação de impressão. | Marcella | 1 | 6 | Development | S4-PBI22 | S4-PO-01 | S4-W2-04, S4-W2-05 |
| S4-W2-03 · Processar pedidos no painel do coordenador | Listar pendentes e enviar decisão de reagendamento ou retirada. Mostrar resultado e atualizar lista. Exercitar reenvio e erro de permissão. | Marcella | 1 | 6 | Development | S4-INT | S4-PO-01 | S4-W2-04, S4-W2-06 |
| S4-W2-04 · Integrar painel, pedidos e relatório à API | Trocar adaptadores de desenvolvimento pelos endpoints reais. Conferir resultado de decisão e comparar painel e relatório com a mesma massa e estudo. | Marcella | 1 | 6 | Development | S4-INT | S4-W2-01, S4-W2-02, S4-W2-03, S4-BE-03, S4-BE-04, S4-PO-07 | S4-QA-05 |
| S4-W2-05 · Testar componentes do monitoramento | Cobrir mudança de estudo, totais, sem registros, erro e saída para impressão em Vitest. Validar dados de dois estudos distintos. | Marcella | 2 | 5 | Testing | S4-QA | S4-W2-01, S4-W2-02 | S4-QA-05 |
| S4-W2-06 · Revisar formulários e navegação web | Validar teclado, foco, rótulos, mensagens e layout de relatório e pedidos. Corrigir barreiras que impeçam concluir o fluxo. | Marcella | 2 | 3 | Development | S4-INT | S4-W2-03 | S4-QA-05 |
| S4-W2-SYNC · Sincronizar andamento e impedimentos | Distribuir 60 minutos pelos dez dias úteis (média de seis minutos por dia). Informar avanço, bloqueio e dependência ao grupo. | Marcella | 2 | 1 | Requirements | S4-REL | — | — |
| S4-W2-REV · Participar da review e retrospectiva | Demonstrar ou verificar as entregas de Marcella, registrar resultado, impedimento e ação de melhoria para a próxima sprint. | Marcella | 2 | 1 | Requirements | S4-REL | S4-QA-05 | S4-PO-06 |

### Laryssa · 38h de tasks + 2h de reserva

| Title | Description | Assigned To | Priority | Remaining Work (h) | Activity | Parent | Pré | Libera |
|---|---|---|---:|---:|---|---|---|---|
| S3C-MOB-01 · Apresentar termo no primeiro acesso | Construir tela de leitura e aceite, bloquear avanço enquanto pendente e restaurar estado confirmado pelo servidor. Cobrir recusa e novo login. | Laryssa | 1 | 4 | Development | S3C-PBI04 | S3C-PO-02 | S4-MOB-05, S4-MOB-06 |
| S3C-MOB-02 · Harmonizar identidades de demonstração | Conferir nomes e perfis de Figma, mocks web/mobile e seed-demo.mjs. Alinhar os exemplos e registrar as contas fictícias do roteiro. | Laryssa | 3 | 1 | Development | S3C-PBI06 | — | S4-QA-05 |
| S4-MOB-01 · Confirmar presença prevista | Exibir visita elegível e ação de confirmar. Evitar duplo toque, atualizar estado e verificar persistência ao reabrir. | Laryssa | 1 | 5 | Development | S4-PBI19 | S4-PO-01 | S4-MOB-05, S4-MOB-06 |
| S4-MOB-02 · Solicitar reagendamento | Coletar motivo e nova data, mostrar validações, protocolo ou estado devolvido e preservar a visita original enquanto o pedido estiver pendente. | Laryssa | 1 | 5 | Development | S4-PBI19 | S4-PO-01 | S4-MOB-05, S4-MOB-06 |
| S4-MOB-03 · Solicitar retirada e acompanhar decisão | Identificar o estudo, solicitar confirmação explícita, apresentar pendência e exibir a decisão do coordenador ao atualizar. | Laryssa | 1 | 5 | Development | S4-PBI20 | S4-PO-01 | S4-MOB-05, S4-MOB-06 |
| S4-MOB-04 · Integrar sessão, estudos e visitas | Configurar cliente autenticado e endereço da API acessível no emulador. Exercitar RF17/RF18 com duas contas e impedir reaproveitamento de dados após logout. | Laryssa | 1 | 6 | Development | S4-INT | S3C-PO-01 | S4-MOB-05 |
| S4-MOB-05 · Integrar fluxos mobile com dados reais | Percorrer termo, confirmação, reagendamento e retirada em emulador. Ajustar navegação, sessão expirada, rede indisponível e retorno ao histórico. | Laryssa | 1 | 5 | Development | S4-INT | S3C-MOB-01, S4-MOB-01, S4-MOB-02, S4-MOB-03, S4-MOB-04, S3C-BE-05, S4-BE-01, S4-BE-02 | S4-QA-05 |
| S4-MOB-06 · Testar componentes do aplicativo | Cobrir aceite, envio de data inválida, duplo toque e retirada pendente com Jest e React Native Testing Library. Anexar execução ao PR. | Laryssa | 2 | 5 | Testing | S4-QA | S3C-MOB-01, S4-MOB-01, S4-MOB-02, S4-MOB-03 | S4-QA-05 |
| S4-MOB-SYNC · Sincronizar andamento e impedimentos | Distribuir 60 minutos pelos dez dias úteis (média de seis minutos por dia). Informar avanço, bloqueio e dependência ao grupo. | Laryssa | 2 | 1 | Requirements | S4-REL | — | — |
| S4-MOB-REV · Participar da review e retrospectiva | Demonstrar ou verificar as entregas de Laryssa, registrar resultado, impedimento e ação de melhoria para a próxima sprint. | Laryssa | 2 | 1 | Requirements | S4-REL | S4-QA-05 | S4-PO-06 |

### Zeton · 38h de tasks + 2h de reserva

| Title | Description | Assigned To | Priority | Remaining Work (h) | Activity | Parent | Pré | Libera |
|---|---|---|---:|---:|---|---|---|---|
| S3C-QA-01 · Validar acesso do coordenador | Testar GET no próprio estudo e em outro estudo e tentativa de alterar a visita prevista. Guardar resultados por perfil. | Zeton | 1 | 1 | Testing | S3C-PBI02 | S3C-BE-03 | S4-QA-05 |
| S3C-QA-02 · Abrir matriz de requisitos e evidências | Criar linhas para RF, PBI, defeito, cenário, responsável, resultado e evidência versionada. Identificar P11 como decisão de escopo. | Zeton | 1 | 1 | Testing | S3C-PBI05 | — | S4-PO-05 |
| S3C-QA-03 · Executar regressão RF08–RF11 | Automatizar cadastro com conta, avaliação, consentimento e inclusão. Verificar rejeição sem conta, sem consentimento e por falta de vaga. | Zeton | 1 | 2 | Testing | S3C-PBI07 | S3C-BE-01, S3C-BE-02, S3C-W2-01, S3C-W1-01 | S4-QA-05 |
| S4-QA-01 · Preparar pipeline e emulador | Subir PostgreSQL descartável, aplicar migrações e seed, compilar Expo e executar smoke no emulador. Configurar jobs de PR/main e publicação dos artefatos de teste e cobertura. | Zeton | 1 | 6 | Deployment | S4-QA | — | S4-QA-02, S4-QA-03, S4-QA-04, S4-QA-06 |
| S4-QA-02 · Automatizar E2E web | Em Cypress, começar com seed isolado, criar estudo, conta, candidato, incluir, agendar e registrar execução. Conferir persistência e rodar a suíte completa após integração web. | Zeton | 1 | 7 | Testing | S4-QA | S4-QA-01 | S4-QA-05 |
| S4-QA-03 · Automatizar E2E mobile | Com Maestro ou executor já instalado, controlar app compilado em emulador, API e banco reais de teste. Automatizar login, aceite, consulta e confirmação, validando estado ao reabrir. | Zeton | 1 | 7 | Testing | S4-QA | S4-QA-01 | S4-QA-05 |
| S4-QA-04 · Auditar cobertura global do backend | Incluir todos os módulos de negócio no denominador, mesmo sem testes. Conferir exclusões de configuração e gerados, limite global de linhas e relatório no SHA da entrega. | Zeton | 1 | 4 | Testing | S4-QA | S4-QA-01, S4-BE-05 | S4-QA-05 |
| S4-QA-05 · Executar regressão final e fechar evidências | Rodar suítes no candidato integrado, reproduzir decisão web refletida no mobile, reconciliar RF21/RF22 e anexar log, captura e resultado à matriz. Reabrir defeitos bloqueadores. | Zeton | 1 | 5 | Testing | S4-REL | S4-QA-02, S4-QA-03, S4-QA-04, S3C-QA-03, S3C-QA-01, S4-W2-04, S4-MOB-05, S4-W1-04, S4-W1-05, S4-W2-05, S4-W2-06, S4-MOB-06, S4-W1-01, S4-W1-02, S4-W1-03, S4-QA-06, S3C-MOB-02 | S4-PO-06, S4-PO-REV, S4-BE-REV, S4-W1-REV, S4-W2-REV, S4-MOB-REV, S4-QA-REV |
| S4-QA-06 · Ensaiar instalação e demonstração | Seguir instruções em ambiente limpo, validar seed e contas por perfil, preparar capturas e anotar comandos ou pré-requisitos faltantes no README. | Zeton | 2 | 3 | Testing | S4-REL | S4-QA-01 | S4-QA-05 |
| S4-QA-SYNC · Sincronizar andamento e impedimentos | Distribuir 60 minutos pelos dez dias úteis (média de seis minutos por dia). Informar avanço, bloqueio e dependência ao grupo. | Zeton | 2 | 1 | Requirements | S4-REL | — | — |
| S4-QA-REV · Participar da review e retrospectiva | Demonstrar ou verificar as entregas de Zeton, registrar resultado, impedimento e ação de melhoria para a próxima sprint. | Zeton | 2 | 1 | Requirements | S4-REL | S4-QA-05 | S4-PO-06 |

**Conferência do PO após o cadastro:** cada um dos seis integrantes tem 38h de Remaining Work inicial, incluindo uma task de sincronização de 1h e uma task de review/retro de 1h por pessoa. As tasks dos sete PBIs S3C somam 39h e já estão incluídas nas 228h cadastradas. As 12h de reserva permanecem livres, com 2h por integrante. Vincular o quadro e os gráficos reais ao README no fechamento.

**Ata D01–D10 e contratos:** [Especificação de contratos e aceite do PO](https://chatgpt.com/library?file_id=libfile_2bfb16c97924819190c5327c9d488628&account_id=personal).

**Documentos de referência:** `ProjetoES2.md`, seções 3, 5, 7 e 10; `planejamento-sprint4-clinicalstudypb.md`, seções 2 a 5. Datas, capacidade e papéis seguem a solicitação atual.

