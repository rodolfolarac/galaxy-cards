# Galaxy Cards — passo a passo de instalação

Tempo total: cerca de 25 minutos. Tudo aqui é gratuito e nenhum passo pede cartão de crédito.

---

## Passo 1 — Criar o banco de dados (Neon Postgres, grátis)

O Neon dá um Postgres na nuvem de graça, sem cartão. É ele que guarda seus cards e seu progresso,
então você acessa os mesmos dados do computador e do celular.

1. Abra **https://neon.com** e clique em **Sign up**. Entre com sua conta do Google — é o
   caminho mais curto.
2. Na tela de criação do projeto:
   - **Project name:** `galaxy-cards`
   - **Postgres version:** deixe a que vier sugerida
   - **Region:** escolha `AWS US East (N. Virginia)` ou a mais próxima do Brasil que aparecer
   - Clique em **Create project**
3. O Neon mostra a **Connection string** na tela seguinte. É um texto assim:

   ```
   postgresql://neondb_owner:npg_AbCd1234@ep-cool-shape-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   Clique no ícone de copiar. **Guarde esse texto** — é a sua `DATABASE_URL`.

   > Se a tela sumir: painel do projeto → botão **Connect** → escolha **Parameters only**
   > desmarcado, e copie a connection string completa.

---

## Passo 2 — Baixar o projeto e configurar

Abra o terminal na pasta do projeto:

```bash
cd galaxy-cards
npm install
cp .env.example .env
```

Agora **gere seu código de acesso**. Troque `meu-codigo-secreto` pelo que você quiser usar
(mínimo 6 caracteres — pode ser uma frase, fica mais seguro):

```bash
npm run passcode -- "meu-codigo-secreto"
```

O comando imprime duas linhas, `PASSCODE_HASH` e `SESSION_SECRET`. Abra o arquivo `.env` e:

- cole essas duas linhas no lugar das que estão vazias;
- cole a connection string do Neon em `DATABASE_URL`.

O `.env` fica assim:

```env
DATABASE_URL="postgresql://neondb_owner:npg_...@ep-....neon.tech/neondb?sslmode=require"
PASSCODE_HASH='$2b$12$....'
SESSION_SECRET='xK9....'
GOOGLE_TTS_API_KEY=""
TTS_VOICE="en-US-Neural2-F"
TTS_RATE="0.95"
PORT=3001
```

> O seu código **não** é salvo em lugar nenhum — só o hash. Se você esquecer, é só rodar
> `npm run passcode` de novo com um código novo e trocar o hash no `.env`.

Crie as tabelas no banco:

```bash
npm run db:push
```

Rode o app:

```bash
npm run dev
```

Abra **http://localhost:5173**, digite seu código e pronto.

---

## Passo 3 — Ativar o áudio do Google Cloud (opcional, mas vale a pena)

**Sem fazer nada**, o app já fala as palavras usando a voz nativa do navegador. Funciona bem no
Chrome e no Edge. O Google Cloud Text-to-Speech dá vozes neurais bem mais naturais, com
**1 milhão de caracteres grátis por mês** — na prática, impossível estourar num app pessoal,
ainda mais porque o app guarda cada áudio no banco e nunca pede o mesmo duas vezes.

### 3.1 — Criar a conta e o projeto

1. Abra **https://console.cloud.google.com** e entre com sua conta Google.
2. Aceite os termos de serviço, se aparecerem.
3. No topo da tela, clique no seletor de projeto (ao lado do logo "Google Cloud") →
   **NOVO PROJETO**.
   - **Nome do projeto:** `galaxy-cards`
   - Clique em **CRIAR** e espere alguns segundos.
4. Quando terminar, clique na notificação **SELECIONAR PROJETO** para entrar nele. Confirme no
   topo que o projeto selecionado é o `galaxy-cards`.

### 3.2 — Ligar o faturamento

A API de voz exige uma conta de faturamento ativa **mesmo para usar só a cota gratuita**. O
Google não cobra nada enquanto você estiver dentro do 1 milhão de caracteres por mês.

1. Menu ☰ (canto superior esquerdo) → **Faturamento**.
2. Clique em **VINCULAR UMA CONTA DE FATURAMENTO** → **CRIAR CONTA DE FATURAMENTO**.
3. Preencha país (Brasil), aceite os termos e informe um cartão. O Google faz uma cobrança de
   verificação de poucos centavos e devolve.
4. Se for sua primeira vez no Google Cloud, você ainda ganha um crédito de teste — que nem
   chega a ser usado nesse volume.

> **Quer evitar o cartão?** Pule este passo 3 inteiro. Deixe `GOOGLE_TTS_API_KEY` vazio no
> `.env` e o app usa a voz do navegador. Nada quebra.

### 3.3 — Ativar a API Text-to-Speech

1. Menu ☰ → **APIs e serviços** → **Biblioteca**.
2. Busque por **Cloud Text-to-Speech API**.
3. Clique no resultado → botão **ATIVAR**. Espere a página confirmar.

### 3.4 — Criar a chave

1. Menu ☰ → **APIs e serviços** → **Credenciais**.
2. **+ CRIAR CREDENCIAIS** → **Chave de API**.
3. A chave aparece numa janelinha (algo como `AIzaSyD...`). **Copie.**
4. Clique em **Editar chave de API** para restringi-la — importante, para ninguém usar sua cota:
   - Em **Restrições de API**, marque **Restringir chave**, e na lista escolha somente
     **Cloud Text-to-Speech API**.
   - Em **Restrições de aplicativo**, deixe **Nenhuma** (a chave é usada pelo servidor, não pelo
     navegador, e nunca é enviada para o front).
   - **SALVAR**.

### 3.5 — Colocar a chave no app

No `.env`:

```env
GOOGLE_TTS_API_KEY="AIzaSyD...sua-chave-aqui"
TTS_VOICE="en-US-Neural2-F"
```

Reinicie o `npm run dev`. Pronto — as cartas passam a falar com voz neural.

**Vozes que valem testar** (troque em `TTS_VOICE`):

| Voz | Como soa |
| --- | --- |
| `en-US-Neural2-F` | feminina americana, clara — o padrão |
| `en-US-Neural2-D` | masculina americana, grave |
| `en-US-Neural2-C` | feminina americana, mais jovem |
| `en-GB-Neural2-A` | feminina britânica |
| `en-GB-Neural2-B` | masculina britânica |

`TTS_RATE` controla a velocidade: `0.85` bem devagar, `1.0` normal.

---

## Passo 4 — Colocar online para usar no celular

### Opção recomendada: Vercel (grátis, 5 minutos)

1. Crie uma conta no **GitHub** (se ainda não tiver) e suba o projeto:

   ```bash
   git init
   git add .
   git commit -m "Galaxy Cards"
   ```

   Crie um repositório **privado** em https://github.com/new chamado `galaxy-cards` e siga as
   duas linhas que o GitHub mostra para enviar (`git remote add origin ...` e `git push`).

2. Abra **https://vercel.com** → **Sign up** com o GitHub.
3. **Add New → Project** → escolha o repositório `galaxy-cards` → **Import**.
4. Antes de clicar em Deploy, abra **Environment Variables** e cadastre, uma por uma:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | a connection string do Neon |
   | `PASSCODE_HASH` | o hash gerado no passo 2 |
   | `SESSION_SECRET` | o secret gerado no passo 2 |
   | `GOOGLE_TTS_API_KEY` | sua chave (se tiver feito o passo 3) |
   | `TTS_VOICE` | `en-US-Neural2-F` |

5. **Deploy**. Em dois minutos você recebe uma URL tipo
   `https://galaxy-cards-abc.vercel.app`.
