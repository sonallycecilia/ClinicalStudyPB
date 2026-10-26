# Cypress — tasks 3209 e 3210

Esta configuração adiciona testes E2E de navegador para a versão atual do ClinicalStudyPB.

## Arquivos adicionados

- `web/cypress.config.ts`: configuração do Cypress e URL-base do Vite.
- `web/cypress/e2e/fluxo-acesso-usuarios.cy.ts`: task 3209 — login, bloqueio de acesso sem sessão, permissões por perfil, cadastro/busca/exclusão de usuário, persistência de sessão e logout.
- `web/cypress/e2e/fluxo-cadastro-estudo.cy.ts`: task 3210 — cadastro de estudo, confirmação, pesquisa, persistência no PostgreSQL após recarregar e validações do formulário.
- `web/cypress/support/e2e.ts`: arquivo de suporte E2E.

## Instalação

Abra um terminal na pasta `web` e execute:

```powershell
npm install
npx cypress verify
```

O Cypress foi adicionado como dependência de desenvolvimento. O ambiente que gerou esta entrega não conseguiu acessar o registro npm para regenerar `web/package-lock.json` após adicionar Cypress. Por isso, a primeira instalação deve usar `npm install` (não `npm ci`) dentro de `web/`; isso reconcilia o lockfile com `package.json`. Confira e inclua o `package-lock.json` atualizado no commit. Depois que o lockfile for atualizado e versionado, os próximos ambientes poderão usar `npm ci`.

## Como executar

Com o Vite e a API rodando em terminais separados (recomendado para testar a integração real):

```powershell
# Terminal 1 — backend
cd backend
npm run start:dev

# Terminal 2 — frontend
cd web
npm run dev

# Terminal 3 — Cypress, dentro de web/
npm run cypress:open
```

Na janela, selecione E2E Testing e execute os dois specs. Para executar sem a interface gráfica:

```powershell
cd web
npm run cypress:run
```

A URL-base é `http://localhost:5173`. Não execute dois servidores Vite diferentes na mesma porta. Os testes apagam os dados locais do navegador antes de cada cenário para não depender de sessões/dados de execuções anteriores.

## Credenciais de demonstração

- Administrador: `ana.souza@clinicalstudypb.test` / `Admin123!`
- Pesquisador: `marina.costa@clinicalstudypb.test` / `Demo123!`

## Limitações desta versão

Os estudos clínicos usam a API autenticada `/studies` e são persistidos no PostgreSQL pela migration `003_create_estudos.sql`. A task 3210 valida a persistência no servidor, não apenas no navegador. A task 3209 usa os endpoints de autenticação, sessão e usuários; o frontend não autentica por fallback local quando a API está indisponível.

## Critério para finalizar as tasks

Execute os dois arquivos no Cypress, corrija qualquer falha e guarde o resultado. A existência dos specs não significa que os testes já passaram. Registre como concluídas apenas depois de uma execução real sem falhas.
