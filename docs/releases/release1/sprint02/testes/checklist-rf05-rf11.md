# Checklist de Testes Funcionais — RF05 a RF11

**Projeto:** ClinicalStudyPB  
**Release:** 1 — Sprint 2  
**Responsável:** QA  
**Período:** 27/10/2026 a 09/11/2026

## RF05 — Critérios de Inclusão e Exclusão

- [ ] **CT-RF05-01:** Cadastrar critérios de inclusão e exclusão válidos, vinculados ao estudo correto.
- [ ] **CT-RF05-02:** Consultar critérios de um estudo, sem retornar critérios de outros estudos.
- [ ] **CT-RF05-03:** Impedir cadastro com campos obrigatórios ausentes ou inválidos.
- [ ] **CT-RF05-04:** Impedir vínculo com estudos ou critérios inexistentes ou incompatíveis.
- [ ] **CT-RF05-05:** Impedir acesso de usuários não autenticados ou sem autorização.

## RF06 — Visitas e Atividades Previstas

- [ ] **CT-RF06-01:** Cadastrar visitas e atividades vinculadas corretamente.
- [ ] **CT-RF06-02:** Consultar visitas e atividades, preservando seus vínculos e ordenação.
- [ ] **CT-RF06-03:** Impedir cadastro com campos obrigatórios ausentes ou inválidos.
- [ ] **CT-RF06-04:** Impedir vínculos com visitas ou estudos inexistentes ou incompatíveis.
- [ ] **CT-RF06-05:** Impedir acesso de usuários não autenticados ou sem autorização.

## RF07 — Estados do Estudo

- [ ] **CT-RF07-01:** Criar estudo com estado inicial Planejamento.
- [ ] **CT-RF07-02:** Permitir transições válidas entre os estados do estudo.
- [ ] **CT-RF07-03:** Impedir transições inválidas, preservando o estado anterior.
- [ ] **CT-RF07-04:** Consultar o estado persistido do estudo.
- [ ] **CT-RF07-05:** Impedir alterações em estudos inexistentes ou sem autorização.

## RF08 — Cadastro de Candidatos

- [ ] **CT-RF08-01:** Cadastrar candidato com dados válidos e vínculo ao estudo correto.
- [ ] **CT-RF08-02:** Listar candidatos por estudo, sem apresentar registros de outros estudos.
- [ ] **CT-RF08-03:** Impedir cadastro com nome ausente ou inválido e e-mail em formato incorreto.
- [ ] **CT-RF08-04:** Impedir cadastro de candidato vinculado a estudo inexistente.
- [ ] **CT-RF08-05:** Impedir acesso de usuários não autenticados ou sem autorização.

## RF09 — Avaliação de Elegibilidade

- [ ] **CT-RF09-01:** Classificar candidato como elegível quando atender aos critérios de inclusão e não atender aos de exclusão.
- [ ] **CT-RF09-02:** Classificar candidato como inelegível quando não atender a algum critério de inclusão ou atender a algum de exclusão.
- [ ] **CT-RF09-03:** Classificar candidato como Em avaliação quando ainda houver respostas pendentes.
- [ ] **CT-RF09-04:** Consultar avaliações existentes e tratar candidatos sem avaliações registradas.
- [ ] **CT-RF09-05:** Impedir avaliações incompletas, duplicadas ou vinculadas a critérios inválidos.
- [ ] **CT-RF09-06:** Impedir avaliações e consultas de candidatos inexistentes ou sem autorização.

## RF10 — Consentimento Simulado

- [ ] **CT-RF10-01:** Registrar consentimento com dados válidos e vínculo ao candidato, estudo e pesquisador.
- [ ] **CT-RF10-02:** Consultar o consentimento registrado ou retornar ausência de registro.
- [ ] **CT-RF10-03:** Impedir registro com campos obrigatórios ausentes ou inválidos.
- [ ] **CT-RF10-04:** Impedir registros vinculados a candidatos inexistentes ou sem autorização.

## RF11 — Inclusão de Candidatos

- [ ] **CT-RF11-01:** Incluir candidato elegível, com critérios aprovados, consentimento registrado e vaga disponível.
- [ ] **CT-RF11-02:** Impedir inclusão de candidato inelegível ou com critérios não atendidos.
- [ ] **CT-RF11-03:** Impedir inclusão sem consentimento registrado.
- [ ] **CT-RF11-04:** Impedir inclusão quando o limite de participantes for atingido.
- [ ] **CT-RF11-05:** Impedir inclusão de candidatos inexistentes ou sem autorização.
- [ ] **CT-RF11-06:** Garantir rollback quando ocorrer falha durante a inclusão.
- [ ] **CT-RF11-07:** Garantir que inclusões simultâneas não ultrapassem o limite de participantes.
- [ ] **CT-RF11-08:** Impedir duplicidade de inclusão do mesmo candidato.
- [ ] **CT-RF11-09:** Validar permissões e estados do estudo para realizar a inclusão.