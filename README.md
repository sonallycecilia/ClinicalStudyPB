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

A documentação interativa da API está disponível em `http://localhost:3000/api`, e a especificação OpenAPI em JSON em `http://localhost:3000/api-json`, quando o backend está em execução.

## 5. Requisitos funcionais

Os requisitos funcionais do sistema são identificados de RF01 a RF22. A descrição e o acompanhamento de cada requisito serão documentados em `docs/requisitos/requisitos-funcionais.md`.

## 6. Testes e qualidade

O projeto utiliza testes automatizados e integração contínua para verificar o funcionamento dos componentes. A meta de cobertura é de, no mínimo, 80% das linhas de código de negócio do backend.

Os resultados dos testes e da cobertura serão registrados ao longo do desenvolvimento.

## 7. Instalação e execução

Esta seção apresenta os requisitos e os passos para preparar o ambiente, instalar as dependências, iniciar a aplicação e executar as verificações automatizadas. O repositório contém uma aplicação web, uma API e um banco PostgreSQL; para desenvolvimento, Docker Compose é a opção mais simples.

### 7.1. Requisitos do ambiente

| Opção | Requisitos |
| --- | --- |
| Com Docker | Docker Desktop no Windows/macOS, ou Docker Engine com Docker Compose v2 no Linux. Mantenha o serviço do Docker iniciado e use containers Linux. Não é necessário instalar Node.js nem PostgreSQL na máquina. |
| Sem Docker | Node.js 24 (mínimo 24.15.0, conforme `backend/package.json`), npm e PostgreSQL 17 acessível pela máquina. O arquivo `backend/.nvmrc` seleciona a linha 24 do Node.js. |
| Para testes da interface | Um navegador moderno para usar a aplicação. Cypress é instalado como dependência da web para executar os testes E2E. |

As portas 3000 (API), 5173 (web) e 5433 (PostgreSQL publicado pelo Compose) devem estar disponíveis. O PostgreSQL escuta na porta 5432 dentro da rede Docker; a porta publicada na máquina é 5433.

### 7.2. Opção recomendada: iniciar tudo com Docker Compose

Na raiz do repositório, execute:

```bash
docker compose up --build
```

Na primeira execução, o Docker cria as imagens e instala as dependências; em seguida, inicia o PostgreSQL, espera o banco ficar pronto, aplica as migrations, insere dados fictícios de demonstração e inicia a API e a web. Aguarde os logs indicarem que os serviços estão prontos.

| Serviço | Endereço local | Observação |
| --- | --- | --- |
| Aplicação web | `http://localhost:5173` | Interface acessada no navegador. |
| API | `http://localhost:3000` | A web usa esse endereço para chamar a API. |
| PostgreSQL | `localhost:5433` | Conexão a partir de ferramentas executadas na máquina. |

Não é necessário executar `npm ci`, criar arquivos `.env` ou aplicar migrations manualmente nesse fluxo. As alterações em `backend/src`, `web/src` e `web/index.html` são refletidas durante o desenvolvimento. Mudanças em dependências ou arquivos de configuração exigem reconstruir as imagens:

```bash
docker compose up --build
```

Para iniciar em segundo plano e consultar o estado dos serviços:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f
```

Para acompanhar apenas um serviço, use `docker compose logs -f backend`, `docker compose logs -f web` ou `docker compose logs -f postgres`. Encerre com `Ctrl+C` quando estiver no primeiro plano ou execute:

```bash
docker compose down
```

O banco usa o volume persistente `postgres_data`; `docker compose down` remove os containers, mas preserva os dados. **Não use `docker compose down -v` a menos que queira apagar permanentemente o banco local.** As credenciais e contas fornecidas pelo Compose são somente para desenvolvimento e demonstração. Consulte [PostgreSQL e migrations](docs/postgresql.md) para acessar o banco e entender as migrations.

### 7.3. Instalação e execução sem Docker

#### 1. Prepare o PostgreSQL

Instale ou disponibilize PostgreSQL 17 e crie um banco e um usuário para desenvolvimento. Outra possibilidade é iniciar somente o serviço de banco definido no Compose:

```bash
docker compose up -d postgres
```

Quando usar o PostgreSQL do Compose com a API executada diretamente na máquina, configure a conexão para `localhost:5433`. O Compose publica a porta 5433 na máquina e encaminha para a porta 5432 do container. Para um PostgreSQL instalado diretamente na máquina, use a porta configurada nessa instalação (normalmente 5432).

#### 2. Configure as variáveis de ambiente

Copie os exemplos e ajuste os valores conforme seu ambiente. Execute os comandos na raiz do repositório.

PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item web\.env.example web\.env
```

