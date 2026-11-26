# Sprint 3 — Planejamento

**Projeto:** ClinicalStudyPB  
**Disciplina:** Engenharia de Software II (2026.2)  
**Período:** 10/11/2026 a 23/11/2026  
**Equipe:** 6 integrantes  
**Esforço total planejado:** 192 horas, conforme o quadro-resumo do backlog da Sprint 3

## 1. Objetivo da sprint

Iniciar a entrega da Release 2 — Acompanhamento e Mobile, implementando os fluxos de acompanhamento dos participantes na aplicação Web (RF12 a RF16) e avançando a experiência do participante no aplicativo Mobile, contemplando a conclusão da autenticação e a consulta de estudos e visitas (RF17 e RF18).

A sprint contempla o agendamento de visitas para participantes incluídos, a atualização da situação das visitas, o registro de resultados fictícios das avaliações, a consulta do histórico de visitas e avaliações e o registro da retirada de participantes. No Mobile, prevê a conclusão do ciclo de autenticação e restauração segura da sessão, além da exibição dos estudos em que o participante está incluído, das próximas visitas e do histórico de comparecimento.

Também estão previstas a definição dos contratos da API e da matriz de permissões, a integração entre Web, Mobile, backend e banco de dados, a atualização da documentação técnica, a execução de testes automatizados e a validação de regressão e cobertura, preservando o funcionamento dos requisitos entregues na Release 1.

## 2. Escopo e entregas planejadas

| Entrega | Descrição | Esforço planejado |
|---|---|---:|
| Gestão, arquitetura e integração | Revisão das pendências da Sprint 2; planejamento e acompanhamento; definição dos contratos REST e da matriz de acesso; atualização dos diagramas; coordenação da integração Web/Mobile; revisão de pull requests e consolidação da documentação | 32 h |
| Backend — acompanhamento e consultas (RF12–RF18) | Implementação dos endpoints e regras para agendamento, atualização da situação das visitas, registro de resultados, consulta de histórico, retirada e consultas autenticadas do participante | 32 h |
| Web — estudos e contexto do participante | Exibição dos participantes incluídos no contexto do estudo, componente reutilizável de resumo e seleção, integração da seleção aos fluxos de acompanhamento, ajuste de navegação e permissões e testes dos componentes | 32 h |
| Web — visitas e acompanhamento (RF12–RF16) | Interfaces para agendamento, atualização da situação das visitas, registro de resultados fictícios, histórico de visitas e avaliações e retirada do participante; integração com os serviços reais da API | 32 h |
| Mobile — autenticação, estudos e visitas (RF17–RF18) | Conclusão da autenticação e restauração segura da sessão; consulta dos estudos do participante; exibição das próximas visitas e do histórico; integração autenticada, navegação e testes de regressão do login | 32 h* |
| Qualidade e testes | Plano de testes e massa de dados; testes de integração das APIs; validação dos fluxos Web e Mobile; automação de fluxos E2E; regressão, validação do CI e evidências de cobertura | 32 h |
| **Total planejado, conforme quadro-resumo do backlog** | | **192 h** |

\* **Conferência necessária:** o quadro-resumo do backlog atribui 7 tasks e 32 h ao Mobile, mas o detalhamento apresenta as tasks S3-MOB-01 a S3-MOB-08 (8 tasks), cujas estimativas somam 31 h. A equipe deve corrigir a contagem e/ou a estimativa no Azure Boards antes de considerar fechada a distribuição individual. Assim, as 192 h acima reproduzem o total consolidado declarado no backlog, não uma soma corrigida por estimativa presumida.

As estimativas representam o esforço comprometido no backlog. A capacidade reservada para contingência não está incluída nesse total.

## 3. Equipe e responsabilidades

