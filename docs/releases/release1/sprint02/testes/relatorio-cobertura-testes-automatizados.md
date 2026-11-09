# Relatório de cobertura e qualidade dos testes automatizados — RF05 a RF11

**Projeto:** ClinicalStudyPB
**Branch:** `test/sprint-2-qa-integration`
**Data da execução:** 09/11/2026

## 1. Resumo da execução

| Suíte | Suítes/arquivos | Testes executados | Aprovados | Reprovados |
|---|---:|---:|---:|---:|
| Backend unitário | 16 | 135 | 135 | 0 |
| Backend integração/E2E | 6 | 62 | 62 | 0 |
| Backend com cobertura (unitário + E2E) | 22 | 197 | 197 | 0 |
| Frontend Vitest/Testing Library | 27 | 532 | 532 | 0 |

O comando combinado de cobertura backend executou os 197 testes novamente; esses resultados não devem ser somados aos resultados unitário e E2E como testes adicionais. No frontend, um teste de integração Web foi adicionado para verificar o fluxo sequencial RF09 → RF10 → RF11.

## 2. Cobertura de código

### Backend

Relatório gerado por `npm run test:coverage:all`:

| Métrica de cobertura de código | Resultado |
|---|---:|
| Statements | 91,74% |
| Branches | 81,74% |
| Functions | 99,32% |
| Lines | 94,32% |

São percentuais de código-fonte instrumentado pelo Jest; não indicam percentual de requisitos atendidos nem de cenários funcionais aprovados. A cobertura inclui `src/` conforme `jest-coverage.config.cjs`.

### Frontend

Relatório gerado pelo Vitest com o provedor V8:

| Métrica de cobertura de código | Resultado |
|---|---:|
| Statements | 96,29% |
| Branches | 93,51% |
| Functions | 87,65% |
| Lines | 96,29% |

A cobertura agregada é alta, mas não uniforme por arquivo. `src/main.tsx` e `src/auth/localUsers.ts` ficaram com 0% de statements; `src/types.ts` também aparece com 0%, sem statements executáveis. `src/auth/AuthContext.tsx` ficou em 75,83% de statements e `src/App.tsx` em 87,80%. `src/components/AppLayout.tsx` teve 61,11% de branches; `src/components/StatusDialog.tsx`, 69,56% de branches e 71,42% de functions. São pontos para avaliar em ciclos futuros, não falhas dos testes nem evidência de defeito.

## 3. Cobertura funcional por requisito

O checklist relaciona os 45 CTs aos arquivos executados. No escopo confirmado, 42 CTs têm automação correspondente aprovada; três CTs condicionais estão marcados como **Não aplicável** enquanto as regras não forem confirmadas. Esta contagem é de cenários rastreados, não de linhas de código.

| Requisito | Cenários aprovados | Não aplicáveis | Situação do escopo confirmado |
|---|---:|---:|---|
| RF05 — Critérios de elegibilidade | 6 | 1 | Adequada; deduplicação não confirmada |
| RF06 — Visitas e atividades | 6 | 0 | Adequada |
| RF07 — Estados dos estudos | 5 | 0 | Adequada |
| RF08 — Cadastro/listagem de candidatos | 5 | 1 | Adequada; duplicidade de e-mail não confirmada |
| RF09 — Avaliação de elegibilidade | 6 | 1 | Adequada; política de reavaliação/histórico não definida |
| RF10 — Consentimento simulado | 5 | 0 | Adequada; política dos estados exercitada, aprovação de negócio pendente |
| RF11 — Inclusão de participantes | 9 | 0 | Adequada; algumas políticas condicionais aguardam confirmação |
| **Total** | **42** | **3** | |

Os três cenários Não aplicáveis são CT-RF05-07 (deduplicação de critérios), CT-RF08-06 (duplicidade de candidato por e-mail) e CT-RF09-07 (reavaliação bem-sucedida e política de histórico). Outros cenários condicionais têm testes para o comportamento atualmente implementado; o resultado desses testes não converte a política em requisito aprovado.

