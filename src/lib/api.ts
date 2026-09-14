import type {
  Card,
  DayPoint,
  Overview,
  Period,
  Rating,
  StudiedWord,
  StudySession,
  Summary,
} from './types';

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.error ?? `Erro ${res.status}`, res.status);
  }
  return data as T;
}

export { ApiError };

export const api = {
  // ── sessão de acesso ──
  me: () => request<{ authenticated: boolean }>('/auth/me'),
  login: (passcode: string) =>
    request<{ authenticated: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),
  logout: () => request<unknown>('/auth/logout', { method: 'POST' }),

  // ── cards ──
  summary: () => request<Summary>('/cards/summary'),
  listCards: (params: { q?: string; filter?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.filter) qs.set('filter', params.filter);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    return request<{ cards: Card[]; total: number }>(`/cards?${qs}`);
  },
  createCard: (body: Partial<Card>) =>
    request<Card>('/cards', { method: 'POST', body: JSON.stringify(body) }),
  bulkCreate: (text: string) =>
    request<{ created: number; errors: string[] }>('/cards/bulk', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  updateCard: (id: number, body: Partial<Card>) =>
    request<Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archiveCard: (id: number, archived: boolean) =>
    request<Card>(`/cards/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archived }),
    }),
  resetCard: (id: number) => request<Card>(`/cards/${id}/reset`, { method: 'POST' }),
  deleteCard: (id: number) => request<unknown>(`/cards/${id}`, { method: 'DELETE' }),

  // ── estudo ──
  available: () => request<{ due: number; total: number }>('/study/available'),
  openDeck: (count: number | null, includeFuture = false) =>
    request<{ session: StudySession; cards: Card[] }>('/study/open', {
      method: 'POST',
      body: JSON.stringify({ count, includeFuture }),
    }),
  review: (
    sessionId: number,
    body: { cardId: number; rating: Rating; elapsedMs: number; sessionElapsedMs: number },
  ) =>
    request<{ card: Card; session: StudySession; nextIn: string; leftDeck: boolean }>(
      `/study/sessions/${sessionId}/review`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  tickSession: (sessionId: number, durationMs: number) =>
    request<StudySession>(`/study/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ durationMs }),
    }),
  finishSession: (sessionId: number, status: 'completed' | 'aborted', durationMs: number) =>
    request<StudySession>(`/study/sessions/${sessionId}/finish`, {
      method: 'POST',
      body: JSON.stringify({ status, durationMs }),
    }),
  sessions: (limit = 20) => request<{ sessions: StudySession[] }>(`/study/sessions?limit=${limit}`),

  // ── estatísticas ──
  overview: (period: Period) => request<Overview>(`/stats/overview?period=${period}`),
  daily: (days = 30) => request<{ series: DayPoint[] }>(`/stats/daily?days=${days}`),
  words: (period: Period) => request<{ words: StudiedWord[] }>(`/stats/words?period=${period}`),
  forecast: () => request<{ forecast: { day: string; total: number }[] }>('/stats/forecast'),

  // ── áudio ──
  ttsStatus: () => request<{ google: boolean; voice: string }>('/tts/status'),
  tts: (text: string) =>
    request<{ audio: string; mime: string; cached: boolean } | undefined>('/tts', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};
