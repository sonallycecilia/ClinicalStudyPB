# Arquitetura e integração do ClinicalStudyPB

Este documento reúne a visão geral da arquitetura do sistema, a responsabilidade de cada aplicação e a forma como os componentes interagem no projeto.

## 1. Visão geral

O ClinicalStudyPB é composto por quatro elementos principais:

- aplicação web
- aplicativo mobile
- backend em NestJS
- PostgreSQL

A API REST do backend concentra regras de negócio, autenticação, autorização e persistência. A web e o mobile usam a API para obter e registrar dados; não se conectam diretamente ao banco.

A arquitetura atende à proposta de um sistema acadêmico de gestão de estudos clínicos, com dados fictícios e sem decisões clínicas automatizadas.

## 2. Responsabilidades por aplicação

### 2.1. Web

A web atende aos perfis de pesquisador, coordenador e administrador. Ela é responsável por:

- autenticação e sessão do usuário
- gerenciamento de usuários
- cadastro e consulta de estudos
- proteção de rotas e menus por perfil
- telas de coordenador e painéis operacionais
- fluxo de acesso e autorização

### 2.2. Mobile

O mobile atende ao perfil participante. Ele permite:

- consulta de estudos em que o participante está incluído
- consulta das próximas visitas
- histórico de comparecimento
- confirmação de presença
- solicitação de reagendamento
- solicitação de retirada voluntária

A interface mobile mantém o perfil `Participante` na API compartilhada, mas não possui página própria na interface web.

### 2.3. Backend

O backend fornece a API REST compartilhada e implementa:

- autenticação via `POST /auth/login`
- restauração de sessão via `GET /auth/me`
- logout via `POST /auth/logout`
- gestão de usuários via `/users`
- gestão de estudos via `/studies`
- validação de sessão, conta ativa e perfil em cada requisição
- integração com PostgreSQL por SQL parametrizado

### 2.4. Banco de dados

O PostgreSQL armazena:

- usuários e sessões
- estudos e critérios
- candidatos e avaliações de elegibilidade
- consentimentos
- participações, visitas, resultados e solicitações
- registros de auditoria

## 3. Fluxo de integração

### 3.1. Web e backend

A web chama a API REST do backend usando `VITE_API_URL`, normalmente `http://localhost:3000` em desenvolvimento. O backend habilita CORS para a origem web local e valida tokens de sessão em cada rota privada.

Fluxo típico:

1. usuário entra com e-mail e senha na web;
2. `POST /auth/login` valida credenciais e retorna token;
3. `GET /auth/me` restaura a sessão ativa;
4. a web mantém o estado de autenticação no navegador;
5. o backend valida sessão e perfil em endpoints protegidos.

### 3.2. Backend e PostgreSQL

O backend usa `DATABASE_URL` para conectar ao PostgreSQL. As operações de leitura e gravação são feitas por `DatabaseService` e módulos específicos, com SQL parametrizado para evitar injeção e garantir consistência.

A arquitetura de acesso é direta e explícita: não há ORM como camada predominante; a persistência é feita por scripts de migração e consultas SQL em módulos do backend.

## 4. Endpoints principais

### 4.1. Autenticação

| Método | Endpoint | Finalidade | Permissões |
|---|---|---|---|
| `POST` | `/auth/login` | autenticar usuário | público |
| `GET` | `/auth/me` | recuperar perfil e sessão ativa | token válido |
| `POST` | `/auth/logout` | invalidar a sessão atual | sessão válida |

### 4.2. Usuários

| Método | Endpoint | Finalidade | Permissões |
|---|---|---|---|
| `GET` | `/users` | listar usuários | administrador |
| `GET` | `/users/:id` | consultar usuário | administrador |
| `POST` | `/users` | criar usuário | administrador |
| `PATCH` | `/users/:id` | editar usuário | administrador |
| `DELETE` | `/users/:id` | excluir usuário | administrador |

### 4.3. Estudos

| Método | Endpoint | Finalidade | Permissões |
|---|---|---|---|
| `GET` | `/studies` | listar estudos do pesquisador | pesquisador ativo |
| `GET` | `/studies/:id` | consultar estudo específico | pesquisador proprietário |
| `POST` | `/studies` | criar estudo | pesquisador ativo |
| `PATCH` | `/studies/:id` | atualizar estudo | pesquisador proprietário |
| `GET` | `/studies/:studyId/candidates` | consultar candidatos do estudo | pesquisador autenticado proprietário do estudo |
| `POST` | `/studies/:studyId/candidates` | cadastrar candidato no estudo | pesquisador autenticado proprietário do estudo |

## 5. Autenticação e autorização

A API usa sessão validada e perfil do usuário em cada requisição. O backend considera:

- token em cabeçalho de autorização;
- existência da sessão associada ao usuário;
- status da conta (`Ativo`/`Inativo`);
- perfil do usuário (`Administrador`, `Pesquisador`, `Coordenador`, `Participante`);
- regra do guard para o endpoint.

Os perfis reconhecidos pela API são os quatro existentes; a interface web, porém, restringe a navegação aos perfis `Administrador`, `Pesquisador` e `Coordenador`. O perfil `Participante` continua sendo suportado na API para uso do cliente mobile.

As regras de acesso relevantes são:

- Administrador: gestão de usuários e permissões;
- Pesquisador: estudos de sua própria autoria;
- Coordenador: fluxo operacional do estudo, candidatos, visitas, painel e relatórios;
- Participante: mobile, sem página própria na web.

## 6. Estado de implementação e elementos demonstrativos

A documentação do projeto indica uma clara separação entre itens implementados e itens ainda demonstrativos.

### Implementado no repositório atual

- autenticação e sessão
- proteção de rotas web
- gerenciamento de usuários
- API de estudos com persistência em PostgreSQL
- cadastro e consulta persistidos de candidatos por estudo, pela API `POST` e `GET /studies/:studyId/candidates`, para o pesquisador autenticado proprietário do estudo
- seed de dados de demonstração
- fluxo web para login, listagem, cadastro e edição de estudos e usuários
- testes automáticos de web, mobile e backend

### Demonstrativo / ainda não integrado plenamente

- demais operações relacionadas a candidatos além do cadastro e da consulta informados acima
- visitas, reagendamentos e relatórios continuam sendo fluxos de interface de demonstração
- processos de acompanhamento de visitas e avaliações em nível operacional completo
- fluxos de mobile que dependem de integrações futuras além do perfil participante básico

Esses itens podem estar presentes como protótipos de interface ou arquivos de suporte, mas a documentação do projeto os classifica como demonstrativos ou não totalmente integrados ao sistema completo.

## 7. Integração local em desenvolvimento

Na raiz do repositório, a execução típica é:

```bash
docker compose up --build
```

A stack fica disponível em:

- web: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5433`

O banco usa volume persistente `postgres_data` e o backend inicia com `npm run db:migrate` e `npm run db:seed:demo` já no processo do Compose.

## 8. Referências

- [README principal](../../../README.md)
- [Documentação de testes](.\sprint01\testes\README-TESTES.md)
- [Banco de dados](.\sprint01\banco_de_dados\README-BD.md)
- [Usuários e controle de acesso](./usuarios-e-controle-de-acesso.md)
