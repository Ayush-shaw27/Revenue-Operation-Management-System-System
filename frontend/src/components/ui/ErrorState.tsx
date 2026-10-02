'use client';

/** ErrorState — calm, actionable error card with a retry button. */
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { fadeIn } from '@/lib/motion';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--text-tertiary)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-primary mt-5 inline-flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
      )}
    </motion.div>
  );
}