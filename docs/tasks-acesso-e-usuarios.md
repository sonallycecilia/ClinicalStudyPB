# Protótipo web — tasks 3115, 3078, 3081 e 3094

Esta versão integra autenticação e usuários com PostgreSQL, proteção de navegação, menus por perfil, testes de autorização, páginas do Coordenador e as telas da task 3205 para o perfil Pesquisador. As páginas genéricas sem design aprovado foram retiradas.

A administração web permite criar contas Administrador, Pesquisador e Coordenador. O Administrador acessa Administração de usuários; o Pesquisador acessa Estudos clínicos; e o Coordenador tem páginas próprias de painel, candidatos, visitas, reagendamentos e relatórios. Participante permanece como perfil da API compartilhada para o aplicativo mobile e não pode entrar na interface Web.

## Relação entre as tasks

| Task | Arquivos/áreas | Resultado |
| --- | --- | --- |
| 3115 — Protótipo web: acesso e usuários | `web/src/pages/LoginPage.tsx`, `web/src/pages/UsersPage.tsx`, `web/src/styles.css`, `backend/src/users/` | Login, listagem, busca, filtro por perfil, resumo de contas, cadastro e edição de usuários. |
| 3078 — Proteger rotas web | `web/src/components/ProtectedRoute.tsx`, `web/src/security/access.ts`, `backend/src/auth/access-token.guard.ts` | A interface redireciona usuários não autenticados; a API exige token bearer nas rotas privadas e confere se a conta continua ativa. |
| 3081 — Ajustar menus conforme o perfil | `web/src/security/access.ts`, `web/src/components/AppLayout.tsx`, `web/src/pages/coordenatorPage.tsx` | Menus e rotas próprios para Administrador, Pesquisador e Coordenador. |
| 3094 — Testar acesso permitido e negado | `web/src/security/access.test.ts`, `backend/src/auth/*.spec.ts`, `backend/src/users/users.service.spec.ts`, `backend/test/access.e2e-spec.ts` | Casos automatizados para menu/rota, token válido/inválido, perfil permitido/negado, operações de usuários e respostas HTTP protegidas. |
| 3205 — Estudos e recrutamento (Pesquisador) | `web/src/pages/StudiesPage.tsx`, `web/src/studies/`, `backend/src/studies/`, `backend/migrations/003_create_estudos.sql` | Lista, busca, filtro, cadastro, edição e detalhes; API autenticada com persistência PostgreSQL e isolamento por pesquisador. |
| 3209 — Cypress: acesso e usuários | `web/cypress/e2e/fluxo-acesso-usuarios.cy.ts` | Cenários E2E de login, permissões, CRUD de usuários, sessão e logout no backend real. |
| 3210 — Cypress: cadastro de estudo | `web/cypress/e2e/fluxo-cadastro-estudo.cy.ts` | Cenários E2E para cadastro, pesquisa, persistência no PostgreSQL e validações do formulário. |

## Estrutura relevante

```text
backend/src/
├── auth/
│   ├── access-token.guard.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── roles.decorator.ts
│   ├── roles.guard.ts
│   └── token.util.ts
├── studies/
│   ├── studies.controller.ts
│   ├── studies.service.ts
│   ├── studies.service.spec.ts
│   └── study.types.ts
└── users/
    ├── user.types.ts
    ├── users.controller.ts
    ├── users.module.ts
    └── users.service.ts

web/src/
├── auth/
├── components/
├── pages/
│   ├── LoginPage.tsx
│   ├── StatusPages.tsx
│   ├── StudiesPage.tsx
│   └── UsersPage.tsx
└── security/
```

A integração em `backend/src/app.module.ts` registra os módulos de autenticação, usuários e estudos; `backend/src/main.ts` habilita CORS para a aplicação web. O módulo de estudos recebe o `DatabaseModule` e usa os guardas compartilhados de autenticação/autorização.

## Endpoints disponíveis

