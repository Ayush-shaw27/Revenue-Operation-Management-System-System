'use client';

/** AnimatedNumber — counts up from the previous value to the new value on mount/refresh. */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (v: number) => string;
  delay?: number;
}

export default function AnimatedNumber({
  value,
  duration = 900,
  className = '',
  formatter,
  delay = 0,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }
    const from = prevValue.current;
    const delta = value - from;
    if (delta === 0) return;

    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      setDisplay(from + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevValue.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      prevValue.current = value;
    };
  }, [value, duration, delay, reduced]);

  const final = formatter ? formatter(display) : Math.round(display).toString();
  return <span className={className}>{final}</span>;
}