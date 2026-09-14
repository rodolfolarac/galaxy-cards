import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './lib/auth.js';
import { authRouter } from './routes/auth.js';
import { cardsRouter } from './routes/cards.js';
import { studyRouter } from './routes/study.js';
import { statsRouter } from './routes/stats.js';
import { ttsRouter } from './routes/tts.js';

export function createApp() {
  const app = express();

  // Atrás do proxy da Vercel/cPanel, para req.ip e cookies secure funcionarem.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);

  // Tudo daqui para baixo exige o código de acesso.
  app.use('/api/cards', requireAuth, cardsRouter);
  app.use('/api/study', requireAuth, studyRouter);
  app.use('/api/stats', requireAuth, statsRouter);
  app.use('/api/tts', requireAuth, ttsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  // Em produção o mesmo processo serve o front buildado.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../../dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    // Fallback da SPA: qualquer rota não-API devolve o index.
    app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Handler de erro: nunca vaza stack trace para o cliente.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[erro]', err);
      res.status(500).json({ error: 'Erro interno. Veja os logs do servidor.' });
    },
  );

  return app;
}
