# Usuários e controle de acesso

Este documento consolida as regras de autenticação, autorização, perfis e gerenciamento de usuários do ClinicalStudyPB.

## 1. Perfis existentes

A API compartilhada reconhece quatro perfis:

| Perfil | Papel | Acesso na Web |
|---|---|---|
| `Administrador` | administração do sistema e contas | sim |
| `Pesquisador` | estudos e pesquisadores próprios | sim |
| `Coordenador` | painel operacional, candidatos, visitas e relatórios | sim |
| `Participante` | cliente mobile; participação em estudos | não |

A web aceita somente os perfis `Administrador`, `Pesquisador` e `Coordenador` na navegação e na sessão ativa. O `Participante` existe para o cliente mobile e também é reconhecido pela API compartilhada.

## 2. Regras de acesso por perfil

### 2.1. Administrador

- pode listar, consultar, criar, editar e excluir usuários
- acessa a área de administração de usuários
- não pode excluir a própria conta
- pode visualizar e administrar contas de outros perfis

### 2.2. Pesquisador

- acessa estudos clínicos relacionados ao próprio usuário
- pode consultar e alterar apenas estudos associados ao pesquisador autenticado
- não pode acessar rotas de administração de usuários

### 2.3. Coordenador

- acessa telas de painel, candidatos, visitas, reagendamentos e relatórios
- usa fluxo operacional de acompanhamento, ainda com distinção entre funcionalidade implementada e demonstrativa
- não tem acesso gratuito a gestão de usuários de administrador

### 2.4. Participante

- perfil da API compartilhada para uso mobile
- sem página, menu ou sessão própria na web
- acessa consulta de estudos e visitas no aplicativo móvel

## 3. Autenticação

O fluxo principal de autenticação usa:

- `POST /auth/login` para obter a sessão e o token
- `GET /auth/me` para restaurar informaçãocom o token válido
- `POST /auth/logout` para revogar a sessão atual

A autenticação valida:

- existência da sessão ativa
- conta em estado `Ativo`
- token vigente
- perfil atual do usuário

Se a sessão for revogada, a conta for inativada ou o token for inválido, o backend responde com falha de autorização (normalmente `401` ou `403`).

## 4. Controle de rotas e menus

A web usa guardas para impedir acesso a rotas restritas. A mesma regra é aplicada aos menus e às páginas:

- usuários não autenticados são redirecionados
- contas com sessão inválida são tratadas como acesso negado
- perfis fora do escopo da web são rejeitados pelo `AuthContext`
- rotas privadas exigem token bearer e sessão válida no backend

Essas validações ficam na camada de acesso da web e da API, e a navegação por perfil é consistente com a autorização do backend.

## 5. Gestão de usuários

### 5.1. Endpoints

| Método | Endpoint | Permissão |
|---|---|---|
| `GET` | `/users` | administrador |
| `GET` | `/users/:id` | administrador |
| `POST` | `/users` | administrador |
| `PATCH` | `/users/:id` | administrador |
| `DELETE` | `/users/:id` | administrador |

### 5.2. Regras de criação e edição

- somente o administrador pode criar ou editar contas de usuários
- o cadastro web aceita `Administrador`, `Pesquisador` e `Coordenador`
- `Participante` continua existindo na API e pode ser mantido para contas compartilhadas do mobile
- a própria conta não pode ser excluída
- alterações de senha ou inativação revogam todas as sessões da conta

### 5.3. Confirmação de exclusão

Na interface web, ao clicar em **Excluir** em Administração de usuários, aparece um modal com:

- nome do usuário
- perfil da conta
- ação de confirmação

A exclusão só é efetivada após confirmar em **Excluir usuário**. A ação **Cancelar**, clicar fora do modal ou pressionar `Esc` fecha a confirmação sem excluir a conta.

## 6. Regras relacionadas à própria conta

- a conta autenticada não pode ser excluída
- uma conta inativada ou revogada não consegue continuar acessando endpoints protegidos
- alteração de perfil passa a valer na próxima requisição protegida
- logout invalida a sessão atual no banco antes de limpar o estado local da interface

## 7. Credenciais de demonstração

As contas de demonstração são fictícias e devem ser usadas apenas em ambiente local de desenvolvimento:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `ana.souza@clinicalstudypb.test` | `Admin123!` |
| Pesquisador | `marina.costa@clinicalstudypb.test` | `Demo123!` |
| Coordenador | `rafael.lima@clinicalstudypb.test` | `Demo123!` |
| Participante | `bianca.oliveira@clinicalstudypb.test` | `Demo123!` |

## 8. Observações de integração

- a API e o banco reconhecem os quatro perfis;
- a web restringe a navegação aos três perfis de interface;
- `Participante` permanece disponível para aplicações mobile e para a API compartilhada;
- o `AuthContext` da web invalida sessões restauradas que recebam `401` e não usa fallback local quando a API falha.

## 9. Referências

- [Arquitetura e integração](./arquitetura-e-integracao.md)
- [Banco de dados](.\sprint01\banco_de_dados\README-BD.md)
- [Documentação de testes](.\sprint01\testes\README-TESTES.md)
- [README principal](../../../README.md)
