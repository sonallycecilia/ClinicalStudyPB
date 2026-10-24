# Perfis contemplados na interface web

A API e a administração web reconhecem quatro perfis:

- **Administrador**: administração de usuários.
- **Pesquisador**: estudos clínicos.
- **Coordenador**: sem página própria nesta versão; direcionado à tela 403.
- **Participante**: sem página própria nesta versão; direcionado à tela 403.

Todos os perfis ativos podem autenticar, consultar a própria conta em `/auth/me` e encerrar a sessão em `/auth/logout`. Somente Administrador pode listar, consultar por ID, cadastrar, editar e excluir usuários. Os outros três perfis recebem 403 nessas operações. Menus e rotas web seguem a mesma separação de áreas.

As permissões são conferidas na API com o perfil atual do banco a cada requisição. Conta inativa, excluída ou sessão revogada recebe 401. O administrador não pode excluir ou inativar a própria conta, nem remover seu próprio perfil administrativo. Alterar senha ou inativar uma conta invalida todas as suas sessões.
