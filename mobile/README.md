# Mobile — ClinicalStudyPB

Na raiz do repositório, com dependências instaladas, banco preparado e Docker Desktop iniciado, execute `npm.cmd run dev:all`.

No navegador, acesse http://localhost:8081. No Expo Go, abra o projeto no celular conectado à mesma rede Wi-Fi do computador. A API precisa estar acessível na porta 3000, incluindo a permissão no firewall.

No desenvolvimento, usa `localhost:3000` na web ou o host do Metro na porta 3000 no dispositivo. Para outro endereço, copie `.env.example` para `.env`, configure `EXPO_PUBLIC_API_URL` e recarregue o aplicativo. No emulador Android, use `http://10.0.2.2:3000`. Builds fora de desenvolvimento exigem a variável com a URL do servidor.

O backend permite a origem web `http://localhost:8081`. Para outro endereço no navegador, configure `MOBILE_WEB_ORIGIN` no backend e reinicie a API.

Conta de participante: `bianca.oliveira@clinicalstudypb.test`, senha `Demo123!`. As contas precisam ter sido criadas pelo seed descrito no README principal. O Mobile permite somente contas ativas com perfil `Participante`; os demais perfis são recusados, com tentativa de revogação do token emitido. O acompanhamento ainda não está implementado.

O login usa `POST /auth/login`. Em Android/iOS, apenas o accessToken é persistido com `expo-secure-store`; senha e dados do usuário não são persistidos. Na web, o token fica somente em memória e recarregar a página exige novo login. Ao iniciar no dispositivo, o aplicativo consulta `GET /auth/me` com Bearer e só libera a tela inicial após validar a resposta, o perfil e a conta ativa. Não usa os dados decodificados do JWT como autorização.

Durante a verificação, exibe carregamento. Erros de rede, timeout e 5xx preservam o token, bloqueiam as telas protegidas e oferecem **Tentar novamente** ou **Sair da conta**. Token inválido/expirado/revogado, conta indisponível, inativa ou de outro perfil exigem nova autenticação e removem o token local.

Sair bloqueia o acesso imediatamente, tenta revogar com `POST /auth/logout` e remove o token local mesmo sem rede. Se a revogação falhar, a tela de login avisa que a sessão remota poderá permanecer ativa até expirar. Falhas do armazenamento são apresentadas sem liberar acesso; se apagar falhar, tenta inutilizar o valor na mesma chave. Se exclusão, sobrescrita e revogação falharem simultaneamente, o app mantém o bloqueio no processo atual, mas não pode garantir a remoção física do token após encerrar o processo. Repita **Sair da conta** quando o armazenamento estiver disponível.

Verificações dentro de `mobile/`: `npm.cmd run typecheck`, `npm.cmd run lint` e `npm.cmd test -- --runInBand`.

A exportação usada no CI é `npx.cmd expo export --platform all --output-dir <diretório-temporário>`. O SecureStore está incluído no Expo Go para Android/iOS; não usamos autenticação biométrica. Builds próprios usam o plugin `expo-secure-store` configurado em `app.json`.

## Testar a sessão no Expo Go

1. Inicie backend e Expo com `npm.cmd run dev:all` na raiz; abra o QR code no Expo Go compatível com o SDK 58, na mesma rede do computador.
2. Entre com a conta de Participante acima, feche e reabra o aplicativo. A tela de verificação deve anteceder a conta autenticada, sem mostrar o login momentaneamente.
3. Com token salvo, desligue a API e reabra. Confirme o bloqueio com a mensagem de falha de verificação; religue a API e toque em **Tentar novamente**.
4. Repita a falha e escolha **Sair da conta**. Confirme que o login aparece com o aviso de revogação não confirmada e que reabrir não restaura o acesso.
5. Tente autenticar contas dos outros perfis do seed. Devem ser recusadas com mensagem de acesso exclusivo ao Participante. Para verificar inativação, alteração de perfil e revogação, altere a conta ou sessão no backend e reabra o app.

## Prévia sem backend

Com o Expo em desenvolvimento, acesse http://localhost:8081/preview para escolher uma tela. Links diretos: `/preview/login` e `/preview/inicio`. É possível iniciar apenas o Expo com `npm.cmd --prefix mobile run web` na raiz, sem Docker ou API.

O login da prévia aceita qualquer e-mail válido e senha não vazia; avança para a conta fictícia de Bianca. Sair retorna ao login da prévia. Nenhuma chamada é feita ao backend, e a sessão real permanece separada. O aviso amarelo identifica a simulação. As rotas de prévia são bloqueadas fora do desenvolvimento. Atualmente só Login e Inicial da conta estão implementadas; as demais telas do Figma não estão no repositório.
