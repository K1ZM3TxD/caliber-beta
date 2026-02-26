'use client';

import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  delayMs?: number;
  cps?: number;
}

export default function TypewriterText({ text, delayMs = 300, cps = 40 }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayed(text);
      return;
    }

    let charIdx = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const startId = setTimeout(() => {
      setDisplayed('');
      intervalId = setInterval(() => {
        charIdx++;
        setDisplayed(text.slice(0, charIdx));
        if (charIdx >= text.length) {
          clearInterval(intervalId!);
        }
      }, Math.round(1000 / cps));
    }, delayMs);

    return () => {
      clearTimeout(startId);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [text, delayMs, cps]);

  return <>{displayed}</>;
}
