import { createContext, useContext, type ReactNode } from 'react';

// Provides a getter so consumers (e.g. useFitText) can read the current
// animating state without re-rendering when it flips. We expose a function
// rather than a boolean so the FractalView can hold the state in a ref.
type Ctx = {
  isAnimating: () => boolean;
  // Optional subscribe API for consumers that want to refit on animation end.
  onChange: (cb: (animating: boolean) => void) => () => void;
};

const AnimatingContext = createContext<Ctx>({
  isAnimating: () => false,
  onChange: () => () => {},
});

export function AnimatingProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <AnimatingContext.Provider value={value}>{children}</AnimatingContext.Provider>;
}

export function useAnimating(): Ctx {
  return useContext(AnimatingContext);
}
