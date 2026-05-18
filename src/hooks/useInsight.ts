// Owns the data state for a (path, term) pair: cache lookup → API call →
// stale-request guard. Mirrors useBreakdown's shape so the consumers feel
// familiar.

import { useEffect, useRef, useState } from 'react';
import { fetchInsight, type Insight } from '../lib/insightApi';
import { insightCacheGet, insightCacheSet } from '../lib/insightCache';

export type UseInsightResult = {
  insight: Insight | null;
  loading: boolean;
  error: string | null;
};

export function useInsight(
  path: string[] | null,
  term: string | null,
): UseInsightResult {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!term || !path) {
      reqIdRef.current++;
      setInsight(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = insightCacheGet(path, term);
    if (cached) {
      reqIdRef.current++;
      setInsight(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++reqIdRef.current;
    setInsight(null);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const out = await fetchInsight({ path, term });
        if (reqIdRef.current !== reqId) return;
        insightCacheSet(path, term, out);
        setInsight(out);
      } catch (e) {
        if (reqIdRef.current !== reqId) return;
        setError(e instanceof Error ? e.message : 'Insight failed.');
      } finally {
        if (reqIdRef.current === reqId) setLoading(false);
      }
    })();
  }, [JSON.stringify(path), term]);

  return { insight, loading, error };
}
