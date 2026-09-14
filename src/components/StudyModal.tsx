import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Flame, Timer, X } from 'lucide-react';
import { api } from '../lib/api';
import { speakCard, stopSpeech } from '../lib/audio';
import { formatClock, formatDuration } from '../lib/format';
import type { Card, Rating, StudySession } from '../lib/types';
import { FlashCard } from './FlashCard';
import { Button, cx } from './ui';

interface Props {
  session: StudySession;
  deck: Card[];
  onClose: (summary: StudySession) => void;
}

interface Answered {
  cardId: number;
  word: string;
  rating: Rating;
  nextIn: string;
}

export function StudyModal({ session, deck, onClose }: Props) {
  /** Fila viva: cartas marcadas como difíceis voltam para o fim dela. */
  const [queue, setQueue] = useState<Card[]>(deck);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [done, setDone] = useState<StudySession | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const startedAt = useRef(Date.now());
  const cardShownAt = useRef(Date.now());
  const cancelSpeech = useRef<(() => void) | null>(null);
  const current = queue[0];

  // ── cronômetro ──
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(id);
  }, [done]);

  // Salva o tempo no banco a cada 15 s, para uma queda de rede não perder o cronômetro.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      api.tickSession(session.id, Date.now() - startedAt.current).catch(() => {});
    }, 15_000);
    return () => clearInterval(id);
  }, [session.id, done]);

  // ── áudio automático a cada carta nova ──
  useEffect(() => {
    if (!current || done) return;
    cardShownAt.current = Date.now();
    setFlipped(false);
    setSpeaking(true);
    const cancel = speakCard(current.word, current.phrase);
    cancelSpeech.current = cancel;
    // Libera o indicador depois de um tempo proporcional ao texto falado.
    const ms = 1400 + current.word.length * 60 + (current.phrase ? 1000 + current.phrase.length * 55 : 0);
    const t = setTimeout(() => setSpeaking(false), ms);
    return () => {
      clearTimeout(t);
      cancel();
    };
  }, [current?.id, done]);

  useEffect(() => () => stopSpeech(), []);

  const replay = useCallback(() => {
    if (!current) return;
    cancelSpeech.current?.();
    setSpeaking(true);
    cancelSpeech.current = speakCard(current.word, current.phrase);
    setTimeout(() => setSpeaking(false), 2500);
  }, [current]);

  // ── responder ──
  const answer = useCallback(
    async (rating: Rating) => {
      if (!current || saving) return;
      setSaving(true);
      stopSpeech();
      setSpeaking(false);

      const cardElapsed = Date.now() - cardShownAt.current;
      const sessionElapsed = Date.now() - startedAt.current;

      try {
        const res = await api.review(session.id, {
          cardId: current.id,
          rating,
          elapsedMs: cardElapsed,
          sessionElapsedMs: sessionElapsed,
        });

        setAnswered((a) => [...a, { cardId: current.id, word: current.word, rating, nextIn: res.nextIn }]);

        setQueue((q) => {
          const rest = q.slice(1);
          // Difícil volta ao fim da fila — "sempre deve aparecer".
          return rating === 'hard' ? [...rest, { ...current, ...res.card }] : rest;
        });

        setToast(
          rating === 'easy'
            ? `“${current.word}” volta em ${res.nextIn}`
            : `“${current.word}” volta ainda neste baralho`,
        );
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Não foi possível salvar a resposta.');
      } finally {
        setSaving(false);
      }
    },
    [current, saving, session.id],
  );

  // Encerra sozinho quando a fila esvazia.
  useEffect(() => {
    if (done || queue.length > 0 || answered.length === 0) return;
    (async () => {
      try {
        const s = await api.finishSession(session.id, 'completed', Date.now() - startedAt.current);
        setDone(s);
      } catch {
        setDone({ ...session, status: 'completed', durationMs: Date.now() - startedAt.current });
      }
    })();
  }, [queue.length, answered.length, done, session]);

  async function quit() {
    stopSpeech();
    try {
      const s = await api.finishSession(session.id, 'aborted', Date.now() - startedAt.current);
      setDone(s);
    } catch {
      setDone({ ...session, status: 'aborted', durationMs: Date.now() - startedAt.current });
    }
  }

  // ── atalhos de teclado ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === 'Escape') { setConfirmQuit(true); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); return; }
      if (!flipped) return;
      if (e.key === '1' || e.key.toLowerCase() === 'd') answer('hard');
      if (e.key === '2' || e.key.toLowerCase() === 'f') answer('easy');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, answer, done]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const total = session.queuedCount;
  const remaining = queue.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Baralho em estudo"
      className="fixed inset-0 z-50 flex flex-col bg-void/88 backdrop-blur-md"
    >
      {done ? (
        <SessionSummary session={done} answered={answered} onClose={() => onClose(done)} />
      ) : (
        <>
          {/* ── topo: constelação de progresso + cronômetro ── */}
          <div className="border-b border-ridge px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-3xl items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-dust">
                <Timer aria-hidden className="size-4 text-cyan" />
                <span className="tabular-nums text-starlight">{formatClock(elapsed)}</span>
              </div>

              <Constellation total={total} answered={answered} remaining={remaining} />

              <button
                onClick={() => setConfirmQuit(true)}
                aria-label="Interromper o estudo"
                className="shrink-0 rounded-lg p-2 text-faint transition-colors hover:bg-white/6 hover:text-starlight"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
          </div>

          {/* ── carta ── */}
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
            <div className="w-full max-w-2xl">
              {current && (
                <FlashCard
                  key={`${current.id}-${answered.length}`}
                  card={current}
                  flipped={flipped}
                  onFlip={() => setFlipped((f) => !f)}
                  onReplay={replay}
                  speaking={speaking}
                />
              )}
            </div>
          </div>

          {/* ── respostas ── */}
          <div className="border-t border-ridge px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="mx-auto max-w-2xl">
              {flipped ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => answer('hard')}
                    disabled={saving}
                    className="group rounded-xl border border-amber/35 bg-amber/10 px-4 py-4 text-left transition-colors hover:bg-amber/18 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 font-medium text-amber">
                      <Flame aria-hidden className="size-4" /> Difícil
                    </span>
                    <span className="mt-0.5 block text-xs text-dust">volta neste baralho</span>
                  </button>

                  <button
                    onClick={() => answer('easy')}
                    disabled={saving}
                    className="group rounded-xl border border-cyan/35 bg-cyan/10 px-4 py-4 text-left transition-colors hover:bg-cyan/18 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 font-medium text-cyan">
                      <Check aria-hidden className="size-4" /> Fácil
                    </span>
                    <span className="mt-0.5 block text-xs text-dust">
                      {current ? nextEasyLabel(current) : 'sai do baralho'}
                    </span>
                  </button>
                </div>
              ) : (
                <Button size="lg" onClick={() => setFlipped(true)} className="w-full">
                  Ver tradução
                </Button>
              )}

              <p className="mt-3 hidden text-center text-xs text-faint sm:block">
                Espaço vira a carta · D marca difícil · F marca fácil · Esc interrompe
              </p>
            </div>
          </div>

          {toast && (
            <div
              role="status"
              className="pointer-events-none fixed inset-x-0 bottom-28 z-10 flex justify-center px-4"
            >
              <span className="glass-strong rounded-full px-4 py-2 text-sm text-starlight">
                {toast}
              </span>
            </div>
          )}

          {confirmQuit && (
            <ConfirmQuit
              studied={answered.length}
              elapsed={elapsed}
              onCancel={() => setConfirmQuit(false)}
              onConfirm={quit}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Rótulo do intervalo que a carta ganha se for marcada como fácil agora. */
function nextEasyLabel(card: Card): string {
  if (card.intervalDays < 7) return 'volta em 1 semana';
  const days = Math.round(card.intervalDays * Math.min(card.ease + 0.15, 3.2));
  if (days >= 365) return 'volta em 1 ano';
  if (days >= 30) return `volta em ${Math.round(days / 30)} ${days >= 60 ? 'meses' : 'mês'}`;
  return `volta em ${Math.round(days / 7)} semanas`;
}

/**
 * Progresso como constelação: cada carta é uma estrela. Cheia = respondida
 * fácil (saiu do baralho), contornada em âmbar = difícil (vai voltar),
 * apagada = ainda não vista.
 */
function Constellation({
  total,
  answered,
  remaining,
}: {
  total: number;
  answered: Answered[];
  remaining: number;
}) {
  const easy = new Set(answered.filter((a) => a.rating === 'easy').map((a) => a.cardId));
  const hard = answered.filter((a) => a.rating === 'hard').length;
  const dots = Math.min(total, 30);
  const scale = total / dots;

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: dots }, (_, i) => {
          const filled = Math.floor(easy.size / scale) > i;
          return (
            <span
              key={i}
              className={cx(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                filled ? 'bg-cyan' : 'bg-white/12',
              )}
            />
          );
        })}
      </div>
      <p className="text-xs text-faint">
        <span className="text-starlight">{easy.size}</span> de {total} memorizadas
        {remaining > 0 && ` · ${remaining} na fila`}
        {hard > 0 && ` · ${hard} ${hard === 1 ? 'repetição' : 'repetições'}`}
      </p>
    </div>
  );
}

