# ClinicalStudyPB — Aplicativo Mobile

Aplicativo do participante do **ClinicalStudyPB**, desenvolvido em React Native e Expo para acompanhar estudos clínicos e visitas vinculados à conta autenticada. O projeto oferece execução em Android, iOS e navegador, com navegação protegida, gerenciamento de sessão e interface baseada nos protótipos do Figma Make.

O ClinicalStudyPB é um projeto acadêmico que utiliza dados fictícios. As funcionalidades representam uma simulação de acompanhamento de estudos e não oferecem suporte a diagnósticos ou decisões clínicas automatizadas.

## Sumário

- [Estado atual das funcionalidades](#estado-atual-das-funcionalidades)
- [Funcionalidades em detalhe](#funcionalidades-em-detalhe)
- [Tecnologias e plataformas](#tecnologias-e-plataformas)
- [Instalação e execução](#instalação-e-execução)
- [Configuração da conexão com a API](#configuração-da-conexão-com-a-api)
- [Integração com o backend](#integração-com-o-backend)
- [Estrutura do projeto e rotas](#estrutura-do-projeto-e-rotas)
- [Interface e acessibilidade](#interface-e-acessibilidade)
- [Testes e verificações](#testes-e-verificações)
- [Solução de problemas](#solução-de-problemas)
- [Documentação relacionada](#documentação-relacionada)

## Estado atual das funcionalidades

A tabela distingue recursos integrados à API, comportamentos locais e interfaces que ainda dependem de implementação no backend.

| Área | Funcionalidade | Situação atual |
| --- | --- | --- |
| Acesso | Login com e-mail e senha | Integrado à API; exclusivo para contas ativas com perfil Participante. |
| Sessão | Restauração, validação e encerramento | Integrado à API; token persistido no armazenamento seguro em Android/iOS. |
| Primeiro acesso | Leitura e aceite do termo de consentimento | Implementado localmente; aceite mantido somente em memória. |
| Estudos | Listagem e detalhes das próprias participações | Integrados à API, com carregamento, estado vazio e recuperação de erros. |
| Visitas | Próximas visitas, histórico e detalhes | Integrados à API, com filtros por situação e data. |
| Perfil | Consulta dos dados da conta e logout | Implementados; sem edição de cadastro. |
| Presença | Tela de confirmação | Prévia de interface; não envia confirmação nem altera a visita. |
| Reagendamento | Calendário, período e motivo | Prévia de interface; não envia solicitação nem altera o agendamento. |
| Retirada | Ação na lista e nos detalhes do estudo | Aviso local de funcionalidade em desenvolvimento. |
| Notificações | Sino no cabeçalho | Aviso local; sem consulta ou recebimento de notificações. |
| Recuperação de senha e suporte | Ações na tela de login | Aviso local; sem envio de e-mail, atendimento ou fluxo adicional. |

As listas autenticadas utilizam exclusivamente as respostas do backend. Os dados de exemplo em `tests/fixtures/` são usados nos testes e não alimentam as telas do aplicativo.

## Funcionalidades em detalhe

### Autenticação e controle de acesso

- Login por e-mail e senha, com validação de campos obrigatórios e do formato do e-mail antes da requisição.
- Opção para mostrar ou ocultar a senha, envio pelo teclado e indicação de autenticação em andamento.
- Mensagens para credenciais inválidas, falhas de conexão, respostas inválidas e contas sem permissão.
- Restrição a usuários com perfil `Participante` e situação `Ativo`. Quando um login emite token para uma conta recusada, o aplicativo tenta revogá-lo.
- Proteção das rotas de estudos, visitas e perfil, inclusive quando acessadas diretamente por endereço.

As ações **Esqueci minha senha** e **Precisa de ajuda? Fale com o suporte** exibem **Funcionalidade em desenvolvimento**, preservando os campos preenchidos.

### Gerenciamento de sessão

Em Android e iOS, somente o `accessToken` é persistido com `expo-secure-store`. Senha e dados do usuário não são persistidos. No navegador, o token fica em memória; recarregar a página exige novo login.

Ao iniciar o aplicativo com token salvo, o acesso permanece bloqueado enquanto `GET /auth/me` valida a sessão, o perfil e a situação da conta. A autorização não é baseada apenas na decodificação local do JWT.

Falhas temporárias de rede, timeout e respostas `5xx`, `408` ou `429` durante a restauração preservam o token e oferecem **Tentar novamente** e **Sair da conta**. Sessões inválidas ou contas recusadas exigem nova autenticação. Nas consultas autenticadas, respostas `401` ou `403` também encerram o acesso local.

O logout bloqueia as telas protegidas imediatamente, tenta revogar a sessão no servidor e remove o token local. Se a revogação remota falhar, o login informa que a sessão no servidor poderá permanecer ativa até expirar. Se a exclusão do armazenamento falhar, o aplicativo tenta inutilizar o valor salvo; falhas de limpeza mantêm o acesso bloqueado e permitem repetir a saída. Se exclusão, sobrescrita e revogação falharem simultaneamente, a remoção física do token após encerrar o processo não pode ser garantida.

As consultas também descartam respostas de sessões anteriores para evitar a exibição de dados antigos após logout ou troca de conta.

### Primeiro acesso e termo de consentimento

O fluxo segue o protótipo do Figma:

1. Após autenticar sem aceite local válido, o participante acessa a tela **Primeiro acesso**.
2. **Visualizar termo de consentimento** abre o documento completo, com instituição, versão, publicação e seções de conteúdo.
3. A leitura possui rolagem independente e ações fixas no rodapé. **Confirmar aceite** permanece desabilitado até marcar a concordância.
4. **Voltar sem aceitar** retorna ao primeiro acesso e mantém **Continuar** desabilitado.
5. A confirmação retorna ao primeiro acesso com o estado **Lido e aceito**. O termo pode ser reaberto para consulta antes de continuar.
6. **Continuar** libera o acesso a estudos, visitas e perfil. A opção **Sair** mantém o encerramento real da sessão disponível durante o primeiro acesso.

O documento atual é a versão **1.0**, publicada em **novembro de 2026**, e está definido em [`src/consent/consentTerm.ts`](src/consent/consentTerm.ts).

O aceite associa o ID da conta autenticada, a versão do documento e a data/hora. Esse registro fica **somente em memória**, sem chamada de gravação na API. Na mesma execução, sair e entrar na mesma conta conserva o aceite; outra conta precisa aceitar separadamente. Reiniciar o processo do aplicativo ou recarregar a web elimina esse registro e exige novo aceite. O bloqueio é uma regra de navegação do mobile; não constitui uma exigência adicional dos endpoints `/me/*` no backend.

### Estudos clínicos

A tela **Meus Estudos Clínicos** consulta as participações da conta autenticada e apresenta:

- Quantidade de estudos retornados, título e objetivo de cada estudo.
- Situação do estudo: **Planejamento**, **Recrutamento**, **Em execução** ou **Encerrado**.
- Situação da participação, apresentada separadamente da situação do estudo.
- Datas de início e término, preservando a data civil recebida da API.
- Acesso à tela de detalhes, com código do estudo, pesquisador responsável, objetivo, período e situação da participação.

Os detalhes são resolvidos a partir das próprias participações. Um identificador ausente dessa lista apresenta **Estudo não encontrado entre as suas participações.**, sem consultar rotas administrativas.

A lista e os detalhes tratam carregamento, ausência de dados e falhas de consulta, com opção de nova tentativa. **Solicitar retirada do estudo** aparece para participações ativas e exibe apenas o aviso de que nenhuma solicitação foi enviada.

### Agenda, histórico e detalhes das visitas

A área **Visitas** possui duas abas:

| Aba | Regra aplicada |
| --- | --- |
| Próximas visitas | Visitas com situação `Agendada` e instante de agendamento posterior ao momento da consulta, em ordem crescente de data. |
| Histórico | Visitas `Realizada`, `Ausente` ou `Cancelada`, em ordem decrescente de data. |

Visitas agendadas cujo horário já passou não são incluídas automaticamente no histórico. A mudança de situação depende dos dados registrados no backend.

Os cartões e detalhes apresentam estudo, nome da visita prevista, situação, data, dia da semana e horário no fuso local do dispositivo. Os detalhes utilizam os dados carregados para a agenda atual; uma visita ausente apresenta **Visita não encontrada nesta agenda.** A aba selecionada é mantida ao retornar dos detalhes para a lista.

O contrato atual da API não fornece código da visita, local, endereço ou instruções de preparo. A interface utiliza **Visita NN** e **Local a informar** como alternativas e só exibe o bloco de preparo quando esse dado estiver disponível.

Em desenvolvimento, as visitas **S3M05 Bianca — visita futura** e **S3M05 Bianca — visita realizada**, da conta `bianca.oliveira@clinicalstudypb.test`, exibem o local fictício **Centro de Pesquisa ClinicalStudyPB — João Pessoa/PB** na lista e nos detalhes. A visita futura também exibe esse local nas prévias de ações. Esse exemplo é aplicado somente quando a visita não possui local informado e não é gravado no backend. As demais visitas mantêm os dados recebidos ou a indicação **Local a informar**.

Para visitas agendadas, estão disponíveis as seguintes prévias:

- **Confirmar presença:** exibe os dados da visita e a ação de confirmação.
- **Solicitar reagendamento:** permite selecionar uma preferência de data em calendário, escolher **Manhã** ou **Tarde** e preencher um motivo opcional. O calendário permite navegar entre meses, destaca a seleção e impede selecionar datas anteriores ao dia atual.

Essas ações exibem **Funcionalidade em desenvolvimento. Nenhuma solicitação foi enviada.** Não há gravação, confirmação de sucesso, mudança de situação ou alteração da data da visita.

### Perfil e navegação

O dashboard compartilha cabeçalho, data atual, saudação com o primeiro nome, avatar com iniciais e navegação inferior entre **Estudos**, **Visitas** e **Perfil**. O avatar do cabeçalho também abre o perfil.

A tela **Minha conta** apresenta nome, e-mail e perfil do usuário autenticado, além da ação **Sair da conta**, com indicação de processamento e tratamento de falhas. Não há edição de dados cadastrais nesta versão.

## Tecnologias e plataformas

| Tecnologia | Uso no projeto |
| --- | --- |
| Expo SDK 58 e React Native 0.88 | Execução do aplicativo em Android e iOS. |
| React 19 e TypeScript | Componentes, estado e tipagem. |
| Expo Router | Rotas baseadas em arquivos e proteção da navegação. |
| React Native Web | Execução da interface mobile no navegador. |
| Expo SecureStore | Armazenamento do token em Android/iOS. |
| Expo Font e Manrope | Tipografia empacotada com o aplicativo. |
| Expo Image | Renderização dos recursos visuais, incluindo SVGs locais. |
| Jest, Jest Expo e Testing Library | Testes de serviços, estado, telas e navegação. |
| ESLint e TypeScript | Análise estática e verificação de tipos. |

As dependências e os scripts estão em [`package.json`](package.json). O aplicativo está configurado para orientação retrato e tema claro em [`app.json`](app.json). A exportação de bundles para as três plataformas é verificada no CI; instalação em lojas e distribuição de builds não fazem parte do fluxo documentado aqui.

## Instalação e execução

### Pré-requisitos

- Node.js **24 LTS** para executar o conjunto com o backend, que exige a faixa `>=24.15.0 <25`.
- npm e dependências instaladas a partir dos lockfiles.
- Docker Desktop com Docker Compose para usar o PostgreSQL do repositório, ou uma instância PostgreSQL configurada separadamente.
- Backend acessível pelo dispositivo ou navegador.
- Para execução no celular, Expo Go compatível com o SDK 58. Emuladores e simuladores exigem o ambiente da plataforma configurado.

Os exemplos abaixo usam **PowerShell**, a partir da **raiz do repositório**. `npm.cmd` e `npx.cmd` evitam o bloqueio dos scripts `.ps1` pela política de execução do Windows. Em outros shells, use `npm` e `npx`.

### Preparação inicial

Instale as dependências:

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix web
npm.cmd ci --prefix mobile
```

Crie `backend/.env` a partir de [`backend/.env.example`](../backend/.env.example) se o arquivo ainda não existir. Preserve configurações locais existentes:

```powershell
if (!(Test-Path backend\.env)) {
    Copy-Item backend\.env.example backend\.env
}
```

Para o PostgreSQL do Compose, ajuste `DATABASE_URL` em `backend/.env` para:

```dotenv
DATABASE_URL=postgresql://clinicalstudy:clinicalstudy_local@localhost:5433/clinicalstudypb
```

O Compose publica o banco na porta **5433** do computador. A porta **5432** é usada dentro do container e também consta no arquivo de ambiente de exemplo; ajuste-a ao executar a API fora do Docker.

Com o Docker Desktop iniciado, prepare o banco:

```powershell
docker compose up -d --wait postgres
npm.cmd --prefix backend run db:migrate
```

Para criar as contas e os estudos fictícios de demonstração em ambiente local:

```powershell
$env:ALLOW_DEMO_SEED = 'true'
npm.cmd --prefix backend run db:seed:demo
Remove-Item Env:ALLOW_DEMO_SEED
```

O seed preserva registros existentes e não cria os vínculos de participação nem a agenda do participante. Portanto, listas vazias podem ser o resultado esperado após essa preparação. Estudos vinculados e visitas precisam existir no banco para aparecer no mobile.

### Iniciar o ambiente completo

Depois da preparação inicial:

```powershell
npm.cmd run dev:all
```

O comando inicia o PostgreSQL do Compose e os processos locais de **backend**, **web** e **mobile**. Ele não aplica migrations nem executa o seed automaticamente.

| Serviço | Endereço padrão |
| --- | --- |
| Mobile no navegador | [http://localhost:8081](http://localhost:8081) |
| API e documentação Swagger | [http://localhost:3000/api](http://localhost:3000/api) |
| Aplicação web administrativa | [http://localhost:5173](http://localhost:5173) |
| PostgreSQL no computador | `localhost:5433` |

### Iniciar somente backend e mobile

Com o banco preparado e em execução, mantenha dois terminais abertos na raiz:

```powershell
# Terminal 1 — Backend
npm.cmd run dev:backend
```

```powershell
# Terminal 2 — Mobile
npm.cmd run dev:mobile
```

No terminal do Expo, abra o QR code com o Expo Go no celular conectado à mesma rede Wi-Fi. Para iniciar diretamente uma plataforma:

```powershell
npm.cmd --prefix mobile run web
npm.cmd --prefix mobile run android
npm.cmd --prefix mobile run ios
```

Execute apenas o comando da plataforma desejada. O simulador iOS requer macOS; no Windows, é possível usar um iPhone físico com Expo Go. Confira no terminal o endereço efetivamente escolhido pelo Expo caso a porta padrão esteja ocupada.

### Conta de demonstração

Após executar o seed, utilize a conta do perfil Participante:

| Campo | Valor |
| --- | --- |
| E-mail | `bianca.oliveira@clinicalstudypb.test` |
| Senha | `Demo123!` |

Contas de Administrador, Pesquisador e Coordenador são recusadas pelo mobile. O primeiro login da execução passa pelo termo de consentimento antes de liberar o dashboard.

## Configuração da conexão com a API

A variável `EXPO_PUBLIC_API_URL` define a URL base do backend, sem acrescentar `/api`. O caminho `/api` pertence à documentação Swagger.

Quando necessário, copie [`mobile/.env.example`](.env.example) para `mobile/.env` e configure a URL:

```powershell
if (!(Test-Path mobile\.env)) {
    Copy-Item mobile\.env.example mobile\.env
}
```

| Ambiente | URL base de exemplo |
| --- | --- |
| Navegador no computador | `http://localhost:3000` |
| Emulador Android padrão | `http://10.0.2.2:3000` |
| Celular físico na mesma rede | `http://192.168.1.100:3000`, substituindo pelo IP do computador. |

Exemplo de `mobile/.env` para um celular físico:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

Sem configuração explícita, o desenvolvimento usa `localhost:3000` na web ou o host informado pelo Metro na porta `3000` em Android/iOS. Fora do modo de desenvolvimento, `EXPO_PUBLIC_API_URL` é obrigatória. Variáveis com o prefixo `EXPO_PUBLIC_` fazem parte da configuração pública do aplicativo e não devem conter segredos.

Após alterar a configuração, reinicie o Expo e recarregue o aplicativo:

```powershell
npm.cmd --prefix mobile run start -- --clear
```

Para acesso pelo celular, a porta da API precisa estar acessível pela rede e permitida no firewall. No navegador, o backend aceita por padrão a origem `http://localhost:8081`; para outra porta ou host, configure `MOBILE_WEB_ORIGIN` em `backend/.env` e reinicie a API.

## Integração com o backend

| Método | Endpoint | Responsabilidade |
| --- | --- | --- |
| `POST` | `/auth/login` | Autenticar e obter o token e os dados da conta. |
| `GET` | `/auth/me` | Validar a sessão armazenada e recuperar o usuário. |
| `POST` | `/auth/logout` | Solicitar a revogação da sessão atual. |
| `GET` | `/me/studies` | Consultar os estudos vinculados ao participante. |
| `GET` | `/me/visits?scope=upcoming` | Consultar próximas visitas. |
| `GET` | `/me/visits?scope=history` | Consultar o histórico de visitas. |

As requisições protegidas enviam `Authorization: Bearer <token>`. O transporte HTTP compartilhado aplica timeout de **15 segundos**, trata falhas de conexão e os serviços validam o formato das respostas antes da exibição.

O aplicativo não usa rotas administrativas como alternativa às consultas `/me/*`. Também não envia operações para aceite do termo, confirmação de presença, reagendamento ou retirada. As permissões e os vínculos de dados são verificados pelo backend; a proteção da interface complementa esse controle.

## Estrutura do projeto e rotas

```text
mobile/
├── assets/                  # Logotipo, ícones e recursos visuais locais
├── src/
│   ├── api/                 # Transporte HTTP, erros e validações compartilhadas
│   ├── app/                 # Rotas e layouts do Expo Router
│   ├── auth/                # Autenticação, sessão e armazenamento do token
│   ├── components/          # Campos, cartões, calendário e estrutura do dashboard
│   ├── consent/             # Conteúdo do termo e estado local do aceite
│   ├── routes/              # Componentes de rota e testes de navegação
│   ├── screens/             # Implementação das telas
│   ├── studies/             # Serviço e consulta dos estudos do participante
│   ├── ui/                  # Paleta, tipografia e tokens visuais
│   └── visits/              # Serviço, filtros e estado da agenda
├── tests/fixtures/          # Dados e auxiliares exclusivos dos testes
├── app.json                 # Configuração do Expo e plugins
└── package.json             # Dependências e comandos
```

| Rota | Tela | Condição de acesso |
| --- | --- | --- |
| `/login` | Login | Sem sessão autenticada. |
| `/session` | Verificação e recuperação da sessão | Inicialização, validação ou falha de verificação. |
| `/primeiro-acesso` | Boas-vindas e situação do termo | Participante autenticado no fluxo de primeiro acesso. |
| `/termo-consentimento` | Leitura e aceite do termo | Participante autenticado no fluxo de primeiro acesso. |
| `/` | Meus Estudos Clínicos | Participante autenticado após aceite e continuidade. |
| `/estudos/[id]` | Detalhes do estudo | Mesmo controle de acesso; dados das próprias participações. |
| `/visitas` | Próximas visitas e histórico | Participante autenticado após aceite e continuidade. |
| `/visitas/[id]` | Detalhes da visita | Mesmo controle de acesso; dados da agenda carregada. |
| `/visitas/[id]/[action]` | Prévia de confirmação ou reagendamento | Ações `confirmar` e `reagendar` para visitas agendadas. |
| `/perfil` | Minha conta | Participante autenticado após aceite e continuidade. |

## Interface e acessibilidade

A interface adapta os protótipos do Figma Make a componentes nativos, reutilizando os tokens de [`src/ui/theme.tsx`](src/ui/theme.tsx), o logotipo local e os componentes compartilhados. O termo e o primeiro acesso usam como referência o ZIP `ClinicalStudyPB - mobile (1).zip`; as telas anteriores seguem a exportação `ClinicalStudyPB - mobile.zip`.

A fonte **Manrope** é empacotada com o aplicativo e carregada com `expo-font`, sem depender do Google Fonts durante o uso. Enquanto a fonte carrega ou se houver falha, a tipografia nativa mantém a interface disponível. Os SVGs locais são renderizados com `expo-image`.

As telas utilizam áreas seguras, conteúdo rolável, tratamento do teclado e largura de conteúdo limitada em telas maiores. Botões, abas, checkbox, campos e calendário incluem rótulos e estados de acessibilidade; indicadores de carregamento e mensagens de erro possuem identificação semântica. A configuração atual utiliza tema claro, e sombras e renderização podem variar entre Android, iOS e web.

## Testes e verificações

Execute os comandos na pasta `mobile/`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand
```

A suíte cobre autenticação, restrição de perfil, restauração e encerramento da sessão, falhas do armazenamento, mudanças de conta, validação dos contratos de estudos e visitas, estados de carregamento e erro, filtros e datas, calendário, primeiro acesso, aceite e navegação protegida. As prévias de ações são verificadas para não enviarem operações ao backend.

O workflow [`Mobile CI`](../.github/workflows/mobile-ci.yml) instala as dependências, executa testes, lint e verificação de tipos e exporta os bundles de Android, iOS e web. Para conferir a exportação localmente:

```powershell
npx.cmd expo export --platform all --output-dir dist
```

A exportação gera os bundles; não instala o aplicativo no dispositivo nem publica uma versão nas lojas.

### Roteiro de validação manual

1. Autentique a conta de demonstração e verifique o bloqueio de **Continuar** antes do aceite.
2. Abra o termo, role o conteúdo e volte sem aceitar. Depois marque a concordância, confirme, reabra o termo para consulta e continue para os estudos.
3. Confira lista, contador, dados e detalhes dos estudos vinculados, incluindo o estado vazio quando não houver participação.
4. Navegue entre próximas visitas, histórico e detalhes. Nas prévias de confirmação e reagendamento, confirme que a interface informa que nenhuma solicitação foi enviada.
5. Abra o calendário, tente selecionar uma data anterior ao dia atual e preencha período e motivo. Verifique os campos com o teclado aberto.
6. Abra o perfil e saia da conta. Confirme que rotas protegidas ficam indisponíveis e exigem autenticação novamente.
7. Em Android/iOS, autentique, encerre o processo e reabra: a sessão deve ser validada antes de liberar o acesso; o termo será exigido novamente porque o aceite não é persistido.
8. Com token salvo, desligue a API e reabra o app. Verifique **Tentar novamente** e **Sair da conta**; restabeleça a API para testar a recuperação.
9. Teste contas inativas ou de outros perfis, links diretos, indisponibilidade de rede e fontes ampliadas nas configurações do aparelho.

## Solução de problemas

| Sintoma | Verificação recomendada |
| --- | --- |
| Não foi possível conectar ao servidor | Confira se a API está ativa, a URL configurada, a rede e o firewall. No celular, `localhost` aponta para o próprio aparelho. |
| Funciona no navegador, mas não no emulador Android | Configure `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` para o emulador padrão. |
| Falha de CORS na web | Ajuste `MOBILE_WEB_ORIGIN` no backend para a origem usada pelo Expo e reinicie a API. |
| A API não conecta ao PostgreSQL do Compose | Confira o Docker Desktop e use a porta `5433` em `DATABASE_URL` na API executada no computador. |
| Login de demonstração recusado | Confira se migrations e seed foram executados e se a conta está ativa com perfil Participante. |
| Estudos ou visitas vazios | Verifique vínculos de participação, visitas cadastradas e o filtro selecionado. O seed não cria esses vínculos nem a agenda. |
| Login solicitado após recarregar a web | Comportamento esperado: o token web fica somente em memória. |
| Termo solicitado após reabrir o aplicativo | Comportamento esperado: o aceite local não é persistido. |
| Mudanças não aparecem no Expo Go | Reinicie com `npm.cmd --prefix mobile run start -- --clear` e reabra o projeto. |
| Erro ao remover a sessão do dispositivo | Repita **Sair da conta** quando o armazenamento estiver disponível. |

## Documentação relacionada

- [Visão geral do ClinicalStudyPB](../README.md)
- [Backend e documentação da API](../backend/README.md)
- [Documentação da Release 1 e preparação do ambiente](../docs/releases/release1/README.md)
- [Contratos da API de estudos e visitas do participante](../docs/releases/release2/Sprint03/contratos-api-rf12-rf18.md)
- [Links dos protótipos e demais referências](../docs/releases/release1/LINKS-UTEIS.md)
