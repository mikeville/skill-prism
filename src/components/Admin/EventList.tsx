import { useEffect, useState } from 'react';

type Breakdown = {
  id: string;
  model: string;
  result: { mains: string[]; subs: string[][] };
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
};

type Event = {
  id: string;
  ts: string;
  session_id: string;
  path: string[];
  cache_hit: boolean;
  depth: number;
  country: string | null;
  city: string | null;
  ip: string | null;
  user_agent: string | null;
  breakdown: Breakdown | null;
};

export function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Event | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin-events?limit=100')
      .then((r) => r.json())
      .then((d: { events?: Event[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setEvents(d.events ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Note>Loading…</Note>;
  if (error) return <Note tone="error">{error}</Note>;
  if (events.length === 0) return <Note>No searches yet. Once visitors run queries, they'll appear here.</Note>;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-neutral-500 border-b border-neutral-200 bg-neutral-50">
          <tr>
            <th className="py-2 px-3">Time</th>
            <th className="py-2 px-3">Path</th>
            <th className="py-2 px-3">Location</th>
            <th className="py-2 px-3">Cache</th>
            <th className="py-2 px-3 text-right">Cost</th>
            <th className="py-2 px-3 w-0"></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={e.id}
              onClick={() => setSelected(e)}
              className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 cursor-pointer"
            >
              <td className="py-2 px-3 text-neutral-500 whitespace-nowrap">{fmtTime(e.ts)}</td>
              <td className="py-2 px-3">
                {e.path.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-neutral-400"> › </span>}
                    <span className={i === e.path.length - 1 ? 'font-medium' : 'text-neutral-600'}>{p}</span>
                  </span>
                ))}
              </td>
              <td className="py-2 px-3 text-neutral-500">
                {[e.city, e.country].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="py-2 px-3">
                <span
                  className={
                    'text-xs px-2 py-0.5 rounded ' +
                    (e.cache_hit ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-800')
                  }
                >
                  {e.cache_hit ? 'hit' : 'miss'}
                </span>
              </td>
              <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                {e.cache_hit ? (
                  <span className="text-neutral-400">—</span>
                ) : e.breakdown ? (
                  `$${Number(e.breakdown.cost_usd).toFixed(5)}`
                ) : (
                  '—'
                )}
              </td>
              <td className="py-2 px-3 text-neutral-400">→</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString();
  if (d.toDateString() === today) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function EventDrawer({ event, onClose }: { event: Event; onClose: () => void }) {
  const gridUrl = '/#/' + event.path.map(encodeURIComponent).join('/');
  const [view, setView] = useState<'meta' | 'json'>('meta');
  return (
    <div className="fixed inset-0 z-20 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] max-w-[92vw] bg-white border-l border-neutral-200 p-6 overflow-y-auto shadow-xl"
      >
        <button
          onClick={onClose}
          className="text-sm text-neutral-500 hover:text-neutral-900 mb-4"
        >
          close
        </button>
        <h2 className="text-lg font-medium">{event.path[event.path.length - 1]}</h2>
        <div className="text-sm text-neutral-500 mb-5">{event.path.join(' › ')}</div>

        <div className="flex gap-1 mb-4">
          <ToggleBtn active={view === 'meta'} onClick={() => setView('meta')}>
            Raw log
          </ToggleBtn>
          <ToggleBtn active={view === 'json'} onClick={() => setView('json')}>
            Result JSON
          </ToggleBtn>
        </div>

        {view === 'meta' && (
          <div className="space-y-0 text-sm border border-neutral-200 rounded">
            <Row label="Time" value={new Date(event.ts).toLocaleString()} />
            <Row label="Session" value={event.session_id.slice(0, 8) + '…'} mono />
            <Row label="Cache" value={event.cache_hit ? 'hit' : 'miss'} />
            <Row label="Depth" value={String(event.depth)} />
            <Row label="Location" value={[event.city, event.country].filter(Boolean).join(', ') || '—'} />
            <Row label="IP" value={event.ip ?? '—'} mono />
            <Row label="User-Agent" value={event.user_agent ?? '—'} small />
            {event.breakdown && (
              <>
                <Row label="Model" value={event.breakdown.model} mono />
                <Row label="Input tokens" value={event.breakdown.input_tokens.toLocaleString()} />
                <Row label="Output tokens" value={event.breakdown.output_tokens.toLocaleString()} />
                <Row label="Cost" value={`$${Number(event.breakdown.cost_usd).toFixed(6)}`} />
              </>
            )}
          </div>
        )}

        {view === 'json' && (
          <pre className="text-xs bg-neutral-50 border border-neutral-200 p-3 rounded overflow-auto max-h-[60vh]">
            {event.breakdown
              ? JSON.stringify(event.breakdown.result, null, 2)
              : '(no breakdown — likely an early failure)'}
          </pre>
        )}

        <div className="mt-5">
          <a
            href={gridUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm bg-neutral-900 text-white px-4 py-2 rounded hover:bg-neutral-700 transition"
          >
            Open in grid ↗
          </a>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 px-3 py-1.5 border-b border-neutral-100 last:border-b-0">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <span
        className={
          'text-neutral-900 text-right truncate ' +
          (mono ? 'font-mono text-xs ' : '') +
          (small ? 'text-xs ' : '')
        }
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'text-xs px-3 py-1 rounded border transition ' +
        (active
          ? 'bg-neutral-900 border-neutral-900 text-white'
          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50')
      }
    >
      {children}
    </button>
  );
}

function Note({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'error';
}) {
  return (
    <div
      className={
        'text-sm p-4 border rounded-lg ' +
        (tone === 'error'
          ? 'text-red-700 bg-red-50 border-red-200'
          : 'text-neutral-500 bg-white border-neutral-200')
      }
    >
      {children}
    </div>
  );
}
