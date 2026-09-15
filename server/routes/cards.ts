import { Router } from 'express';
import { z } from 'zod';
import { and, count, desc, eq, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cards } from '../db/schema.js';
import { duplicateMessage, findDuplicate, normalizeWord } from '../lib/duplicates.js';

export const cardsRouter = Router();

const cardInput = z.object({
  word: z.string().trim().min(1, 'A palavra é obrigatória.').max(200),
  translation: z.string().trim().min(1, 'A tradução é obrigatória.').max(400),
  phrase: z.string().trim().max(600).optional().nullable(),
  phraseTranslation: z.string().trim().max(600).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const blank = (v: string | null | undefined) => (v && v.length ? v : null);

/** Palavras já cadastradas, arquivadas incluídas, para barrar repetidos. */
const existingWords = () =>
  db.select({ id: cards.id, word: cards.word, archived: cards.archived }).from(cards);

/** Lista com busca, filtro e paginação. */
cardsRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const filter = String(req.query.filter ?? 'all');
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  const conds = [];
  if (q) {
    conds.push(
      or(
        ilike(cards.word, `%${q}%`),
        ilike(cards.translation, `%${q}%`),
        ilike(cards.phrase, `%${q}%`),
      ),
    );
  }
  if (filter === 'mastered') conds.push(and(eq(cards.mastered, true), eq(cards.retired, false))!);
  if (filter === 'permanent') conds.push(eq(cards.retired, true));
  if (filter === 'learning')
    conds.push(and(eq(cards.mastered, false), eq(cards.archived, false), eq(cards.retired, false))!);
  if (filter === 'due')
    conds.push(
      and(eq(cards.archived, false), eq(cards.retired, false), lte(cards.dueAt, new Date()))!,
    );
  if (filter === 'archived') conds.push(eq(cards.archived, true));
  else if (filter !== 'all') conds.push(eq(cards.archived, false));

  const where = conds.length ? and(...conds) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(cards).where(where).orderBy(desc(cards.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(cards).where(where),
  ]);

  res.json({ cards: rows, total });
});

/** Contadores do cabeçalho: cadastradas / aprendidas / no baralho agora. */
cardsRouter.get('/summary', async (_req, res) => {
  const [row] = await db
    .select({
      registered: count(),
      mastered: sql<number>`count(*) filter (where ${cards.mastered} and not ${cards.archived})`,
      permanent: sql<number>`count(*) filter (where ${cards.retired} and not ${cards.archived})`,
      archived: sql<number>`count(*) filter (where ${cards.archived})`,
      dueNow: sql<number>`count(*) filter (where not ${cards.archived} and not ${cards.retired} and ${cards.dueAt} <= now())`,
      learning: sql<number>`count(*) filter (where not ${cards.archived} and not ${cards.retired} and not ${cards.mastered})`,
    })
    .from(cards);

  res.json({
    registered: Number(row?.registered ?? 0),
    mastered: Number(row?.mastered ?? 0),
    permanent: Number(row?.permanent ?? 0),
    archived: Number(row?.archived ?? 0),
    dueNow: Number(row?.dueNow ?? 0),
    learning: Number(row?.learning ?? 0),
  });
});

cardsRouter.post('/', async (req, res) => {
  const parsed = cardInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }
  const d = parsed.data;
  const duplicate = findDuplicate(d.word, await existingWords());
  if (duplicate) {
    res.status(409).json({ error: duplicateMessage(duplicate) });
    return;
  }
  const [row] = await db
    .insert(cards)
    .values({
      word: d.word,
      translation: d.translation,
      phrase: blank(d.phrase),
      phraseTranslation: blank(d.phraseTranslation),
      notes: blank(d.notes),
    })
    .returning();
  res.status(201).json(row);
});

/** Cadastro em massa: uma linha por card, separada por ; ou tab. */
cardsRouter.post('/bulk', async (req, res) => {
  const text = String(req.body?.text ?? '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    res.status(400).json({ error: 'Cole ao menos uma linha.' });
    return;
  }

  const existing = await existingWords();
  /** Chave normalizada → número da primeira linha que a trouxe. */
  const seen = new Map<string, number>();
  const values = [];
  const errors: string[] = [];
  for (const [i, line] of lines.entries()) {
    const parts = line.split(/\t|;/).map((p) => p.trim());
    const [word, translation, phrase, phraseTranslation] = parts;
    if (!word || !translation) {
      errors.push(`Linha ${i + 1}: precisa de "palavra ; tradução".`);
      continue;
    }
    const duplicate = findDuplicate(word, existing);
    if (duplicate) {
      errors.push(`Linha ${i + 1}: ${duplicateMessage(duplicate)}`);
      continue;
    }
    const key = normalizeWord(word);
    const firstLine = seen.get(key);
    if (firstLine) {
      errors.push(`Linha ${i + 1}: “${word}” repete a linha ${firstLine}.`);
      continue;
    }
    seen.set(key, i + 1);
    values.push({
      word,
      translation,
      phrase: blank(phrase),
      phraseTranslation: blank(phraseTranslation),
    });
  }

  if (!values.length) {
    res.status(400).json({ error: errors[0] ?? 'Nada para importar.' });
    return;
  }
  const rows = await db.insert(cards).values(values).returning();
  res.status(201).json({ created: rows.length, errors });
});

cardsRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = cardInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }
  const d = parsed.data;
  if (d.word !== undefined) {
    const duplicate = findDuplicate(d.word, await existingWords(), id);
    if (duplicate) {
      res.status(409).json({ error: duplicateMessage(duplicate) });
      return;
    }
  }
  const [row] = await db
    .update(cards)
    .set({
      ...(d.word !== undefined ? { word: d.word } : {}),
      ...(d.translation !== undefined ? { translation: d.translation } : {}),
      ...(d.phrase !== undefined ? { phrase: blank(d.phrase) } : {}),
      ...(d.phraseTranslation !== undefined
        ? { phraseTranslation: blank(d.phraseTranslation) }
        : {}),
      ...(d.notes !== undefined ? { notes: blank(d.notes) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: 'Card não encontrado.' }); return; }
  res.json(row);
});

/** Arquiva / desarquiva (tira do baralho sem perder o histórico). */
cardsRouter.post('/:id/archive', async (req, res) => {
  const id = Number(req.params.id);
  const archived = Boolean(req.body?.archived ?? true);
  const [row] = await db
    .update(cards)
    .set({ archived, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: 'Card não encontrado.' }); return; }
  res.json(row);
});

/** Volta a carta para o baralho de hoje, zerando o agendamento. */
cardsRouter.post('/:id/reset', async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .update(cards)
    .set({
      intervalDays: 0,
      streak: 0,
      mastered: false,
      retired: false,
      dueAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: 'Card não encontrado.' }); return; }
  res.json(row);
});

cardsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(cards).where(eq(cards.id, id)).returning();
  if (!row) { res.status(404).json({ error: 'Card não encontrado.' }); return; }
  res.json({ deleted: true });
});
