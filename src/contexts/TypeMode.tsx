import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type TypeMode = 'display' | 'plain';

type Ctx = {
  mode: TypeMode;
  toggle: () => void;
};

const TypeModeContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'ohtani.typeMode';

function readInitial(): TypeMode {
  if (typeof window === 'undefined') return 'display';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'plain' ? 'plain' : 'display';
}

export function TypeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TypeMode>(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // storage unavailable — fine, in-memory state still works for the session
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === 'display' ? 'plain' : 'display'));
  }, []);

  return <TypeModeContext.Provider value={{ mode, toggle }}>{children}</TypeModeContext.Provider>;
}

export function useTypeMode(): Ctx {
  const ctx = useContext(TypeModeContext);
  if (!ctx) throw new Error('useTypeMode must be used inside TypeModeProvider');
  return ctx;
}
