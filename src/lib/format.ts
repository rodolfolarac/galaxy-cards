/** Cronômetro: 07:42 ou 1:07:42. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duração por extenso, para relatórios: "12 min", "1 h 05". */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return `${Math.round(ms / 1000)} s`;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')}`;
}

const dt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const dtTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const shortDate = (iso: string | Date) => dt.format(new Date(iso));
export const dateTime = (iso: string | Date) => dtTime.format(new Date(iso));

/** "volta em 6 dias" / "disponível agora". */
export function relativeDue(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'no baralho';
  const days = Math.ceil(diff / 86_400_000);
  if (days === 1) return 'volta amanhã';
  if (days < 30) return `volta em ${days} dias`;
  const months = Math.round(days / 30);
  return months === 1 ? 'volta em 1 mês' : `volta em ${months} meses`;
}

export const pluralize = (n: number, one: string, many: string) => (n === 1 ? one : many);
