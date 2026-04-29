import { useCallback, useState } from 'react';
import type { TweakValues } from '../types';

const STORAGE_KEY = 'ohtani:tweaks:v2';

export const TWEAK_DEFAULTS: TweakValues = {
  density: 'comfortable',
  showCoords: false,
  depthOverride: 'auto',
};

function isDensity(v: unknown): v is TweakValues['density'] {
  return v === 'compact' || v === 'comfortable';
}
function isDepthOverride(v: unknown): v is TweakValues['depthOverride'] {
  return v === 'auto' || v === '1' || v === '2';
}

function load(): TweakValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return TWEAK_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TweakValues>;
    return {
      density: isDensity(parsed.density) ? parsed.density : TWEAK_DEFAULTS.density,
      showCoords:
        typeof parsed.showCoords === 'boolean' ? parsed.showCoords : TWEAK_DEFAULTS.showCoords,
      depthOverride: isDepthOverride(parsed.depthOverride)
        ? parsed.depthOverride
        : TWEAK_DEFAULTS.depthOverride,
    };
  } catch {
    return TWEAK_DEFAULTS;
  }
}

export type SetTweak = <K extends keyof TweakValues>(key: K, value: TweakValues[K]) => void;

export function useTweaks(): [TweakValues, SetTweak] {
  const [values, setValues] = useState<TweakValues>(load);

  const setTweak: SetTweak = useCallback((key, value) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return [values, setTweak];
}
