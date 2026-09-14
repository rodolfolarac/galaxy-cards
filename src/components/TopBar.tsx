import { Layers, LogOut, Sparkles, TrendingUp } from 'lucide-react';
import { cx } from './ui';

export type Tab = 'deck' | 'cards' | 'progress';

const TABS: { id: Tab; label: string; Icon: typeof Sparkles }[] = [
  { id: 'deck', label: 'Baralho', Icon: Sparkles },
  { id: 'cards', label: 'Palavras', Icon: Layers },
  { id: 'progress', label: 'Progresso', Icon: TrendingUp },
];

export function TopBar({
  tab,
  onTab,
  onLogout,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-ridge bg-void/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <span aria-hidden className="text-lg text-nebula-soft">
            ✦
          </span>
          <span className="font-reader text-xl tracking-tight">Galaxy Cards</span>
        </div>

        <nav className="ml-auto flex items-center gap-1 rounded-xl border border-ridge bg-black/25 p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={cx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                tab === id
                  ? 'bg-nebula/85 text-white'
                  : 'text-dust hover:bg-white/6 hover:text-starlight',
              )}
            >
              <Icon aria-hidden className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={onLogout}
          title="Sair"
          aria-label="Sair"
          className="shrink-0 rounded-lg p-2 text-faint transition-colors hover:bg-white/6 hover:text-starlight"
        >
          <LogOut aria-hidden className="size-4" />
        </button>
      </div>
    </header>
  );
}
