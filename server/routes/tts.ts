import { Router } from 'express';
import { z } from 'zod';
import { hasGoogleTts, synthesize, DEFAULT_VOICE } from '../lib/tts.js';

export const ttsRouter = Router();

ttsRouter.get('/status', (_req, res) => {
  res.json({ google: hasGoogleTts(), voice: DEFAULT_VOICE });
});

const input = z.object({
  text: z.string().trim().min(1).max(400),
  voice: z.string().trim().max(60).optional(),
});

/**
 * Devolve { audio, mime } em base64. Se não houver chave do Google
 * configurada, responde 204 e o front cai na voz do navegador.
 */
ttsRouter.post('/', async (req, res) => {
  const parsed = input.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Texto inválido.' }); return; }

  try {
    const audio = await synthesize(parsed.data.text, parsed.data.voice);
    if (!audio) { res.status(204).end(); return; }
    res.json({ audio: audio.data, mime: audio.mime, cached: audio.cached });
  } catch (err) {
    console.error('[tts]', err);
    // Falha na API não pode travar o estudo: o front usa o navegador.
    res.status(204).end();
  }
});
