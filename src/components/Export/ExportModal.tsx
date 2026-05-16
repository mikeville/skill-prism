import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DataState } from '../../types';
import {
  ASPECT_PRESETS,
  FORMAT_LABELS,
  type AspectKey,
  type FormatKey,
} from '../../lib/export/dimensions';
import {
  capturePdfBlob,
  capturePngBlob,
  captureSvgString,
  svgStringToBlob,
} from '../../lib/export/capture';
import { slugifyTopic, triggerDownload } from '../../lib/export/download';
import { waitForExportReady } from '../../lib/export/readiness';
import { ExportCanvas } from './ExportCanvas';

type Props = {
  open: boolean;
  onClose: () => void;
  data: DataState | null;
  topic: string;
};

type Status = 'idle' | 'rendering' | 'capturing' | 'error';

// Custom chevron baked into the select's background. Replaces the native
// arrow so we can control its inset from the right edge (Chrome/macOS
// otherwise renders the caret nearly flush to the border). Color matches
// --c-ink-mut.
const CHEVRON_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23876b16' stroke-width='1.5'><path d='M3 4.5 L6 7.5 L9 4.5'/></svg>\")";

const SELECT_STYLE: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: CHEVRON_SVG,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '12px 12px',
};

export function ExportModal({ open, onClose, data, topic }: Props) {
  const [format, setFormat] = useState<FormatKey>('png');
  const [aspect, setAspect] = useState<AspectKey>('square');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // When set, ExportCanvas mounts offscreen and the effect below runs the
  // capture pipeline. Cleared after capture completes (success or failure).
  const [renderJob, setRenderJob] = useState<{
    format: FormatKey;
    aspect: AspectKey;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Reset transient state when the modal closes.
  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setErrorMsg(null);
      setRenderJob(null);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status === 'idle') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, status]);

  // Render → wait → capture → download → unmount.
  useEffect(() => {
    if (!renderJob) return;
    let cancelled = false;
    setStatus('rendering');

    (async () => {
      // Wait for the ExportCanvas portal to mount. The setRenderJob() that
      // triggered this effect also queued the canvas render; in StrictMode
      // dev, the ref can take an extra tick to populate.
      let node = canvasRef.current;
      for (let i = 0; i < 10 && !node; i++) {
        await new Promise((r) => setTimeout(r, 0));
        node = canvasRef.current;
      }
      if (!node || cancelled) return;

      try {
        await waitForExportReady(node);
        if (cancelled) return;
        setStatus('capturing');

        const preset = ASPECT_PRESETS[renderJob.aspect];
        const slug = slugifyTopic(topic);
        const filename = `skill-prism-${slug}-${preset.key}.${renderJob.format}`;

        if (renderJob.format === 'png') {
          const blob = await capturePngBlob(node, {
            width: preset.width,
            height: preset.height,
          });
          if (cancelled) return;
          triggerDownload(blob, filename);
        } else if (renderJob.format === 'pdf') {
          const blob = await capturePdfBlob(node, {
            width: preset.width,
            height: preset.height,
          });
          if (cancelled) return;
          triggerDownload(blob, filename);
        } else {
          const svg = await captureSvgString(node, {
            width: preset.width,
            height: preset.height,
          });
          if (cancelled) return;
          triggerDownload(svgStringToBlob(svg), filename);
        }

        setStatus('idle');
        setRenderJob(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[export] capture failed', err);
        setErrorMsg(err instanceof Error ? err.message : 'Capture failed');
        setStatus('error');
        setRenderJob(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [renderJob, topic]);

  if (!open) return null;

  const preset = ASPECT_PRESETS[aspect];
  const busy = status === 'rendering' || status === 'capturing';
  const buttonLabel =
    status === 'rendering' ? 'Rendering…' : status === 'capturing' ? 'Capturing…' : 'Export';

  return createPortal(
    <>
      {/* Modal overlay + card */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Export"
      >
        <div
          className="absolute inset-0 bg-paper/80 backdrop-blur-sm"
          onClick={busy ? undefined : onClose}
        />
        <div
          className="relative bg-paper border border-line-meta p-6 w-[min(420px,90vw)] flex flex-col gap-4"
          style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.35)' }}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-meta font-meta text-ink">EXPORT</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring disabled:opacity-40 disabled:hover:opacity-40 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              CLOSE
            </button>
          </div>

          <Field label="FORMAT">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatKey)}
              disabled={busy}
              className="w-full bg-fill-page text-ink border border-line-meta pl-2.5 pr-8 py-2 text-meta font-meta cursor-pointer hover:border-ink-mut transition-colors duration-hover focus:outline-none focus:border-ink-mut disabled:cursor-not-allowed disabled:opacity-40"
              style={SELECT_STYLE}
            >
              {(Object.keys(FORMAT_LABELS) as FormatKey[]).map((k) => (
                <option key={k} value={k}>
                  {FORMAT_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="SIZE">
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as AspectKey)}
              disabled={busy}
              className="w-full bg-fill-page text-ink border border-line-meta pl-2.5 pr-8 py-2 text-meta font-meta cursor-pointer hover:border-ink-mut transition-colors duration-hover focus:outline-none focus:border-ink-mut disabled:cursor-not-allowed disabled:opacity-40"
              style={SELECT_STYLE}
            >
              {(Object.keys(ASPECT_PRESETS) as AspectKey[]).map((k) => (
                <option key={k} value={k}>
                  {ASPECT_PRESETS[k].label}
                </option>
              ))}
            </select>
          </Field>

          {/* Aspect preview rectangle — static, not a live render. */}
          <div className="flex items-center justify-center py-2">
            <div
              className="border border-line-meta bg-fill-page flex items-center justify-center text-meta font-meta text-ink-mut"
              style={{
                width: `${Math.min(220, 220 * (preset.width / preset.height))}px`,
                height: `${Math.min(220, 220 * (preset.height / preset.width))}px`,
                maxWidth: '220px',
                maxHeight: '220px',
              }}
            >
              {preset.width}×{preset.height}
            </div>
          </div>

          {errorMsg && (
            <div className="text-meta font-meta text-ink border border-line-meta px-3 py-2">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-meta font-meta text-ink-mut hover:opacity-60 transition-opacity duration-hover focus-ring disabled:opacity-40 disabled:hover:opacity-40 disabled:cursor-not-allowed"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => {
                if (busy || !data) return;
                setErrorMsg(null);
                setRenderJob({ format, aspect });
              }}
              disabled={busy || !data}
              className="text-meta font-meta text-ink hover:opacity-60 transition-opacity duration-hover focus-ring disabled:opacity-40 disabled:hover:opacity-40 disabled:cursor-not-allowed border border-ink px-3 py-1"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Offscreen render host. Only mounted while a capture is in flight. */}
      {renderJob && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: '-99999px',
            top: 0,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <ExportCanvas
            ref={canvasRef}
            data={data}
            width={ASPECT_PRESETS[renderJob.aspect].width}
            height={ASPECT_PRESETS[renderJob.aspect].height}
          />
        </div>
      )}
    </>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-meta font-meta text-ink-mut">{label}</span>
      {children}
    </label>
  );
}
