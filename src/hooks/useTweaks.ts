// Tweak values — single source of truth for the Tweaks panel.
// Persists to localStorage. Replaces the prototype's postMessage host protocol.

import { useCallback, useState } from 'react';
import type { TweakValues } from '../types';

const STORAGE_KEY = 'ohtani:tweaks:v1';

export const TWEAK_DEFAULTS: TweakValues = {
  accent: '#ffd700',
  fontFamily: 'Inter',
  lineWeight: 1,
  density: 'comfortable',
  showCoords: false,
  background: '#FFFFFF',
};

function isFontFamily(v: unknown): v is TweakValues['fontFamily'] {
  return v === 'Inter' || v === 'Manrope' || v === 'System';
}
function isDensity(v: unknown): v is TweakValues['density'] {
  return v === 'compact' || v === 'comfortable';
}

function loadFromStorage(): TweakValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return TWEAK_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TweakValues>;
    return {
      accent: typeof parsed.accent === 'string' ? parsed.accent : TWEAK_DEFAULTS.accent,
      fontFamily: isFontFamily(parsed.fontFamily) ? parsed.fontFamily : TWEAK_DEFAULTS.fontFamily,
      lineWeight:
        typeof parsed.lineWeight === 'number' ? parsed.lineWeight : TWEAK_DEFAULTS.lineWeight,
      density: isDensity(parsed.density) ? parsed.density : TWEAK_DEFAULTS.density,
      showCoords:
        typeof parsed.showCoords === 'boolean' ? parsed.showCoords : TWEAK_DEFAULTS.showCoords,
      background:
        typeof parsed.background === 'string' ? parsed.background : TWEAK_DEFAULTS.background,
    };
  } catch {
    return TWEAK_DEFAULTS;
  }
}

export type SetTweak = <K extends keyof TweakValues>(key: K, value: TweakValues[K]) => void;

export function useTweaks(): [TweakValues, SetTweak] {
  const [values, setValues] = useState<TweakValues>(loadFromStorage);

  const setTweak: SetTweak = useCallback((key, value) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Quota or disabled storage — values still persist for the session.
      }
      return next;
    });
  }, []);

  return [values, setTweak];
}

// Map TweakValues.fontFamily to an actual CSS font stack.
export const FONT_STACKS: Record<TweakValues['fontFamily'], string> = {
  Inter: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  Manrope: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
  System: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};
