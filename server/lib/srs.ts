/**
 * Agendamento no estilo SM-2, simplificado para dois botões (fácil / difícil),
 * que é como o usuário pediu: "fácil" tira a carta do baralho por pelo menos
 * uma semana, "difícil" devolve a carta para a fila da sessão atual.
 */

/** Intervalo (em dias) da primeira resposta "fácil". */
export const FIRST_EASY_INTERVAL = 7;
/** A partir deste intervalo a palavra conta como memorizada. */
export const MASTERED_THRESHOLD_DAYS = 7;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.2;
/** Teto de 1 ano para não agendar cartas para 2040. */
export const MAX_INTERVAL_DAYS = 365;

export type Rating = 'easy' | 'hard';

export interface SrsState {
  ease: number;
  intervalDays: number;
  streak: number;
}

export interface SrsResult {
  ease: number;
  intervalDays: number;
  streak: number;
  dueAt: Date;
  mastered: boolean;
  /** true quando a carta deixa o baralho de hoje. */
  leftDeck: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function schedule(state: SrsState, rating: Rating, now = new Date()): SrsResult {
  if (rating === 'hard') {
    // Difícil: sempre volta a aparecer. Fica disponível imediatamente, a
    // facilidade cai e a sequência zera.
    return {
      ease: clamp(state.ease - 0.2, MIN_EASE, MAX_EASE),
      intervalDays: 0,
      streak: 0,
      dueAt: new Date(now.getTime()),
      mastered: false,
      leftDeck: false,
    };
  }

  const ease = clamp(state.ease + 0.15, MIN_EASE, MAX_EASE);
  const streak = state.streak + 1;

  // Primeira vez fácil => 7 dias. Depois, cresce multiplicando pela facilidade.
  const intervalDays =
    state.intervalDays < FIRST_EASY_INTERVAL
      ? FIRST_EASY_INTERVAL
      : clamp(Math.round(state.intervalDays * ease), FIRST_EASY_INTERVAL, MAX_INTERVAL_DAYS);

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    ease,
    intervalDays,
    streak,
    dueAt,
    mastered: intervalDays >= MASTERED_THRESHOLD_DAYS,
    leftDeck: true,
  };
}

/** Texto amigável do próximo intervalo, para mostrar no botão. */
export function describeInterval(days: number): string {
  if (days <= 0) return 'agora';
  if (days === 1) return '1 dia';
  if (days < 7) return `${days} dias`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return w === 1 ? '1 semana' : `${w} semanas`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return m === 1 ? '1 mês' : `${m} meses`;
  }
  const y = Math.round(days / 365);
  return y === 1 ? '1 ano' : `${y} anos`;
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
