# ClinicalStudyPB

ClinicalStudyPB é um sistema acadêmico desenvolvido na disciplina de Engenharia de Software II, no semestre 2026.2, com o objetivo de apoiar a gestão operacional de estudos clínicos, com foco em cadastro de estudos, recrutamento, elegibilidade, consentimento, visitas, acompanhamento e relatórios. O projeto compreende aplicação web, aplicativo mobile, backend REST e banco de dados PostgreSQL, com dados fictícios e sem apoio a diagnósticos ou decisões clínicas automatizadas.

## 1. Visão geral

O sistema atende aos perfis de:

- Administrador
- Pesquisador
- Coordenador
- Participante

## 2. Tecnologias

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

## 3. Arquitetura

A solução é organizada em quatro blocos principais:

- Web: interface para administradores, pesquisadores e coordenadores.
- Mobile: interface para participantes.
- Backend: API REST compartilhada, autenticação, autorização e regras de negócio.
- PostgreSQL: persistência para usuários, sessões, estudos, candidatos e visitas.

A documentação detalhada da arquitetura está em [arquitetura-e-integracao.md](docs\releases\release1\arquitetura-e-integracao.md).

## 4. Requisitos e escopo

O projeto acompanha os requisitos funcionais da especificação e do plano de trabalho da equipe, incluindo:

- cadastro e gerenciamento de usuários
- autenticação e sessões
- controle de acesso por perfil
- cadastro de estudos com critérios e visitas
- recrutamento e elegibilidade
- consentimento e inclusão de participantes
- acompanhamento de visitas e avaliações
- painel e relatórios simplificados

Importante: nem todos os requisitos previstos precisam estar completamente implementados em toda a base de código do repositório; a documentação do projeto diferencia claramente o que está integrado e o que continua como fluxos demonstrativos ou planejados.

## 5. Execução rápida

### Opção recomendada: Docker Compose

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

O banco usa o volume persistente `postgres_data`; `docker compose down` remove os containers, mas preserva os dados. **Não use `docker compose down -v` a menos que queira apagar permanentemente o banco local.** As credenciais e contas fornecidas pelo Compose são somente para desenvolvimento e demonstração. Consulte [PostgreSQL e migrations](docs\releases\release1\sprint01\banco_de_dados\README-BD.md) para acessar o banco e entender as migrations.

### Execução sem Docker

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

O seed só pode ser executado fora de produção e com `ALLOW_DEMO_SEED=true`. Ele preserva contas e estudos que já existam com os mesmos identificadores, portanto não redefine seus dados. As contas fictícias e senhas estão descritas em [Usuários e controle de acesso](docs\releases\release1\usuarios-e-controle-de-acesso.md). Não use dados fictícios ou essas credenciais em produção.

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

#### Iniciar banco, API, web e mobile juntos

Depois de preparar os arquivos `.env`, instalar as dependências de cada aplicação (incluindo `npm ci --prefix mobile`) e aplicar as migrations, execute na raiz:

```powershell
npm.cmd run dev:all
```

Mantenha o Docker Desktop iniciado. O comando inicia o PostgreSQL, aguarda o banco ficar saudável e executa API, web e Expo no mesmo terminal. A web fica em `http://localhost:5173`; o Expo permite abrir o aplicativo mobile no celular. `Ctrl+C` encerra os processos de desenvolvimento; o banco permanece no Docker. Para parar o banco sem apagar seus dados, use `docker compose stop postgres`.

#### Iniciar banco, API, web e mobile juntos

Depois de preparar os arquivos `.env`, instalar as dependências de cada aplicação (incluindo `npm ci --prefix mobile`) e aplicar as migrations, execute na raiz:

```powershell
npm.cmd run dev:all
```

Mantenha o Docker Desktop iniciado. O comando inicia o PostgreSQL, aguarda o banco ficar saudável e executa API, web e Expo no mesmo terminal. A web fica em `http://localhost:5173`; o Expo permite abrir o aplicativo mobile no celular. `Ctrl+C` encerra os processos de desenvolvimento; o banco permanece no Docker. Para parar o banco sem apagar seus dados, use `docker compose stop postgres`.

## 6. Testes

Os comandos principais são:

```bash
cd backend
npm test
npm run test:e2e

cd ../web
npm test
npm run cypress:run

cd ../mobile
npm test -- --runInBand
```

Para informações detalhadas, consulte [README-TESTES.md](docs/releases/release1/sprint01/testes/README-TESTES.md).

## 7. Documentação

A documentação organizada do projeto está em [docs/README.md](docs/README.md). Há também material específico para:

- [Banco de dados](docs\releases\release1\sprint01\banco_de_dados\README-BD.md)
- [Arquitetura e integração](docs\releases\release1\arquitetura-e-integracao.md)
- [Usuários e controle de acesso](docs\releases\release1\usuarios-e-controle-de-acesso.md)
- [Testes automatizados](docs\releases\release1\sprint01\testes\README-TESTES.md)
- [Sprint 01 — planejamento](docs\releases\release1\sprint01\planejamento.md)
- [Sprint 01 — retrospectiva](docs\releases\release1\sprint01\retrospectiva.md)