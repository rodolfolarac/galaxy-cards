import { api } from './api';

/**
 * Fala um texto em inglês. Tenta o Google TTS pelo servidor (com cache
 * em banco); se não houver chave configurada ou a rede falhar, usa a voz
 * nativa do navegador. Nunca lança erro — áudio não pode travar o estudo.
 */

let googleAvailable: boolean | null = null;
const objectUrls = new Map<string, string>();
let current: HTMLAudioElement | null = null;
/** Token de geração: cancela falas pendentes quando a carta muda. */
let generation = 0;

export function stopSpeech() {
  generation += 1;
  if (current) {
    current.pause();
    current.currentTime = 0;
    current = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

async function ensureStatus() {
  if (googleAvailable !== null) return googleAvailable;
  try {
    const s = await api.ttsStatus();
    googleAvailable = s.google;
  } catch {
    googleAvailable = false;
  }
  return googleAvailable;
}

function base64ToUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Vozes en-US do navegador, preferindo as de melhor qualidade. */
function pickBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  if (!en.length) return null;
  const preferred = ['Google US English', 'Samantha', 'Microsoft Aria', 'Microsoft Jenny'];
  for (const name of preferred) {
    const hit = en.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  return en.find((v) => v.lang === 'en-US') ?? en[0];
}

function speakWithBrowser(text: string, token: number): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.92;
    const v = pickBrowserVoice();
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    if (token !== generation) return resolve();
    window.speechSynthesis.speak(u);
  });
}

function playUrl(url: string, token: number): Promise<void> {
  return new Promise((resolve) => {
    if (token !== generation) return resolve();
    const audio = new Audio(url);
    current = audio;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}

/** Fala o texto e resolve quando o áudio termina. */
export async function speak(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  const token = ++generation;

  const cached = objectUrls.get(clean);
  if (cached) return playUrl(cached, token);

  if (await ensureStatus()) {
    try {
      const res = await api.tts(clean);
      if (token !== generation) return;
      if (res?.audio) {
        const url = base64ToUrl(res.audio, res.mime);
        objectUrls.set(clean, url);
        return playUrl(url, token);
      }
    } catch {
      // cai para o navegador
    }
  }

  if (token !== generation) return;
  return speakWithBrowser(clean, token);
}

/**
 * Sequência de uma carta: fala a palavra e, 1 segundo depois de terminar,
 * fala a frase de exemplo. Devolve uma função de cancelamento.
 */
export function speakCard(word: string, phrase?: string | null): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  (async () => {
    await speak(word);
    if (cancelled || !phrase?.trim()) return;
    await new Promise<void>((r) => {
      timer = setTimeout(r, 1000);
    });
    if (cancelled) return;
    await speak(phrase);
  })();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    stopSpeech();
  };
}

/**
 * Alguns navegadores só exigem um gesto do usuário para liberar o áudio.
 * Chamado uma vez no login/abertura do baralho.
 */
export function primeAudio() {
  try {
    window.speechSynthesis?.getVoices();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch {
    /* ignora */
  }
}
