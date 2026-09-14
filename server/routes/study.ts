import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cards, reviews, studySessions } from '../db/schema.js';
import { describeInterval, schedule, shuffle } from '../lib/srs.js';

export const studyRouter = Router();

const openInput = z.object({
  /** null = todas as cartas disponíveis. */
  count: z.number().int().positive().max(1000).nullable().optional(),
  /** Se faltarem cartas vencidas, completa com as agendadas mais próximas. */
  includeFuture: z.boolean().optional().default(false),
  /** Baralho dirigido: só estas cartas, ignorando prazo e quantidade. */
  cardIds: z.array(z.number().int().positive()).max(1000).optional(),
});

/** Quantas cartas estão disponíveis agora (para o seletor de tamanho). */
studyRouter.get('/available', async (_req, res) => {
  const [row] = await db
    .select({
      due: sql<number>`count(*) filter (where ${cards.dueAt} <= now())`,
      total: sql<number>`count(*)`,
    })
    .from(cards)
    .where(and(eq(cards.archived, false), eq(cards.retired, false)));

  res.json({ due: Number(row?.due ?? 0), total: Number(row?.total ?? 0) });
});

/** Sessão em andamento, se houver — permite retomar depois de fechar o app. */
studyRouter.get('/active', async (_req, res) => {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.status, 'active'))
    .orderBy(desc(studySessions.startedAt))
    .limit(1);

  if (!session) { res.json({ session: null, cards: [] }); return; }

  // Recompõe a fila: as cartas da sessão que ainda estão vencidas.
  const reviewed = await db
    .select({ cardId: reviews.cardId })
    .from(reviews)
    .where(eq(reviews.sessionId, session.id));

  res.json({ session, reviewedCardIds: reviewed.map((r) => r.cardId) });
});

/** Abre um baralho novo: sorteia as cartas e cria a sessão. */
studyRouter.post('/open', async (req, res) => {
  const parsed = openInput.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: 'Parâmetros inválidos.' }); return; }
  const { count: requested, includeFuture, cardIds } = parsed.data;

  // Encerra qualquer sessão pendurada antes de abrir outra.
  await db
    .update(studySessions)
    .set({ status: 'aborted', endedAt: new Date() })
    .where(eq(studySessions.status, 'active'));

  // Rodada dirigida (o "revisar as difíceis" do resumo): usa exatamente
  // as cartas pedidas, sem olhar prazo nem quantidade.
  if (cardIds?.length) {
    const picked = await db.select().from(cards).where(inArray(cards.id, cardIds));
    if (!picked.length) {
      res.status(409).json({ error: 'Essas cartas não existem mais.' });
      return;
    }
    const deck = shuffle(picked);
    const [session] = await db
      .insert(studySessions)
      .values({ requestedCount: deck.length, queuedCount: deck.length, status: 'active' })
      .returning();
    res.status(201).json({ session, cards: deck });
    return;
  }

  const now = new Date();
  const dueCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.archived, false), eq(cards.retired, false), lte(cards.dueAt, now)));

  let deck = shuffle(dueCards);

  if (requested != null && deck.length < requested && includeFuture) {
    const have = new Set(deck.map((c) => c.id));
    const extra = await db
      .select()
      .from(cards)
      .where(and(eq(cards.archived, false), eq(cards.retired, false)))
      .orderBy(asc(cards.dueAt))
      .limit(requested * 2);
    for (const c of extra) {
      if (deck.length >= requested) break;
      if (!have.has(c.id)) { deck.push(c); have.add(c.id); }
    }
    deck = shuffle(deck);
  }

  if (requested != null) deck = deck.slice(0, requested);

  if (!deck.length) {
    res.status(409).json({
      error:
        'Nenhuma carta disponível agora. As palavras que você marcou como fáceis voltam nos próximos dias.',
    });
    return;
  }

  const [session] = await db
    .insert(studySessions)
    .values({ requestedCount: requested ?? null, queuedCount: deck.length, status: 'active' })
    .returning();

  res.status(201).json({ session, cards: deck });
});