Linux/macOS:

```bash
cp backend/.env.example backend/.env
cp web/.env.example web/.env
```

Edite `backend/.env` e confira as configurações principais:

| Variável | Obrigatória | Finalidade / valor local de referência |
| --- | --- | --- |
| `DATABASE_URL` | Sim | URL de conexão PostgreSQL. O exemplo do arquivo aponta para `localhost:5432`; altere a porta para `5433` se estiver usando o PostgreSQL do Compose a partir da máquina. Formato: `postgresql://usuario:senha@localhost:5432/nome_do_banco`. |
| `PORT` | Não | Porta HTTP da API; padrão `3000`. |
| `WEB_ORIGIN` | Não | Origem permitida pelo CORS; padrão `http://localhost:5173`. |
| `AUTH_JWT_SECRET` | Não no desenvolvimento local | Segredo de assinatura dos tokens. Use um valor aleatório forte com pelo menos 32 caracteres em ambientes que não sejam demonstrações locais; nunca reutilize o valor de exemplo em produção. |

Em `web/.env`, `VITE_API_URL` define o endereço da API visto pelo navegador e, por padrão, é `http://localhost:3000`. A web é servida na porta 5173 para corresponder ao CORS padrão da API. Os arquivos `.env` são locais e não devem ser commitados.

#### 3. Instale as dependências

Use Node.js 24. Na raiz do repositório, execute:

```bash
npm ci
npm run setup
```

`npm ci` instala as dependências e ferramentas do repositório. `npm run setup` instala as dependências do backend e da web, incluindo as dependências necessárias aos testes. O script usa `npm install` para a web; se essa instalação atualizar `web/package-lock.json`, revise e versione a atualização quando ela fizer parte das mudanças do projeto.

#### 4. Aplique as migrations e (opcionalmente) crie dados de demonstração

O backend exige `DATABASE_URL` e não inicia se não conseguir conectar ao PostgreSQL. Depois de configurar o `.env`, aplique o schema versionado:

```bash
npm --prefix backend run db:migrate
```

Para criar as contas e os estudos fictícios usados na demonstração, habilite o seed explicitamente. No PowerShell:

```powershell
$env:ALLOW_DEMO_SEED = 'true'
npm --prefix backend run db:seed:demo
Remove-Item Env:ALLOW_DEMO_SEED
```

No Linux/macOS:

```bash
ALLOW_DEMO_SEED=true npm --prefix backend run db:seed:demo
```

O seed só pode ser executado fora de produção e com `ALLOW_DEMO_SEED=true`. Ele preserva contas e estudos que já existam com os mesmos identificadores, portanto não redefine seus dados. As contas fictícias e senhas estão descritas em [Acesso e usuários](docs/tasks-acesso-e-usuarios.md). Não use dados fictícios ou essas credenciais em produção.

#### 5. Inicie a aplicação

Na raiz:

```bash
npm run dev
```

Esse comando inicia backend e web juntos. Acesse `http://localhost:5173`; a API estará em `http://localhost:3000`. Os logs dos processos aparecem no mesmo terminal, identificados como `backend` e `web`. Pressione `Ctrl+C` para encerrar ambos. Se preferir, inicie-os em terminais separados:

```bash
npm run dev:backend
npm run dev:web
```

