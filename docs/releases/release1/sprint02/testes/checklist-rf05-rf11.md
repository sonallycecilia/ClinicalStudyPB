//depois alterar esse nome para ficar melhor desenhado:

# Checklist de Qualidade — RF05 a RF11

**Projeto:** ClinicalStudyPB  
**Sprint:** 2  
**Responsável:** QA: Marcella
**Período:** 27/10/2026 a 09/11/2026  
**Status:** Em execução

## 1. Objetivo

Definir os cenários e critérios de validação das funcionalidades correspondentes aos requisitos RF05 a RF11, verificando o comportamento esperado, as regras de negócio, a integridade dos dados e o tratamento de situações inválidas.

Este documento servirá como referência para a execução dos testes de qualidade da Sprint 2.

## 2. Critérios gerais de qualidade

Durante a validação, deverão ser considerados:

- Funcionamento correto das operações de cadastro, consulta e atualização.
- Validação dos campos obrigatórios.
- Consistência dos relacionamentos entre estudos, visitas, candidatos e participantes.
- Persistência correta das informações no banco de dados.
- Aplicação das regras de negócio.
- Tratamento adequado de entradas inválidas e operações não permitidas.
- Retorno de mensagens e códigos HTTP coerentes com o resultado da operação.

## 3. Cenários de teste

### RF05 — Definir critérios de inclusão e exclusão

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF05-01 | Cadastrar critérios de inclusão | Critérios cadastrados e associados ao estudo correto. | Não executado |
| CT-RF05-02 | Cadastrar critérios de exclusão | Critérios cadastrados e associados ao estudo correto. | Não executado |
| CT-RF05-03 | Consultar critérios cadastrados | Critérios retornados corretamente. | Não executado |
| CT-RF05-04 | Enviar cadastro sem campos obrigatórios | Operação rejeitada com validação adequada. | Não executado |
| CT-RF05-05 | Verificar persistência dos critérios | Informações permanecem disponíveis após nova consulta. | Não executado |

### RF06 — Definir visitas previstas e suas atividades

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF06-01 | Cadastrar visita prevista | Visita cadastrada e vinculada ao estudo. | Não executado |
| CT-RF06-02 | Cadastrar atividades de uma visita | Atividades associadas à visita correta. | Não executado |
| CT-RF06-03 | Consultar visitas e atividades | Informações retornadas corretamente. | Não executado |
| CT-RF06-04 | Cadastrar visita com dados obrigatórios ausentes | Operação rejeitada com validação adequada. | Não executado |
| CT-RF06-05 | Verificar integridade dos relacionamentos | Visitas e atividades permanecem associadas corretamente. | Não executado |

### RF07 — Gerenciar estados do estudo

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF07-01 | Consultar estado de um estudo | Estado atual retornado corretamente. | Não executado |
| CT-RF07-02 | Alterar estado do estudo | Alteração realizada e persistida. | Não executado |
| CT-RF07-03 | Informar estado inexistente ou inválido | Operação rejeitada com validação adequada. | Não executado |
| CT-RF07-04 | Consultar estado após atualização | Estado atualizado retornado corretamente. | Não executado |
| CT-RF07-05 | Verificar regras de transição de estados | Alterações respeitam as regras de negócio definidas. | Não executado |

### RF08 — Cadastrar candidatos vinculados a um estudo

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF08-01 | Cadastrar candidato com dados válidos | Candidato cadastrado e vinculado ao estudo. | Não executado |
| CT-RF08-02 | Consultar candidato cadastrado | Dados do candidato retornados corretamente. | Não executado |
| CT-RF08-03 | Cadastrar candidato sem campos obrigatórios | Operação rejeitada com validação adequada. | Não executado |
| CT-RF08-04 | Vincular candidato a estudo inexistente | Operação rejeitada. | Não executado |
| CT-RF08-05 | Verificar persistência do candidato | Dados permanecem disponíveis após nova consulta. | Não executado |

### RF09 — Registrar avaliação dos critérios de elegibilidade

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF09-01 | Registrar avaliação de elegibilidade | Avaliação registrada para o candidato correto. | Não executado |
| CT-RF09-02 | Registrar avaliação com critérios atendidos | Resultado de elegibilidade correspondente à avaliação. | Não executado |
| CT-RF09-03 | Registrar avaliação com critérios não atendidos | Resultado de inelegibilidade correspondente à avaliação. | Não executado |
| CT-RF09-04 | Consultar avaliação registrada | Informações retornadas corretamente. | Não executado |
| CT-RF09-05 | Verificar associação da avaliação | Avaliação vinculada ao candidato e estudo corretos. | Não executado |

### RF10 — Registrar consentimento simulado do candidato

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF10-01 | Registrar consentimento do candidato | Consentimento registrado corretamente. | Não executado |
| CT-RF10-02 | Consultar consentimento registrado | Informação retornada corretamente. | Não executado |
| CT-RF10-03 | Verificar persistência do consentimento | Registro permanece disponível após nova consulta. | Não executado |
| CT-RF10-04 | Tentar incluir candidato sem consentimento | Inclusão impedida. | Não executado |

### RF11 — Incluir candidatos como participantes

| ID | Cenário | Resultado esperado | Status |
|---|---|---|---|
| CT-RF11-01 | Incluir candidato elegível e consentido | Candidato incluído como participante. | Não executado |
| CT-RF11-02 | Tentar incluir candidato inelegível | Inclusão impedida. | Não executado |
| CT-RF11-03 | Tentar incluir candidato sem consentimento | Inclusão impedida. | Não executado |
| CT-RF11-04 | Tentar incluir candidato com limite de vagas atingido | Inclusão impedida. | Não executado |
| CT-RF11-05 | Verificar quantidade de participantes após inclusão | Quantidade atualizada corretamente. | Não executado |
| CT-RF11-06 | Tentar incluir novamente o mesmo candidato | Duplicidade impedida, conforme regra de negócio. | Não executado |

## 4. Registro da execução

Para cada cenário executado, registrar:

- **Data da execução:**
- **Responsável:**
- **Ambiente:**
- **Versão/branch testada:**
- **Resultado obtido:**
- **Status:** Aprovado / Reprovado / Bloqueado.
- **Evidência:** link para captura de tela, resposta da API ou log.
- **Observações:** descrição de falhas ou comportamentos inesperados.

## 5. Resumo dos resultados

| Status | Quantidade |
|---|---:|
| Aprovados | 0 |
| Reprovados | 0 |
| Bloqueados | 0 |
| Não executados | 35 |
| **Total** | **35** |

*Os quantitativos deverão ser atualizados conforme a execução dos cenários.*

## 6. Registro de problemas encontrados

| ID do cenário | Problema identificado | Severidade | Responsável pela correção | Status |
|---|---|---|---|---|
| - | Nenhum problema registrado inicialmente. | - | - | - |

## 7. Conclusão

A conclusão da validação será registrada após a execução dos cenários, considerando os resultados obtidos, os problemas identificados e as funcionalidades que permanecerem pendentes.