| Método | Caminho | Permissão |
| --- | --- | --- |
| `POST` | `/auth/login` | Público; retorna token e dados públicos do usuário. |
| `GET` | `/auth/me` | Token válido de conta ativa. |
| `POST` | `/auth/logout` | Sessão válida; invalida a sessão atual no banco. |
| `GET` | `/users` | Administrador. |
| `GET` | `/users/:id` | Administrador; UUID válido. |
| `POST` | `/users` | Administrador. |
| `PATCH` | `/users/:id` | Administrador. |
| `DELETE` | `/users/:id` | Administrador; não pode excluir a própria conta. |
| `GET` | `/studies` | Pesquisador ativo; lista somente os próprios estudos. |
| `GET` | `/studies/:id` | Pesquisador proprietário do estudo. |
| `POST` | `/studies` | Pesquisador ativo; associa o estudo à identidade do token. |
| `PATCH` | `/studies/:id` | Pesquisador proprietário; valida datas e limites de participantes. |

## Contas fictícias para testes

Estas contas são exclusivamente dados de demonstração. Não use credenciais reais.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `ana.souza@clinicalstudypb.test` | `Admin123!` |
| Pesquisador | `marina.costa@clinicalstudypb.test` | `Demo123!` |
| Coordenador | `rafael.lima@clinicalstudypb.test` | `Demo123!` |
| Participante | `bianca.oliveira@clinicalstudypb.test` | `Demo123!` |

## Como executar

### API

Use a versão Node definida pelo projeto (`backend/.nvmrc`, Node 24):

```bash
cd backend
cp .env.example .env
npm ci
npm run db:migrate
npm run start:dev
```

Antes de uma implantação, defina `AUTH_JWT_SECRET` com um segredo aleatório forte. O segredo de fallback destina-se somente ao desenvolvimento local.

### Aplicação web

Em outro terminal:

```bash
cd web
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite (normalmente `http://localhost:5173`). Para apontar a interface para outra API, crie `web/.env` com `VITE_API_URL=http://localhost:3000`.

As contas fictícias são criadas no PostgreSQL pelo seed explícito de desenvolvimento, habilitado no Compose; para execução local, consulte [PostgreSQL](postgresql.md). A interface depende da API e não troca para dados locais se ela falhar. CRUD e login de usuários e estudos usam PostgreSQL. O logout invalida a sessão no banco antes de limpar o navegador; se a API estiver indisponível, a interface informa a falha e permite tentar novamente. Alterações de senha ou inativação revogam todas as sessões da conta. Alterações de perfil valem na próxima requisição protegida. O administrador não pode excluir, inativar ou remover o próprio perfil administrativo.

## Testes

```bash
# API (dentro de backend/)
npm test
npm run test:e2e

# Interface (dentro de web/)
npm test
npm run build
```

Os testes E2E exigem `DATABASE_URL` e PostgreSQL disponível. Cada suíte usa um schema temporário, preservando os dados de desenvolvimento. São cobertos os quatro perfis, CRUD persistente e invalidação de sessões, inclusive após reiniciar a aplicação.

## Confirmação antes de excluir um usuário

Na tela de Administração de usuários, o botão **Excluir** abre um modal de confirmação com o nome e o perfil da conta selecionada. A exclusão só acontece depois de confirmar em **Excluir usuário**; **Cancelar**, clicar fora do modal ou pressionar `Esc` fecha a confirmação sem excluir. A própria conta conectada não pode ser excluída. A implementação fica em `web/src/pages/UsersPage.tsx`, e os estilos do modal ficam em `web/src/styles.css`.


## Task 3205 — protótipo web de estudos e recrutamento (perfil Pesquisador)

A interface `web/src/pages/StudiesPage.tsx` implementa lista, indicadores, busca/filtro, menu de ações, cadastro, edição, confirmação e detalhes. `web/src/studies/studiesApi.ts` consome os endpoints autenticados `/studies`; a migration `003_create_estudos.sql` persiste estudos no PostgreSQL. O backend associa cada estudo ao pesquisador do token e impede que outro Pesquisador consulte ou altere esse estudo. O perfil Participante é mantido no backend para a aplicação mobile, sem página própria na Web.
