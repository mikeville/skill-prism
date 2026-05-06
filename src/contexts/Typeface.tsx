import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  FONTS,
  TYPEFACE_KEYS,
  setActiveFont,
  type FontConfig,
  type TypefaceKey,
} from '../lib/fontConfig';

type Ctx = {
  key: TypefaceKey;
  font: FontConfig;
  set: (key: TypefaceKey) => void;
};

const TypefaceContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'ohtani.typeface';

function readInitial(): TypefaceKey {
  if (typeof window === 'undefined') return 'roboto';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return TYPEFACE_KEYS.includes(v as TypefaceKey) ? (v as TypefaceKey) : 'roboto';
}

export function TypefaceProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<TypefaceKey>(() => {
    const initial = readInitial();
    setActiveFont(initial);
    return initial;
  });

  useEffect(() => {
    setActiveFont(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // storage unavailable — fine, in-memory state still works
    }
  }, [key]);

  const set = useCallback((next: TypefaceKey) => setKey(next), []);

  return (
    <TypefaceContext.Provider value={{ key, font: FONTS[key], set }}>
      {children}
    </TypefaceContext.Provider>
  );
}

export function useTypeface(): Ctx {
  const ctx = useContext(TypefaceContext);
  if (!ctx) throw new Error('useTypeface must be used inside TypefaceProvider');
  return ctx;
}
