# Registro da integração final do ClinicalStudyPB

## Fonte e combinação das versões

Esta entrega combina o backend PostgreSQL de `ClinicalStudyPB-feat-banco-de-dados`, a integração web mais recente, as páginas do Coordenador da versão completa anterior e os testes Cypress das tasks 3209 e 3210. Foram preservados os diagramas, comentários de código e guias relevantes. Arquivos locais `.env`, `node_modules`, `.git` e builds antigos não são distribuídos no ZIP.

## Decisões de integração

- **Banco e sessão:** PostgreSQL continua como fonte de verdade para usuários e sessões. O token restaurado é validado por `GET /auth/me`; o botão Sair chama `POST /auth/logout` para revogar a sessão no servidor antes de limpar a sessão local.
- **Estudos:** a implementação antiga em memória foi consolidada com a API web e substituída por persistência PostgreSQL (`backend/migrations/003_create_estudos.sql`). As rotas `GET /studies`, `GET /studies/:id`, `POST /studies` e `PATCH /studies/:id` exigem um Pesquisador ativo e só permitem ler/alterar estudos do pesquisador autenticado. O dono é obtido do token, não de um identificador fornecido pelo formulário.
- **Menus web:** Administrador tem Administração de usuários; Pesquisador tem Estudos clínicos; Coordenador tem painel, candidatos/participantes, visitas/avaliações, reagendamentos e relatórios.
- **Participante:** o perfil continua no banco e na API compartilhada para o aplicativo mobile. Não possui login/página/menu na interface Web; contas Participante já existentes continuam visíveis na administração compartilhada e só mostram a opção Participante ao editar essa conta existente. Novas contas criadas pela Web podem ser Administrador, Pesquisador ou Coordenador.
- **Cypress:** a task 3209 valida login, proteção de rota, perfis, CRUD de usuários e revogação de sessão. A task 3210 valida cadastro, validação e persistência de estudos no PostgreSQL. Os testes usam as contas e estudos fictícios criados pelo seed de desenvolvimento.
- **Coordenador:** as páginas e os fluxos de interface foram preservados, mas candidatos, visitas, reagendamentos e relatórios ainda são protótipos front-end; não há endpoints ou tabelas próprios para essas áreas nesta integração.
- **Helpers locais antigos:** `web/src/auth/localUsers.ts` foi mantido para referência/compatibilidade, mas não é importado pelo fluxo ativo. A autenticação e o CRUD ativos dependem da API e não recorrem a usuários locais em caso de falha da API.

## Inicialização

### Com Docker (recomendado)

Na raiz:

```powershell
docker compose up --build
```

O Compose inicia PostgreSQL, executa as migrations e o seed de demonstração e sobe API e web. A interface fica em `http://localhost:5173` e a API em `http://localhost:3000`. Use esse seed somente em desenvolvimento/testes; ele usa contas fictícias e preserva registros já existentes.

### Dependências locais

Use Node.js 24 conforme `backend/.nvmrc`. Na raiz:

```powershell
npm ci
npm run setup
npm run dev
```

`npm run setup` instala as dependências do backend com o lockfile e reconcilia as dependências/lockfile web, pois Cypress foi adicionado à versão de frontend sem acesso ao registro npm durante a geração desta entrega. Depois de instalar, confira e versione `web/package-lock.json` atualizado para que instalações futuras possam usar `npm ci`.

## Testes

Com API, PostgreSQL, seed e Vite em execução:

```powershell
cd web
npm run cypress:open
```

Para modo headless, use `npm run cypress:run`. As suítes do backend podem ser executadas dentro de `backend/` com `npm test`, `npm run test:e2e` e `npm run build`, usando PostgreSQL e Node 24.

## Limitações da validação deste pacote

- O TypeScript da interface passou na verificação de tipos usando as dependências presentes na cópia disponível.
- A verificação sintática de 56 arquivos `.ts`/`.tsx` não encontrou diagnósticos.
- O ambiente de montagem não conseguiu acessar `registry.npmjs.org`; por isso, não foi possível atualizar automaticamente o lockfile web, executar Vitest/Vite (o conjunto de módulos disponível não inclui o binário Rollup para Linux) ou instalar o binário Cypress.
- O ambiente só tinha Node 22, enquanto o backend exige Node 24 e a cópia de validação não tinha o pacote `pg` instalado; o build/testes do backend e os testes E2E Cypress não foram declarados como aprovados.

Antes de marcar a integração como concluída, instale as dependências num ambiente com acesso ao npm e execute o build/testes web, build/testes unitários do backend e as duas suítes Cypress contra um PostgreSQL de desenvolvimento.
