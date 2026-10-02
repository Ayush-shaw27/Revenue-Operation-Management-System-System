'use client';

/** GlassCard — the signature glass-surface container used across every screen. */
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { ReactNode, MouseEvent } from 'react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  tilt?: boolean;
  variant?: 'default' | 'subtle' | 'elevated';
}

const VARIANTS: Record<NonNullable<GlassCardProps['variant']>, string> = {
  default: 'glass-card',
  subtle: 'glass-card-subtle',
  elevated: 'glass-card-elevated',
};

export default function GlassCard({
  children,
  className = '',
  glow = true,
  tilt = false,
  variant = 'default',
}: GlassCardProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number; visible: boolean }>({
    x: 50,
    y: 50,
    visible: false,
  });

  // Tilt springs driven by mouse position (only when tilt is enabled).
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useMotionValue(0), { damping: 15, stiffness: 150 });
  const rotateY = useSpring(useMotionValue(0), { damping: 15, stiffness: 150 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mx.set(x);
    my.set(y);
    setSpot({ x: x * 100, y: y * 100, visible: true });
    if (tilt) {
      rotateX.set((y - 0.5) * 6); // ±3 degrees
      rotateY.set((x - 0.5) * 6);
    }
  }

  function handleMouseLeave() {
    setSpot((s) => ({ ...s, visible: false }));
    rotateX.set(0);
    rotateY.set(0);
  }

  const style = tilt && !reduced ? { rotateX, rotateY, transformPerspective: 900 } : undefined;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style as React.CSSProperties}
      whileHover={tilt && !reduced ? { scale: 1.01 } : undefined}
      className={cn(VARIANTS[variant], 'relative', className)}
    >
      {glow && spot.visible && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
          style={{
            background: `radial-gradient(320px circle at ${spot.x}% ${spot.y}%, var(--accent-glow), transparent 70%)`,
            opacity: 0.12,
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}