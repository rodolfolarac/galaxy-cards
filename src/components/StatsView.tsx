import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { dateTime, formatDuration, shortDate } from '../lib/format';
import type { DayPoint, Overview, Period, StudiedWord, StudySession } from '../lib/types';
import { Panel, cx } from './ui';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Hoje' },
  { id: 'week', label: '7 dias' },
  { id: 'month', label: '30 dias' },
];

export function StatsView() {
  const [period, setPeriod] = useState<Period>('day');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [words, setWords] = useState<StudiedWord[]>([]);
  const [series, setSeries] = useState<DayPoint[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    api.overview(period).then(setOverview).catch(() => {});
    api.words(period).then((r) => setWords(r.words)).catch(() => {});
  }, [period]);

  useEffect(() => {
    api.daily(30).then((r) => setSeries(r.series)).catch(() => {});
    api.sessions(12).then((r) => setSessions(r.sessions)).catch(() => {});
  }, []);

  const r = overview?.reviews;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-reader text-2xl leading-tight">Seu progresso</h2>
        <div className="flex gap-1 rounded-xl border border-ridge bg-black/25 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={cx(
                'rounded-lg px-3.5 py-1.5 text-sm transition-colors',
                period === p.id ? 'bg-nebula/85 text-white' : 'text-dust hover:text-starlight',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ridge bg-white/8 lg:grid-cols-5">
        <Tile label="Cartas estudadas" value={r?.studied ?? 0} />
        <Tile label="Palavras distintas" value={r?.distinctCards ?? 0} />
        <Tile label="Saíram do baralho" value={r?.leftDeck ?? 0} tone="cyan" />
        <Tile label="Repetiram" value={r?.hard ?? 0} tone="amber" />
        <Tile
          label="Tempo estudando"
          value={formatDuration(overview?.sessions.durationMs ?? 0)}
          className="col-span-2 lg:col-span-1"
        />
      </dl>

      {overview && (
        <p className="text-sm text-dust">
          {overview.sessions.total === 0
            ? 'Nenhum baralho aberto neste período.'
            : `${overview.sessions.total} ${overview.sessions.total === 1 ? 'baralho aberto' : 'baralhos abertos'} · ${overview.sessions.completed} ${overview.sessions.completed === 1 ? 'concluído' : 'concluídos'}${overview.sessions.aborted > 0 ? ` · ${overview.sessions.aborted} interrompido${overview.sessions.aborted === 1 ? '' : 's'}` : ''}`}
          {overview.cardsCreated > 0 &&
            ` · ${overview.cardsCreated} ${overview.cardsCreated === 1 ? 'palavra nova cadastrada' : 'palavras novas cadastradas'}`}
        </p>
      )}

      <DailyChart series={series} />

      {/* ── Palavras estudadas no período ── */}
      <Panel className="p-6 sm:p-8">
        <h3 className="font-reader text-xl leading-tight">
          Palavras estudadas {period === 'day' ? 'hoje' : period === 'week' ? 'nos 7 dias' : 'nos 30 dias'}
        </h3>

        {words.length === 0 ? (
          <p className="py-8 text-center text-sm text-faint">
            Nada por aqui ainda. Abra um baralho para começar.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/8">
            {words.map((w) => (
              <li key={w.cardId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                <span className="font-reader text-lg">{w.word}</span>
                <span className="min-w-0 flex-1 text-sm text-dust">{w.translation}</span>
                <span className="flex items-center gap-2 text-xs tabular-nums">
                  {w.easy > 0 && <span className="text-cyan">{w.easy} fácil</span>}
                  {w.hard > 0 && <span className="text-amber">{w.hard} difícil</span>}
                  <span className="text-faint">{dateTime(w.lastAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── Sessões ── */}
      {sessions.length > 0 && (
        <Panel className="p-6 sm:p-8">
          <h3 className="font-reader text-xl leading-tight">Últimos baralhos</h3>
          <ul className="mt-4 divide-y divide-white/8">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-sm">
                <span className="text-dust">{dateTime(s.startedAt)}</span>
                <span className="min-w-0 flex-1 text-starlight">
                  {s.studiedCount} de {s.queuedCount} {s.queuedCount === 1 ? 'carta' : 'cartas'}
                  <span className="text-faint">
                    {' '}
                    · {s.leftDeckCount} {s.leftDeckCount === 1 ? 'saiu' : 'saíram'} do baralho
                  </span>
                </span>
                <span className="tabular-nums text-dust">{formatDuration(s.durationMs)}</span>
                <span
                  className={cx(
                    'rounded-md px-2 py-0.5 text-xs',
                    s.status === 'completed' && 'bg-cyan/15 text-cyan',
                    s.status === 'aborted' && 'bg-amber/15 text-amber',
                    s.status === 'active' && 'bg-nebula/25 text-nebula-soft',
                  )}
                >
                  {s.status === 'completed' ? 'concluído' : s.status === 'aborted' ? 'interrompido' : 'em aberto'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string | number;
  tone?: 'cyan' | 'amber';
  className?: string;
}) {
  return (
    <div className={cx('bg-deep/60 px-4 py-5', className)}>
      <dd
        className={cx(
          'font-reader text-3xl leading-none tabular-nums',
          tone === 'cyan' && 'text-cyan',
          tone === 'amber' && 'text-amber',
        )}
      >
        {value}
      </dd>
      <dt className="mt-1.5 text-xs leading-snug text-faint">{label}</dt>
    </div>
  );
}

/** Barras empilhadas: fácil em ciano embaixo, difícil em âmbar em cima. */
function DailyChart({ series }: { series: DayPoint[] }) {
  const max = Math.max(...series.map((d) => d.studied), 1);
  if (!series.length) return null;

  return (
    <Panel className="p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-reader text-xl leading-tight">Ritmo dos últimos 30 dias</h3>
        <p className="flex items-center gap-3 text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan" aria-hidden /> fácil
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber" aria-hidden /> difícil
          </span>
        </p>
      </div>

      <div className="mt-5 flex h-36 items-end gap-[3px]">
        {series.map((d) => {
          const h = (d.studied / max) * 100;
          const easyPart = d.studied ? (d.easy / d.studied) * h : 0;
          return (
            <div
              key={d.day}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${shortDate(d.day)}: ${d.studied} ${d.studied === 1 ? 'carta' : 'cartas'}`}
            >
              {d.studied > 0 ? (
                <>
                  <span className="w-full rounded-t-sm bg-amber/75" style={{ height: `${h - easyPart}%` }} />
                  <span className="w-full bg-cyan/75" style={{ height: `${easyPart}%` }} />
                </>
              ) : (
                <span className="h-[2px] w-full rounded-full bg-white/10" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{shortDate(series[0].day)}</span>
        <span>{shortDate(series[series.length - 1].day)}</span>
      </div>
    </Panel>
  );
}
