'use client';

/** Shared Framer Motion configuration — one source of truth for all easing/springs. */
import { useReducedMotion as useFmReducedMotion } from 'framer-motion';

/** The signature ease-out curve used across the whole product. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const SPRING = { damping: 25, stiffness: 300 };

export const DURATIONS = {
  fast: 0.2,
  standard: 0.4,
  slow: 0.7,
  page: 0.5,
};

export const STAGGER = {
  container: { show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: DURATIONS.standard, ease: EASE } },
  },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: DURATIONS.standard, ease: EASE } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATIONS.standard, ease: EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATIONS.standard, ease: EASE } },
};

export function useReducedMotion(): boolean {
  return useFmReducedMotion() ?? false;
}

/** Respect prefers-reduced-motion: returns motion-safe variants or instant ones. */
export function motionSafe<T extends Record<string, unknown>>(
  variants: T,
  reduced: boolean,
): T {
  if (reduced) {
    return Object.fromEntries(
      Object.entries(variants).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null ? { ...(v as object), transition: { duration: 0 } } : v,
      ]),
    ) as T;
  }
  return variants;
}