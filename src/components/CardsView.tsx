import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { speak } from '../lib/audio';
import { relativeDue } from '../lib/format';
import type { Card } from '../lib/types';
import { Button, Field, Input, Notice, Panel, Spinner, Textarea, cx } from './ui';

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'due', label: 'No baralho' },
  { id: 'learning', label: 'Aprendendo' },
  { id: 'mastered', label: 'Memorizadas' },
  { id: 'permanent', label: 'Permanentes' },
  { id: 'archived', label: 'Arquivadas' },
] as const;

const empty = { word: '', translation: '', phrase: '', phraseTranslation: '', notes: '' };

export function CardsView({ onChanged }: { onChanged: () => void }) {
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Card | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listCards({ q, filter, limit: 200 });
      setCards(res.cards);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as palavras.');
    } finally {
      setLoading(false);
    }
  }, [q, filter]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  function startEdit(card: Card) {
    setEditing(card);
    setForm({
      word: card.word,
      translation: card.translation,
      phrase: card.phrase ?? '',
      phraseTranslation: card.phraseTranslation ?? '',
      notes: card.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.updateCard(editing.id, form);
        setFlash(`“${form.word}” atualizada.`);
      } else {
        await api.createCard(form);
        setFlash(`“${form.word}” entrou no baralho.`);
      }
      setForm(empty);
      setEditing(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function importBulk() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.bulkCreate(bulk);
      setFlash(`${res.created} ${res.created === 1 ? 'palavra importada' : 'palavras importadas'}.`);
      if (res.errors.length) setError(res.errors.slice(0, 3).join(' '));
      setBulk('');
      setBulkOpen(false);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível importar.');
    } finally {
      setSaving(false);
    }
  }

  async function act(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      setFlash(message);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A ação falhou.');
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Formulário ── */}
      <Panel className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-reader text-2xl leading-tight">
            {editing ? `Editar “${editing.word}”` : 'Nova palavra ou frase'}
          </h2>
          <div className="flex items-center gap-2">
            {editing && (
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                <X aria-hidden className="size-4" /> Cancelar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setBulkOpen((v) => !v)}>
              {bulkOpen ? 'Fechar importação' : 'Importar várias'}
            </Button>
          </div>
        </div>

        {bulkOpen ? (
          <div className="mt-5 space-y-4">
            <Field
              label="Cole um card por linha"
              hint="Formato: palavra ; tradução ; frase em inglês ; tradução da frase — os dois últimos são opcionais."
            >
              <Textarea
                rows={7}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={
                  'reliable ; confiável ; She is a reliable friend. ; Ela é uma amiga confiável.\nthorough ; minucioso\nIt is not a big deal. ; Não é grande coisa.\nI am running late. ; Estou atrasado.'
                }
                className="font-mono text-sm"
              />
            </Field>
            {error && <Notice>{error}</Notice>}
            <Button onClick={importBulk} disabled={saving || !bulk.trim()}>
              {saving ? <Spinner /> : <Plus aria-hidden className="size-4" />} Importar
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Palavra ou frase em inglês" hint="Pode ser uma palavra solta ou uma frase inteira.">
                <Input
                  value={form.word}
                  onChange={(e) => setForm({ ...form, word: e.target.value })}
                  placeholder="reliable  —  ou  —  It is not a big deal."
                  required
                  spellCheck={false}
                />
              </Field>
              <Field label="Tradução">
                <Input
                  value={form.translation}
                  onChange={(e) => setForm({ ...form, translation: e.target.value })}
                  placeholder="confiável  —  ou  —  Não é grande coisa."
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Frase de exemplo em inglês"
                hint="Opcional. Aparece abaixo e é falada 1 s depois. Deixe vazio em cards que já são uma frase."
              >
                <Input
                  value={form.phrase}
                  onChange={(e) => setForm({ ...form, phrase: e.target.value })}
                  placeholder="She is a reliable friend."
                  spellCheck={false}
                />
              </Field>
              <Field label="Tradução da frase">
                <Input
                  value={form.phraseTranslation}
                  onChange={(e) => setForm({ ...form, phraseTranslation: e.target.value })}
                  placeholder="Ela é uma amiga confiável."
                />
              </Field>
            </div>

            <Field label="Observação" hint="Opcional. Aparece no verso da carta.">
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Sinônimo de dependable."
              />
            </Field>

            {error && <Notice>{error}</Notice>}

            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Spinner /> : <Plus aria-hidden className="size-4" />}
              {editing ? 'Salvar alterações' : 'Adicionar ao baralho'}
            </Button>
          </form>
        )}
      </Panel>

      {/* ── Lista ── */}
      <Panel className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar palavra, tradução ou frase"
              className="pl-10"
              aria-label="Buscar"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cx(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  filter === f.id
                    ? 'border-nebula-soft bg-nebula/25 text-starlight'
                    : 'border-ridge text-dust hover:text-starlight',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm text-faint">
          {loading ? 'Carregando…' : `${total} ${total === 1 ? 'palavra' : 'palavras'}`}
        </p>

        {flash && (
          <div className="mt-4">
            <Notice tone="info">{flash}</Notice>
          </div>
        )}

        <ul className="mt-4 divide-y divide-white/8">
          {cards.map((card) => (
            <li key={card.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="font-reader text-xl text-starlight">{card.word}</span>
                  <button
                    onClick={() => speak(card.phrase ? `${card.word}. ${card.phrase}` : card.word)}
                    aria-label={`Ouvir ${card.word}`}
                    className="rounded p-1 text-faint transition-colors hover:text-cyan"
                  >
                    <Volume2 aria-hidden className="size-3.5" />
                  </button>
                  <span className="text-dust">{card.translation}</span>
                </div>

                {card.phrase && (
                  <p className="mt-1 font-reader text-sm italic text-nebula-soft/80">
                    {card.phrase}
                    {card.phraseTranslation && (
                      <span className="not-italic text-faint"> — {card.phraseTranslation}</span>
                    )}
                  </p>
                )}

                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                  {card.archived ? (
                    <span className="text-rose-300/80">arquivada</span>
                  ) : card.retired ? (
                    <span className="text-nebula-soft">permanente · 60 dias alcançados</span>
                  ) : (
                    <span className={card.mastered ? 'text-cyan' : undefined}>
                      {card.mastered ? 'memorizada' : 'aprendendo'}
                    </span>
                  )}
                  {!card.archived && !card.retired && <span>· {relativeDue(card.dueAt)}</span>}
                  {!card.archived && !card.retired && card.streak > 0 && (
                    <span>· {card.streak} de 4 acertos seguidos</span>
                  )}
                  {card.reviewCount > 0 && (
                    <span>
                      · {card.easyCount} fácil / {card.hardCount} difícil
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-0.5">
                <IconAction label="Editar" onClick={() => startEdit(card)}>
                  <Pencil aria-hidden className="size-4" />
                </IconAction>
                <IconAction
                  label={
                    card.retired
                      ? 'Tirar de permanente e devolver ao baralho'
                      : 'Devolver ao baralho de hoje'
                  }
                  highlight={card.retired}
                  onClick={() => act(() => api.resetCard(card.id), `“${card.word}” voltou ao baralho.`)}
                >
                  <RotateCcw aria-hidden className="size-4" />
                </IconAction>
                <IconAction
                  label={card.archived ? 'Desarquivar' : 'Arquivar'}
                  onClick={() =>
                    act(
                      () => api.archiveCard(card.id, !card.archived),
                      card.archived ? `“${card.word}” voltou ao acervo.` : `“${card.word}” arquivada.`,
                    )
                  }
                >
                  {card.archived ? (
                    <ArchiveRestore aria-hidden className="size-4" />
                  ) : (
                    <Archive aria-hidden className="size-4" />
                  )}
                </IconAction>
                <IconAction
                  label="Excluir"
                  danger
                  onClick={() => {
                    if (!confirm(`Excluir “${card.word}” e todo o histórico dela?`)) return;
                    act(() => api.deleteCard(card.id), `“${card.word}” excluída.`);
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                </IconAction>
              </div>
            </li>
          ))}
        </ul>

        {!loading && cards.length === 0 && (
          <p className="py-10 text-center text-sm text-faint">
            {q ? `Nenhuma palavra encontrada para “${q}”.` : 'Nenhuma palavra neste filtro.'}
          </p>
        )}
      </Panel>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  highlight,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Destaca a ação quando ela é a saída natural daquele estado. */
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        'rounded-lg p-2 transition-colors',
        danger
          ? 'text-faint hover:bg-rose-500/15 hover:text-rose-300'
          : highlight
            ? 'text-nebula-soft hover:bg-nebula/20 hover:text-starlight'
            : 'text-faint hover:bg-white/8 hover:text-starlight',
      )}
    >
      {children}
    </button>
  );
}
