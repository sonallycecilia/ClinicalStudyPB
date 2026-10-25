# Testes Automatizados — Mobile | ClinicalStudyPB

## 1. Objetivo

Este documento descreve os testes automatizados implementados no aplicativo mobile do ClinicalStudyPB, as tecnologias utilizadas, os procedimentos de instalação das dependências e as instruções para executar os testes localmente.

Os testes fazem parte das atividades de QA da **Sprint 1** e têm como objetivo verificar o comportamento básico de telas importantes do aplicativo, permitindo identificar regressões durante o desenvolvimento.

## 2. Tecnologias utilizadas

- **Jest:** framework de testes automatizados.
- **jest-expo:** configuração do Jest para projetos baseados em Expo.
- **@testing-library/react-native:** biblioteca para renderizar componentes React Native e verificar seus comportamentos.
- **Node.js e npm:** ambiente de execução JavaScript e gerenciamento de dependências.

## 3. Testes implementados

Foram criados testes automatizados para duas telas do aplicativo:

| Arquivo | Finalidade |
|---|---|
| `LoginScreen.test.tsx` | Verificar o comportamento básico da tela de login. |
| `HomeScreen.test.tsx` | Verificar o comportamento básico da tela inicial. |

Os testes verificam aspectos básicos da renderização das telas. A cobertura de cenários adicionais poderá ser ampliada conforme novas funcionalidades forem desenvolvidas.

**Localização dos arquivos:** os testes estão associados às telas correspondentes dentro da estrutura do aplicativo mobile.

## 4. Pré-requisitos

Antes de executar os testes, é necessário ter instalado:

- Node.js, preferencialmente em uma versão compatível com a utilizada no CI.
- npm, instalado junto com o Node.js.
- Git, caso seja necessário obter o projeto do repositório.

## 5. Como executar os testes

Execute os comandos abaixo dentro da pasta `mobile/`.

### Passo 1 — Instalar as dependências

Antes da primeira execução, execute:

```bat
npm.cmd ci
```

Esse comando instala as dependências a partir do arquivo `package-lock.json`, respeitando as versões registradas no projeto.

### Passo 2 — Executar os testes automatizados

Execute:

```bat
npm.cmd test -- --runInBand
```

Este é o comando principal para executar os testes. 

### Passo 3 — Conferir o resultado

Na execução validada durante o desenvolvimento, o resultado esperado era:

- **2 suítes de testes executadas;**
- **2 testes aprovados;**
- **nenhum teste reprovado.**

## 6. Verificações complementares

Além dos testes automatizados, foram realizadas verificações estáticas do código.

### Análise de código (lint)

```bat
npm.cmd run lint
```

Verifica problemas de estilo e possíveis erros identificados pelas regras de análise estática configuradas no projeto.

### Verificação de tipos TypeScript

```bat
npx.cmd tsc --noEmit
```

Verifica erros de tipagem TypeScript sem gerar arquivos JavaScript.

### Verificação das alterações no Git

```bat
git diff --check
```

Verifica problemas de espaços em branco nas alterações ainda não commitadas.

> Observação: se algum comando complementar não estiver disponível na versão atual do projeto, confira os scripts existentes em `package.json` e a configuração do TypeScript.

## 7. Pipeline de CI com GitHub Actions

Foi configurada uma pipeline de Integração Contínua (*Continuous Integration — CI*) utilizando o GitHub Actions, por meio do arquivo `.github/workflows/mobile-ci.yml`.

O objetivo é automatizar as verificações do aplicativo mobile, permitindo identificar problemas nas alterações do código antes que elas avancem no fluxo de desenvolvimento.

### Etapas da pipeline

A pipeline automatiza as verificações definidas no workflow, que incluem a preparação do ambiente, a instalação das dependências e a execução dos testes e das análises configuradas.

O fluxo geral é:

1. **Preparação do ambiente:** configura a versão do Node.js utilizada pela pipeline.
2. **Instalação das dependências:** instala as dependências do projeto mobile utilizando o `package-lock.json`.
3. **Execução dos testes:** executa os testes automatizados configurados para o aplicativo.
4. **Verificações adicionais:** executa as demais verificações definidas no arquivo de workflow, quando configuradas.

## 8. Considerações finais

Os testes automatizados implementados estabelecem uma base inicial de validação para o aplicativo mobile do ClinicalStudyPB. Como evolução, recomenda-se ampliar a cobertura para validações de formulários, interações do usuário, estados de carregamento, tratamento de erros e fluxos de navegação, conforme as funcionalidades forem implementadas.