# Protótipo web — tasks 3115, 3078, 3081 e 3094

Esta versão reúne o protótipo de acesso e administração de usuários, a proteção de navegação, os testes de autorização e as telas da task 3205 para o perfil Pesquisador. As páginas genéricas sem design aprovado foram retiradas.

A interface web contempla somente os perfis Administrador, Pesquisador e Coordenador; o perfil Participante não é exposto na interface. O Administrador acessa Administração de usuários. O Pesquisador acessa Estudos clínicos. O Coordenador continua sem página própria nesta versão e é direcionado à tela 403 até que exista um design aprovado para sua área.

## Relação entre as tasks

| Task | Arquivos/áreas | Resultado |
| --- | --- | --- |
| 3115 — Protótipo web: acesso e usuários | `web/src/pages/LoginPage.tsx`, `web/src/pages/UsersPage.tsx`, `web/src/styles.css`, `backend/src/users/` | Login, listagem, busca, filtro por perfil, resumo de contas, cadastro e edição de usuários. |
| 3078 — Proteger rotas web | `web/src/components/ProtectedRoute.tsx`, `web/src/security/access.ts`, `backend/src/auth/access-token.guard.ts` | A interface redireciona usuários não autenticados; a API exige token bearer nas rotas privadas e confere se a conta continua ativa. |
| 3081 — Ajustar menus conforme o perfil | `web/src/security/access.ts`, `web/src/components/AppLayout.tsx` | Administração de usuários é exibida para Administrador e Estudos clínicos para Pesquisador. O Coordenador ainda não tem página própria nesta versão. |
| 3094 — Testar acesso permitido e negado | `web/src/security/access.test.ts`, `backend/src/auth/*.spec.ts`, `backend/src/users/users.service.spec.ts` | Casos automatizados para menu/rota, token válido/inválido, perfil permitido/negado e operações básicas de usuários, incluindo testes E2E das respostas HTTP protegidas. |

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

A integração em `backend/src/app.module.ts` registra os módulos de autenticação e usuários; `backend/src/main.ts` habilita CORS para a aplicação web. Os demais endpoints de exemplo foram preservados.

## Endpoints disponíveis

| Método | Caminho | Permissão |
| --- | --- | --- |
| `POST` | `/auth/login` | Público; retorna token e dados públicos do usuário. |
| `GET` | `/auth/me` | Token válido de conta ativa. |
| `GET` | `/users` | Administrador. |
| `POST` | `/users` | Administrador. |
| `PATCH` | `/users/:id` | Administrador. |
| `DELETE` | `/users/:id` | Administrador; não pode excluir a própria conta. |

## Contas fictícias para testes

Estas contas são exclusivamente dados de demonstração. Não use credenciais reais.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `ana.souza@clinicalstudypb.test` | `Admin123!` |
| Pesquisador | `marina.costa@clinicalstudypb.test` | `Demo123!` |
| Coordenador | `rafael.lima@clinicalstudypb.test` | `Demo123!` |

## Como executar

### API

Use a versão Node definida pelo projeto (`backend/.nvmrc`, Node 24):

```bash
cd backend
cp .env.example .env
npm ci
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

Se a API estiver indisponível, a interface pode usar as contas fictícias no modo de demonstração. Nesse modo, alterações na tabela ficam apenas no `localStorage` do navegador; a API utiliza dados em memória. Isso é suficiente para o protótipo, mas não substitui persistência PostgreSQL nem autenticação configurada para produção.

## Testes

```bash
# API (dentro de backend/)
npm test
npm run test:e2e

# Interface (dentro de web/)
npm test
npm run build
```

Os testes foram adicionados, mas devem ser executados no ambiente Node compatível após instalar as dependências.

## Confirmação antes de excluir um usuário

Na tela de Administração de usuários, o botão **Excluir** abre um modal de confirmação com o nome e o perfil da conta selecionada. A exclusão só acontece depois de confirmar em **Excluir usuário**; **Cancelar**, clicar fora do modal ou pressionar `Esc` fecha a confirmação sem excluir. A própria conta conectada não pode ser excluída. A implementação fica em `web/src/pages/UsersPage.tsx`, e os estilos do modal ficam em `web/src/styles.css`.


## Task 3205 — protótipo web de estudos e recrutamento (perfil Pesquisador)

A interface `web/src/pages/StudiesPage.tsx` implementa a lista de estudos clínicos, os indicadores de resumo, busca e filtro por situação, menu de ações, cadastro, edição, confirmação de sucesso e detalhes do estudo. A rota fica em `web/src/App.tsx`; o menu e as permissões do perfil Pesquisador ficam em `web/src/security/access.ts`; os estilos específicos estão no fim de `web/src/styles.css`.

**Limitação:** estudos e indicadores são armazenados localmente no navegador (`localStorage`). Esta entrega não cria endpoints ou persistência de banco para estudos. A integração com o backend deve ser feita quando a equipe definir o contrato da API. O perfil Participante continua fora da interface web.
