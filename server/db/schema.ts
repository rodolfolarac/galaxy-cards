import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Um card = uma palavra em inglês + tradução, opcionalmente com uma frase
 * de exemplo e a tradução dela. Os campos de SRS (ease/intervalDays/dueAt)
 * controlam quando o card volta a aparecer no baralho.
 */
export const cards = pgTable(
  'cards',
  {
    id: serial('id').primaryKey(),

    word: text('word').notNull(),
    translation: text('translation').notNull(),
    phrase: text('phrase'),
    phraseTranslation: text('phrase_translation'),
    notes: text('notes'),

    // --- SRS ---
    /** Fator de facilidade no estilo SM-2. Começa em 2.5, nunca abaixo de 1.3. */
    ease: real('ease').notNull().default(2.5),
    /** Intervalo atual em dias. 0 = ainda está no baralho de hoje. */
    intervalDays: real('interval_days').notNull().default(0),
    /** Quando o card volta a ficar disponível. Passado/agora = está no baralho. */
    dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),

    easyCount: integer('easy_count').notNull().default(0),
    hardCount: integer('hard_count').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    /** Sequência atual de "fácil" seguidos. Zera ao marcar difícil. */
    streak: integer('streak').notNull().default(0),

    /** true quando o intervalo passou do limiar de memorização (>= 7 dias). */
    mastered: boolean('mastered').notNull().default(false),
    /** Arquivado manualmente: sai do baralho para sempre, mas fica no histórico. */
    archived: boolean('archived').notNull().default(false),

    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cards_due_idx').on(t.dueAt),
    index('cards_archived_idx').on(t.archived),
  ],
);

/**
 * Uma sessão de estudo = um baralho aberto. Guarda o cronômetro e os
 * contadores, e é atualizada a cada carta respondida (nunca só no final,
 * para que uma interrupção não perca o progresso).
 */
export const studySessions = pgTable(
  'study_sessions',
  {
    id: serial('id').primaryKey(),
    /** Quantidade pedida ao abrir o baralho (null = "todas"). */
    requestedCount: integer('requested_count'),
    /** Quantas cartas realmente entraram na fila. */
    queuedCount: integer('queued_count').notNull().default(0),
    studiedCount: integer('studied_count').notNull().default(0),
    easyCount: integer('easy_count').notNull().default(0),
    hardCount: integer('hard_count').notNull().default(0),
    /** Cartas que saíram do baralho nesta sessão (agendadas para o futuro). */
    leftDeckCount: integer('left_deck_count').notNull().default(0),

    /** 'active' | 'completed' | 'aborted' */
    status: text('status').notNull().default('active'),
    durationMs: integer('duration_ms').notNull().default(0),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [index('sessions_started_idx').on(t.startedAt)],
);

/** Um registro por carta respondida. É a fonte de verdade das estatísticas. */
export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id').references(() => studySessions.id, {
      onDelete: 'set null',
    }),
    /** 'easy' | 'hard' */
    rating: text('rating').notNull(),
    /** Intervalo em dias aplicado por esta revisão. */
    intervalDays: real('interval_days').notNull().default(0),
    /** Quanto tempo a carta ficou aberta, em ms. */
    elapsedMs: integer('elapsed_ms').notNull().default(0),
    /** true se esta revisão tirou a carta do baralho de hoje. */
    leftDeck: boolean('left_deck').notNull().default(false),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reviews_reviewed_idx').on(t.reviewedAt),
    index('reviews_card_idx').on(t.cardId),
  ],
);

/**
 * Cache de áudio do Google Cloud TTS. Guardar o mp3 em base64 evita
 * pagar/chamar a API de novo para a mesma frase e deixa o app rápido.
 */
export const audioCache = pgTable(
  'audio_cache',
  {
    /** sha256(text + '|' + voice + '|' + speed) */
    key: text('key').primaryKey(),
    text: text('text').notNull(),
    voice: text('voice').notNull(),
    mime: text('mime').notNull().default('audio/mpeg'),
    data: text('data').notNull(), // base64
    bytes: integer('bytes').notNull().default(0),
    hits: integer('hits').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type StudySession = typeof studySessions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
