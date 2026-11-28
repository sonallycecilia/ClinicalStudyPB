# Ambiguidades do contrato da AB 4128

Registro de 27/11/2026 para revisão da PO, referente à S3C-BE-02 da Sprint 4. As decisões abaixo descrevem a implementação atual na branch `feature/4128-exigir-vinculo-candidato`. São interpretações técnicas adotadas durante a implementação; sua documentação não equivale a aprovação expressa da PO.

Referência: [contrato D03/D10 da PO, versão 1.1](https://github.com/sonallycecilia/ClinicalStudyPB/blob/2aabeaf2b848a41d3ba0aef7f20920e1dd95492c/docs/releases/release2/sprint04/especificacao-de-contratos-e-aceite-po-sc3.md), publicado na branch `docs/sprint-4-PO`, commit `2aabeaf2b848a41d3ba0aef7f20920e1dd95492c`. A S3C-PO-01 foi considerada Done conforme informado pelo solicitante, embora o documento mantenha o cabeçalho “Em revisão”.

## A01 Autorização individual do Coordenador no estudo

**Contrato:** o cadastro é descrito como operação do Coordenador do estudo, com retorno `403` fora do estudo.

**Ambiguidade:** o modelo atual não possui associação individual entre Coordenador e estudo. A regra existente permite ao Coordenador ativo acessar todos os estudos em recrutamento. Assim, não há informação persistida que permita distinguir um estudo autorizado de um estudo alheio para esse perfil.

**Interpretação implementada:** preservar a autorização existente, permitindo cadastro pelo Coordenador ativo em estudos em recrutamento e retornando `403` nas demais fases. Não foi criada uma associação de equipe nesta task.

**Impacto:** um Coordenador ativo pode cadastrar candidatos em qualquer estudo em recrutamento, inclusive de outro Pesquisador.

**Decisão a confirmar pela PO:** se a expressão Coordenador do estudo representa a política atual ou exige um vínculo individual ainda não modelado. Exigir esse vínculo implicaria definir sua origem e evoluir a autorização e o modelo de dados.

## A02 Cadastro pelo Pesquisador proprietário

**Contrato:** D03 e o contrato de cadastro descrevem o fluxo do Coordenador.

**Ambiguidade:** não há revogação expressa da permissão anterior de cadastro pelo Pesquisador proprietário, e a solicitação da #4128 exige preservar os comportamentos de RF08 que não conflitem com o novo contrato.

**Interpretação implementada:** preservar essa permissão, exigindo também uma conta Participante ativa. O Pesquisador continua restrito aos próprios estudos e não pode cadastrar em estudo encerrado. As permissões anteriores em planejamento e execução foram mantidas.

**Impacto:** o cadastro não ficou exclusivo do Coordenador.

**Decisão a confirmar pela PO:** se o Pesquisador proprietário mantém a permissão ou se o novo cadastro deve ser exclusivo do Coordenador.

## A03 Abrangência de D10 em RF09 e RF10

**Contrato:** preservar candidatos legados sem conta, permitir consulta nas novas etapas que dependem da conta e mantê-los fora de RF17–RF18.

**Ambiguidade:** D10 não enumera quais operações dependem da conta. RF09 (avaliação de elegibilidade) e RF10 (consentimento de recrutamento) anteriormente operavam pelo identificador do candidato, sem usar diretamente sua conta.

**Interpretação implementada:** aplicar consulta apenas ao avanço do recrutamento de candidatos sem vínculo. Permanecem permitidos a listagem e os GET de avaliações e consentimentos. Novos POST de avaliações RF09, consentimentos RF10 e inclusão RF11 retornam `422`, com `codigo: CANDIDATO_SEM_VINCULO`, antes de qualquer gravação.

**Impacto:** candidatos legados sem conta não podem receber nova avaliação nem novo registro de consentimento, inclusive recusa ou revogação. Avaliações, consentimentos, estados e participações históricos permanecem preservados e consultáveis pelas regras de acesso existentes.

**Prioridade para revisão:** esta é a interpretação mais restritiva registrada. Os testes confirmam o comportamento implementado, mas não resolvem a intenção da PO sobre RF09/RF10.

**Decisão a confirmar pela PO:** se RF09 e RF10 devem continuar permitindo gravações em legados, mantendo o bloqueio das operações que efetivamente exigem conta, ou se o bloqueio de todo avanço RF09–RF11 corresponde ao aceite pretendido. Se a primeira interpretação for escolhida, os bloqueios de RF09/RF10 e seus testes precisarão ser ajustados, preservando os históricos.

## A04 Código HTTP para duplicação

**Contrato:** define `201`, `401`, `403` e `422` para os cenários de cadastro, sem especificar a resposta para repetição da mesma conta no mesmo estudo.

**Interpretação implementada:** retornar `409 Conflict` para violação da constraint `candidatos_estudo_usuario_unico`, inclusive em requisições concorrentes. A mesma conta pode ser associada a estudos diferentes.

**Justificativa e impacto:** segue o padrão de conflito de unicidade do backend e permite ao cliente distinguir uma duplicação de uma conta inválida. A tentativa rejeitada não sobrescreve o candidato existente.

**Decisão a confirmar pela PO:** se `409` deve compor o contrato publicado para duplicação.

## Rastreabilidade da implementação

- `backend/src/studies/studies.service.ts`: autorização existente por perfil, propriedade e fase do estudo (A01/A02).
- `backend/src/studies/candidates.controller.ts`: perfis permitidos e documentação HTTP (A02/A04).
- `backend/src/studies/candidates.service.ts`: bloqueios D10 e tratamento da constraint de duplicação (A03/A04).
- `backend/src/studies/candidates.link.spec.ts` e `backend/test/candidate-link.e2e-spec.ts`: verificação do comportamento adotado.
- `backend/src/studies/candidates.authorization.spec.ts`: regressão das permissões existentes.

Este registro não altera código, permissões, dados históricos ou o Azure. As definições de apresentação e integração Web/Mobile permanecem no escopo das respectivas tasks.
