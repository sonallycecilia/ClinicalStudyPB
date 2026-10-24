# PostgreSQL e migrations

## Iniciar com Docker

Na raiz do projeto:

```bash
docker compose up --build
```

O Compose inicia PostgreSQL 17, aguarda o banco ficar disponível, aplica as migrations, executa o seed fictício e inicia backend e web. O banco usa o volume `postgres_data`, preservado por `docker compose down`. As credenciais abaixo são exclusivamente de desenvolvimento local.

| Configuração | Valor |
| --- | --- |
| Host para ferramentas locais | `localhost` |
| Porta | `5432` |
| Banco | `clinicalstudypb` |
| Usuário | `clinicalstudy` |
| Senha local | `clinicalstudy_local` |
| Host acessado pelo backend no Docker | `postgres` |

Para abrir o terminal SQL:

```bash
docker compose exec postgres psql -U clinicalstudy -d clinicalstudypb
```

Dentro do psql, `\dt` lista as tabelas e `\d usuarios` mostra a estrutura de usuários.

## Backend executado fora do Docker

É possível iniciar somente o banco com `docker compose up -d postgres`, ou usar um PostgreSQL 17 instalado localmente com banco e usuário criados previamente.

Copie `backend/.env.example` para `backend/.env`. O exemplo usa `localhost` na `DATABASE_URL`; ajuste as credenciais se usar uma instalação própria. Depois, dentro de `backend/`:

```bash
npm ci
npm run db:migrate
npm run start:dev
```

No PowerShell, use `npm.cmd` se a política de execução bloquear `npm.ps1`.

O backend exige `DATABASE_URL` e verifica a conexão na inicialização em todos os ambientes.

Para criar as quatro contas fictícias fora do Docker, habilite explicitamente o seed no PowerShell:

```powershell
$env:ALLOW_DEMO_SEED='true'
npm run db:seed:demo
```

O seed é proibido em produção e usa `ON CONFLICT (email) DO NOTHING`: não altera senhas, status ou perfis de contas existentes. As credenciais estão em [Acesso e usuários](tasks-acesso-e-usuarios.md). No Compose de desenvolvimento, `ALLOW_DEMO_SEED=true` já está configurado.

## Estrutura e mudanças do banco

`backend/migrations/001_create_usuarios.sql` cria a tabela `usuarios`: UUID, nome, e-mail único normalizado em minúsculas, telefone opcional, hash e salt da senha, perfil, status e data de criação. Os quatro perfis permitidos são Administrador, Pesquisador, Coordenador e Participante. O status começa como Ativo. Esta migration cria a estrutura sem inserir contas ou credenciais de demonstração.

O executor registra as versões na tabela `schema_migrations`, verifica se arquivos já aplicados foram modificados e executa as mudanças pendentes em uma transação. Rodar novamente não reaplica migrations concluídas. Para evoluir o modelo, adicione um novo arquivo numerado, como `002_nome_da_mudanca.sql`, e execute `npm run db:migrate` dentro de `backend/`. Não altere migrations já aplicadas. Não há comando automático de reversão; correções devem ser feitas em nova migration.

O acesso usa SQL direto pelo driver `pg`, com pool de conexões no `DatabaseService`. Nas consultas que recebem valores externos, utilize parâmetros (`$1`, `$2`), sem concatenar entradas do usuário ao SQL.

## Usuários e sessões

`UsersService` executa cadastro, listagem, consulta por UUID, edição, exclusão e autenticação no PostgreSQL, com consultas parametrizadas, e-mail normalizado e senha derivada com scrypt e salt individual. Hash e salt não são retornados pela API. A migration `002_create_sessoes.sql` cria sessões com UUID próprio, usuário e expiração; a exclusão da conta remove suas sessões por chave estrangeira.

O token dura uma hora e só é aceito enquanto sua sessão existir no banco. `POST /auth/logout` remove apenas a sessão atual. Trocar a senha ou inativar a conta remove todas as sessões dessa conta; reativá-la não recupera tokens antigos. Os guards consultam o perfil atual em cada requisição. A web valida sessões restauradas por `/auth/me`, limpa sessões ao receber 401 e não usa contas locais se a API falhar. Os estudos continuam no armazenamento local do navegador.

## Verificação

```powershell
docker compose ps
docker compose exec backend npm run db:migrate
docker compose exec postgres psql -U clinicalstudy -d clinicalstudypb -c "SELECT nome FROM schema_migrations ORDER BY nome;"
# Na raiz, com dependências locais instaladas:
$env:DATABASE_URL='postgresql://clinicalstudy:clinicalstudy_local@localhost:5432/clinicalstudypb'
npm --prefix backend test -- --runInBand
npm --prefix backend run test:e2e -- --runInBand
npm --prefix web test
```

Os testes E2E criam schemas temporários exclusivos, aplicam as migrations e removem esses schemas no encerramento. Não usam nem apagam contas de desenvolvimento. Cobrem os quatro perfis, CRUD, persistência após reinício, duplicidade, senha, inativação e logout com tentativa de reutilizar o token.
