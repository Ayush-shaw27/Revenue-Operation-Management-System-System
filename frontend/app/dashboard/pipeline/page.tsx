'use client';

/** Pipeline — deal cards with stage, probability, anomaly/risk indicators, next-best-actions. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Handshake, Lightbulb, TrendingUp, Inbox } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import Badge, { StageBadge } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatDate, STAGE_LABELS, STAGE_COLORS, STAGE_ORDER } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import type { Deal, NextBestAction } from '@/api/types';

export default function PipelinePage() {
  const { data: deals, isLoading, error, load } = useApi<Deal[]>(() => api.listDeals());
  const actions = useApi<NextBestAction[]>(() => api.nextBestActions());
  const [stageFilter, setStageFilter] = useState<string>('all');

  const actionMap = useMemo(() => {
    const m = new Map<string, NextBestAction>();
    for (const a of actions.data || []) m.set(a.deal_id, a);
    return m;
  }, [actions.data]);

  const filtered = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => stageFilter === 'all' || d.stage === stageFilter);
  }, [deals, stageFilter]);

  const totalValue = filtered.reduce((sum, d) => sum + d.value, 0);

  return (
    <DashboardLayout title="Pipeline" subtitle={`${filtered.length} deals · ${formatCurrency(totalValue, true)}`}>
      {/* Stage filter pills */}
      <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-5 flex flex-wrap gap-2">
        <FilterPill active={stageFilter === 'all'} label={`All (${deals?.length ?? 0})`} onClick={() => setStageFilter('all')} index={0} />
        {STAGE_ORDER.map((stage, i) => (
          <FilterPill
            key={stage}
            active={stageFilter === stage}
            label={`${STAGE_LABELS[stage]} (${deals?.filter((d) => d.stage === stage).length ?? 0})`}
            onClick={() => setStageFilter(stage)}
            index={i + 1}
            dot={STAGE_COLORS[stage]}
          />
        ))}
      </motion.div>
{isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} className="h-[200px]" />)}
        </div>
      ) : error ? (
        <GlassCard><ErrorState onRetry={load} message={error.message} /></GlassCard>
      ) : !deals || deals.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Handshake className="h-6 w-6" />} title="No deals in pipeline" message="Deals will appear here once created." />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard><EmptyState icon={<Inbox className="h-6 w-6" />} title="No deals in this stage" /></GlassCard>
      ) : (
        <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deal, i) => (
            <DealCard key={deal.id} deal={deal} actions={actionMap.get(deal.id)?.recommendations} index={i} />
          ))}
        </motion.div>
      )}
    </DashboardLayout>
  );
}

function FilterPill({
  active, label, onClick, index, dot,
}: { active: boolean; label: string; onClick: () => void; index: number; dot?: string }) {
  return (
    <motion.button
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium transition-all duration-200 ${
        active
          ? 'bg-[var(--accent)] text-white shadow-[0_4px_16px_-4px_var(--accent-glow)]'
          : 'border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)]'
      }`}
    >
      {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
      {label}
    </motion.button>
  );
}

function DealCard({
  deal, actions, index,
}: { deal: Deal; actions?: NextBestAction['recommendations']; index: number }) {
  const riskTone = deal.is_anomalous ? 'red' : deal.probability < 40 ? 'amber' : 'green';
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: index * 0.06 }} className="group">
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{deal.title}</p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">{deal.company}</p>
          </div>
          <StageBadge stage={deal.stage} />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[20px] font-medium tracking-tight text-[var(--text-primary)]">{formatCurrency(deal.value, true)}</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">value</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-medium text-[var(--text-primary)]">{deal.probability}%</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">probability</p>
          </div>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--card-hover)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${deal.probability}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 + index * 0.05 }}
            className="h-full rounded-full"
            style={{ backgroundColor: STAGE_COLORS[deal.stage] || '#06b6d4' }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={riskTone as 'green'}>
            {deal.is_anomalous ? <AlertTriangle className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {deal.is_anomalous ? 'Anomaly' : `${deal.days_in_stage}d in stage`}
          </Badge>
          {deal.close_date && <span className="text-[11px] text-[var(--text-tertiary)]">Close {formatDate(deal.close_date)}</span>}
        </div>

        {actions && actions.length > 0 && (
          <div className="mt-4 rounded-xl bg-[var(--card-hover)]/70 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
              <Lightbulb className="h-3 w-3" /> Next best action
            </div>
            <p className="mt-1 text-[12px] leading-snug text-[var(--text-secondary)]">{actions[0].action}</p>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}