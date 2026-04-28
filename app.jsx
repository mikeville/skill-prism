const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ---------- Tweaks defaults ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ffd700",
  "fontFamily": "Inter",
  "lineWeight": 1,
  "density": "comfortable",
  "showCoords": false,
  "background": "#FFFFFF"
}/*EDITMODE-END*/;

const FONT_STACKS = {
  "Inter": "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  "Manrope": "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
  "System": "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const EXAMPLES = [
  "linear algebra",
  "the russian revolution",
  "espresso extraction",
];

// ---------- Persistent breakdown cache (localStorage) ----------
// One key per path, prefixed for easy inspection in devtools.
const CACHE_PREFIX = 'ohtani:cache:';
function cacheGet(pathKey) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + pathKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function cacheSet(pathKey, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + pathKey, JSON.stringify(value));
  } catch {} // quota exceeded or storage disabled — fail silent
}

// ---------- Empty state ----------
function EmptyState({ onSubmit, accent, fontStack }) {
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (v) => {
    const t = (v ?? val).trim();
    if (!t) return;
    onSubmit(t);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 0,
      fontFamily: fontStack,
      color: '#111',
    }}>
      <div style={{
        position: 'absolute',
        top: 24, left: 28,
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        opacity: 0.55,
        whiteSpace: 'nowrap',
      }}>
        Ohtani <span style={{ opacity: 0.5 }}>· fractal topic browser</span>
      </div>
      <div style={{
        position: 'absolute',
        top: 24, right: 28,
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        opacity: 0.55,
      }}>
        v0.1
      </div>

      <div style={{
        fontSize: 13,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        opacity: 0.6,
        marginBottom: 22,
      }}>
        breakdown · 9 × 9
      </div>

      <div style={{
        width: 'min(560px, 78vw)',
        borderTop: '1px solid #111',
        borderBottom: '1px solid #111',
        padding: '14px 0',
      }}>
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="what do you want to learn?"
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: fontStack,
            fontSize: 22,
            color: '#111',
            letterSpacing: '-0.01em',
          }}
        />
      </div>

      <div style={{
        display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 'min(560px, 78vw)',
        fontSize: 12,
      }}>
        <span style={{ opacity: 0.5, marginRight: 4 }}>try:</span>
        {EXAMPLES.map((ex, i) => (
          <React.Fragment key={ex}>
            <button
              onClick={() => submit(ex)}
              style={{
                background: 'none', border: 'none',
                fontFamily: fontStack, fontSize: 12,
                color: '#111', opacity: 0.75,
                textDecoration: 'underline',
                textDecorationColor: 'rgba(17,17,17,0.25)',
                textUnderlineOffset: 3,
                cursor: 'pointer', padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = accent; e.currentTarget.style.opacity = 1; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#111'; e.currentTarget.style.opacity = 0.75; }}
            >{ex}</button>
            {i < EXAMPLES.length - 1 && <span style={{ opacity: 0.3 }}>·</span>}
          </React.Fragment>
        ))}
      </div>

      <div style={{
        position: 'absolute',
        bottom: 24, left: 28,
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        opacity: 0.4,
        maxWidth: 360,
        lineHeight: 1.6,
      }}>
        Each cell decomposes further. Tap to descend.<br/>
        The path you take shapes what you see next.
      </div>
    </div>
  );
}

// ---------- Breadcrumb ----------
function Breadcrumb({ path, onJump, accent, fontStack, regenerating }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      fontFamily: fontStack, fontSize: 12,
      flexWrap: 'wrap',
      lineHeight: 1.4,
    }}>
      {path.map((node, i) => {
        const isLast = i === path.length - 1;
        return (
          <React.Fragment key={i}>
            <button
              onClick={() => !isLast && onJump(i)}
              disabled={isLast}
              style={{
                background: 'none', border: 'none',
                fontFamily: fontStack, fontSize: 12,
                color: isLast ? accent : '#111',
                fontWeight: isLast ? 600 : 400,
                opacity: isLast ? 1 : 0.7,
                cursor: isLast ? 'default' : 'pointer',
                padding: '2px 0',
                letterSpacing: '-0.005em',
              }}
              onMouseEnter={(e) => { if (!isLast) { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = accent; } }}
              onMouseLeave={(e) => { if (!isLast) { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.color = '#111'; } }}
            >{node}</button>
            {!isLast && <span style={{ opacity: 0.35, padding: '0 10px' }}>/</span>}
          </React.Fragment>
        );
      })}
      {regenerating && (
        <span style={{
          marginLeft: 16,
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent,
          opacity: 0.85,
        }}>
          <Pulse /> regenerating
        </span>
      )}
    </div>
  );
}

function Pulse() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => (x + 1) % 4), 250);
    return () => clearInterval(id);
  }, []);
  return <span style={{ display: 'inline-block', width: 22, textAlign: 'left' }}>{'·'.repeat(t)}</span>;
}

