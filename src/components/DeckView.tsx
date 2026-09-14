import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { api } from '../lib/api';
import { primeAudio } from '../lib/audio';
import { shortDate } from '../lib/format';
import type { Card, StudySession, Summary } from '../lib/types';
import { Button, Notice, Panel, Spinner, cx } from './ui';

const SIZES = [10, 20, 30, 40, 50] as const;

export function DeckView({
  summary,
  onStart,
  onGoToCards,
}: {
  summary: Summary | null;
  onStart: (session: StudySession, deck: Card[]) => void;
  onGoToCards: () => void;
}) {
  const [size, setSize] = useState<number | null>(10);
  const [available, setAvailable] = useState<{ due: number; total: number } | null>(null);
  const [forecast, setForecast] = useState<{ day: string; total: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.available().then(setAvailable).catch(() => {});
    api.forecast().then((r) => setForecast(r.forecast)).catch(() => {});
  }, [summary]);

  /** `count` explícito evita ler um `size` desatualizado do render anterior. */
  async function open(includeFuture = false, count: number | null = size) {
    setBusy(true);
    setError(null);
    primeAudio();
    try {
      const { session, cards } = await api.openDeck(count, includeFuture);
      onStart(session, cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o baralho.');
    } finally {
      setBusy(false);
    }
  }

  const due = available?.due ?? 0;
  const registered = summary?.registered ?? 0;
  const mastered = summary?.mastered ?? 0;
  const deckSize = size === null ? due : Math.min(size, due);
  const short = size !== null && due < size && due > 0;

  if (registered === 0) {
    return (
      <Panel className="mx-auto max-w-lg p-9 text-center">
        <span aria-hidden className="mb-4 block text-3xl text-nebula-soft">
          ✦
        </span>
        <h2 className="font-reader text-3xl leading-tight">Seu céu ainda está vazio</h2>
        <p className="mx-auto mt-3 max-w-[36ch] text-sm leading-relaxed text-dust">
          Cadastre a primeira palavra em inglês com a tradução — e, se quiser, uma frase de
          exemplo. O baralho se monta sozinho a partir daí.
        </p>
        <Button size="lg" onClick={onGoToCards} className="mt-6">
          Cadastrar a primeira palavra
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Órbita: a razão entre memorizadas e cadastradas, como um arco ── */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-7 p-6 sm:flex-row sm:items-center sm:gap-9 sm:p-8">
          <MasteryArc mastered={mastered} registered={registered} />

          <div className="min-w-0 flex-1 space-y-4">
            <Counter
              value={mastered}
              label={`${mastered === 1 ? 'palavra aprendida' : 'palavras aprendidas'} e memorizadas`}
              tone="cyan"
            />
            <Counter
              value={registered}
              label={registered === 1 ? 'palavra cadastrada' : 'palavras cadastradas'}
            />
            {due > 0 && (
              <p className="text-sm text-dust">
                <span className="text-amber">{due}</span>{' '}
                {due === 1 ? 'espera por você agora' : 'esperam por você agora'}
              </p>
            )}
          </div>
        </div>
      </Panel>

      {/* ── Lançador ── */}
      <Panel className="p-6 sm:p-8">
        <h2 className="font-reader text-2xl leading-tight">Quantas cartas nesta rodada?</h2>
        <p className="mt-1.5 text-sm text-dust">
          A ordem é sempre sorteada. Cartas marcadas como fáceis só voltam depois do prazo.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {SIZES.map((n) => (
            <SizeChip key={n} active={size === n} disabled={due === 0} onClick={() => setSize(n)}>
              {n}
            </SizeChip>
          ))}
          <SizeChip active={size === null} disabled={due === 0} onClick={() => setSize(null)}>
            Todas{due > 0 && ` · ${due}`}
          </SizeChip>
        </div>

        {error && (
          <div className="mt-5">
            <Notice>{error}</Notice>
          </div>
        )}

        {due === 0 ? (
          <div className="mt-6 space-y-3">
            <Notice tone="info">
              Nenhuma carta vencida. Você já revisou tudo que estava agendado para hoje.
            </Notice>
            <Button variant="outline" onClick={() => open(true, 10)} disabled={busy}>
              Estudar 10 mesmo assim
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => open(false)}
              disabled={busy}
              className="breathe mt-6 w-full sm:w-auto"
            >
              {busy ? <Spinner /> : <Play aria-hidden className="size-4" />}
              {busy ? 'Abrindo…' : `Abrir baralho com ${deckSize} ${deckSize === 1 ? 'carta' : 'cartas'}`}
            </Button>
            {short && (
              <p className="mt-3 text-xs text-faint">
                Só {due} {due === 1 ? 'carta está vencida' : 'cartas estão vencidas'} agora — o
                baralho vai abrir com {due}.{' '}
                <button
                  onClick={() => open(true)}
                  className="text-nebula-soft underline underline-offset-2 hover:text-starlight"
                >
                  Completar com as próximas agendadas
                </button>
              </p>
            )}
          </>
        )}
      </Panel>

      {forecast.length > 0 && <Forecast rows={forecast} />}
    </div>
  );
}

