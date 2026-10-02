'use client';

/** StatCard — animated KPI card with count-up value, delta pill, and optional micro-chart. */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import GlassCard from './GlassCard';
import { cn } from '@/lib/cn';
import { fadeUp } from '@/lib/motion';

interface StatCardProps {
  label: string;
  value: number;
  formatter?: (v: number) => string;
  delta?: number;
  deltaSuffix?: string;
  icon?: ReactNode;
  chart?: ReactNode;
  className?: string;
  index?: number;
  deltaInverted?: boolean;
}

export default function StatCard({
  label,
  value,
  formatter,
  delta,
  deltaSuffix = '%',
  icon,
  chart,
  className = '',
  index = 0,
  deltaInverted = false,
}: StatCardProps) {
  const deltaGood = delta !== undefined && (deltaInverted ? delta <= 0 : delta >= 0);
  const showDelta = delta !== undefined;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.07 }}
      className={cn('h-full', className)}
    >
      <GlassCard className="group h-full p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                {icon}
              </div>
            )}
            <p className="text-[13px] font-medium text-[var(--text-tertiary)]">{label}</p>
          </div>
          {showDelta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold',
                deltaGood ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}
              {deltaSuffix}
            </span>
          )}
        </div>
        <div className="mt-4">
          <AnimatedNumber
            value={value}
            formatter={formatter}
            className="text-2xl sm:text-[32px] font-medium tracking-tight text-[var(--text-primary)]"
          />
        </div>
        {chart && <div className="mt-4">{chart}</div>}
      </GlassCard>
    </motion.div>
  );
}