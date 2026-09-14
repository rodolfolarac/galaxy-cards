export interface Card {
  id: number;
  word: string;
  translation: string;
  phrase: string | null;
  phraseTranslation: string | null;
  notes: string | null;
  intervalDays: number;
  dueAt: string;
  easyCount: number;
  hardCount: number;
  reviewCount: number;
  streak: number;
  mastered: boolean;
  /** Chegou aos 60 dias: não volta ao baralho até você devolver pelo painel. */
  retired: boolean;
  archived: boolean;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: number;
  requestedCount: number | null;
  queuedCount: number;
  studiedCount: number;
  easyCount: number;
  hardCount: number;
  leftDeckCount: number;
  status: 'active' | 'completed' | 'aborted';
  durationMs: number;
  startedAt: string;
  endedAt: string | null;
}

export interface Summary {
  registered: number;
  mastered: number;
  permanent: number;
  archived: number;
  dueNow: number;
  learning: number;
}

export interface Overview {
  period: 'day' | 'week' | 'month';
  from: string;
  reviews: {
    studied: number;
    distinctCards: number;
    easy: number;
    hard: number;
    leftDeck: number;
    timeMs: number;
  };
  sessions: { total: number; completed: number; aborted: number; durationMs: number };
  cardsCreated: number;
}

export interface DayPoint {
  day: string;
  studied: number;
  easy: number;
  hard: number;
}

export interface StudiedWord {
  cardId: number;
  word: string;
  translation: string;
  phrase: string | null;
  mastered: boolean;
  intervalDays: number;
  dueAt: string;
  times: number;
  easy: number;
  hard: number;
  lastAt: string;
  leftDeck: boolean;
}

export type Rating = 'easy' | 'hard';
export type Period = 'day' | 'week' | 'month';