function Counter({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: 'cyan';
}) {
  return (
    <p className="flex items-baseline gap-2.5">
      <span
        className={cx(
          'font-reader text-[2.75rem] leading-none tabular-nums',
          tone === 'cyan' ? 'text-cyan' : 'text-starlight',
        )}
      >
        {value}
      </span>
      <span className="min-w-0 text-sm leading-snug text-dust">{label}</span>
    </p>
  );
}

/** Arco de progresso: memorizadas sobre cadastradas. */
function MasteryArc({ mastered, registered }: { mastered: number; registered: number }) {
  const pct = registered ? mastered / registered : 0;
  const r = 62;
  const c = 2 * Math.PI * r;
  // Arco de 270° (deixa uma abertura embaixo, como uma órbita incompleta).
  const span = c * 0.75;

  return (
    <div className="relative mx-auto size-40 shrink-0 sm:mx-0">
      <svg viewBox="0 0 160 160" className="size-full -rotate-[225deg]">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="#ffffff14"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${span} ${c}`}
        />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="url(#arc)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${span * pct} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)' }}
        />
        <defs>
          <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3de0e8" />
            <stop offset="55%" stopColor="#a678ff" />
            <stop offset="100%" stopColor="#e8489f" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-reader text-3xl tabular-nums">{Math.round(pct * 100)}%</span>
        <span className="text-xs text-faint">do acervo</span>
      </div>
    </div>
  );
}

function SizeChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'rounded-xl border px-4 py-2.5 text-sm tabular-nums transition-colors disabled:opacity-40',
        active
          ? 'border-nebula-soft bg-nebula/25 text-starlight'
          : 'border-ridge text-dust hover:border-nebula-soft/60 hover:text-starlight',
      )}
    >
      {children}
    </button>
  );
}

/** Quantas cartas voltam em cada um dos próximos dias. */
function Forecast({ rows }: { rows: { day: string; total: number }[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Panel className="p-6 sm:p-8">
      <h2 className="font-reader text-xl leading-tight">Próximas revisões</h2>
      <p className="mt-1 text-sm text-dust">Quando cada carta volta ao baralho.</p>

      <ul className="mt-5 flex items-end gap-1.5 overflow-x-auto pb-1">
        {rows.map((r) => {
          const past = r.day <= today;
          return (
            <li key={r.day} className="flex min-w-11 flex-1 flex-col items-center gap-1.5">
              <span className="text-xs tabular-nums text-dust">{r.total}</span>
              <span
                className={cx('w-full rounded-t-md', past ? 'bg-amber/70' : 'bg-nebula/70')}
                style={{ height: `${Math.max(6, (r.total / max) * 76)}px` }}
              />
              <span className="text-[0.68rem] whitespace-nowrap text-faint">
                {past ? 'hoje' : shortDate(r.day)}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