// ---------- Main App ----------
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const fontStack = FONT_STACKS[tweaks.fontFamily] || FONT_STACKS["IBM Plex Mono"];

  // path: array of strings from root to current focus
  const [path, setPath] = useState([]);
  const [data, setData] = useState(null); // { topic, mains, subs, loading }
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [zoomKey, setZoomKey] = useState(0);
  const [zoomTrigger, setZoomTrigger] = useState(null); // for animation
  const reqIdRef = useRef(0);

  const generateFor = useCallback(async (newPath) => {
    const reqId = ++reqIdRef.current;
    const topic = newPath[newPath.length - 1];
    setData({ topic, mains: [], subs: {}, loading: true });
    setRegenerating(true);
    setError(null);
    try {
      const out = await generateBreakdown({ topic, path: newPath });
      if (reqIdRef.current !== reqId) return; // stale
      cacheSet(JSON.stringify(newPath), { mains: out.mains, subs: out.subs });
      setData({ topic, mains: out.mains, subs: out.subs, loading: false });
    } catch (e) {
      if (reqIdRef.current !== reqId) return;
      setError(e.message || 'Generation failed.');
      setData({ topic, mains: [], subs: {}, loading: false });
    } finally {
      if (reqIdRef.current === reqId) setRegenerating(false);
    }
  }, []);

  const navigateTo = useCallback((newPath) => {
    setPath(newPath);
    setZoomKey(k => k + 1);
    setError(null);

    const cached = cacheGet(JSON.stringify(newPath));
    if (cached) {
      reqIdRef.current++; // invalidate any in-flight request
      const topic = newPath[newPath.length - 1];
      setData({ topic, mains: cached.mains, subs: cached.subs, loading: false });
      setRegenerating(false);
      return;
    }
    generateFor(newPath);
  }, [generateFor]);

  const handleSubmit = (topic) => navigateTo([topic]);

  const handleCellClick = ({ kind, term, anchor }) => {
    const newPath = kind === 'leaf' ? [...path, anchor, term] : [...path, term];
    setZoomTrigger({ key: Date.now() });
    navigateTo(newPath);
  };

  const handleJump = (idx) => {
    if (idx >= path.length - 1) return;
    navigateTo(path.slice(0, idx + 1));
  };

  const handleReset = () => {
    setPath([]);
    setData(null);
    setError(null);
  };

  const inEmpty = path.length === 0;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: tweaks.background,
      color: '#111',
      fontFamily: fontStack,
      overflow: 'hidden',
    }}>
      {inEmpty ? (
        <EmptyState onSubmit={handleSubmit} accent={tweaks.accent} fontStack={fontStack} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          padding: '20px 28px 24px',
          gap: 14,
        }}>
          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 24,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
              <button
                onClick={handleReset}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: fontStack,
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  opacity: 0.55,
                  alignSelf: 'flex-start',
                  color: '#111',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = tweaks.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.55; e.currentTarget.style.color = '#111'; }}
              >
                ◂ Ohtani
              </button>
              <Breadcrumb path={path} onJump={handleJump} accent={tweaks.accent} fontStack={fontStack} regenerating={regenerating} />
            </div>
          </div>

          {/* Grid */}
          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', alignItems: 'stretch', justifyContent: 'center',
            minHeight: 0,
          }}>
            <div
              key={zoomKey}
              className="gridShell"
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                width: 'min(100%, 100%)',
                maxWidth: '100%',
                maxHeight: '100%',
                margin: '0 auto',
                animation: 'fadeZoom 280ms ease-out',
              }}
            >
              <HaradaGrid
                data={data}
                onCellClick={handleCellClick}
                showCoords={tweaks.showCoords}
                accent={tweaks.accent}
                density={tweaks.density}
                fontStack={fontStack}
                lineWeight={tweaks.lineWeight}
                zoomKey={zoomKey}
              />
              {error && (
                <div style={{
                  position: 'absolute', bottom: 8, left: 8,
                  background: '#F5F2EB',
                  border: `1px solid ${tweaks.accent}`,
                  padding: '6px 10px',
                  fontSize: 11,
                  color: tweaks.accent,
                  letterSpacing: '-0.005em',
                }}>
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-start', alignItems: 'center',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.4,
          }}>
            <span>tap any cell to descend</span>
          </div>
        </div>
      )}

      <Tweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function Tweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent" />
      <TweakColor label="Color" value={tweaks.accent} onChange={(v) => setTweak('accent', v)} />
      <TweakSection label="Type" />
      <TweakSelect
        label="Family"
        value={tweaks.fontFamily}
        options={["Inter", "Manrope", "System"]}
        onChange={(v) => setTweak('fontFamily', v)}
      />
      <TweakSection label="Grid" />
      <TweakRadio
        label="Density"
        value={tweaks.density}
        options={["compact", "comfortable"]}
        onChange={(v) => setTweak('density', v)}
      />
      <TweakSlider
        label="Line weight"
        value={tweaks.lineWeight}
        min={0.5} max={2.5} step={0.25}
        onChange={(v) => setTweak('lineWeight', v)}
      />
      <TweakToggle
        label="Show coordinates"
        value={tweaks.showCoords}
        onChange={(v) => setTweak('showCoords', v)}
      />
      <TweakSection label="Background" />
      <TweakColor label="Paper" value={tweaks.background} onChange={(v) => setTweak('background', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
