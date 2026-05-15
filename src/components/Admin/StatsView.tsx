import { useEffect, useState } from 'react';

type Range = 'day' | 'week' | 'month' | 'all';

type Stats = {
  range: Range;
  totals: {
    events: number;
    sessions: number;
    cache_hits: number;
    cache_misses: number;
    cache_hit_rate: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
  daily: { day: string; searches: number; cost: number }[];
  countries: { country: string; count: number }[];
  top_queries: { query: string; count: number }[];
};

const RANGE_LABEL: Record<Range, string> = {
  day: 'Today',
  week: '7d',
  month: '30d',
  all: 'All time',
};

export function StatsView() {
  const [range, setRange] = useState<Range>('week');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('api/admin-stats?range=' + range)
      .then((r) => r.json())
      .then((d: Stats & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setStats(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div>
      <div className="flex gap-1 mb-6 flex-wrap">
        {(['day', 'week', 'month', 'all'] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={
              'px-3 py-1.5 text-sm rounded transition border ' +
              (range === r
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'text-neutral-600 bg-white hover:bg-neutral-50 border-neutral-200')
            }
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {!error && loading && <div className="text-sm text-neutral-500">Loading…</div>}
      {!error && !loading && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Searches" value={stats.totals.events.toLocaleString()} />
            <Stat label="Sessions" value={stats.totals.sessions.toLocaleString()} />
            <Stat
              label="Cache hit rate"
              value={(stats.totals.cache_hit_rate * 100).toFixed(0) + '%'}
              sub={`${stats.totals.cache_hits} of ${stats.totals.events}`}
            />
            <Stat
              label="Spend"
              value={'$' + stats.totals.cost_usd.toFixed(4)}
              sub={`${(stats.totals.input_tokens / 1000).toFixed(1)}k in / ${(stats.totals.output_tokens / 1000).toFixed(1)}k out`}
            />
          </div>

          {stats.daily.length > 0 && (
            <div className="mt-8 grid lg:grid-cols-2 gap-6">
              <Sparkline
                title="Searches per day"
                points={stats.daily.map((d) => ({ x: d.day, y: d.searches }))}
              />
              <Sparkline
                title="Spend per day"
                points={stats.daily.map((d) => ({ x: d.day, y: d.cost }))}
                fmt={(v) => '$' + v.toFixed(4)}
              />
            </div>
          )}

          <div className="mt-8 grid lg:grid-cols-2 gap-6">
            <Section title="Top queries">
              <List
                rows={stats.top_queries.map((q) => ({ key: q.query, label: q.query, value: q.count.toLocaleString() }))}
              />
            </Section>
            <Section title="Countries">
              <List
                rows={stats.countries.slice(0, 8).map((c) => ({
                  key: c.country,
                  label: c.country,
                  value: c.count.toLocaleString(),
                }))}
              />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-2xl font-medium mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{title}</h3>
      <div className="border border-neutral-200 rounded-lg p-4 bg-white">{children}</div>
    </div>
  );
}

function List({ rows }: { rows: { key: string; label: string; value: string }[] }) {
  if (rows.length === 0) return <div className="text-sm text-neutral-400">—</div>;
  return (
    <ul className="text-sm">
      {rows.map((r) => (
        <li
          key={r.key}
          className="flex justify-between gap-3 py-1.5 border-b border-neutral-100 last:border-b-0"
        >
          <span className="truncate">{r.label}</span>
          <span className="text-neutral-500 tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Sparkline({
  title,
  points,
  fmt,
}: {
  title: string;
  points: { x: string; y: number }[];
  fmt?: (v: number) => string;
}) {
  const f = fmt ?? ((v: number) => v.toLocaleString());
  if (points.length === 0) {
    return (
      <Section title={title}>
        <div className="text-neutral-400 text-sm">—</div>
      </Section>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.y));
  const w = 600;
  const h = 80;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const polyPts = points
    .map((p, i) => `${i * stepX},${h - (p.y / max) * h}`)
    .join(' ');
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{title}</h3>
      <div className="border border-neutral-200 rounded-lg p-4 bg-white">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 text-neutral-700">
          <polyline points={polyPts} fill="none" stroke="currentColor" strokeWidth="1.5" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={i * stepX}
              cy={h - (p.y / max) * h}
              r="2"
              fill="currentColor"
            />
          ))}
        </svg>
        <div className="flex justify-between text-xs text-neutral-400 mt-1">
          <span>{points[0]?.x}</span>
          <span>{points[points.length - 1]?.x}</span>
        </div>
        <div className="text-xs text-neutral-500 mt-1">peak: {f(max)}</div>
      </div>
    </div>
  );
}
