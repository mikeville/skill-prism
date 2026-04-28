// 9x9 Harada grid — fractal topic browser.
// Three components in one file because they share coordinate math and styling and would
// only pass the same props through each other if split.

import { type CSSProperties } from 'react';
import type { CellStatus, DataState } from '../types';
import {
  blockCellToRC,
  blockToMainIdx,
  cellLabel,
  cellToMainIdx,
  classifyCell,
} from '../lib/gridMapping';
import styles from './HaradaGrid.module.css';

type Density = 'compact' | 'comfortable';

export type CellClickPayload =
  | { kind: 'anchor'; term: string; mainIdx: number }
  | { kind: 'leaf'; term: string; anchor: string; mainIdx: number; subIdx: number };

type HaradaGridProps = {
  data: DataState | null;
  onCellClick: (p: CellClickPayload) => void;
  showCoords: boolean;
  accent: string;
  density: Density;
  fontStack: string;
  lineWeight: number;
  zoomKey: number;
};

export function HaradaGrid({
  data,
  onCellClick,
  showCoords,
  accent,
  density,
  fontStack,
  lineWeight,
  zoomKey,
}: HaradaGridProps) {
  const cells = [];
  for (let b = 0; b < 9; b++) {
    for (let c = 0; c < 9; c++) {
      const [r, col] = blockCellToRC(b, c);
      const role = classifyCell(b, c);

      let content = '';
      let status: CellStatus = 'empty';

      if (role === 'topic') {
        content = data?.topic ?? '';
        status = 'topic';
      } else if (role === 'centerMain') {
        const mainIdx = cellToMainIdx(c);
        content = data?.mains[mainIdx] ?? '';
        status = content ? 'centerMain' : data?.loading ? 'loading' : 'empty';
      } else if (role === 'mirrorMain') {
        const mainIdx = blockToMainIdx(b);
        content = data?.mains[mainIdx] ?? '';
        status = content ? 'mirrorMain' : data?.loading ? 'loading' : 'empty';
      } else {
        // leaf
        const subIdx = cellToMainIdx(c);
        content = data?.subs[b]?.[subIdx] ?? '';
        status = content ? 'leaf' : data?.loading ? 'loading' : 'empty';
      }

      cells.push(
        <GridCell
          key={`${b}-${c}-${zoomKey}`}
          row={r}
          col={col}
          label={cellLabel(b, c)}
          content={content}
          status={status}
          showCoords={showCoords}
          accent={accent}
          density={density}
          fontStack={fontStack}
          onClick={() => {
            if (status === 'topic' || status === 'empty' || status === 'loading') return;
            if (role === 'centerMain' || role === 'mirrorMain') {
              const mainIdx = role === 'centerMain' ? cellToMainIdx(c) : blockToMainIdx(b);
              const term = data?.mains[mainIdx];
              if (term) onCellClick({ kind: 'anchor', term, mainIdx });
            } else if (role === 'leaf') {
              const mainIdx = blockToMainIdx(b);
              const subIdx = cellToMainIdx(c);
              const anchorTerm = data?.mains[mainIdx];
              const term = data?.subs[b]?.[subIdx];
              if (term && anchorTerm) {
                onCellClick({ kind: 'leaf', term, anchor: anchorTerm, mainIdx, subIdx });
              }
            }
          }}
        />,
      );
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {cells}
        <GridLines weight={lineWeight} />
      </div>
    </div>
  );
}

// ---------- GridCell ----------

type GridCellProps = {
  row: number;
  col: number;
  label: string;
  content: string;
  status: CellStatus;
  onClick: () => void;
  showCoords: boolean;
  accent: string;
  density: Density;
  fontStack: string;
};

function GridCell({
  row,
  col,
  label,
  content,
  status,
  onClick,
  showCoords,
  accent,
  density,
  fontStack,
}: GridCellProps) {
  const isTopic = status === 'topic';
  const isAnchor = status === 'centerMain' || status === 'mirrorMain';
  const isClickable = !isTopic && !!content && status !== 'loading';

  const padY = density === 'compact' ? 4 : 6;
  const padX = density === 'compact' ? 4 : 6;
  const fs = density === 'compact' ? 9.5 : 10.5;
  const topicFs = density === 'compact' ? 13 : 15;
  const anchorFs = density === 'compact' ? 10.5 : 11.5;

  const fontWeight = isTopic
    ? 800
    : status === 'centerMain'
      ? 600
      : status === 'mirrorMain'
        ? 500
        : status === 'leaf'
          ? 300
          : 400;

  const cellStyle: CSSProperties = {
    gridRow: row + 1,
    gridColumn: col + 1,
    padding: `${padY}px ${padX}px`,
    fontFamily: fontStack,
    fontSize: isTopic ? topicFs : isAnchor ? anchorFs : fs,
    fontWeight,
    color: isTopic ? accent : '#111',
    background: isTopic ? 'rgba(17,17,17,0.04)' : undefined,
  };

  const className = [
    styles.cell,
    isAnchor ? styles.cellAnchor : '',
    isClickable ? styles.cellClickable : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div onClick={isClickable ? onClick : undefined} className={className} style={cellStyle}>
      {showCoords && !isTopic && <div className={styles.coord}>{label}</div>}
      {status === 'loading' ? (
        <div className={styles.shimmer} />
      ) : (
        <div className={`${styles.content} ${content ? '' : styles.contentEmpty}`}>
          {content || (status === 'empty' ? '—' : '')}
        </div>
      )}
      {isTopic && (
        <div
          className={styles.topicBorder}
          style={{ borderColor: accent, borderWidth: '1.5px' }}
        />
      )}
    </div>
  );
}

// ---------- GridLines ----------

function GridLines({ weight }: { weight: number }) {
  const hair = `rgba(203,198,174,0.5)`;
  const w1 = Math.max(0.5, weight * 0.5);
  const w2 = Math.max(1, weight);

  return (
    <>
      <div
        className={styles.linesHair}
        style={{
          backgroundImage: `
            repeating-linear-gradient(to right, ${hair} 0 ${w1}px, transparent ${w1}px calc(100%/9)),
            repeating-linear-gradient(to bottom, ${hair} 0 ${w1}px, transparent ${w1}px calc(100%/9))
          `,
        }}
      />
      {[1, 2].map((i) => (
        <div
          key={`v${i}`}
          className={styles.linesHeavy}
          style={{
            left: `calc(${i} * 100% / 3)`,
            top: 0,
            bottom: 0,
            width: w2,
            transform: `translateX(-${w2 / 2}px)`,
          }}
        />
      ))}
      {[1, 2].map((i) => (
        <div
          key={`h${i}`}
          className={styles.linesHeavy}
          style={{
            top: `calc(${i} * 100% / 3)`,
            left: 0,
            right: 0,
            height: w2,
            transform: `translateY(-${w2 / 2}px)`,
          }}
        />
      ))}
      <div className={styles.linesFrame} style={{ borderWidth: w2 }} />
    </>
  );
}
