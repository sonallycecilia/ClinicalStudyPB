# ClinicalStudyPB — Sistema de Gestão de Estudos Clínicos

## 1. Sobre o projeto

O ClinicalStudyPB é um sistema desenvolvido na disciplina de Engenharia de Software II, no semestre 2026.2, com o objetivo de apoiar o gerenciamento de estudos clínicos, incluindo protocolos, recrutamento de participantes, elegibilidade, visitas, acompanhamento e relatórios.

O sistema utiliza dados fictícios e não realiza diagnósticos ou decisões clínicas automatizadas.

## 2. Equipe e responsabilidades

| Papel | Integrante | Responsabilidade |
|---|---|---|
| Líder técnico / Gerente | Marcella | Arquitetura, integração e planejamento |
| Backend | Sonally | Dados e regras de negócio |
| Web 1 | Lethycia | Estudos, protocolos e usuários |
| Web 2 | Zeton | Recrutamento, visitas e relatórios |
| Mobile | Leticia | Aplicativo do participante e protótipos |
| QA / DevOps | Laryssa | Pipeline e coordenação da qualidade |

## 3. Tecnologias utilizadas

| Componente | Tecnologia |
|---|---|
| Backend | TypeScript, NestJS e Node.js |
| Web | TypeScript, React e Vite |
| Mobile | TypeScript, React Native e Expo |
| Banco de dados | PostgreSQL |
| Testes do backend | Jest e Supertest |
| Testes web | Vitest e Testing Library |
| Testes E2E web | Cypress |
| Testes mobile | Jest e React Native Testing Library |
| Integração contínua | GitHub Actions |

## 4. Arquitetura

O sistema é composto por uma aplicação web, um aplicativo mobile e uma API REST compartilhada. A API concentra as regras de negócio e a comunicação com o banco de dados PostgreSQL.

A documentação da API será disponibilizada com OpenAPI/Swagger.

## 5. Requisitos funcionais

Os requisitos funcionais do sistema são identificados de RF01 a RF22. A descrição e o acompanhamento de cada requisito serão documentados em `docs/requisitos/requisitos-funcionais.md`.

## 6. Testes e qualidade

O projeto utiliza testes automatizados e integração contínua para verificar o funcionamento dos componentes. A meta de cobertura é de, no mínimo, 80% das linhas de código de negócio do backend.

Os resultados dos testes e da cobertura serão registrados ao longo do desenvolvimento.

## 7. Instalação e execução

As instruções de instalação, configuração do ambiente e execução do backend, da aplicação web, do aplicativo mobile e do banco de dados serão adicionadas conforme a estrutura do projeto for configurada.

## 8. Documentação complementar

A documentação do projeto incluirá requisitos funcionais, diagramas de arquitetura, decisões técnicas, evidências das sprints e relatórios das releases.
