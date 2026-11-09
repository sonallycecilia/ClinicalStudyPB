# Relatório de Cobertura e Qualidade dos Testes Automatizados — Backend

## 1. Objetivo

Este relatório apresenta os resultados da suíte de testes automatizados do backend do ClinicalStudyPB, estabelecendo uma referência para acompanhar a qualidade do código e orientar melhorias na cobertura dos testes.

Além de registrar os resultados da execução, são definidos indicadores e metas para ampliar a abrangência dos testes, reduzir caminhos não validados e fortalecer a confiabilidade da aplicação.

## 2. Indicadores atuais

**Execução realizada em 08/11/2026**

| Indicador | Resultado |
|---|---:|
| Suítes aprovadas | 18 |
| Testes aprovados | 104 |
| Testes com falha | 0 |
| Statements | 91,08% |
| Branches | 79,09% |
| Functions | 99,29% |
| Lines | 93,78% |

A execução contemplou testes unitários e E2E, todos concluídos sem falhas.

### Distribuição dos testes

| Categoria | Suítes | Testes aprovados |
|---|---:|---:|
| Unitários | 15 | 77 |
| Integração/E2E | 3 | 27 |
| **Total** | **18** | **104** |

## 3. Metas de qualidade

Para orientar a evolução da suíte automatizada, são propostas as seguintes metas:

| Indicador | Atual | Meta inicial | Diferença |
|---|---:|---:|---:|
| Statements | 91,08% | 95% | +3,92 p.p. |
| Branches | 79,09% | 85% | +5,91 p.p. |
| Functions | 99,29% | 100% | +0,71 p.p. |
| Lines | 93,78% | 95% | +1,22 p.p. |

As metas são referências internas para evolução da qualidade e poderão ser revisadas conforme a maturidade do projeto.

## 4. Oportunidades de melhoria

A análise da cobertura por módulo permite identificar onde os esforços de melhoria devem ser priorizados.

| Módulo | Lines | Branches | Prioridade |
|---|---:|---:|---|
| Database | 81,48% | 44,44% | Alta |
| Swagger | 100% | 57,14% | Avaliar necessidade |
| Users | 86,04% | 87,61% | Média |
| Auth | 96,29% | 78,65% | Média |
| Studies | 93,54% | 80,05% | Média |

### Prioridades de melhoria

**1. Banco de dados**

Apresenta a menor cobertura, principalmente em ramificações. Priorizar a análise dos caminhos condicionais e dos comportamentos de sucesso e falha dos serviços de acesso a dados.

**2. Autenticação e autorização**

Ampliar os cenários de condições alternativas, incluindo situações de acesso permitido, negado e dados de autenticação inválidos.

**3. Regras de negócio dos estudos**

Complementar os testes de condições alternativas relacionadas ao gerenciamento de estudos, critérios, visitas e candidatos.

**4. Swagger**

Avaliar os caminhos não cobertos e verificar se correspondem a comportamentos relevantes que justifiquem novos testes.

## 5. Plano de evolução

| Ação | Resultado esperado |
|---|---|
| Revisar trechos não cobertos do módulo Database | Ampliar cobertura de instruções e ramificações |
| Complementar testes de autenticação e autorização | Validar mais condições de acesso |
| Ampliar cenários alternativos das regras de negócio | Reduzir caminhos funcionais não exercitados |
| Executar novamente a suíte após as melhorias | Medir a evolução dos indicadores |
| Validar a execução na CI | Garantir repetibilidade dos testes no ambiente automatizado |

## 6. Acompanhamento das metas

Os indicadores desta execução constituem a linha de base para as próximas avaliações.

| Indicador | Linha de base | Meta | Próxima medição |
|---|---:|---:|---|
| Statements | 91,08% | 95% | Pendente |
| Branches | 79,09% | 85% | Pendente |
| Functions | 99,29% | 100% | Pendente |
| Lines | 93,78% | 95% | Pendente |

A próxima medição deverá ser realizada após a implementação das melhorias, permitindo comparar os resultados e verificar o cumprimento das metas.

## 7. Considerações finais

A suíte atual apresenta 104 testes aprovados, sem falhas, e cobertura de 93,78% das linhas de código.

Apesar do resultado positivo, a análise evidencia oportunidades de melhoria, especialmente no módulo de banco de dados e na cobertura de ramificações.

O foco das próximas evoluções será ampliar a cobertura dos caminhos relevantes da aplicação, mantendo a estabilidade dos testes existentes e utilizando os indicadores como instrumento de acompanhamento contínuo da qualidade do backend.