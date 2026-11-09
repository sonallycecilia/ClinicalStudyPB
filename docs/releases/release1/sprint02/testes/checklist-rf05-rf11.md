# Checklist de QA Funcional — RF05 a RF11

| Campo | Informação |
|---|---|
| Projeto | ClinicalStudyPB |
| Release / Sprint | Release 1 / Sprint 2 |
| Responsável | QA — Marcella |
| Período da sprint | 27/10/2026 a 09/11/2026 |
| Situação da execução deste checklist | Não executado |

## 1. Objetivo

Planejar e registrar a validação funcional dos requisitos RF05 a RF11, relacionando cada cenário ao requisito, ao comportamento esperado, à situação observada na implementação e aos testes automatizados existentes. O checklist orienta a execução da Sprint 2 e a preparação das evidências da Release 1.

O planejamento da Sprint 2 é a referência local disponível para o escopo dos requisitos: critérios por estudo (RF05), visitas e atividades (RF06), estados de estudo (RF07), cadastro e consulta de candidatos (RF08), avaliação de elegibilidade (RF09), consentimento simulado (RF10) e inclusão de candidatos elegíveis com consentimento e vaga (RF11).

O documento externo de regras de negócio referenciado na documentação do projeto não pôde ser consultado neste contexto. Portanto, hipóteses não confirmadas pelo planejamento local estão marcadas como **A confirmar** e não são critérios obrigatórios de aprovação até serem validadas pela equipe responsável. Nenhum requisito funcional é alterado por este checklist.

## 2. Critérios gerais de qualidade

- Validar os fluxos positivos e negativos previstos no requisito, sem converter sugestões em regras obrigatórias.
- Conferir campos obrigatórios, formatos, valores aceitos e rejeição de campos não permitidos conforme o contrato atual da API.
- Conferir vínculo e isolamento por estudo e por pesquisador, bem como respostas para registros inexistentes ou fora do escopo.
- Conferir persistência, chaves/relacionamentos, consistência de estados e ausência de efeitos parciais em operações transacionais.
- Para elegibilidade, conferir a resposta de cada critério ativo e o estado resultante do candidato; não presumir uma avaliação automática de dados clínicos.
- Para consentimento e inclusão, verificar separadamente o registro/consulta do consentimento e os pré-requisitos de inclusão.
- Distinguir implementação de API, integração da interface Web e execução comprovada do cenário. Código ou teste automatizado existente não é evidência de que este checklist foi executado.
- Não confundir cobertura funcional planejada com cobertura de código. O relatório agregado da suíte automatizada não substitui evidência vinculada a cada cenário.
- Registrar evidências reproduzíveis (ambiente, dados, requisição/resposta ou evidência visual), resultado e justificativa para cenários bloqueados ou não aplicáveis.

## 3. Cenários de teste

**Legenda da regra:** **Planejado** = consta no escopo/critério de conclusão local da Sprint 2; **A confirmar** = regra adicional cuja obrigatoriedade deve ser validada com a equipe.
**Legenda da implementação:** descreve a evidência encontrada no repositório, não o resultado da execução do cenário.

### 3.1 Revisão da versão anterior

- Os cenários de consulta e persistência de critérios, visitas e candidatos foram consolidados quando verificavam o mesmo fluxo pela mesma consulta.
- A alteração de critérios e a duplicidade de critérios/candidatos foram mantidas apenas como **A confirmar**; não há, nas referências locais consultáveis, confirmação de que sejam regras obrigatórias.
- O cenário de alteração do estado para **Planejamento** foi corrigido: esse é o estado inicial do estudo e o retorno a ele não é uma transição válida na implementação atual.
- As tentativas de inclusão sem consentimento e com consentimento recusado foram movidas de RF10 para RF11, pois testam a regra de inclusão, não o registro do consentimento.
- A consulta de avaliação foi mantida com o endpoint existente de consulta; resultados de elegibilidade agora distinguem respostas completas, inelegibilidade e avaliação pendente.
- A inclusão com vaga disponível e a consulta/persistência da participação foram consolidadas no fluxo positivo; a duplicidade e as restrições de estado não confirmadas permanecem separadas como **A confirmar**.