| Papel | Integrante | Responsabilidade na Sprint 3 |
|---|---|---|
| Líder técnico / Gerente | Zeton | Arquitetura, definição dos contratos da API e da matriz de acesso, integração entre as frentes, revisão de pull requests, documentação e condução do planejamento, review e retrospectiva |
| Desenvolvedor Backend | Laryssa | Modelagem e persistência, endpoints e regras de negócio para visitas, avaliações, histórico, retirada e consultas autenticadas do participante; testes do backend e atualização do Swagger/OpenAPI |
| Desenvolvedor Web — estudos, protocolos e usuários | Marcella | Listagem dos participantes incluídos, seleção e resumo do participante, integração com os fluxos de acompanhamento, navegação, permissões e testes dos componentes correspondentes |
| Desenvolvedor Web — recrutamento, visitas e relatórios | Sonally | Interfaces de agendamento, atualização da situação das visitas, registro de resultados, histórico e retirada; integração dos fluxos Web com a API |
| Desenvolvedor Mobile | Lethycia | Conclusão da autenticação e restauração da sessão, telas de estudos e visitas do participante, integração das consultas autenticadas, navegação e testes Mobile |
| QA / DevOps | Letícia | Estratégia e massa de testes, testes de integração, validação dos fluxos Web e Mobile, automação E2E, regressão, CI e consolidação das evidências de qualidade e cobertura |

A qualidade deve ser trabalhada de forma compartilhada: backend e desenvolvedores de interface também implementam e mantêm os testes de suas entregas, enquanto QA/DevOps coordena a validação integrada e a consolidação das evidências.

## 4. Decisões técnicas

- Manutenção da stack definida para o projeto: NestJS e TypeScript no backend, React e TypeScript na aplicação Web, React Native com Expo no aplicativo Mobile e PostgreSQL como banco de dados.
- Definição e compartilhamento prévio dos contratos REST para RF12 a RF18, incluindo rotas, métodos, parâmetros, DTOs, respostas, códigos HTTP, erros e autenticação, permitindo desenvolvimento paralelo com mocks quando necessário.
- Reutilização do modelo persistente existente, especialmente das estruturas de visitas, resultados de avaliações e participações em estudos. Uma migration só deverá ser criada se a revisão identificar uma lacuna real no schema.
- Implementação das regras de negócio e validações de autorização no backend. A interface não deve ser considerada responsável por proteger operações ou dados por conta própria.
- Para RF13, utilizar as situações previstas no modelo: Agendada, Realizada, Ausente e Cancelada. O registro como Realizada deve exigir a data de realização.
- Para RF14, registrar resultados fictícios associados à atividade prevista e à visita correspondente, respeitando a unicidade por visita e atividade e os campos existentes para valor, unidade e observação.
- Preservação do histórico ao registrar a retirada do participante, atualizando a participação para Retirado e registrando data e motivo conforme o modelo existente.
- No Mobile, aproveitar LoginScreen, AuthContext e os endpoints de autenticação já existentes (`POST /auth/login`, `GET /auth/me` e `POST /auth/logout`). Concluir a restauração da sessão com armazenamento seguro do accessToken, utilizando `expo-secure-store` em versão compatível com o SDK Expo. Não criar outra tela de login nem novos endpoints de autenticação.
- As consultas Mobile devem identificar o participante a partir do usuário autenticado e dos vínculos já existentes entre usuário, candidato e participação. Não utilizar identificadores arbitrários enviados pelo cliente como fonte de autorização nem permitir consulta de dados de outro participante.
- Padronização dos estados de carregamento, sucesso, lista vazia e erro nas interfaces, incluindo falhas de rede, sessão expirada e acesso não autorizado.
- Manutenção da integração contínua e execução dos testes nos pull requests. As pull requests destinadas à branch principal devem observar a regra indicada no backlog de obter pelo menos duas aprovações antes da integração.
- Preservação das funcionalidades da Release 1 e execução de testes de regressão durante a integração das novas entregas.

## 5. Critérios de conclusão

A sprint será considerada concluída após a revisão das entregas e a verificação dos seguintes pontos:

- **RF12:** agendamento de visitas para participantes incluídos, vinculando a visita à visita prevista correspondente e validando participação ativa, data/horário, duplicidades e permissões.
- **RF13:** atualização da situação da visita para Realizada, Ausente ou Cancelada, mantendo as validações e exigindo data de realização quando aplicável.
- **RF14:** registro e consulta de resultados fictícios das avaliações, associados à visita e à atividade correta, sem duplicidade indevida.
- **RF15:** consulta cronológica do histórico do participante, reunindo visitas, datas, situações e resultados, com tratamento para histórico vazio e restrição de acesso.
- **RF16:** registro da retirada de uma participação ativa, com status Retirado, data e motivo, preservando o histórico.
- **Autenticação Mobile:** login/logout existente preservado, token armazenado de forma segura e sessão restaurada e validada antes de liberar telas protegidas; acesso permitido somente ao perfil Participante.
- **RF17:** participante autenticado consegue consultar os estudos em que possui participação, sem acesso a vínculos de outras pessoas.
- **RF18:** aplicativo exibe próximas visitas e histórico de comparecimento, com estudo, visita, data e situação, tratando ausência de registros e falhas de consulta.
- Interfaces Web integradas à API para os fluxos RF12 a RF16 e interfaces Mobile integradas às consultas autenticadas de RF17 e RF18, com estados de carregamento, sucesso, vazio e erro.
- Testes unitários das regras de negócio do backend e testes de integração dos principais endpoints executados.
- Testes automatizados dos componentes e fluxos Web e Mobile, incluindo regressão do login/logout.
- Pelo menos um fluxo E2E Web cobrindo agendamento e atualização da situação de uma visita e um fluxo E2E Mobile cobrindo autenticação e consulta dos estudos e visitas.
- Testes de regressão dos requisitos anteriores executados para verificar que as entregas da Release 1 continuam funcionando.
- Pipeline de CI validado e evidência de cobertura mínima de 80% das linhas do código de negócio do backend, excluindo código gerado e configurações.
- Swagger/OpenAPI atualizado com as rotas, DTOs, autenticação, respostas e erros implementados.
- Diagramas de arquitetura e sequência atualizados para representar os fluxos da Sprint 3.
- Pull requests revisadas, integração validada e evidências de implementação e testes organizadas.
- Sprint Review e retrospectiva realizadas, com registro do que foi concluído, parcialmente concluído ou ficou pendente, dos impedimentos e das ações de melhoria para a Sprint 4.

## 6. Acompanhamento e encerramento

O acompanhamento das atividades será realizado pelo Azure DevOps, com atualização do estado das tasks, responsáveis, prioridade, dependências, impedimentos e campo Remaining Work. Cada task deverá ser vinculada à User Story/PBI correspondente; as atividades transversais de gestão poderão ser vinculadas ao item de gerenciamento da sprint.

O período da Sprint 3 está previsto para **10/11/2026 a 23/11/2026**. O backlog considera **9 dias úteis**, com disponibilidade de **36 horas por integrante** (9 dias × 4 horas), totalizando **216 horas de capacidade da equipe**. A distribuição de referência por integrante é de 4 horas para Weekly Meeting, 24 horas para execução e testes, 4 horas para Sprint Review/Retrospectiva e 4 horas reservadas para contingência. A contingência não está incluída nas 192 horas comprometidas em tasks.

A Weekly Meeting deverá confirmar objetivo, escopo, responsáveis, estimativas, prioridades, contratos, dependências, riscos e impedimentos. Durante a sprint, o quadro deverá ser atualizado continuamente, e a integração deverá ocorrer em entregas pequenas para reduzir bloqueios entre as frentes. As datas e os horários específicos das cerimônias não estão discriminados no backlog consultado e deverão ser registrados no calendário da equipe.

O encerramento da Sprint 3 deverá consolidar os resultados de RF12 a RF18, distinguindo requisitos concluídos, parcialmente implementados e pendentes. Também deverão ser registrados os resultados dos testes, a cobertura, as evidências, os problemas conhecidos, as decisões técnicas e as ações de melhoria para a Sprint 4.

Como a Sprint 3 integra a **Release 2**, a documentação produzida deverá alimentar `releases/release2/README.md`, sem antecipar a conclusão da release, cujo escopo inclui também as entregas previstas para a Sprint 4.