function ConfirmQuit({
  studied,
  elapsed,
  onCancel,
  onConfirm,
}: {
  studied: number;
  elapsed: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-void/70 px-5">
      <div className="glass-strong w-full max-w-sm rounded-2xl p-6">
        <h2 className="font-reader text-2xl">Interromper o estudo?</h2>
        <p className="mt-2 text-sm leading-relaxed text-dust">
          As {studied} {studied === 1 ? 'carta respondida' : 'cartas respondidas'} já estão salvas.
          O tempo de {formatClock(elapsed)} entra no seu histórico e as cartas que sobraram
          continuam no baralho.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel}>
            Continuar estudando
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Interromper
          </Button>
        </div>
      </div>
    </div>
  );
}

function SessionSummary({
  session,
  answered,
  onClose,
}: {
  session: StudySession;
  answered: Answered[];
  onClose: () => void;
}) {
  const easy = answered.filter((a) => a.rating === 'easy');
  const hard = answered.filter((a) => a.rating === 'hard');
  const uniqueEasy = new Set(easy.map((a) => a.cardId)).size;
  const interrupted = session.status === 'aborted';

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-10">
      <div className="glass-strong w-full max-w-lg rounded-2xl p-7">
        <span aria-hidden className="mb-4 block text-center text-3xl text-nebula-soft">
          ✦
        </span>
        <h2 className="text-center font-reader text-3xl leading-tight">
          {interrupted ? 'Estudo interrompido' : 'Baralho concluído'}
        </h2>
        <p className="mt-2 text-center text-sm text-dust">
          {interrupted
            ? 'Tudo o que você respondeu foi salvo.'
            : 'Todas as cartas do baralho foram respondidas.'}
        </p>

        <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ridge bg-white/8 sm:grid-cols-4">
          <Stat label="Cartas" value={answered.length} />
          <Stat label="Memorizadas" value={uniqueEasy} tone="cyan" />
          <Stat label="Repetições" value={hard.length} tone="amber" />
          <Stat label="Tempo" value={formatDuration(session.durationMs)} />
        </dl>

        {easy.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm text-dust">Saíram do baralho</p>
            <ul className="flex flex-wrap gap-1.5">
              {[...new Map(easy.map((a) => [a.cardId, a])).values()].map((a) => (
                <li
                  key={a.cardId}
                  className="rounded-lg border border-cyan/25 bg-cyan/10 px-2.5 py-1 text-sm"
                >
                  <span className="font-reader">{a.word}</span>
                  <span className="ml-1.5 text-xs text-faint">{a.nextIn}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button size="lg" onClick={onClose} className="mt-7 w-full">
          Voltar ao baralho
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'cyan' | 'amber';
}) {
  return (
    <div className="bg-deep/70 px-3 py-4 text-center">
      <dd
        className={cx(
          'font-reader text-2xl tabular-nums',
          tone === 'cyan' && 'text-cyan',
          tone === 'amber' && 'text-amber',
        )}
      >
        {value}
      </dd>
      <dt className="mt-0.5 text-xs text-faint">{label}</dt>
    </div>
  );
}