### RF05 — Definir critérios de inclusão e exclusão para cada estudo

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF05-01 | RF05 | Cadastrar critérios de inclusão e de exclusão válidos. Cada registro deve retornar com tipo, descrição e vínculo ao estudo enviados; os tipos devem permanecer distintos. | Planejado | API de cadastro implementada; componente Web de critérios e testes existentes. | AUT-01, AUT-02 |
| CT-RF05-02 | RF05 | Consultar os critérios de um estudo após o cadastro. A lista deve conter os registros persistidos daquele estudo, sem critérios de outro estudo. | Planejado | API de listagem e consulta por estudo implementadas. | AUT-01, AUT-02 |
| CT-RF05-03 | RF05 | Enviar tipo, descrição ou campos inválidos/obrigatórios ausentes. A API deve rejeitar a solicitação sem persistir critério inválido. | Planejado | DTO e validação no serviço implementados. | AUT-01, AUT-02 |
| CT-RF05-04 | RF05 | Cadastrar em estudo inexistente e consultar critério inexistente ou vinculado a outro estudo. Deve retornar ausência/erro apropriado sem criar associação inválida. | Planejado | API verifica estudo e escopo do critério; respostas de ausência são implementadas. | AUT-01, AUT-02 |
| CT-RF05-05 | RF05 | Tentar ler ou alterar critérios sem autenticação ou como pesquisador que não é proprietário do estudo. O acesso deve ser negado, sem expor dados de outro pesquisador. | Planejado | Guards e verificação de propriedade no backend implementados. | AUT-02 |
| CT-RF05-06 | RF05 | **A confirmar:** atualizar parcialmente tipo, descrição ou situação ativa de um critério. Se a atualização fizer parte do requisito aprovado, os campos alterados devem persistir no estudo correto e os não enviados devem ser preservados. | A confirmar | PATCH existe e invalida avaliações afetadas; a obrigatoriedade da atualização não está confirmada no planejamento local. | AUT-01, AUT-02 |
| CT-RF05-07 | RF05 | **A confirmar:** cadastrar novamente critério com tipo/descrição já existentes. Definir com a equipe se a repetição deve ser aceita ou rejeitada; não reprovar o requisito até essa regra ser confirmada. | A confirmar | Não foi localizada regra funcional de deduplicação no fluxo de cadastro. | — |

### RF06 — Definir visitas previstas e suas atividades

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF06-01 | RF06 | Cadastrar visita prevista e atividade válida. A visita deve estar vinculada ao estudo e a atividade à visita correspondente. | Planejado | API de visitas e atividades implementada; componente Web de visitas e testes existentes. | AUT-03, AUT-04 |
| CT-RF06-02 | RF06 | Consultar visitas e atividades cadastradas. A resposta deve refletir os dados persistidos e manter cada atividade na visita correta. | Planejado | APIs de listagem/consulta implementadas; ordenação de visitas por ordem definida no serviço. | AUT-03, AUT-04 |
| CT-RF06-03 | RF06 | Enviar visita ou atividade sem campos obrigatórios, com valores inválidos ou campos desconhecidos. A solicitação deve ser rejeitada sem persistência inválida. | Planejado | DTOs e validação de payload implementados. | AUT-03, AUT-04 |
| CT-RF06-04 | RF06 | Cadastrar atividade em visita inexistente/de outro estudo ou consultar estudo/visita inexistente. Deve retornar erro de ausência e não criar associação inválida. | Planejado | Serviço valida a relação estudo-visita antes da operação. | AUT-03, AUT-04 |
| CT-RF06-05 | RF06 | Acessar visitas/atividades sem autenticação ou como pesquisador não proprietário. O acesso deve ser negado e os dados devem permanecer isolados. | Planejado | Guards e verificação do proprietário no backend implementados. | AUT-04 |
| CT-RF06-06 | RF06 | **A confirmar:** cadastrar duas visitas com a mesma ordem no estudo. A API atual rejeita a segunda operação com conflito; confirmar se unicidade de ordem é regra de negócio obrigatória ou restrição adicional. | A confirmar | Restrição única e resposta de conflito implementadas e testadas. | AUT-03, AUT-04 |

