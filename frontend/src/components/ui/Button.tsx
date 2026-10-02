'use client';

/** Button — magnetic primary/secondary buttons used site-wide. */
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { ReactNode, ButtonHTMLAttributes, MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/motion';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  magnetic?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  [key: string]: unknown;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  magnetic = true,
  disabled,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { damping: 25, stiffness: 300 });
  const sy = useSpring(my, { damping: 25, stiffness: 300 });

  function handleMouseMove(e: MouseEvent<HTMLButtonElement>) {
    if (!magnetic || reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    mx.set(dx * 0.25);
    my.set(dy * 0.25);
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ x: sx, y: sy }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'h-8 px-3.5 text-[13px]',
        size === 'md' && 'h-10 px-5 text-sm',
        size === 'lg' && 'h-11 px-6 text-[15px]',
        variant === 'primary' && 'bg-[var(--accent)] text-white hover:brightness-110 shadow-[0_4px_20px_-4px_var(--accent-glow)]',
        variant === 'secondary' && 'bg-[var(--card)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--card-hover)]',
        variant === 'ghost' && 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-hover)]',
        variant === 'danger' && 'bg-red-500/90 text-white hover:bg-red-500',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}