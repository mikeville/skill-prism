import { ANYBODY } from '../lib/fontConfig';

// Shared brand mark. One source of truth for the SKILL PRISM wordmark so the
// EmptyState mark and the Topbar mark stay visually identical across the
// empty→active handoff. Anybody axes: wdth [50–150], wght [100–900].
export const SKILL_PRISM_MARK = {
  family: ANYBODY.family,
  fontSize: '12px',
  variationSettings: '"wdth" 100, "wght" 800',
  tagline: 'FRACTAL TOPIC BROWSER',
  taglineVariationSettings: '"wdth" 100, "wght" 400',
} as const;

type Props = {
  // When true, renders the tagline next to the wordmark (used by EmptyState).
  withTagline?: boolean;
  // Optional className applied to the root span (used by Topbar to add a
  // hover-color/transition treatment when the mark wraps a button).
  className?: string;
  // Optional inline style merged onto the wordmark. The Topbar nudges the mark
  // up by 1px for optical centering against the icon row on its right side.
  style?: React.CSSProperties;
  // Color treatment for the tagline. Defaults to muted ink.
  taglineColor?: 'mut' | 'ink';
};

export function SkillPrismMark({ withTagline, className, style, taglineColor = 'mut' }: Props) {
  return (
    <span
      className={className}
      style={{
        // inline-block so callers can apply transform/translate via `style` —
        // CSS transforms are ignored on the default inline-flow span, which
        // silently swallowed the Topbar's translateY(-1px) optical-centering
        // nudge after the wordmark was extracted into this component.
        display: 'inline-block',
        fontFamily: SKILL_PRISM_MARK.family,
        fontSize: SKILL_PRISM_MARK.fontSize,
        fontVariationSettings: SKILL_PRISM_MARK.variationSettings,
        ...style,
      }}
    >
      SKILL PRISM
      {withTagline && (
        <>
          <span className="text-line-meta mx-1.5">·</span>
          <span
            className={taglineColor === 'ink' ? 'text-ink' : 'text-ink-mut'}
            style={{
              fontVariationSettings: SKILL_PRISM_MARK.taglineVariationSettings,
            }}
          >
            {SKILL_PRISM_MARK.tagline}
          </span>
        </>
      )}
    </span>
  );
}
