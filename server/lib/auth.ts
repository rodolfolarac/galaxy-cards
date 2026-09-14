import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const COOKIE = 'gc_session';
const MAX_AGE_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) {
    throw new Error(
      'SESSION_SECRET ausente ou curta demais. Gere uma com: npm run passcode',
    );
  }
  return s;
}

function passcodeHash(): string {
  const h = process.env.PASSCODE_HASH;
  if (!h) {
    throw new Error('PASSCODE_HASH não definida. Gere com: npm run passcode');
  }
  return h;
}

/** Comparação do código digitado com o hash bcrypt guardado no .env. */
export async function verifyPasscode(input: string): Promise<boolean> {
  if (typeof input !== 'string' || input.length === 0 || input.length > 200) return false;
  try {
    return await bcrypt.compare(input, passcodeHash());
  } catch {
    return false;
  }
}

export function issueSession(res: Response) {
  const token = jwt.sign({ sub: 'owner' }, secret(), { expiresIn: `${MAX_AGE_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function isAuthed(req: Request): boolean {
  const token = req.cookies?.[COOKIE];
  if (!token) return false;
  try {
    jwt.verify(token, secret());
    return true;
  } catch {
    return false;
  }
}

/** Middleware: tudo em /api (menos o login) exige sessão válida. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

/**
 * Freio simples contra força bruta no código de acesso, por IP.
 * Em memória — suficiente para um app pessoal de um usuário só.
 */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const rec = attempts.get(ip);

  if (rec && rec.until > now && rec.count >= MAX_ATTEMPTS) {
    const mins = Math.ceil((rec.until - now) / 60000);
    res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${mins} min.` });
    return;
  }
  if (!rec || rec.until <= now) attempts.set(ip, { count: 0, until: now + WINDOW_MS });
  next();
}

export function registerFailedAttempt(req: Request) {
  const ip = req.ip ?? 'unknown';
  const rec = attempts.get(ip);
  if (rec) rec.count += 1;
}

export function clearAttempts(req: Request) {
  attempts.delete(req.ip ?? 'unknown');
}
