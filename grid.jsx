// 9x9 grid — Harada-style nested 3x3 of 3x3 blocks
// Coordinates: blocks indexed 0..8 in reading order, each holds 9 cells indexed 0..8.
// Block 4 = center block (holds the topic at cell 4). For block b != 4, the cell at index 4
// is the sub-skill that anchors that block; the other 8 cells in that block are sub-sub-skills.
// Outer-cell-of-center-block (b=4, c!=4) === center-cell-of-outer-block (b!=4, c=4) — they MIRROR.

const BLOCK_LABELS = ['A','B','C','D','E','F','G','H','I'];
const CELL_LABELS = ['1','2','3','4','5','6','7','8','9'];

// Map (block, cell) -> (row, col) in the flat 9x9
function blockCellToRC(b, c) {
  const blockRow = Math.floor(b / 3);
  const blockCol = b % 3;
  const cellRow = Math.floor(c / 3);
  const cellCol = c % 3;
  return [blockRow * 3 + cellRow, blockCol * 3 + cellCol];
}

// The 8 outer cells of the center block, in their canonical order (matches outer block index when b<4 or b>4)
// The mirroring rule: for each non-center block b, the anchor cell of that block (c=4) is the same
// concept as the center-block cell at position (b's position relative to center).
// Block b -> which cell of center block (block 4) does it mirror to?
// block 0 (top-left) mirrors center-block cell 0; block 1 -> cell 1; ... block 8 -> cell 8.
// (since both grids are 3x3 with same indexing and block 4 is center)

function GridCell({ row, col, label, content, status, onClick, showCoords, accent, density, fontStack }) {
  // status: 'topic' | 'centerMain' | 'mirrorMain' | 'leaf' | 'empty' | 'loading'
  // - topic       (b=4, c=4)  — focal topic (heaviest)
  // - centerMain  (b=4, c≠4)  — 8 mains in the centermost block
  // - mirrorMain  (b≠4, c=4)  — 8 mirrored mains anchoring each outer block
  // - leaf        (b≠4, c≠4)  — 64 sub-sub-skills (lightest)
  const isTopic = status === 'topic';
  const isAnchor = status === 'centerMain' || status === 'mirrorMain';
  const isClickable = !isTopic && content && status !== 'loading';

  const padY = density === 'compact' ? 4 : 6;
  const padX = density === 'compact' ? 4 : 6;
  const fs = density === 'compact' ? 9.5 : 10.5;
  const topicFs = density === 'compact' ? 13 : 15;
  const anchorFs = density === 'compact' ? 10.5 : 11.5;

  const fontWeight =
    isTopic                 ? 800 :
    status === 'centerMain' ? 600 :
    status === 'mirrorMain' ? 500 :
    status === 'leaf'       ? 300 : 400;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`gcell ${isTopic ? 'topic' : ''} ${isAnchor ? 'anchor' : ''} ${isClickable ? 'clickable' : ''}`}
      style={{
        gridRow: row + 1,
        gridColumn: col + 1,
        padding: `${padY}px ${padX}px`,
        fontFamily: fontStack,
        fontSize: isTopic ? topicFs : isAnchor ? anchorFs : fs,
        fontWeight,
        color: isTopic ? accent : '#111',
        cursor: isClickable ? 'pointer' : 'default',
        position: 'relative',
        background: isTopic ? 'rgba(17,17,17,0.04)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        lineHeight: 1.25,
        letterSpacing: '-0.005em',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {showCoords && !isTopic && (
        <div style={{
          position: 'absolute',
          top: 2, right: 3,
          fontSize: 7,
          fontFamily: fontStack,
          color: isTopic ? accent : '#111',
          opacity: isTopic ? 0.5 : 0.28,
          letterSpacing: '0.08em',
          fontWeight: 400,
          pointerEvents: 'none',
        }}>{label}</div>
      )}
      {status === 'loading' ? (
        <div className="loadingCell" style={{
          width: '40%', height: 1, background: '#111', opacity: 0.18, marginTop: 4
        }} />
      ) : (
        <div style={{
          textWrap: 'pretty',
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          opacity: content ? 1 : 0.25,
          width: '100%',
        }}>
          {content || (status === 'empty' ? '—' : '')}
        </div>
      )}
      {isTopic && (
        <div style={{
          position: 'absolute', inset: 0, border: `1.5px solid ${accent}`, pointerEvents: 'none'
        }} />
      )}
    </div>
  );
}

