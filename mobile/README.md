# Mobile — ClinicalStudyPB

Na raiz do repositório, com dependências instaladas, banco preparado e Docker Desktop iniciado, execute `npm.cmd run dev:all`.

No navegador, acesse http://localhost:8081. No Expo Go, abra o projeto no celular conectado à mesma rede Wi-Fi do computador. A API precisa estar acessível na porta 3000, incluindo a permissão no firewall.

No desenvolvimento, usa `localhost:3000` na web ou o host do Metro na porta 3000 no dispositivo. Para outro endereço, copie `.env.example` para `.env`, configure `EXPO_PUBLIC_API_URL` e recarregue o aplicativo. No emulador Android, use `http://10.0.2.2:3000`. Builds fora de desenvolvimento exigem a variável com a URL do servidor.

O backend permite a origem web `http://localhost:8081`. Para outro endereço no navegador, configure `MOBILE_WEB_ORIGIN` no backend e reinicie a API.

Conta de participante: `bianca.oliveira@clinicalstudypb.test`, senha `Demo123!`. As contas precisam ter sido criadas pelo seed descrito no README principal. Os quatro perfis podem autenticar; a tela inicial confirma conta e perfil. O acompanhamento ainda não está implementado.

O login usa `POST /auth/login`. A sessão fica em memória; ao recarregar ou fechar, é necessário entrar novamente. Sair revoga a sessão na API com `POST /auth/logout`; se a API estiver indisponível, permite tentar novamente. Nenhuma senha é persistida.

Verificações dentro de `mobile/`: `npm.cmd run typecheck`, `npm.cmd run lint` e `npm.cmd test -- --runInBand`.

## Prévia sem backend

Com o Expo em desenvolvimento, acesse http://localhost:8081/preview para escolher uma tela. Links diretos: `/preview/login` e `/preview/inicio`. É possível iniciar apenas o Expo com `npm.cmd --prefix mobile run web` na raiz, sem Docker ou API.

O login da prévia aceita qualquer e-mail válido e senha não vazia; avança para a conta fictícia de Bianca. Sair retorna ao login da prévia. Nenhuma chamada é feita ao backend, e a sessão real permanece separada. O aviso amarelo identifica a simulação. As rotas de prévia são bloqueadas fora do desenvolvimento. Atualmente só Login e Inicial da conta estão implementadas; as demais telas do Figma não estão no repositório.