### RF07 — Gerenciar os estados do estudo

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF07-01 | RF07 | Consultar um estudo recém-criado. O estado inicial deve ser Planejamento. | Planejado | Estado inicial persistido e retornado pela API. | AUT-05, AUT-06 |
| CT-RF07-02 | RF07 | Percorrer Planejamento → Recrutamento → Execução → Encerrado, consultando o resultado após cada transição válida. Cada novo estado deve persistir. | Planejado | Transições sequenciais implementadas no backend; representação/validação de estados também existe na Web. | AUT-05, AUT-06 |
| CT-RF07-03 | RF07 | Tentar informar estado desconhecido ou pular/inverter etapa. A operação deve ser rejeitada e o estado anterior deve permanecer inalterado. | Planejado | Validação de estado e de transição implementada. | AUT-05, AUT-06 |
| CT-RF07-04 | RF07 | Consultar o estudo após atualizar o estado. Deve retornar o estado persistido, não um valor inferido apenas pelas datas. | Planejado | Consulta retorna o estado persistido. | AUT-05, AUT-06 |
| CT-RF07-05 | RF07 | Atualizar estudo inexistente ou pertencente a outro pesquisador, ou tentar alterar estado sem sessão/perfil autorizado. Deve retornar erro apropriado sem alterar dados. | Planejado | Ausência, propriedade e autorização são verificadas no backend. | AUT-05, AUT-06 |

### RF08 — Cadastrar candidatos vinculados a um estudo

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF08-01 | RF08 | Cadastrar candidato com nome válido e e-mail opcional válido. A resposta deve conter candidato associado ao estudo correto e estado inicial de recrutamento. | Planejado | API POST implementada; DTO permite e-mail opcional. | AUT-07, AUT-08 |
| CT-RF08-02 | RF08 | Consultar candidatos de estudo com registros e de estudo sem candidatos. A listagem deve retornar apenas os registros daquele estudo e lista vazia quando não houver candidatos. | Planejado | API GET por estudo implementada e isolada pelo identificador do estudo. | AUT-07, AUT-08 |
| CT-RF08-03 | RF08 | Enviar nome ausente/vazio, e-mail inválido ou campos não permitidos. A API deve rejeitar dados inválidos; e-mail ausente deve continuar aceito conforme DTO atual. | Planejado | DTO e validação de cadastro implementados. | AUT-07, AUT-08 |
| CT-RF08-04 | RF08 | Cadastrar ou consultar candidatos em estudo inexistente. Deve retornar ausência do estudo e não persistir candidato. | Planejado | Serviço verifica se o estudo existe e pode ser alterado. | AUT-07, AUT-08 |
| CT-RF08-05 | RF08 | Tentar cadastrar ou listar candidatos sem autorização ou em estudo de outro pesquisador. Deve negar o acesso e não revelar registros alheios. | Planejado | Guards e propriedade do estudo verificados pela API. A consulta de candidatos na Web está explicitamente indisponível no adaptador atual. | AUT-08, AUT-14 |
| CT-RF08-06 | RF08 | **A confirmar:** cadastrar novamente candidato com e-mail igual no mesmo estudo. Confirmar se isso representa duplicidade proibida; e-mail repetido não deve ser tratado como falha de requisito sem regra aprovada. | A confirmar | Não foi localizada regra funcional de deduplicação no cadastro. | — |

### RF09 — Registrar a avaliação dos critérios de elegibilidade

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF09-01 | RF09 | Avaliar todos os critérios ativos do candidato, com inclusão atendida e exclusão não atendida. A resposta e a consulta posterior devem mostrar as avaliações e estado Elegível associados ao candidato/estudo. | Planejado | POST e GET de avaliações implementados; persistência no backend. Não foi encontrado fluxo de avaliação integrado na Web. | AUT-09, AUT-10, AUT-11 |
| CT-RF09-02 | RF09 | Avaliar candidato que não atende a critério de inclusão ou que atende a critério de exclusão. O estado resultante deve ser Inelegível. | Planejado | Regras de resultado implementadas no serviço. | AUT-09, AUT-11 |
| CT-RF09-03 | RF09 | Registrar resposta Pendente sem outro critério reprovador. O candidato deve permanecer Em avaliação, não ser marcado Elegível. | Planejado | Estado pendente implementado. | AUT-09 |
| CT-RF09-04 | RF09 | Consultar avaliação de candidato existente sem avaliações. Deve retornar estado atual e coleção vazia; para candidato inexistente ou fora do estudo, deve retornar ausência. | Planejado | GET de avaliação implementado, com verificação de candidato e estudo. | AUT-09, AUT-11 |
| CT-RF09-05 | RF09 | Enviar avaliação incompleta, duplicada, com resultado/UUID inválido, critério inativo ou de outro estudo, ou tentar avaliar sem critérios ativos. Deve rejeitar sem gravar avaliação parcial. | Planejado | Validação do DTO e transação exigem uma resposta válida por critério ativo. | AUT-09, AUT-10, AUT-11 |
| CT-RF09-06 | RF09 | Tentar avaliar ou consultar candidato inexistente, de outro estudo ou sem autorização. Deve retornar erro apropriado e preservar isolamento dos dados. | Planejado | Verificação de escopo e acesso implementada. A interface Web de avaliação não foi localizada. | AUT-09, AUT-11 |
| CT-RF09-07 | RF09 | **A confirmar:** reavaliar candidato ainda não incluído após mudança de respostas/critérios. Confirmar se a operação deve substituir as avaliações anteriores ou preservar histórico; a regra e a expectativa de histórico não estão definidas no planejamento local. | A confirmar | API permite atualização das avaliações existentes; não foi localizada exigência local de histórico nem teste específico de reavaliação bem-sucedida. | — |