## 4. Principais comportamentos cobertos

- Cadastro, consulta, atualização, validação, relacionamentos e autorização de critérios, visitas, atividades e estados do estudo.
- Cadastro e listagem de candidatos, filtros por estudo/nome/status, validação, erros e estados de carregamento.
- Avaliação elegível, inelegível e pendente; critérios ativos, avaliação persistida/consultada, acesso e dados inválidos.
- Registro e consulta de consentimentos sem registro e nos estados Registrado, Recusado e Revogado.
- Inclusão com elegibilidade, consentimento e capacidade; bloqueios por pré-requisitos, duplicidade observada, concorrência na última vaga e rollback transacional.
- Interação Web sequencial de avaliação → consentimento → inclusão e atualização do status exibido na lista. O transporte deste teste Web é simulado; os E2E backend verificam a persistência PostgreSQL.

## 5. Falhas, limitações e observações

- Nenhum teste unitário, E2E ou frontend falhou.
- O teste E2E de rollback provoca intencionalmente uma violação de constraint PostgreSQL para comprovar a reversão da transação. O NestJS registra essa exceção no log, mas o teste espera a resposta de erro e passa.
- A suíte `StudyCriteriaSection.test.tsx` ainda emite um aviso React de atualização fora de `act(...)`; não causa falha e não foi alterada por ser alheio aos cenários novos.
- A cobertura frontend é agregada e deixa arquivos sem statements cobertos e lacunas de branches/functions; os principais pontos estão detalhados na seção 2 e não alteram o resultado aprovado dos testes.
- Os testes frontend usam transporte HTTP simulado e não comprovam, isoladamente, integração Web com um backend real.
- Três regras de negócio ainda precisam de confirmação (identificadas no checklist); não foram inventadas nem transformadas em critérios de reprovação.
- Não foi identificado defeito da aplicação durante as suítes executadas.

## 6. Comandos executados

```powershell
Set-Location backend
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:coverage:all

Set-Location web
npm test -- --reporter=dot
npm test -- src/integration/recruitmentFlows.integration.test.tsx --reporter=dot
npm test -- --coverage --reporter=dot
npm run build
```

O comando de cobertura Web executa os testes e gera o relatório de cobertura V8; os resultados estão separados dos indicadores de cobertura do backend.

## 7. Testes aproveitados, criados e modificados

### Testes preexistentes aproveitados

- Backend unitário: `criteria.service.spec.ts`, `criteria.dto.spec.ts`, `visits.service.spec.ts`, `visits.dto.spec.ts`, `studies.service.spec.ts`, `candidates.service.spec.ts`, `candidates.dto.spec.ts`, `candidates.assessment.service.spec.ts` e `candidates.assessment.dto.spec.ts`.
- Backend PostgreSQL/E2E: `studies.e2e-spec.ts`, `eligibility.e2e-spec.ts`, `consent.e2e-spec.ts` e `inclusion.e2e-spec.ts`.
- Frontend: testes de `StudyCriteriaSection`, `StudyVisitsSection`, estudos/status, formulário, cadastro/listagem de candidatos e interfaces de elegibilidade, consentimento e inclusão.

### Teste novo

- [recruitmentFlows.integration.test.tsx](../../../../../web/src/integration/recruitmentFlows.integration.test.tsx): fluxo RF09–RF11, com API simulada, validação da ordem das operações e atualização do status do candidato após inclusão.

### Arquivos de testes modificados

Nenhum teste existente foi modificado ou removido.

### Documentação modificada

- [checklist-rf05-rf11.md](./checklist-rf05-rf11.md): referências por CT, tipo, situação real da execução e regras condicionais.
- Este relatório: resultados medidos, cobertura de código, cobertura funcional rastreada, limitações e comandos.

## 8. Pendências

1. QA/equipe de produto: confirmar as três regras marcadas como Não aplicável e demais políticas condicionais identificadas no checklist.
2. QA: manter teste manual de ponta a ponta contra ambiente integrado como evidência complementar; os testes de frontend usam transporte simulado.
