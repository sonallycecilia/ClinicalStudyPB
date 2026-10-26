# ClinicalStudyPB — guia de integração, instalação e execução

Este guia explica como configurar, iniciar e testar a versão integrada do **ClinicalStudyPB**. Ele complementa o `README.md` da raiz e reúne os principais passos para quem está preparando o ambiente pela primeira vez.

> **Uso acadêmico/desenvolvimento:** as credenciais e os dados de demonstração deste guia são fictícios. Não utilize os segredos ou as contas de demonstração em produção.

## 1. O que está integrado

O projeto é composto por três serviços principais:

- **Web:** React, TypeScript e Vite; páginas de login, administração de usuários, estudos clínicos e áreas de Coordenador.
- **Backend:** API REST NestJS; autenticação, sessões, controle de acesso por perfil, operações de usuários e endpoints de estudos clínicos.
- **Banco de dados:** PostgreSQL; guarda usuários, sessões e estudos clínicos.

O perfil Participante continua reconhecido pela API compartilhada para uso mobile, mas não possui menu nem páginas próprias na interface Web.

### Principais decisões de integração

- O frontend chama a API; não se conecta diretamente ao PostgreSQL.
- O login usa `POST /auth/login`; a restauração da sessão consulta `GET /auth/me`; o logout chama `POST /auth/logout` para revogar a sessão no servidor.
- Os endpoints de usuários exigem perfil Administrador.
- Os endpoints de estudos (`/studies`) exigem Pesquisador autenticado e limitam a consulta/alteração aos estudos associados ao pesquisador da sessão.
- As telas do Coordenador estão preservadas, mas candidatos, visitas, reagendamentos e relatórios continuam sendo fluxos de interface de demonstração; ainda não possuem API/tabelas próprias nesta integração.
- As tasks Cypress 3209 e 3210 possuem testes E2E em `web/cypress/e2e/`.

## 2. Requisitos

### Opção recomendada: Docker Desktop

No Windows, instale o Docker Desktop e confirme que ele está aberto e que o mecanismo está em execução. Se o Docker informar que a virtualização está desativada, habilite Intel VT-x/Intel Virtualization Technology ou AMD-V/SVM Mode nas configurações UEFI/BIOS do computador, conforme o fabricante. O Docker deve conseguir executar containers Linux.

Com Docker Compose, não é necessário instalar Node.js ou PostgreSQL localmente para iniciar a aplicação. **Para rodar Cypress pelo terminal do Windows**, porém, será necessário ter Node.js/npm instalados localmente.

### Alternativa sem Docker

- Node.js **24** (a versão do backend está indicada em `backend/.nvmrc`).
- PostgreSQL 17 instalado localmente ou acessível pela rede.
- npm, instalado junto com Node.js.

## 3. Iniciar o projeto com Docker (recomendado)

### 3.1. Abrir a pasta correta

Abra a pasta raiz `ClinicalStudyPB` no terminal. Ela deve conter `compose.yaml`, `backend/` e `web/`.

Confira se o Docker responde:

```powershell
docker version
docker compose version
```

Os dois comandos devem mostrar suas versões sem erro do servidor/engine.

### 3.2. Conferir a configuração

```powershell
docker compose config
```

O comando deve terminar sem erro. A configuração padrão publica:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432` (acesso local ao banco)

### 3.3. Iniciar os serviços

Na raiz do projeto, execute:

```powershell
docker compose up --build
```

Na primeira execução, o Docker pode precisar baixar a imagem do PostgreSQL e construir as imagens do backend e da web. Aguarde os serviços iniciarem e mantenha esse terminal aberto.

O Compose:

1. inicia o PostgreSQL e aguarda o healthcheck do banco;
2. aplica as migrations do backend;
3. cria contas e estudos fictícios para desenvolvimento, sem substituir registros que já existam;
4. inicia a API;
5. inicia a interface web quando a API estiver saudável.

Quando os serviços estiverem iniciados, abra `http://localhost:5173` no navegador.

### 3.4. Executar em segundo plano (opcional)

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f
```

Para acompanhar apenas um serviço:

```powershell
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f web
```

Para parar/remover os containers sem apagar os dados do banco:

```powershell
docker compose down
```

> **Não use `docker compose down -v` a menos que queira apagar o volume do PostgreSQL e todos os dados locais nele.**

### 3.5. Se a porta 5432 estiver indisponível no Windows

Se o Docker mostrar um erro dizendo que não consegue publicar `127.0.0.1:5432`, pode haver outro PostgreSQL usando essa porta ou o Windows pode tê-la reservada.

No `compose.yaml`, dentro do serviço `postgres`, altere somente o mapeamento da porta do host:

```yaml
ports:
  - "127.0.0.1:5433:5432"