### 7.4. Executar testes e verificações

Os comandos abaixo podem ser executados na raiz depois de instalar as dependências. Os testes E2E do backend exigem uma conexão PostgreSQL pela variável `DATABASE_URL`; use um banco dedicado a testes, nunca produção. A suíte cria schemas temporários e os remove ao terminar, sem alterar as tabelas de negócio existentes.

| Verificação | Comando | Requisitos |
| --- | --- | --- |
| Testes unitários da API | `npm --prefix backend test -- --runInBand` | Dependências instaladas. |
| Lint da API | `npm --prefix backend run lint` | Dependências instaladas. |
| Build da API | `npm --prefix backend run build` | Dependências instaladas. |
| Testes E2E da API | `npm --prefix backend run test:e2e -- --runInBand` | PostgreSQL de testes acessível por `DATABASE_URL`. |
| Cobertura consolidada da API | `npm --prefix backend run test:coverage:all` | PostgreSQL de testes acessível por `DATABASE_URL`. |
| Testes unitários da web | `npm --prefix web test` | Dependências instaladas. |
| Build da web | `npm --prefix web run build` | Dependências instaladas. |

Para configurar `DATABASE_URL` somente no terminal PowerShell antes de executar os testes E2E:

```powershell
$env:DATABASE_URL = 'postgresql://clinicalstudy:clinicalstudy_local@localhost:5433/clinicalstudypb'
npm --prefix backend run test:e2e -- --runInBand
Remove-Item Env:DATABASE_URL
```

Esse exemplo usa o PostgreSQL do Compose. Se estiver usando outro banco, substitua a URL; para evitar riscos, prefira um banco dedicado a testes. A suíte E2E não carrega `backend/.env` automaticamente: defina `DATABASE_URL` no ambiente do terminal antes de executar os testes. No Linux/macOS, use `export DATABASE_URL='postgresql://usuario:senha@localhost:5432/banco_teste'` e depois execute o comando.

Os testes E2E do navegador são executados com Cypress e precisam que a web e a API estejam em execução, além de haver dados de demonstração no banco. Inicie a aplicação, por exemplo, com `docker compose up --build` ou `npm run dev`, e em outro terminal, na raiz, execute:

```bash
npm --prefix web run cypress:run
```

Para abrir o Cypress em modo interativo:

```bash
npm --prefix web run cypress:open
```

O Cypress está configurado para usar `http://localhost:5173` como endereço web e `http://localhost:3000` como endereço da API. No fluxo Docker as dependências são instaladas dentro dos containers e o binário do Cypress não é instalado no container da web; execute os comandos Cypress localmente após `npm run setup`.

No Windows, se a política de execução do PowerShell impedir a execução do `npm.ps1`, use `npm.cmd` no lugar de `npm` nos comandos. Para detalhes de banco, migrations e testes E2E, consulte [PostgreSQL e migrations](docs/postgresql.md).

## 8. Documentação complementar

A documentação do projeto incluirá requisitos funcionais, diagramas de arquitetura, decisões técnicas, evidências das sprints e relatórios das releases.

## 9. Fatia inicial de acesso e usuários

O protótipo das tasks 3115, 3078, 3081, 3094 e 3205 está na aplicação `web/` e nos módulos `backend/src/auth/` e `backend/src/users/`. A interface contém login, administração de usuários, proteção de rotas, menus por perfil, páginas do Coordenador e páginas auxiliares 403/404. Para o perfil Pesquisador, a task 3205 inclui lista de estudos, cadastro, edição, confirmação de sucesso e detalhes, consumindo a API `/studies` e persistindo no PostgreSQL. As tasks Cypress 3209 e 3210 têm specs E2E em `web/cypress/e2e/`; consulte `docs/cypress-tasks-3209-3210.md`. Consulte [`docs/tasks-acesso-e-usuarios.md`](docs/tasks-acesso-e-usuarios.md) para credenciais fictícias, endpoints, limites do protótipo e instruções para execução.