function HaradaGrid({ data, onCellClick, showCoords, accent, density, fontStack, lineWeight, zoomKey }) {
  // data: { topic: string, mains: [8 strings, in block-order excluding 4],
  //         subs: { [blockIdx]: [8 strings in cell-order excluding 4] } }
  // blockIdx in 0..8 except 4 (center).
  // We'll render 81 cells.

  const cells = [];
  for (let b = 0; b < 9; b++) {
    for (let c = 0; c < 9; c++) {
      const [r, col] = blockCellToRC(b, c);
      const label = `${BLOCK_LABELS[b]}${CELL_LABELS[c]}`;
      let content = '';
      let status = 'empty';

      if (b === 4 && c === 4) {
        content = data?.topic || '';
        status = 'topic';
      } else if (b === 4 && c !== 4) {
        // Cell in center block — one of the 8 main sub-skills
        const mainIdx = c < 4 ? c : c - 1; // 0..7
        content = data?.mains?.[mainIdx] || '';
        status = content ? 'centerMain' : (data?.loading ? 'loading' : 'empty');
      } else if (b !== 4 && c === 4) {
        // Center of outer block — mirrors the corresponding main (block index in outer ring)
        const mainIdx = b < 4 ? b : b - 1; // 0..7
        content = data?.mains?.[mainIdx] || '';
        status = content ? 'mirrorMain' : (data?.loading ? 'loading' : 'empty');
      } else {
        // outer block, outer cell — sub-sub-skill (leaf)
        const subIdx = c < 4 ? c : c - 1;
        content = data?.subs?.[b]?.[subIdx] || '';
        status = content ? 'leaf' : (data?.loading ? 'loading' : 'empty');
      }

      cells.push(
        <GridCell
          key={`${b}-${c}-${zoomKey}`}
          row={r}
          col={col}
          label={label}
          content={content}
          status={status}
          showCoords={showCoords}
          accent={accent}
          density={density}
          fontStack={fontStack}
          onClick={() => {
            if (status === 'topic') return;
            // Build click target: which sub-skill node was tapped?
            // Anchor (b==4,c!=4 or b!=4,c==4) -> drilling into that main sub-skill
            // Leaf (b!=4,c!=4) -> drilling into that sub-sub-skill (path includes its anchor)
            if ((b === 4 && c !== 4) || (b !== 4 && c === 4)) {
              const mainIdx = (b === 4) ? (c < 4 ? c : c - 1) : (b < 4 ? b : b - 1);
              const term = data?.mains?.[mainIdx];
              if (term) onCellClick({ kind: 'anchor', term, mainIdx });
            } else if (b !== 4 && c !== 4) {
              const mainIdx = b < 4 ? b : b - 1;
              const subIdx = c < 4 ? c : c - 1;
              const anchor = data?.mains?.[mainIdx];
              const term = data?.subs?.[b]?.[subIdx];
              if (term) onCellClick({ kind: 'leaf', term, anchor, mainIdx, subIdx });
            }
          }}
        />
      );
    }
  }

  // Build the 9x9 with two layers of borders: outer block dividers heavier
  return (
    <div className="haradaWrap" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        className="harada"
        style={{
          display: 'grid',
          gridTemplateRows: 'repeat(9, 1fr)',
          gridTemplateColumns: 'repeat(9, 1fr)',
          width: '100%',
          height: '100%',
          background: '#F5F2EB',
          position: 'relative',
          // hairline borders applied via cell + overlay
        }}
      >
        {cells}
        {/* Cell hairlines — drawn via inset gradient overlay */}
        <GridLines weight={lineWeight} />
      </div>
    </div>
  );
}

function GridLines({ weight }) {
  // Hairline at every cell boundary (1/9 increments), and a heavier line at every 1/3 boundary.
  // Oat tints sourced from Figma variable `grey1` (#cbc6ae).
  const hair = `rgba(203,198,174,0.5)`;
  const heavy = `#cbc6ae`;
  const w1 = Math.max(0.5, weight * 0.5);
  const w2 = Math.max(1, weight);

  // Use repeating-linear-gradient for hairlines, plus 4 absolute lines (2 vert, 2 horiz) for block dividers.
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          repeating-linear-gradient(to right, ${hair} 0 ${w1}px, transparent ${w1}px calc(100%/9)),
          repeating-linear-gradient(to bottom, ${hair} 0 ${w1}px, transparent ${w1}px calc(100%/9))
        `,
      }} />
      {/* Block dividers - thirds */}
      {[1, 2].map(i => (
        <div key={`v${i}`} style={{
          position: 'absolute',
          left: `calc(${i} * 100% / 3)`, top: 0, bottom: 0,
          width: w2, transform: `translateX(-${w2/2}px)`,
          background: heavy, pointerEvents: 'none',
        }} />
      ))}
      {[1, 2].map(i => (
        <div key={`h${i}`} style={{
          position: 'absolute',
          top: `calc(${i} * 100% / 3)`, left: 0, right: 0,
          height: w2, transform: `translateY(-${w2/2}px)`,
          background: heavy, pointerEvents: 'none',
        }} />
      ))}
      {/* Outer frame */}
      <div style={{
        position: 'absolute', inset: 0,
        border: `${w2}px solid ${heavy}`,
        pointerEvents: 'none',
      }} />
    </>
  );
}

window.HaradaGrid = HaradaGrid;
window.BLOCK_LABELS = BLOCK_LABELS;
window.CELL_LABELS = CELL_LABELS;
