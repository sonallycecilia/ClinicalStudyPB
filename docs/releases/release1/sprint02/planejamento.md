# Sprint 2 — Planejamento

**Projeto:** ClinicalStudyPB  
**Disciplina:** Engenharia de Software II (2026.2)  
**Período:** 27/10/2026 a 09/11/2026  
**Equipe:** 6 integrantes  
**Esforço total planejado:** 187 horas

## 1. Objetivo da sprint

Completar o fluxo de recrutamento e inclusão de participantes do ClinicalStudyPB, contemplando a implementação dos requisitos RF05 a RF11 na aplicação Web, com integração entre interface, API e banco de dados.

A sprint contempla a definição dos critérios de inclusão e exclusão, o cadastro de visitas previstas e suas atividades, o gerenciamento dos estados dos estudos, o cadastro de candidatos, a avaliação de elegibilidade, o registro do consentimento simulado e a inclusão de participantes, respeitando as regras de negócio e o limite de vagas.

Também estão previstas a continuidade dos protótipos navegáveis do aplicativo mobile, a validação do pipeline de integração contínua, a execução de testes automatizados e a consolidação da documentação técnica e das evidências necessárias ao encerramento da Release 1.

## 2. Escopo e entregas planejadas

| Entrega | Descrição | Esforço |
|---|---|---|
| Preparação técnica e continuidade | Revisão das pendências da Sprint 1, definição dos contratos da API, revisão dos protótipos mobile e configuração e validação do pipeline de CI | 25 h |
| Critérios de inclusão e exclusão (RF05) | Modelagem, persistência, API e interface para definição e consulta dos critérios por estudo | 15 h |
| Visitas previstas (RF06) | Cadastro e consulta de visitas previstas e respectivas atividades por estudo | 14 h |
| Estados dos estudos (RF07) | Gerenciamento dos estados de planejamento, recrutamento, execução e encerrado, com validação das transições | 8 h |
| Candidatos (RF08) | Modelagem, cadastro, consulta e integração dos candidatos aos estudos | 15 h |
| Elegibilidade (RF09) | Avaliação dos critérios de inclusão e exclusão dos candidatos, com persistência e consulta dos resultados | 6 h |
| Consentimento simulado (RF10) | Registro e consulta do consentimento simulado dos candidatos | 5 h |
| Inclusão de participantes (RF11) | Implementação das regras para inclusão de candidatos elegíveis, com consentimento registrado e vagas disponíveis | 6 h |
| Protótipos mobile | Evolução dos protótipos navegáveis do participante, contemplando estudos, próximas visitas, histórico e ações simuladas | 15 h |
| Integração Web/Backend | Integração dos módulos de estudos e recrutamento à API, revisão dos fluxos e resolução de incompatibilidades | 25 h |
| Qualidade e testes | Testes unitários das regras de negócio, testes dos componentes web, testes de integração dos endpoints e validação do pipeline | 21 h |
| Documentação da Release 1 | Atualização dos diagramas, documentação dos protótipos mobile, consolidação dos resultados, evidências e registro técnico da release | 20 h |
| Organização da sprint | Planejamento, acompanhamento do quadro, review e retrospectiva | 12 h |
| **Total** | | **187 h** |

As estimativas representam o esforço planejado para as atividades da equipe e devem ser compatíveis com a capacidade disponível no período.

## 3. Equipe e responsabilidades

| Papel | Integrante | Responsabilidade |
|---|---|---|
| Líder técnico / Gerente | Laryssa | Arquitetura, integração e planejamento |
| Backend | Letícia | Dados e regras de negócio |
| Web 1 | Zeton | Estudos, protocolos e usuários |
| Web 2 | Lethycia | Recrutamento, visitas e relatórios |
| Mobile | Sonally | Aplicativo do participante e protótipos |
| QA / DevOps | Marcella | Pipeline e qualidade |

## 4. Decisões técnicas

- Manutenção da stack definida na Sprint 1: NestJS e TypeScript no backend, React e TypeScript na aplicação web e React Native com Expo no aplicativo mobile.
- PostgreSQL como banco de dados, com persistência das novas entidades e relacionamentos necessários aos requisitos RF05 a RF11.
- Definição prévia dos contratos da API, incluindo endpoints, formatos de requisição e resposta, códigos HTTP e tratamento de erros, para orientar a integração entre frontend e backend.
- Implementação das regras de negócio no backend, mantendo a validação das operações no servidor.
- Integração das interfaces web aos endpoints correspondentes, com tratamento de carregamento, sucesso e falhas.
- Desenvolvimento mobile limitado, nesta sprint, a protótipos navegáveis com dados fictícios e fluxos simulados, sem integração funcional com a API.
- Manutenção e validação do pipeline de integração contínua para execução automatizada de build e testes.
- Estudo de viabilidade da utilização do AWS EC2 Free Tier para futura implantação do projeto, sem exigir deploy efetivo nesta sprint.
- Priorização dos fluxos de recrutamento e inclusão, deixando funcionalidades de acompanhamento e agendamento individual de visitas para as próximas sprints.

## 5. Critérios de conclusão

A sprint será considerada concluída após a revisão das entregas e a verificação dos seguintes pontos:

- RF05: critérios de inclusão e exclusão cadastrados e persistidos por estudo.
- RF06: visitas previstas e atividades cadastradas e persistidas.
- RF07: estados dos estudos gerenciados com validação das transições.
- RF08: candidatos cadastrados e consultados por estudo.
- RF09: avaliação de elegibilidade registrada e consultável.
- RF10: consentimento simulado registrado e consultável.
- RF11: inclusão bloqueada quando não houver elegibilidade, consentimento ou vaga disponível.
- Interface web integrada à API e ao banco de dados, com tratamento de sucesso e erro.
- Protótipos mobile navegáveis, com fluxos simulados e documentação das funcionalidades e pendências.
- Testes automatizados executados no pipeline, incluindo testes unitários, de integração e de componentes web.
- Evidência da cobertura do código de negócio do backend, com meta mínima de 80% das linhas.
- README da Release 1, documentação Swagger/OpenAPI e registro das pendências conhecidas atualizados.
- Pull requests revisados, integração validada e evidências organizadas.
- Review, retrospectiva e registro das atividades de encerramento realizados.

## 6. Acompanhamento e encerramento

O acompanhamento das atividades será realizado pelo Azure DevOps, com atualização dos responsáveis, do andamento das tasks, das dependências e dos impedimentos.

O período da Sprint 2 está previsto para **27/10/2026 a 09/11/2026**, com disponibilidade de 20 horas semanais por integrante, totalizando 40 horas por pessoa e 240 horas para a equipe.

A reunião de acompanhamento está prevista para **02/11/2026**, e a Sprint Review para **08/11/2026**.

O encerramento da Sprint 2 deverá consolidar as entregas das duas sprints da Release 1, registrando os requisitos concluídos, parcialmente implementados e pendentes, os resultados dos testes, a cobertura, as evidências e as pendências conhecidas.

A conclusão da Release 1 está prevista para **09/11/2026**, com preparação da versão identificada como `release1`, criação da tag e do GitHub Release e consolidação do registro oficial em `releases/release1/README.md`.