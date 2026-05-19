// Self-contained insight surface: takes a (path, term) target, runs the hook,
// renders content. App composes this into two different layouts:
//   • Desktop: as a fixed-width right-side aside that scrolls independently.
//   • Mobile:  as an inline section below the grid that scrolls with the page.

import { useState } from 'react';
import { useInsight } from '../../hooks/useInsight';
import { InsightContent } from './InsightContent';

type Props = {
  term: string;
  // The full breadcrumb context that led to the term. Used only as prompt
  // context (the cache key is term-only).
  path: string[];
  onClose?: () => void;
  compact?: boolean;
};

export function InsightPane({ term, path, onClose, compact }: Props) {
  const [retryKey, setRetryKey] = useState(0);
  const { insight, loading, error } = useInsight(path, term);

  return (
    <InsightContent
      key={`${term}::${retryKey}`}
      term={term}
      insight={insight}
      loading={loading}
      error={error}
      onRetry={() => setRetryKey((k) => k + 1)}
      onClose={onClose}
      compact={compact}
    />
  );
}