### RF10 — Registrar o consentimento simulado do candidato

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF10-01 | RF10 | Registrar consentimento simulado com estado Registrado e versão do termo válidos. A resposta deve identificar candidato/estudo e registrar o pesquisador autenticado. | Planejado | POST e persistência implementados no backend. Não foi encontrado fluxo de consentimento integrado na Web. | AUT-12, AUT-13 |
| CT-RF10-02 | RF10 | Consultar consentimento de candidato existente com e sem registro. Deve retornar o registro mais recente ou status nulo quando nenhum existir. | Planejado | GET retorna estado mais recente ou valores nulos; consulta implementada. | AUT-12, AUT-13 |
| CT-RF10-03 | RF10 | Enviar estado/versão obrigatórios ausentes ou inválidos, observação inválida ou campo desconhecido. Deve rejeitar sem registrar consentimento. | Planejado | DTO e validação do serviço implementados. | AUT-12, AUT-13 |
| CT-RF10-04 | RF10 | Registrar/consultar consentimento de candidato inexistente, fora do estudo ou sem autorização. Deve retornar erro apropriado e preservar o isolamento. | Planejado | Verificação de candidato, estudo e pesquisador implementada. | AUT-12, AUT-13 |
| CT-RF10-05 | RF10 | **A confirmar:** registrar um novo estado após um consentimento anterior (por exemplo, Recusado, Revogado ou novo Registrado). Confirmar política de alteração/revogação e efeito sobre uma inclusão; a implementação registra eventos e consulta o mais recente. | A confirmar | Estados adicionais e consulta do último registro existem na API; a política obrigatória não está confirmada no planejamento local. | AUT-12, AUT-13 |

### RF11 — Incluir candidatos elegíveis no estudo

| ID | RF | Cenário e resultado esperado | Regra | Implementação observada | Automação |
|---|---|---|---|---|---|
| CT-RF11-01 | RF11 | Incluir candidato Elegível, com critérios ativos aprovados, consentimento Registrado e vaga disponível. Deve criar participação Ativa, atualizar estado do candidato para Incluído e incrementar o contador sem exceder o limite; consultar a lista de candidatos e o estudo deve refletir o estado e contador persistidos. | Planejado | Inclusão transacional implementada no backend; resposta inclui participação e contador. Não foi encontrado fluxo de inclusão na Web. | AUT-12, AUT-13 |
| CT-RF11-02 | RF11 | Tentar incluir candidato Inelegível ou com critério ativo pendente/não aprovado. A operação deve ser bloqueada sem criar participação ou alterar contador. | Planejado | Verificações de elegibilidade e de todos os critérios ativos implementadas. | AUT-12, AUT-13 |
| CT-RF11-03 | RF11 | Tentar incluir candidato elegível sem qualquer registro de consentimento. A inclusão deve ser bloqueada e nenhum dado de participação/contador deve ser alterado. | Planejado | Consentimento ausente bloqueia inclusão. | AUT-12, AUT-13 |
| CT-RF11-04 | RF11 | **A confirmar:** tentar incluir após consentimento Recusado ou Revogado. Se esses estados e a política de revogação forem confirmados, a inclusão deve ser bloqueada e os dados preservados. | A confirmar | A API bloqueia quando o registro mais recente não é Registrado; a regra de negócio ainda precisa de confirmação. | AUT-12, AUT-13 |
| CT-RF11-05 | RF11 | Com limite atingido, bloquear inclusão; em disputa simultânea pela última vaga, não permitir que o total ultrapasse o limite. | Planejado | Bloqueio por capacidade, serialização transacional e cenário concorrente E2E implementados. | AUT-12, AUT-13 |
| CT-RF11-06 | RF11 | Tentar incluir candidato inexistente/fora do estudo ou por pesquisador não proprietário. Deve retornar erro apropriado, sem participação, alteração de estado ou contador. | Planejado | API verifica existência e propriedade do estudo/candidato. | AUT-13 |
| CT-RF11-07 | RF11 | Simular falha durante a gravação da inclusão. A transação deve reverter participação, estado do candidato e contador, sem persistência parcial. | Planejado | Transação implementada e rollback coberto por E2E. | AUT-13 |
| CT-RF11-08 | RF11 | **A confirmar:** repetir inclusão do mesmo candidato. A API atual rejeita candidato já Incluído; confirmar se a prevenção de inclusão duplicada é critério obrigatório. | A confirmar | Recusa implementada e exercitada no fluxo E2E; obrigatoriedade não foi confirmada no planejamento local. | AUT-13 |
| CT-RF11-09 | RF11 | **A confirmar:** tentar incluir em estudo encerrado ou em estado diferente de Recrutamento. Confirmar quais estados permitem inclusão; atualmente a API bloqueia Encerrado, mas permite outros estados. | A confirmar | Restrição parcial por estado implementada (Encerrado); regra completa de estado para inclusão não está confirmada. | — |

