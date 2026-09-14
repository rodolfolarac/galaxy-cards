import { Router } from 'express';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cards, reviews, studySessions } from '../db/schema.js';

export const statsRouter = Router();

type Period = 'day' | 'week' | 'month';

function since(period: Period): Date {
  const now = new Date();
  if (period === 'day') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = period === 'week' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Resumo de um período: dia, semana ou mês. */
statsRouter.get('/overview', async (req, res) => {
  const period = (['day', 'week', 'month'] as const).includes(req.query.period as Period)
    ? (req.query.period as Period)
    : 'day';
  const from = since(period);

  const [r] = await db
    .select({
      studied: sql<number>`count(*)`,
      distinct: sql<number>`count(distinct ${reviews.cardId})`,
      easy: sql<number>`count(*) filter (where ${reviews.rating} = 'easy')`,
      hard: sql<number>`count(*) filter (where ${reviews.rating} = 'hard')`,
      leftDeck: sql<number>`count(distinct ${reviews.cardId}) filter (where ${reviews.leftDeck})`,
      timeMs: sql<number>`coalesce(sum(${reviews.elapsedMs}), 0)`,
    })
    .from(reviews)
    .where(gte(reviews.reviewedAt, from));

  const [s] = await db
    .select({
      sessions: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${studySessions.status} = 'completed')`,
      aborted: sql<number>`count(*) filter (where ${studySessions.status} = 'aborted')`,
      durationMs: sql<number>`coalesce(sum(${studySessions.durationMs}), 0)`,
    })
    .from(studySessions)
    .where(gte(studySessions.startedAt, from));

  const [c] = await db
    .select({ created: sql<number>`count(*)` })
    .from(cards)
    .where(gte(cards.createdAt, from));

  res.json({
    period,
    from,
    reviews: {
      studied: Number(r?.studied ?? 0),
      distinctCards: Number(r?.distinct ?? 0),
      easy: Number(r?.easy ?? 0),
      hard: Number(r?.hard ?? 0),
      leftDeck: Number(r?.leftDeck ?? 0),
      timeMs: Number(r?.timeMs ?? 0),
    },
    sessions: {
      total: Number(s?.sessions ?? 0),
      completed: Number(s?.completed ?? 0),
      aborted: Number(s?.aborted ?? 0),
      durationMs: Number(s?.durationMs ?? 0),
    },
    cardsCreated: Number(c?.created ?? 0),
  });
});

/** Série diária dos últimos N dias, para o gráfico de barras. */
statsRouter.get('/daily', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 7), 120);
  const from = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${reviews.reviewedAt}), 'YYYY-MM-DD')`,
      studied: sql<number>`count(*)`,
      easy: sql<number>`count(*) filter (where ${reviews.rating} = 'easy')`,
      hard: sql<number>`count(*) filter (where ${reviews.rating} = 'hard')`,
    })
    .from(reviews)
    .where(gte(reviews.reviewedAt, from))
    .groupBy(sql`date_trunc('day', ${reviews.reviewedAt})`)
    .orderBy(sql`date_trunc('day', ${reviews.reviewedAt})`);

  // Preenche os dias sem estudo com zero para o gráfico não ficar com buracos.
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    series.push({
      day: key,
      studied: Number(hit?.studied ?? 0),
      easy: Number(hit?.easy ?? 0),
      hard: Number(hit?.hard ?? 0),
    });
  }
  res.json({ series });
});

/** Palavras efetivamente estudadas no período, com a nota que recebeu. */
statsRouter.get('/words', async (req, res) => {
  const period = (['day', 'week', 'month'] as const).includes(req.query.period as Period)
    ? (req.query.period as Period)
    : 'day';
  const from = since(period);
  const limit = Math.min(Number(req.query.limit ?? 200) || 200, 500);

  const rows = await db
    .select({
      cardId: cards.id,
      word: cards.word,
      translation: cards.translation,
      phrase: cards.phrase,
      mastered: cards.mastered,
      intervalDays: cards.intervalDays,
      dueAt: cards.dueAt,
      times: sql<number>`count(${reviews.id})`,
      easy: sql<number>`count(*) filter (where ${reviews.rating} = 'easy')`,
      hard: sql<number>`count(*) filter (where ${reviews.rating} = 'hard')`,
      lastAt: sql<string>`max(${reviews.reviewedAt})`,
      leftDeck: sql<boolean>`bool_or(${reviews.leftDeck})`,
    })
    .from(reviews)
    .innerJoin(cards, eq(cards.id, reviews.cardId))
    .where(gte(reviews.reviewedAt, from))
    .groupBy(cards.id)
    .orderBy(desc(sql`max(${reviews.reviewedAt})`))
    .limit(limit);

  res.json({ words: rows });
});

/** Quantas cartas voltam ao baralho em cada um dos próximos 14 dias. */
statsRouter.get('/forecast', async (_req, res) => {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${cards.dueAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)`,
    })
    .from(cards)
    .where(and(eq(cards.archived, false), sql`${cards.dueAt} < now() + interval '14 days'`))
    .groupBy(sql`date_trunc('day', ${cards.dueAt})`)
    .orderBy(sql`date_trunc('day', ${cards.dueAt})`);

  res.json({ forecast: rows.map((r) => ({ day: r.day, total: Number(r.total) })) });
});
