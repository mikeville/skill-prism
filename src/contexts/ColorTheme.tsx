import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { COLOR_SETS, DEFAULT_SET_ID, getSet, type ColorSet } from '../lib/themes';

type Ctx = {
  setId: string;
  swapped: boolean;
  set: ColorSet;
  resolved: { ink: string; inkMut: string; paper: string };
  setSet: (id: string) => void;
  toggleSwap: () => void;
};

const ColorThemeContext = createContext<Ctx | null>(null);

const STORAGE_KEY_SET = 'skill-prism.colorSet';
const STORAGE_KEY_SWAP = 'skill-prism.colorSwap';

function readInitialSet(): string {
  if (typeof window === 'undefined') return DEFAULT_SET_ID;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_SET);
    if (v && COLOR_SETS.some((s) => s.id === v)) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SET_ID;
}

function readInitialSwap(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY_SWAP) === '1';
  } catch {
    return false;
  }
}

function resolve(set: ColorSet, swapped: boolean) {
  if (!swapped) return { ink: set.ink, inkMut: set.inkMut, paper: set.paper };
  return { ink: set.paper, inkMut: set.inkMut, paper: set.ink };
}

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [setId, setSetId] = useState<string>(readInitialSet);
  const [swapped, setSwapped] = useState<boolean>(readInitialSwap);

  const set = useMemo(() => getSet(setId), [setId]);
  const resolved = useMemo(() => resolve(set, swapped), [set, swapped]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--c-ink', resolved.ink);
    root.style.setProperty('--c-ink-mut', resolved.inkMut);
    root.style.setProperty('--c-paper', resolved.paper);
  }, [resolved]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_SET, setId);
    } catch {
      /* storage unavailable */
    }
  }, [setId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_SWAP, swapped ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, [swapped]);

  const setSet = useCallback((id: string) => {
    setSetId(id);
  }, []);

  const toggleSwap = useCallback(() => {
    setSwapped((s) => !s);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ setId, swapped, set, resolved, setSet, toggleSwap }),
    [setId, swapped, set, resolved, setSet, toggleSwap],
  );

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>;
}

export function useColorTheme(): Ctx {
  const ctx = useContext(ColorThemeContext);
  if (!ctx) throw new Error('useColorTheme must be used inside ColorThemeProvider');
  return ctx;
}