### 3.2 Referências dos testes automatizados existentes

Os códigos AUT identificam arquivos/suítes encontrados no repositório; os nomes entre aspas são descrições existentes nos próprios testes. A referência indica cobertura automatizada existente, não execução comprovada deste checklist.

| Código | Referência existente |
|---|---|
| AUT-01 | [criteria.service.spec.ts](../../../../../backend/src/studies/criteria.service.spec.ts) — `describe('CriteriaService')`; [criteria.dto.spec.ts](../../../../../backend/src/studies/criteria.dto.spec.ts) — `describe('Criterion DTOs')`; [StudyCriteriaSection.test.tsx](../../../../../web/src/components/StudyCriteriaSection.test.tsx) — `describe('StudyCriteriaSection')`, `describe('StudyCriteriaEditor')` e `describe('edição de estudo com critérios')`. |
| AUT-02 | [studies.e2e-spec.ts](../../../../../backend/test/studies.e2e-spec.ts) — “cadastra, consulta e atualiza critérios vinculados ao estudo do pesquisador” e “valida critérios e impede acesso a critérios fora do estudo ou de outro pesquisador”. |
| AUT-03 | [visits.service.spec.ts](../../../../../backend/src/studies/visits.service.spec.ts) — `describe('VisitsService')`; [visits.dto.spec.ts](../../../../../backend/src/studies/visits.dto.spec.ts) — `describe('DTOs de visitas previstas')`; [StudyVisitsSection.test.tsx](../../../../../web/src/components/StudyVisitsSection.test.tsx) — `describe('StudyVisitsSection — listagem')` e `describe('StudyVisitsSection — cadastro')`. |
| AUT-04 | [studies.e2e-spec.ts](../../../../../backend/test/studies.e2e-spec.ts) — “cadastra, consulta e valida visitas previstas e atividades vinculadas ao estudo”. |
| AUT-05 | [studies.service.spec.ts](../../../../../backend/src/studies/studies.service.spec.ts) — `describe('StudiesService com PostgreSQL')`; [studyStatus.test.ts](../../../../../web/src/studies/studyStatus.test.ts) — `describe('estados do estudo')`; [studiesApi.test.ts](../../../../../web/src/studies/studiesApi.test.ts) — `describe('Studies API')`. |
| AUT-06 | [studies.e2e-spec.ts](../../../../../backend/test/studies.e2e-spec.ts) — “persiste estados do estudo e permite somente transições sequenciais”. |
| AUT-07 | [candidates.service.spec.ts](../../../../../backend/src/studies/candidates.service.spec.ts) — `describe('CandidatesService')`; [candidates.dto.spec.ts](../../../../../backend/src/studies/candidates.dto.spec.ts) — `describe('CreateCandidateRequestDto')`. |
| AUT-08 | [studies.e2e-spec.ts](../../../../../backend/test/studies.e2e-spec.ts) — “cadastra e consulta candidatos vinculados a um estudo próprio”. |
| AUT-09 | [candidates.assessment.service.spec.ts](../../../../../backend/src/studies/candidates.assessment.service.spec.ts) — `describe('CandidatesService avaliação de elegibilidade')`. |
| AUT-10 | [candidates.assessment.dto.spec.ts](../../../../../backend/src/studies/candidates.assessment.dto.spec.ts) — `describe('EvaluateCandidateRequestDto')`. |
| AUT-11 | [studies.e2e-spec.ts](../../../../../backend/test/studies.e2e-spec.ts) — “avalia os critérios do candidato e persiste elegibilidade ou inelegibilidade”. |
| AUT-12 | [candidates.service.spec.ts](../../../../../backend/src/studies/candidates.service.spec.ts) — `describe('CandidatesService')`; [candidates.dto.spec.ts](../../../../../backend/src/studies/candidates.dto.spec.ts) — `describe('RegisterCandidateConsentRequestDto')`. |
| AUT-13 | [studies.e2e-spec.ts](../../../../../backend/test/studies.e2e-spec.ts) — “registra consentimento e inclui apenas candidatos aptos, respeitando o limite de vagas”, “inclui somente um candidato quando duas requisições disputam a última vaga”, “reverte participação, candidato e contador quando a atualização final falha”, “rejeita a inclusão de candidato com avaliação pendente” e “rejeita a inclusão quando o consentimento mais recente foi revogado”. |
| AUT-14 | [CandidateFormPage.test.tsx](../../../../../web/src/pages/CandidateFormPage.test.tsx) — `describe('página e rotas de cadastro de candidato no App')`; o teste “carrega estudos reais pela consulta autorizada, preserva o layout e mantém o cadastro sem persistência bloqueado” documenta a lacuna de integração Web, não um cadastro aprovado. |

