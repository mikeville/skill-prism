import { useRef } from 'react';

export type InputAnimationData = {
  initialRect: DOMRect;
  timestamp: number;
};

export function useInputAnimation() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationDataRef = useRef<InputAnimationData | null>(null);

  const captureInitialPosition = () => {
    if (wrapperRef.current) {
      animationDataRef.current = {
        initialRect: wrapperRef.current.getBoundingClientRect(),
        timestamp: Date.now(),
      };
    }
  };

  const getAnimationData = () => animationDataRef.current;

  return {
    wrapperRef,
    captureInitialPosition,
    getAnimationData,
  };
}