6. Abra no celular, adicione à tela de início (Safari: Compartilhar → Adicionar à Tela de
   Início; Chrome: menu → Adicionar à tela inicial) e ele se comporta como app.

Quem abrir a URL sem o código vê **só a tela de acesso**. Nenhum dado é lido ou alterado sem
o código.

### E a HostGator?

A **hospedagem compartilhada** da HostGator roda PHP — Node.js não está nas compatibilidades
oficiais dela, então este app não sobe lá. Duas saídas:

- **Plano VPS ou Cloud da HostGator:** aí sim. Instale Node 20+, envie a pasta, rode
  `npm install && npm run build && npm start` e coloque um proxy reverso (nginx) apontando para
  a porta 3001. O mesmo `.env` vale.
- **cPanel com "Setup Node.js App":** se o seu plano tiver esse ícone em *Software*, funciona:
  aponte o **Application startup file** para `dist-server/server/index.js`, cadastre as
  variáveis de ambiente na mesma tela e rode `npm install && npm run build` pelo terminal do
  cPanel.

Se nenhum dos dois existir no seu plano, fique com a Vercel — é grátis e não tem esse limite.

---

## Comandos do dia a dia

| Comando | O que faz |
| --- | --- |
| `npm run dev` | roda front (5173) e API (3001) juntos |
| `npm run build` | gera a versão de produção |
| `npm start` | roda a versão de produção num processo só |
| `npm run db:push` | aplica o schema no banco |
| `npm run db:studio` | abre um painel visual do banco no navegador |
| `npm run passcode -- "novo-codigo"` | gera um hash novo para trocar o código |

---

## Se algo der errado

**"DATABASE_URL não definida"** — o `.env` não existe ou está fora da pasta do projeto.
Rode `cp .env.example .env` na raiz e preencha.

**"PASSCODE_HASH não definida"** — rode `npm run passcode -- "seu-codigo"` e cole as duas
linhas no `.env`.

**O código certo não entra** — o hash tem cifrões (`$`). Mantenha ele entre **aspas simples**
no `.env`, nunca aspas duplas.

**Não sai áudio nenhum** — no celular, o navegador exige um toque na tela antes de tocar som;
o primeiro toque no botão "Abrir baralho" já libera. Se continuar mudo, confira o console do
servidor: um erro `Google TTS 403` significa que a API não foi ativada (passo 3.3) ou a chave
está restrita demais (passo 3.4).

**"Muitas tentativas"** na tela de acesso — proteção contra chute de senha. Espera 15 minutos
ou reinicia o servidor.
