'use client';

/** EmptyState — small icon + message + action, never a blank rectangle. */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { scaleIn } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, message, action, className = '' }: EmptyStateProps) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="show"
      className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-[var(--text-primary)]">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-[var(--text-tertiary)]">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}