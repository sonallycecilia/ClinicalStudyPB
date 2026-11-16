# ClinicalStudyPB

O **ClinicalStudyPB — Sistema de Gestão de Estudos Clínicos** é um projeto acadêmico desenvolvido na disciplina de Engenharia de Software II, no semestre 2026.2. Seu objetivo é apoiar a gestão operacional de estudos clínicos, abrangendo atividades como cadastro de estudos, recrutamento de candidatos, avaliação de elegibilidade, registro de consentimento, acompanhamento de participantes e relatórios de progresso. O sistema é composto por uma aplicação web, um aplicativo mobile, um backend REST e um banco de dados PostgreSQL, utilizando dados fictícios e sem fornecer suporte a diagnósticos ou decisões clínicas automatizadas.

## Visão geral

A solução contempla quatro perfis de usuários:

- **Administrador:** gerencia usuários e seus perfis de acesso.
- **Pesquisador:** cadastra e gerencia estudos e suas configurações.
- **Coordenador:** atua nas atividades operacionais dos estudos.
- **Participante:** utiliza o aplicativo mobile destinado ao acompanhamento de sua participação.

## Tecnologias

O projeto é organizado em quatro componentes principais:

| Componente | Tecnologia |
|---|---|
| Backend | TypeScript, NestJS, Node.js |
| Web | TypeScript, React, Vite |
| Mobile | TypeScript, React Native, Expo |
| Banco de dados | PostgreSQL |
| Testes backend | Jest + Supertest |
| Testes web | Vitest + Testing Library |
| Testes E2E web | Cypress |
| Testes mobile | Jest + React Native Testing Library |
| CI | GitHub Actions |

A comunicação entre as interfaces e o backend ocorre por meio de uma API REST, responsável pela autenticação, autorização, validações e regras de negócio. Os dados são armazenados no PostgreSQL.

## Documentação

Para mais informações sobre arquitetura, diagramas, requisitos funcionais, funcionalidades implementadas, instalação e execução, banco de dados, testes, documentação da API e processo de desenvolvimento, consulte o **[README da Release 1](docs/releases/release1/README.md)**.

Esse documento reúne o registro detalhado da primeira entrega do projeto, abrangendo as Sprints 1 e 2 e os requisitos RF01 a RF11.