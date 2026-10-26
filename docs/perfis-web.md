# Perfis contemplados na interface web

A API compartilhada e o banco reconhecem quatro perfis, pois o projeto também atende ao aplicativo mobile:

- **Administrador**: administração de contas e perfis de acesso.
- **Pesquisador**: estudos clínicos próprios.
- **Coordenador**: painel, candidatos/participantes, visitas e avaliações, reagendamentos e relatórios.
- **Participante**: perfil mantido para o cliente mobile; não tem página, menu ou sessão de navegação própria na interface Web.

A interface Web só aceita sessões dos perfis Administrador, Pesquisador e Coordenador. O `AuthContext` valida tokens restaurados consultando `/auth/me` e rejeita perfis fora desse escopo. No cadastro de usuários Web, só é possível criar contas Administrador, Pesquisador ou Coordenador. Contas Participante existentes podem continuar sendo exibidas para administração compartilhada e, quando editadas, mantêm o perfil Participante por padrão; essa opção só aparece para preservar a conta existente, não para criar novos participantes pelo Web.

Os menus e as rotas usam as mesmas permissões. A API valida token, sessão ativa, situação da conta e perfil atual em cada requisição. Somente Administrador pode listar, consultar por ID, cadastrar, editar e excluir usuários. Estudos clínicos ficam restritos ao Pesquisador proprietário. Conta inativa, excluída ou sessão revogada recebe 401; perfil não autorizado recebe 403.