## 4. Critérios de aprovação

- Cada cenário **Planejado** será aprovado somente após execução com resultado observado compatível com o esperado e evidência identificável.
- Cenários **A confirmar** não são bloqueadores nem critérios de reprovação até que a equipe confirme e registre a regra aplicável.
- Em casos negativos, além do erro esperado, verificar que não houve persistência ou alteração parcial indevida.
- Uma implementação ou teste automatizado existente, bem como um percentual agregado de cobertura, não basta para marcar cenário como aprovado.
- Cenários bloqueados ou não aplicáveis devem ter justificativa registrada; a ausência de interface ou endpoint necessário deve ser descrita como lacuna, não como aprovação.

## 5. Registro de execução

Nenhum cenário deste checklist foi executado nesta atualização. O relatório automatizado existente [relatorio-cobertura-testes-automatizados.md](./relatorio-cobertura-testes-automatizados.md) registra uma execução agregada da suíte em 08/11/2026, mas não associa resultado/evidência a cada CT. Por isso, todos os cenários permanecem **Não executado**.

| ID do cenário | Tipo planejado | Status | Evidência / referência da execução | Observações |
|---|---|---|---|---|
| CT-RF05-01 | Integração/API | Não executado | — | — |
| CT-RF05-02 | Integração/API | Não executado | — | — |
| CT-RF05-03 | Integração/API | Não executado | — | — |
| CT-RF05-04 | Integração/API | Não executado | — | — |
| CT-RF05-05 | Integração/API | Não executado | — | — |
| CT-RF05-06 | Integração/API | Não executado | — | A confirmar |
| CT-RF05-07 | Integração/API | Não executado | — | A confirmar |
| CT-RF06-01 | Integração/API | Não executado | — | — |
| CT-RF06-02 | Integração/API | Não executado | — | — |
| CT-RF06-03 | Integração/API | Não executado | — | — |
| CT-RF06-04 | Integração/API | Não executado | — | — |
| CT-RF06-05 | Integração/API | Não executado | — | — |
| CT-RF06-06 | Integração/API | Não executado | — | A confirmar |
| CT-RF07-01 | Integração/E2E | Não executado | — | — |
| CT-RF07-02 | Integração/E2E | Não executado | — | — |
| CT-RF07-03 | Integração/E2E | Não executado | — | — |
| CT-RF07-04 | Integração/E2E | Não executado | — | — |
| CT-RF07-05 | Integração/E2E | Não executado | — | — |
| CT-RF08-01 | Integração/API | Não executado | — | — |
| CT-RF08-02 | Integração/API | Não executado | — | — |
| CT-RF08-03 | Integração/API | Não executado | — | — |
| CT-RF08-04 | Integração/API | Não executado | — | — |
| CT-RF08-05 | Integração/API | Não executado | — | — |
| CT-RF08-06 | Integração/API | Não executado | — | A confirmar |
| CT-RF09-01 | Integração/E2E | Não executado | — | — |
| CT-RF09-02 | Integração/E2E | Não executado | — | — |
| CT-RF09-03 | Integração/E2E | Não executado | — | — |
| CT-RF09-04 | Integração/API | Não executado | — | — |
| CT-RF09-05 | Integração/API | Não executado | — | — |
| CT-RF09-06 | Integração/API | Não executado | — | — |
| CT-RF09-07 | Integração/API | Não executado | — | A confirmar |
| CT-RF10-01 | Integração/API | Não executado | — | — |
| CT-RF10-02 | Integração/API | Não executado | — | — |
| CT-RF10-03 | Integração/API | Não executado | — | — |
| CT-RF10-04 | Integração/API | Não executado | — | — |
| CT-RF10-05 | Integração/API | Não executado | — | A confirmar |
| CT-RF11-01 | Integração/E2E | Não executado | — | — |
| CT-RF11-02 | Integração/E2E | Não executado | — | — |
| CT-RF11-03 | Integração/E2E | Não executado | — | — |
| CT-RF11-04 | Integração/E2E | Não executado | — | A confirmar |
| CT-RF11-05 | Integração/E2E | Não executado | — | — |
| CT-RF11-06 | Integração/API | Não executado | — | — |
| CT-RF11-07 | Integração/E2E | Não executado | — | — |
| CT-RF11-08 | Integração/E2E | Não executado | — | A confirmar |
| CT-RF11-09 | Integração/API | Não executado | — | A confirmar |

