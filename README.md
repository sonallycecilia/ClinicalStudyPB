# ClinicalStudyPB — Sistema de Gestão de Estudos Clínicos

## 1. Sobre o projeto

O ClinicalStudyPB é um sistema desenvolvido na disciplina de Engenharia de Software II, no semestre 2026.2, com o objetivo de apoiar o gerenciamento de estudos clínicos, incluindo protocolos, recrutamento de participantes, elegibilidade, visitas, acompanhamento e relatórios.

O sistema utiliza dados fictícios e não realiza diagnósticos ou decisões clínicas automatizadas.

## 2. Equipe e responsabilidades

| Papel | Integrante | Responsabilidade |
| --- | --- | --- |
| Líder técnico / Gerente | Marcella | Arquitetura, integração e planejamento |
| Backend | Sonally | Dados e regras de negócio |
| Web 1 | Lethycia | Estudos, protocolos e usuários |
| Web 2 | Zeton | Recrutamento, visitas e relatórios |
| Mobile | Leticia | Aplicativo do participante e protótipos |
| QA / DevOps | Laryssa | Pipeline e coordenação da qualidade |

## 3. Tecnologias utilizadas

| Componente | Tecnologia |
| --- | --- |
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

### Com Docker (ambiente de desenvolvimento)

Instale Docker com Compose v2 e mantenha o serviço Docker iniciado. No Windows e macOS, use Docker Desktop; no Linux, Docker Engine com o plugin Compose ou Docker Desktop. Use containers Linux.

Depois de clonar o repositório, execute na raiz:

```bash
docker compose up --build
```

Esse comando instala as dependências dentro das imagens e inicia PostgreSQL, aplica as migrations e inicia backend e web. Não é necessário instalar Node.js ou npm na máquina, executar `npm ci`, nem criar arquivos `.env` para a demonstração padrão.

Abra `http://localhost:5173`; a API fica em `http://localhost:3000`. A web inicia depois que a API estiver respondendo. As portas 3000 e 5173 devem estar livres; encerre servidores locais antes de usar Docker.

Alterações em `backend/src`, `web/src` e `web/index.html` são refletidas durante o desenvolvimento. As dependências ficam dentro das imagens, separadas do `node_modules` da máquina. Ao alterar dependências ou outros arquivos de configuração, execute novamente `docker compose up --build`.

Para rodar em segundo plano, use `docker compose up --build -d`. Para acompanhar os logs, use `docker compose logs -f`. Para parar e remover os containers, execute `docker compose down`; em primeiro plano, `Ctrl+C` também para os serviços.

Essa configuração é para desenvolvimento local. O Compose define a URL pública da API como `http://localhost:3000`, pois as chamadas partem do navegador. Os arquivos `.env` locais não são copiados para as imagens; configurações adicionais devem ser declaradas no Compose. Usuários e sessões são persistidos no PostgreSQL. O Compose habilita explicitamente o seed de quatro contas fictícias, preservando contas existentes. Consulte [PostgreSQL e migrations](docs/postgresql.md) para conexão e comandos.

### Sem Docker

Use Node.js 24, conforme `backend/.nvmrc`. Na raiz do repositório, instale as dependências uma vez:

```bash
npm ci
npm run setup
```

Depois, inicie backend e web juntos com um único comando:

```bash
npm run dev
```

Acesse a aplicação em `http://localhost:5173`. A API fica em `http://localhost:3000`.
Os logs aparecem no mesmo terminal, identificados por `backend` e `web`. Use `Ctrl+C` para encerrar os dois serviços. Se um deles encerrar, o outro também será encerrado.

As configurações opcionais estão em `backend/.env.example` e `web/.env.example`; copie para `.env` na respectiva pasta quando precisar personalizá-las. As portas 3000 e 5173 devem estar livres antes de iniciar. A web usa porta fixa para corresponder à origem CORS padrão do backend.

Para executar separadamente, use `npm run dev:backend` ou `npm run dev:web` na raiz. Repita `npm ci` quando mudar o lockfile da raiz. Como Cypress foi adicionado recentemente à web e o ambiente de integração não conseguiu regenerar `web/package-lock.json`, `npm run setup` usa `npm install --prefix web` para reconciliar o lockfile. Depois de uma instalação local bem-sucedida, versione o lockfile web atualizado e volte a usar `npm ci` nele em ambientes limpos.

O backend exige `DATABASE_URL`. Antes de executar, aplique as migrations conforme [PostgreSQL e migrations](docs/postgresql.md). Cadastro, consulta, edição, exclusão e login de usuários usam o banco; logout invalida a sessão no servidor. Os estudos clínicos também são persistidos no PostgreSQL pela API `/studies`, com autorização por pesquisador proprietário.

## 8. Documentação complementar

A documentação do projeto incluirá requisitos funcionais, diagramas de arquitetura, decisões técnicas, evidências das sprints e relatórios das releases.

## 9. Fatia inicial de acesso e usuários

O protótipo das tasks 3115, 3078, 3081, 3094 e 3205 está na aplicação `web/` e nos módulos `backend/src/auth/` e `backend/src/users/`. A interface contém login, administração de usuários, proteção de rotas, menus por perfil, páginas do Coordenador e páginas auxiliares 403/404. Para o perfil Pesquisador, a task 3205 inclui lista de estudos, cadastro, edição, confirmação de sucesso e detalhes, consumindo a API `/studies` e persistindo no PostgreSQL. As tasks Cypress 3209 e 3210 têm specs E2E em `web/cypress/e2e/`; consulte `docs/cypress-tasks-3209-3210.md`. Consulte [`docs/tasks-acesso-e-usuarios.md`](docs/tasks-acesso-e-usuarios.md) para credenciais fictícias, endpoints, limites do protótipo e instruções para execução.