```

A porta **5433** será usada pelo Windows e a porta **5432** continuará sendo usada dentro do container. Mantenha a `DATABASE_URL` do backend apontando para `postgres:5432`, pois a comunicação entre containers usa o nome do serviço `postgres` e a porta interna do banco.

Salve o arquivo e confira:

```powershell
docker compose config
docker compose up --build
```

### 3.6. Se o backend ficar `unhealthy`

Confira primeiro o estado dos serviços:

```powershell
docker compose ps -a
```

Depois consulte os logs:

```powershell
docker compose logs --tail=150 backend
docker compose logs --tail=100 postgres
```

Leia a primeira mensagem de erro relevante. Erros durante `db:migrate`/`db:seed:demo` podem indicar configuração ou conexão do banco; `UnknownDependenciesException` indica um problema de configuração de módulos/dependências do NestJS. Corrija a causa indicada pelos logs antes de tentar novamente. Não apague o volume do banco como primeira medida.

## 4. Contas fictícias para testar a interface Web

O Compose de desenvolvimento habilita o seed de demonstração. As contas são criadas sem sobrescrever contas existentes com o mesmo e-mail.

| Perfil Web | E-mail | Senha |
| --- | --- | --- |
| Administrador | `ana.souza@clinicalstudypb.test` | `Admin123!` |
| Pesquisador | `marina.costa@clinicalstudypb.test` | `Demo123!` |
| Coordenador | `rafael.lima@clinicalstudypb.test` | `Demo123!` |

A conta Participante de demonstração existe para a API compartilhada/mobile, mas não tem página ou menu na Web.

## 5. Executar sem Docker (alternativa)

Este caminho exige que o PostgreSQL já esteja instalado e em execução.

### 5.1. Configurar o backend

Use Node.js 24. Crie `backend/.env` a partir de `backend/.env.example` e ajuste `DATABASE_URL` para a instância PostgreSQL local. Exemplo de URL local:

```dotenv
DATABASE_URL=postgresql://clinicalstudy:clinicalstudy_local@localhost:5432/clinicalstudypb
PORT=3000
WEB_ORIGIN=http://localhost:5173
AUTH_JWT_SECRET=use-um-segredo-aleatorio-com-pelo-menos-32-caracteres
```

Crie previamente o banco e o usuário configurados na URL. Dentro da pasta `backend`, execute:

```powershell
npm ci
npm run db:migrate
$env:ALLOW_DEMO_SEED='true'
npm run db:seed:demo
npm run start:dev
```

Mantenha esse terminal aberto. O comando de seed é somente para desenvolvimento/testes; não o habilite em produção.

### 5.2. Configurar e iniciar a Web

Em outro terminal, entre na pasta `web`. Crie `web/.env` a partir de `web/.env.example` se precisar alterar o endereço da API. Para execução local padrão, use `VITE_API_URL=http://localhost:3000`.

Execute:

```powershell
npm install
npm run dev
```

Abra `http://localhost:5173`. Para ambos os serviços funcionarem, a API deve estar acessível em `http://localhost:3000`, a origem web deve estar permitida pelo CORS e o banco deve estar disponível.

### 5.3. Iniciar ambos pela raiz (opcional)

A raiz do projeto possui scripts para preparar dependências e iniciar web e backend juntos. Use Node.js 24 e configure o PostgreSQL/backend conforme a seção anterior. Na raiz:

```powershell
npm ci
npm run setup
npm run dev
```

O script `npm run setup` instala as dependências do backend pelo lockfile e executa `npm install` na Web para reconciliar a dependência Cypress adicionada. Depois de uma instalação bem-sucedida, confira e versione `web/package-lock.json` se ele tiver sido atualizado.

## 6. Rodar os testes

### 6.1. Testes unitários e build do backend

Com as dependências instaladas, dentro de `backend/`:

```powershell
npm run build
npm test
npm run test:e2e
```

Os testes de integração exigem um PostgreSQL disponível e as variáveis de ambiente adequadas.

### 6.2. Testes da Web

Dentro de `web/`:

```powershell
npm test
npm run build
```

### 6.3. Cypress — tasks 3209 e 3210

Deixe PostgreSQL, API e web em execução. Em um terminal local, abra `web/` e instale as dependências se ainda não o fez:

```powershell
npm install
```

Abra a interface Cypress:

```powershell
npm run cypress:open
```

Selecione **E2E Testing**, escolha um navegador e execute:

- `cypress/e2e/fluxo-acesso-usuarios.cy.ts` — task 3209: login, proteção de rotas, perfis, gerenciamento de usuários, sessão e logout.
- `cypress/e2e/fluxo-cadastro-estudo.cy.ts` — task 3210: cadastro de estudo, validações e persistência na API/PostgreSQL.

Para executar os testes em modo de terminal/headless:

```powershell
npm run cypress:run
```

O Cypress usa a aplicação em `http://localhost:5173` e a API em `http://localhost:3000`. Se a API estiver indisponível ou o seed não tiver criado as contas/estudos esperados, os testes de acesso podem falhar antes de validar o fluxo.

## 7. Comandos úteis de diagnóstico

Na raiz do projeto:

```powershell
docker compose ps -a
docker compose logs --tail=150 backend
docker compose logs --tail=100 postgres
docker compose logs --tail=100 web
```

Para confirmar que a API responde:

```powershell
Invoke-WebRequest http://localhost:3000/
```

Para confirmar o estado da branch e dos arquivos antes de registrar alterações:

```powershell
git branch --show-current
git status
```

## 8. Limitações conhecidas da integração

- As páginas do Coordenador (candidatos/participantes, visitas, reagendamentos e relatórios) continuam sendo protótipos de interface; esta integração não cria API/tabelas próprias para essas áreas.
- O perfil Participante permanece no backend compartilhado para o aplicativo mobile, sem página ou menu próprio na Web.
- Os dados de demonstração são fictícios e destinados a testes locais.
- A existência de arquivos de teste não garante que eles passaram. Depois da instalação local das dependências, execute as suítes e registre os resultados antes de considerar as tasks 3094, 3209 e 3210 validadas.

## 9. Documentação relacionada

- [`README.md`](../README.md): visão geral do projeto e atalhos de execução.
- [`postgresql.md`](postgresql.md): banco, migrations e persistência.
- [`tasks-acesso-e-usuarios.md`](tasks-acesso-e-usuarios.md): tasks 3115, 3078, 3081, 3094 e 3205; endpoints e contas de demonstração.
- [`cypress-tasks-3209-3210.md`](cypress-tasks-3209-3210.md): escopo dos testes Cypress.
