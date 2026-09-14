import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import type { Card, StudySession, Summary } from './lib/types';
import { CardsView } from './components/CardsView';
import { DeckView } from './components/DeckView';
import { LoginScreen } from './components/LoginScreen';
import { Starfield } from './components/Starfield';
import { StatsView } from './components/StatsView';
import { StudyModal } from './components/StudyModal';
import { TopBar, type Tab } from './components/TopBar';
import { Spinner } from './components/ui';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('deck');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [study, setStudy] = useState<{ session: StudySession; deck: Card[] } | null>(null);

  const refreshSummary = useCallback(() => {
    api.summary().then(setSummary).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .me()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) refreshSummary();
  }, [authed, refreshSummary]);

  async function logout() {
    await api.logout().catch(() => {});
    setAuthed(false);
    setSummary(null);
    setStudy(null);
  }

  if (authed === null) {
    return (
      <>
        <Starfield />
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      </>
    );
  }

  if (!authed) {
    return (
      <>
        <Starfield />
        <LoginScreen onEnter={() => setAuthed(true)} />
      </>
    );
  }

  return (
    <>
      <Starfield />
      <TopBar tab={tab} onTab={setTab} onLogout={logout} />

      <main className="mx-auto max-w-6xl px-4 py-7 pb-20 sm:px-6">
        {tab === 'deck' && (
          <DeckView
            summary={summary}
            onStart={(session, deck) => setStudy({ session, deck })}
            onGoToCards={() => setTab('cards')}
          />
        )}
        {tab === 'cards' && <CardsView onChanged={refreshSummary} />}
        {tab === 'progress' && <StatsView />}
      </main>

      {study && (
        <StudyModal
          session={study.session}
          deck={study.deck}
          onClose={() => {
            setStudy(null);
            refreshSummary();
          }}
        />
      )}
    </>
  );
}
