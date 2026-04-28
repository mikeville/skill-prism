import { useEffect, useState, type CSSProperties } from 'react';
import styles from './Breadcrumb.module.css';

type Props = {
  path: string[];
  onJump: (idx: number) => void;
  accent: string;
  fontStack: string;
  regenerating: boolean;
};

export function Breadcrumb({ path, onJump, accent, fontStack, regenerating }: Props) {
  return (
    <div
      className={styles.root}
      style={{ '--accent': accent, fontFamily: fontStack } as CSSProperties}
    >
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={i}>
            <button
              type="button"
              onClick={() => !isLast && onJump(i)}
              disabled={isLast}
              className={styles.crumbButton}
              style={{ fontFamily: fontStack }}
            >
              {node}
            </button>
            {!isLast && <span className={styles.separator}>/</span>}
          </span>
        );
      })}
      {regenerating && (
        <span className={styles.regen} style={{ color: accent }}>
          <Pulse /> regenerating
        </span>
      )}
    </div>
  );
}

function Pulse() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 4), 250);
    return () => clearInterval(id);
  }, []);
  return <span className={styles.pulse}>{'·'.repeat(t)}</span>;
}
