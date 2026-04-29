// Owns the data state for a given path: cache lookup → API call → stale-request guard.
// App passes a `path: string[]` and gets back the current data + regenerating/error flags.

import { useEffect, useRef, useState } from 'react';
import { generateBreakdown } from '../lib/api';
import { cacheGet, cacheSet } from '../lib/cache';
import type { DataState } from '../types';

export type UseBreakdownResult = {
  data: DataState | null;
  regenerating: boolean;
  error: string | null;
};

export function useBreakdown(path: string[]): UseBreakdownResult {
  const [data, setData] = useState<DataState | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (path.length === 0) {
      // Empty state — no fetch, clear data.
      reqIdRef.current++;
      setData(null);
      setRegenerating(false);
      setError(null);
      return;
    }

    const topic = path[path.length - 1];
    const cached = cacheGet(path);
    if (cached) {
      reqIdRef.current++; // invalidate any in-flight request
      setData({ topic, mains: cached.mains, subs: cached.subs, loading: false });
      setRegenerating(false);
      setError(null);
      return;
    }

    // Cache miss — fetch.
    const reqId = ++reqIdRef.current;
    setData({ topic, mains: [], subs: [], loading: true });
    setRegenerating(true);
    setError(null);

    (async () => {
      try {
        const out = await generateBreakdown({ topic, path });
        if (reqIdRef.current !== reqId) return; // stale
        cacheSet(path, out);
        setData({ topic, mains: out.mains, subs: out.subs, loading: false });
      } catch (e) {
        if (reqIdRef.current !== reqId) return;
        setError(e instanceof Error ? e.message : 'Generation failed.');
        setData({ topic, mains: [], subs: [], loading: false });
      } finally {
        if (reqIdRef.current === reqId) setRegenerating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(path)]);
  // ^ Stringified key — path is a new array each render but the cache is keyed by content,
  //   so we want the effect to re-run only when the *content* of the path changes.

  return { data, regenerating, error };
}
