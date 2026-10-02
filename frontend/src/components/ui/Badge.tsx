'use client';

/** Badge — status pill used for stages, risk tiers, and scores. */
import { cn } from '@/lib/cn';
import { STAGE_COLORS } from '@/lib/format';

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'cyan' | 'gray';
  className?: string;
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  green: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
  red: 'bg-red-500/10 text-red-500 ring-red-500/20',
  amber: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  blue: 'bg-blue-500/10 text-blue-500 ring-blue-500/20',
  violet: 'bg-violet-500/10 text-violet-500 ring-violet-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-500 ring-cyan-500/20',
  gray: 'bg-[var(--card-hover)] text-[var(--text-tertiary)] ring-[var(--border)]',
};

export default function Badge({ children, tone = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Derive a badge tone from a stage string. */
export function StageBadge({ stage }: { stage: string }) {
  const color = STAGE_COLORS[stage] || '#888';
  const tone: BadgeProps['tone'] =
    stage === 'closed-won' || stage === 'converted'
      ? 'green'
      : stage === 'closed-lost'
        ? 'red'
        : stage === 'negotiation'
          ? 'amber'
          : stage === 'proposal'
            ? 'cyan'
            : stage === 'qualification' || stage === 'contacted'
              ? 'blue'
              : stage === 'prospecting' || stage === 'new'
                ? 'violet'
                : 'gray';
  return <Badge tone={tone}>{stage}</Badge>;
}

export function TierBadge({ tier }: { tier: string }) {
  const tone: BadgeProps['tone'] =
    tier === 'high' ? 'red' : tier === 'medium' ? 'amber' : 'green';
  return <Badge tone={tone}>{tier}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  const tone: BadgeProps['tone'] =
    score >= 80 ? 'green' : score >= 60 ? 'blue' : score >= 40 ? 'amber' : 'red';
  return <Badge tone={tone}>{score}</Badge>;
}