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

    // Must SET the value here, not just return.  React StrictMode (enabled in
    // next.config.js) mounts, unmounts and remounts every effect in dev:
    //   1st run  -> schedules the animation, display is still 0
    //   cleanup  -> cancels the rAF, sets prevValue = value
    //   2nd run  -> from === value, so delta === 0 and it returned early
    // leaving `display` at 0 forever.  Every KPI on the dashboard rendered as
    // "$0" while the API was returning perfectly good data.
    if (delta === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      setDisplay(from + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        prevValue.current = value;
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      // Snap to the target on teardown.  An aborted animation must never leave
      // a stale number on screen, and `prevValue` must only advance once the
      // animation has actually landed on `value`.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      prevValue.current = value;
      setDisplay(value);
    };
  }, [value, duration, delay, reduced]);

  const final = formatter ? formatter(display) : Math.round(display).toString();
  return <span className={className}>{final}</span>;
}