const reviewInput = z.object({
  cardId: z.number().int().positive(),
  rating: z.enum(['easy', 'hard']),
  elapsedMs: z.number().int().min(0).max(3_600_000).optional().default(0),
  /** Cronômetro total da sessão até aqui, salvo a cada resposta. */
  sessionElapsedMs: z.number().int().min(0).optional(),
});

/**
 * Registra a resposta de uma carta. Card, review e sessão são atualizados
 * na hora — se o app fechar no meio, nada se perde.
 */
studyRouter.post('/sessions/:id/review', async (req, res) => {
  const sessionId = Number(req.params.id);
  const parsed = reviewInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }
  const { cardId, rating, elapsedMs, sessionElapsedMs } = parsed.data;

  const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) { res.status(404).json({ error: 'Card não encontrado.' }); return; }

  const now = new Date();
  const next = schedule({ intervalDays: card.intervalDays, streak: card.streak }, rating, now);

  const [updated] = await db
    .update(cards)
    .set({
      intervalDays: next.intervalDays,
      streak: next.streak,
      dueAt: next.dueAt,
      mastered: next.mastered,
      retired: next.retired,
      lastReviewedAt: now,
      reviewCount: card.reviewCount + 1,
      easyCount: card.easyCount + (rating === 'easy' ? 1 : 0),
      hardCount: card.hardCount + (rating === 'hard' ? 1 : 0),
      updatedAt: now,
    })
    .where(eq(cards.id, cardId))
    .returning();

  await db.insert(reviews).values({
    cardId,
    sessionId,
    rating,
    intervalDays: next.intervalDays,
    elapsedMs,
    leftDeck: next.leftDeck,
    reviewedAt: now,
  });

  const [session] = await db
    .update(studySessions)
    .set({
      studiedCount: sql`${studySessions.studiedCount} + 1`,
      easyCount: sql`${studySessions.easyCount} + ${rating === 'easy' ? 1 : 0}`,
      hardCount: sql`${studySessions.hardCount} + ${rating === 'hard' ? 1 : 0}`,
      leftDeckCount: sql`${studySessions.leftDeckCount} + ${next.leftDeck ? 1 : 0}`,
      ...(sessionElapsedMs != null ? { durationMs: sessionElapsedMs } : {}),
    })
    .where(eq(studySessions.id, sessionId))
    .returning();

  res.json({
    card: updated,
    session,
    nextIn: describeInterval(next.intervalDays),
    leftDeck: next.leftDeck,
    retired: next.retired,
  });
});

/** Salva o cronômetro periodicamente, mesmo sem resposta de carta. */
studyRouter.patch('/sessions/:id', async (req, res) => {
  const id = Number(req.params.id);
  const durationMs = Number(req.body?.durationMs ?? 0);
  const [session] = await db
    .update(studySessions)
    .set({ durationMs: Math.max(0, Math.floor(durationMs)) })
    .where(eq(studySessions.id, id))
    .returning();
  if (!session) { res.status(404).json({ error: 'Sessão não encontrada.' }); return; }
  res.json(session);
});

/** Finaliza ou interrompe a sessão. */
studyRouter.post('/sessions/:id/finish', async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status === 'aborted' ? 'aborted' : 'completed';
  const durationMs = Math.max(0, Math.floor(Number(req.body?.durationMs ?? 0)));

  const [session] = await db
    .update(studySessions)
    .set({ status, durationMs, endedAt: new Date() })
    .where(eq(studySessions.id, id))
    .returning();

  if (!session) { res.status(404).json({ error: 'Sessão não encontrada.' }); return; }
  res.json(session);
});

/** Histórico de sessões para a aba de estatísticas. */
studyRouter.get('/sessions', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  const rows = await db
    .select()
    .from(studySessions)
    .orderBy(desc(studySessions.startedAt))
    .limit(limit);
  res.json({ sessions: rows });
});
