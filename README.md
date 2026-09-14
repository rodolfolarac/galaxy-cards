# ✦ Galaxy Cards

Baralho pessoal de memorização de vocabulário em inglês, com repetição espaçada, áudio nativo e
progresso guardado em banco de dados — não em `localStorage`.

**Comece por [SETUP.md](./SETUP.md)** — é o passo a passo completo, do zero ao app no celular.

---

## O que ele faz

**Cadastro.** Palavra em inglês, tradução, e opcionalmente uma frase de exemplo com a tradução
dela e uma observação. Dá para colar dezenas de palavras de uma vez pelo importador em massa
(`palavra ; tradução ; frase ; tradução da frase`, uma por linha).

**Baralho.** Você escolhe 10, 20, 30, 40, 50 ou todas. A ordem é sempre sorteada
(Fisher-Yates). O baralho abre como um modal em tela cheia.

**Áudio automático.** Ao abrir cada carta, a palavra é falada em inglês; um segundo depois, a
frase de exemplo. Google Cloud TTS com vozes neurais quando há chave configurada — e cada áudio
gerado fica guardado no banco, então a mesma palavra nunca custa uma segunda chamada. Sem chave,
cai na voz do próprio navegador e tudo continua funcionando.

**Fácil e difícil.** Cada "fácil" seguido afasta a carta mais 15 dias:

| Acertos seguidos | A carta volta em |
| --- | --- |
| 1º fácil | 15 dias |
| 2º fácil | 30 dias |
| 3º fácil | 45 dias |
| 4º fácil | **nunca** — vira permanente |

Aos 60 dias a palavra sai do baralho de vez. Ela continua no acervo, marcada como
**permanente**, e só volta se você devolvê-la pelo painel.

**Difícil** derruba a escada para zero e devolve a carta ao baralho na hora — errar uma vez
recomeça do primeiro degrau. Dentro do mesmo baralho, uma carta difícil reaparece no máximo
uma vez, para a sessão sempre terminar com o resumo.

O botão "Fácil" mostra, antes do clique, exatamente em quanto tempo aquela carta volta.

**Nada se perde.** Cada resposta grava na hora: o card, o registro da revisão e os contadores da
sessão. O cronômetro é salvo a cada 15 segundos. Se você fechar o app no meio do baralho, o que
já foi respondido está salvo e as cartas restantes continuam no baralho.

**Interromper.** Botão de sair a qualquer momento, com confirmação que diz o que já foi salvo.
A sessão fica marcada como interrompida no histórico, com o tempo e a quantidade de cartas.

**Progresso.** Uma aba com recortes de hoje, 7 dias e 30 dias: cartas estudadas, palavras
distintas, quantas saíram do baralho, quantas repetiram, tempo estudando, gráfico diário dos
últimos 30 dias, a lista das palavras estudadas no período e o histórico de baralhos.

**Contadores no topo.** "*x* palavras aprendidas e memorizadas" e "*x* palavras cadastradas",
com um arco mostrando a proporção entre os dois.

**Acesso protegido.** Uma tela de código antes de tudo. Quem tiver a URL sem o código não lê nem
altera nada.

---

## Como a segurança funciona

- O código de acesso nunca é guardado — só um hash **bcrypt** (12 rounds), numa variável de
  ambiente. Nem o banco nem o repositório têm o código.
- Entrando, o servidor emite um **JWT** num cookie `HttpOnly`, `SameSite=Lax` e `Secure` em
  produção. JavaScript da página não consegue ler o cookie, o que fecha a porta para roubo de
  sessão via XSS.
- **Toda** rota sob `/api` (exceto o próprio login) passa pelo middleware `requireAuth`. Sem
  cookie válido, a resposta é `401` — não existe rota de leitura aberta.
- Oito tentativas erradas por IP a cada 15 minutos, e toda tentativa errada tem 400 ms de atraso
  proposital.
- A chave do Google TTS fica só no servidor; o navegador recebe o mp3, nunca a chave.

---

## Arquitetura

```
server/
  app.ts              app Express (usado igual em dev, produção e serverless)
  index.ts            servidor local / VPS
  db/schema.ts        tabelas Drizzle: cards, study_sessions, reviews, audio_cache
  lib/srs.ts          agendamento de repetição espaçada + embaralhamento
  lib/auth.ts         passcode, JWT, rate limit
  lib/tts.ts          Google TTS + cache em banco
  routes/             auth · cards · study · stats · tts
api/index.ts          entrada serverless da Vercel (reaproveita server/app.ts)
src/
  components/         Starfield · DeckView · CardsView · StatsView · StudyModal · FlashCard
  lib/                api · audio · format · types
drizzle/              migrações SQL geradas
```

O mesmo app Express serve os três ambientes, então não há código duplicado entre rodar local,
num VPS e na Vercel.

**Stack:** React 19 · Vite 7 · Tailwind v4 · Express · Drizzle ORM · Neon Postgres ·
Google Cloud Text-to-Speech.

---

## Atalhos de teclado durante o estudo

| Tecla | Ação |
| --- | --- |
| `Espaço` / `Enter` | vira a carta |
| `D` ou `1` | marca difícil |
| `F` ou `2` | marca fácil |
| `Esc` | interrompe o estudo |

---

## Ajustando o algoritmo

Tudo está em `server/lib/srs.ts`, no topo do arquivo:

```ts
export const STEP_DAYS = 15;            // tamanho de cada degrau
export const PERMANENT_AFTER_DAYS = 60; // aqui a carta sai do baralho de vez
```

Quer degraus de 10 dias parando em 90? Troque os dois números. O resto se ajusta sozinho — os
degraus, o rótulo do botão, o contador de acertos no painel e os testes.
