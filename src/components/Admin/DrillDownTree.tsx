import { useEffect, useState } from 'react';

type SessionEvent = {
  id: string;
  ts: string;
  path: string[];
  cache_hit: boolean;
  depth: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};
type Session = {
  session_id: string;
  country: string | null;
  cost_usd: number;
  events: SessionEvent[];
};

type TreeNode = {
  label: string;
  fullPath: string[];
  event: SessionEvent | null;
  children: TreeNode[];
};

const PATH_SEP = '␞';

function buildTree(events: SessionEvent[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();
  // Insert in chronological order so the tree shows breadth-first by visit order.
  const sorted = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  for (const e of sorted) {
    let levelList = root;
    let levelMap = map;
    for (let i = 0; i < e.path.length; i++) {
      const sub = e.path.slice(0, i + 1);
      const key = sub.join(PATH_SEP);
      let node = levelMap.get(key);
      if (!node) {
        node = { label: e.path[i], fullPath: sub, event: null, children: [] };
        levelMap.set(key, node);
        levelList.push(node);
      }
      if (i === e.path.length - 1 && !node.event) node.event = e;
      levelList = node.children;
      // For deeper-level lookups we still want a single map (paths are unique).
      levelMap = map;
    }
  }
  return root;
}

export function DrillDownTree() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin-sessions?limit=30')
      .then((r) => r.json())
      .then((d: { sessions?: Session[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setSessions(d.sessions ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Note>Loading…</Note>;
  if (error) return <Note tone="error">{error}</Note>;
  if (sessions.length === 0) return <Note>No sessions yet.</Note>;

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const tree = buildTree(s.events);
        const start = s.events[0]?.ts;
        const end = s.events[s.events.length - 1]?.ts;
        const duration =
          start && end ? humanDuration(new Date(end).getTime() - new Date(start).getTime()) : '';
        return (
          <section
            key={s.session_id}
            className="border border-neutral-200 rounded-lg p-4 bg-white"
          >
            <header className="flex items-baseline justify-between mb-3 gap-3">
              <div>
                <div className="text-sm font-mono">{s.session_id.slice(0, 8)}…</div>
                <div className="text-xs text-neutral-500">
                  {s.events.length} search{s.events.length === 1 ? '' : 'es'} ·{' '}
                  {s.country || 'Unknown'}
                  {duration && ' · ' + duration}
                  {' · '}
                  {new Date(start).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="text-xs text-neutral-500 tabular-nums">
                ${s.cost_usd.toFixed(5)}
              </div>
            </header>
            <ul className="text-sm">
              {tree.map((node) => (
                <TreeRow key={node.fullPath.join('/')} node={node} depth={0} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const url = '/#/' + node.fullPath.map(encodeURIComponent).join('/');
  return (
    <>
      <li
        className="flex items-baseline gap-2 py-0.5"
        style={{ paddingLeft: depth * 20 + 'px' }}
      >
        <span className="text-neutral-300">▸</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-900 hover:underline"
        >
          {node.label}
        </a>
        {node.event && (
          <span className="text-xs text-neutral-400 tabular-nums">
            {node.event.cache_hit
              ? '· cached'
              : node.event.cost_usd > 0
                ? `· $${node.event.cost_usd.toFixed(5)}`
                : ''}
          </span>
        )}
      </li>
      {node.children.map((c) => (
        <TreeRow key={c.fullPath.join('/')} node={c} depth={depth + 1} />
      ))}
    </>
  );
}

function humanDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
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
