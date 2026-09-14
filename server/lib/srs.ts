/**
 * Agendamento por degraus fixos de 15 dias.
 *
 * Cada "fácil" seguido empurra a carta um degrau adiante:
 *
 *   1º fácil → 15 dias
 *   2º fácil → 30 dias
 *   3º fácil → 45 dias
 *   4º fácil → 60 dias → a carta vira permanente e não volta mais sozinha
 *
 * "Difícil" derruba a sequência para zero e devolve a carta ao baralho na
 * hora, então errar uma vez recomeça a escada do primeiro degrau.
 *
 * Uma carta permanente só retorna se for devolvida ao baralho pelo painel.
 */

/** Tamanho de cada degrau, em dias. */
export const STEP_DAYS = 15;
/** Ao alcançar este intervalo, a carta sai do baralho para sempre. */
export const PERMANENT_AFTER_DAYS = 60;
/** Quantos "fácil" seguidos tornam a carta permanente. */
export const EASY_TO_PERMANENT = PERMANENT_AFTER_DAYS / STEP_DAYS; // 4
/** A partir deste intervalo a palavra conta como memorizada. */
export const MASTERED_THRESHOLD_DAYS = STEP_DAYS;

export type Rating = 'easy' | 'hard';

export interface SrsState {
  intervalDays: number;
  /** Quantos "fácil" seguidos a carta acumulou. */
  streak: number;
}

export interface SrsResult {
  intervalDays: number;
  streak: number;
  dueAt: Date;
  mastered: boolean;
  /** true quando a carta sai do baralho de hoje. */
  leftDeck: boolean;
  /** true quando a carta chegou aos 60 dias e não volta mais sozinha. */
  retired: boolean;
}

/** Intervalo do degrau correspondente a uma sequência de N acertos. */
export function intervalForStreak(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(streak * STEP_DAYS, PERMANENT_AFTER_DAYS);
}

export function schedule(state: SrsState, rating: Rating, now = new Date()): SrsResult {
  if (rating === 'hard') {
    // Difícil: volta ao baralho imediatamente e a escada recomeça do zero.
    return {
      intervalDays: 0,
      streak: 0,
      dueAt: new Date(now.getTime()),
      mastered: false,
      leftDeck: false,
      retired: false,
    };
  }

  const streak = state.streak + 1;
  const intervalDays = intervalForStreak(streak);
  const retired = intervalDays >= PERMANENT_AFTER_DAYS;

  return {
    intervalDays,
    streak,
    dueAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
    mastered: intervalDays >= MASTERED_THRESHOLD_DAYS,
    leftDeck: true,
    retired,
  };
}

/** Texto amigável do próximo intervalo, para mostrar no botão. */
export function describeInterval(days: number): string {
  if (days <= 0) return 'agora';
  if (days === 1) return '1 dia';
  if (days < 30) return `${days} dias`;
  if (days === 30) return '1 mês';
  if (days === 60) return '2 meses';
  if (days < 365) return `${Math.round(days / 30)} meses`;
  const y = Math.round(days / 365);
  return y === 1 ? '1 ano' : `${y} anos`;
}

/** O que acontece se a carta for marcada como fácil agora. */
export function previewEasy(streak: number): { days: number; permanent: boolean } {
  const days = intervalForStreak(streak + 1);
  return { days, permanent: days >= PERMANENT_AFTER_DAYS };
}

/** Embaralhamento Fisher-Yates — a ordem do baralho é sempre aleatória. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