**Status permitidos:** Não executado; Aprovado; Reprovado; Bloqueado; Não aplicável.
**Tipos de teste previstos:** Manual; Unitário; Integração; E2E. O tipo planejado não representa execução realizada.

## 6. Ambiente de testes

| Componente | Ambiente/tecnologia prevista |
|---|---|
| Backend/API | NestJS |
| Interface Web | React |
| Banco de dados | PostgreSQL |
| Execução local | Docker Compose |
| Testes do backend | Jest e Supertest |
| Testes da Web | Ferramentas configuradas no projeto (Vitest/Testing Library, conforme suítes existentes) |
| Contratos da API | Swagger |

Versões, configurações, dados de teste, comandos, data e identificação da execução devem ser registrados junto às evidências reais. Nenhuma execução foi iniciada para atualizar este checklist.

## 7. Considerações finais

- A implementação atual contém APIs e testes automatizados de backend para critérios, visitas, estados, candidatos, avaliação, consentimento e inclusão. Isso representa cobertura de implementação/testes encontrada, não aprovação funcional deste checklist.
- RF05 e RF06 têm componentes e testes de Web identificados; RF07 tem representação/validação de estados na Web. A execução deve confirmar o fluxo integrado.
- Em RF08, a API backend permite cadastro e consulta, mas o adaptador de consulta de candidatos da Web declara a funcionalidade indisponível; a integração Web de candidatos permanece uma lacuna a validar.
- Em RF09, RF10 e RF11, as operações estão presentes na API backend, mas não foram localizados fluxos Web integrados para avaliação, consentimento e inclusão. Esses fluxos são lacunas de integração da interface e não devem ser considerados entregues na Web sem evidência adicional.
- Permanecem pendentes de confirmação: atualização e deduplicação de critérios; unicidade de ordem das visitas como regra de negócio; deduplicação de candidatos; política de reavaliação/histórico; alteração ou revogação de consentimento; recusa/revogação como bloqueio de inclusão; duplicidade de inclusão como critério obrigatório; e estados do estudo que permitem inclusão.
- A cobertura planejada inclui cadastro, consulta, validação, relacionamentos, autorização/isolamento, persistência, avaliação positiva/negativa/pendente, consentimento, vagas, concorrência e integridade transacional. Não inclui regras adicionais sem confirmação nem confunde cobertura funcional com cobertura de código.
- Os identificadores deste documento são únicos e cada um permanece **Não executado** até haver evidência individual, datada e rastreável.
