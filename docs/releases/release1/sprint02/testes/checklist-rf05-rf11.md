# Plano e Checklist de Testes Funcionais — RF05 a RF11

**Projeto:** ClinicalStudyPB  
**Sprint:** 2  
**Responsável:** QA — Marcella  
**Período:** 27/10/2026 a 09/11/2026  
**Status:** Em execução

## 1. Objetivo

Definir os cenários e critérios de validação das funcionalidades correspondentes aos requisitos RF05 a RF11, verificando o comportamento esperado, as regras de negócio, a integridade dos dados e o tratamento de situações inválidas.

Este documento servirá como referência para o planejamento e a execução dos testes de qualidade da Sprint 2.

## 2. Critérios gerais de qualidade

Durante a validação, deverão ser considerados:

- Funcionamento correto das operações de cadastro e consulta.
- Validação dos campos obrigatórios.
- Consistência dos relacionamentos entre estudos, visitas, atividades, candidatos e participantes.
- Persistência correta das informações no banco de dados.
- Aplicação das regras de negócio definidas.
- Tratamento adequado de entradas inválidas e operações não permitidas.
- Retorno de mensagens e códigos HTTP coerentes com o resultado da operação.

## 3. Cenários de teste

### RF05 — Definir critérios de inclusão e exclusão para cada estudo

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF05-01 | Cadastrar critérios de inclusão | Critérios cadastrados e associados ao estudo correto. |
| CT-RF05-02 | Cadastrar critérios de exclusão | Critérios cadastrados e associados ao estudo correto. |
| CT-RF05-03 | Consultar critérios cadastrados | Critérios de inclusão e exclusão retornados corretamente. |
| CT-RF05-04 | Enviar cadastro sem campos obrigatórios | Operação rejeitada com validação adequada. |
| CT-RF05-05 | Verificar persistência dos critérios | Informações permanecem disponíveis após nova consulta. |

### RF06 — Definir visitas previstas e suas atividades

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF06-01 | Cadastrar visita prevista | Visita cadastrada e vinculada ao estudo correto. |
| CT-RF06-02 | Cadastrar atividades de uma visita | Atividades associadas à visita correta. |
| CT-RF06-03 | Consultar visitas e atividades | Informações retornadas corretamente. |
| CT-RF06-04 | Cadastrar visita sem campos obrigatórios | Operação rejeitada com validação adequada. |
| CT-RF06-05 | Verificar integridade dos relacionamentos | Visitas e atividades permanecem associadas corretamente após consulta. |

### RF07 — Gerenciar os estados do estudo

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF07-01 | Alterar estado do estudo para planejamento | Estado atualizado e persistido corretamente. |
| CT-RF07-02 | Alterar estado do estudo para recrutamento | Estado atualizado e persistido corretamente. |
| CT-RF07-03 | Alterar estado do estudo para execução | Estado atualizado e persistido corretamente. |
| CT-RF07-04 | Alterar estado do estudo para encerrado | Estado atualizado e persistido corretamente. |
| CT-RF07-05 | Informar estado inexistente ou inválido | Operação rejeitada com validação adequada. |
| CT-RF07-06 | Consultar estado após atualização | Estado atual retornado corretamente. |

### RF08 — Cadastrar candidatos vinculados a um estudo

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF08-01 | Cadastrar candidato com dados válidos | Candidato cadastrado e vinculado ao estudo. |
| CT-RF08-02 | Consultar candidato cadastrado | Dados do candidato retornados corretamente. |
| CT-RF08-03 | Cadastrar candidato sem campos obrigatórios | Operação rejeitada com validação adequada. |
| CT-RF08-04 | Vincular candidato a estudo inexistente | Operação rejeitada. |
| CT-RF08-05 | Verificar persistência do candidato | Dados permanecem disponíveis após nova consulta. |

### RF09 — Registrar a avaliação dos critérios de elegibilidade

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF09-01 | Registrar avaliação de elegibilidade | Avaliação registrada para o candidato correto. |
| CT-RF09-02 | Avaliar candidato que atende aos critérios | Resultado de elegibilidade correspondente à avaliação. |
| CT-RF09-03 | Avaliar candidato que não atende aos critérios | Resultado de inelegibilidade correspondente à avaliação. |
| CT-RF09-04 | Consultar avaliação registrada | Informações da avaliação retornadas corretamente. |
| CT-RF09-05 | Verificar associação da avaliação | Avaliação vinculada ao candidato e estudo corretos. |

### RF10 — Registrar o consentimento simulado do candidato

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF10-01 | Registrar consentimento do candidato | Consentimento simulado registrado corretamente. |
| CT-RF10-02 | Consultar consentimento registrado | Informação retornada corretamente. |
| CT-RF10-03 | Verificar persistência do consentimento | Registro permanece disponível após nova consulta. |
| CT-RF10-04 | Tentar incluir candidato sem consentimento | Inclusão impedida. |

### RF11 — Incluir candidatos elegíveis e com consentimento registrado, respeitando o limite de vagas

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-RF11-01 | Incluir candidato elegível e com consentimento registrado | Candidato incluído como participante. |
| CT-RF11-02 | Tentar incluir candidato inelegível | Inclusão impedida. |
| CT-RF11-03 | Tentar incluir candidato sem consentimento | Inclusão impedida. |
| CT-RF11-04 | Tentar incluir candidato com limite de vagas atingido | Inclusão impedida. |
| CT-RF11-05 | Verificar quantidade de participantes após inclusão | Quantidade atualizada corretamente. |
| CT-RF11-06 | Tentar incluir novamente o mesmo candidato | Duplicidade impedida, conforme regra de negócio. |

## 4. Registro da execução

Para cada cenário executado, registrar:

- **Data da execução:**
- **Responsável:**
- **Ambiente:**
- **Versão/branch testada:**
- **Dados utilizados:**
- **Passos executados:**
- **Resultado esperado:**
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
| Não executados | 36 |
| **Total** | **36** |

*Os quantitativos deverão ser atualizados conforme a execução dos cenários.*

## 6. Registro de problemas encontrados

| ID do cenário | Problema identificado | Severidade | Responsável pela correção | Status |
|---|---|---|---|---|
| - | Nenhum problema registrado inicialmente. | - | - | - |

## 7. Observações sobre a execução

- Os cenários deverão ser executados considerando os endpoints e as funcionalidades efetivamente implementados.
- As regras de transição dos estados do estudo deverão ser verificadas conforme as regras de negócio documentadas.
- Os dados utilizados nos testes deverão permitir a reprodução dos cenários.
- Cenários cuja funcionalidade ainda não esteja implementada deverão ser registrados como bloqueados, com a respectiva justificativa.
- Os resultados deverão ser acompanhados de evidências.

## 8. Conclusão

A conclusão da validação será registrada após a execução dos cenários, considerando os resultados obtidos, os problemas identificados e as funcionalidades que permanecerem pendentes.