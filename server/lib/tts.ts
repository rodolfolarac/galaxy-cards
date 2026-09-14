import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { audioCache } from '../db/schema.js';

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** Vozes neurais en-US. Trocar em TTS_VOICE no .env. */
export const DEFAULT_VOICE = process.env.TTS_VOICE || 'en-US-Neural2-F';
export const DEFAULT_RATE = Number(process.env.TTS_RATE || '0.95');
/** Textos maiores que isso não são sintetizados (proteção de cota). */
const MAX_CHARS = 400;

export function hasGoogleTts(): boolean {
  return Boolean(process.env.GOOGLE_TTS_API_KEY);
}

function cacheKey(text: string, voice: string, rate: number): string {
  return crypto
    .createHash('sha256')
    .update(`${text}|${voice}|${rate}`)
    .digest('hex');
}

export interface TtsAudio {
  data: string; // base64
  mime: string;
  cached: boolean;
}

/**
 * Devolve o mp3 do texto. Bate no cache do banco primeiro; só chama o
 * Google quando é a primeira vez que aquele texto+voz aparece.
 * Retorna null quando não há chave configurada — aí o front usa a voz
 * nativa do navegador (Web Speech API).
 */
export async function synthesize(
  rawText: string,
  voice = DEFAULT_VOICE,
  rate = DEFAULT_RATE,
): Promise<TtsAudio | null> {
  const text = rawText.trim().slice(0, MAX_CHARS);
  if (!text) return null;

  const key = cacheKey(text, voice, rate);

  const [hit] = await db.select().from(audioCache).where(eq(audioCache.key, key)).limit(1);
  if (hit) {
    // Contador de acertos, só para aparecer nas estatísticas de economia.
    await db
      .update(audioCache)
      .set({ hits: sql`${audioCache.hits} + 1` })
      .where(eq(audioCache.key, key));
    return { data: hit.data, mime: hit.mime, cached: true };
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return null;

  const languageCode = voice.split('-').slice(0, 2).join('-') || 'en-US';

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: rate, pitch: 0 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google TTS ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error('Google TTS não devolveu áudio.');

  const data = json.audioContent;
  const bytes = Math.floor((data.length * 3) / 4);

  await db
    .insert(audioCache)
    .values({ key, text, voice, mime: 'audio/mpeg', data, bytes })
    .onConflictDoNothing();

  return { data, mime: 'audio/mpeg', cached: false };
}
