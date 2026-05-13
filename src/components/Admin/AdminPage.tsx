// Top-level admin route at /admin.
// Renders an auth gate, then a tabbed dashboard. Styled neutrally — this page
// is a tool for the operator, not part of the home app's design system.

import { useEffect, useState } from 'react';
import { AdminGate } from './AdminGate';
import { EventList } from './EventList';
import { DrillDownTree } from './DrillDownTree';
import { StatsView } from './StatsView';

type Tab = 'events' | 'sessions' | 'stats';

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('events');

  useEffect(() => {
    fetch('/api/admin-me')
      .then((r) => r.json())
      .then((d: { authenticated?: boolean }) => setAuthed(Boolean(d?.authenticated)))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-sm text-neutral-500 normal-case font-sans">
        Loading…
      </div>
    );
  }
  if (!authed) {
    return <AdminGate onAuthed={() => setAuthed(true)} />;
  }
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 normal-case font-sans">
      <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="flex items-center gap-6">
          <a href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← home
          </a>
          <h1 className="text-base font-medium">Skill Prism · Admin</h1>
        </div>
        <nav className="flex gap-1">
          {(['events', 'sessions', 'stats'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'px-3 py-1.5 text-sm rounded transition ' +
                (tab === t
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100')
              }
            >
              {t === 'events' ? 'Recent searches' : t === 'sessions' ? 'Drill-down trees' : 'Stats'}
            </button>
          ))}
        </nav>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'events' && <EventList />}
        {tab === 'sessions' && <DrillDownTree />}
        {tab === 'stats' && <StatsView />}
      </main>
    </div>
  );
}
