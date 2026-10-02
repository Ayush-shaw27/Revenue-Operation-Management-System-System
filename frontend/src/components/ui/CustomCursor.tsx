'use client';

/** CustomCursor — a small dot + trailing ring that morphs on interactive elements.
 *
 * Used on marketing/landing/login pages. Disabled on dense dashboard tables
 * (per calibration rule) and whenever the OS requests reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { PointerEvent } from 'react';
import { useReducedMotion } from '@/lib/motion';

export default function CustomCursor() {
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { damping: 25, stiffness: 300 });
  const ringY = useSpring(y, { damping: 25, stiffness: 300 });

  useEffect(() => {
    if (reduced) return;
    const mq = window.matchMedia('(pointer: fine)');
    if (!mq.matches) return; // touch devices keep the native cursor
    setEnabled(true);
    document.documentElement.classList.add('custom-cursor-on');
    return () => document.documentElement.classList.remove('custom-cursor-on');
  }, [reduced]);

  if (!enabled || reduced) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Dot */}
      <motion.div
        className="fixed left-0 top-0 h-[6px] w-[6px] rounded-full bg-white mix-blend-difference"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
      />
      {/* Trailing ring */}
      <motion.div
        className="fixed left-0 top-0 h-9 w-9 rounded-full border border-white/40 mix-blend-difference"
        style={{ x: ringX, y: ringY, translateX: '-50%', translateY: '-50%' }}
        animate={{
          scale: pressed ? 0.7 : hovering ? 1.6 : 1,
          opacity: hovering ? 0.8 : 0.5,
        }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}

/** Global mouse-move tracker that drives the custom cursor via DOM events. */
export function CursorTracker() {
  const xRef = useRef<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const move = (e: MouseEvent) => {
        xRef.current = e.clientX;
        document.dispatchEvent(
          new CustomEvent('cursor-move', { detail: { x: e.clientX, y: e.clientY } }),
        );
      };
      const over = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const interactive = target?.closest('a, button, [role="button"], input, textarea, select, [data-hover]');
        setHovering(Boolean(interactive));
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseover', over);
      window.addEventListener('mousedown', () => setPressed(true));
      window.addEventListener('mouseup', () => setPressed(false));
      return () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseover', over);
        window.removeEventListener('mousedown', () => setPressed(true));
        window.removeEventListener('mouseup', () => setPressed(false));
      };
    }
  }, []);

  return null;
}