'use client';

/** Dashboard overview — KPI cards with animated counters, revenue chart, and insights. */
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, DollarSign, Users, AlertTriangle, Target, Handshake } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/ui/StatCard';
import GlassCard from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import AreaChart from '@/components/charts/AreaChart';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import type { ExecSummary, PipelineInsightsResponse } from '@/api/types';

export default function DashboardPage() {
  const summary = useApi<ExecSummary>(() => api.execSummary());
  const insights = useApi<PipelineInsightsResponse>(() => api.pipelineInsights());
  const s = summary.data;

  return (
    <DashboardLayout title="Overview" subtitle="Revenue operations at a glance">
      {/* KPI Grid */}
      <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {summary.isLoading ? (
          <>
            <SkeletonCard className="h-[140px]" />
            <SkeletonCard className="h-[140px]" />
            <SkeletonCard className="h-[140px]" />
            <SkeletonCard className="h-[140px]" />
          </>
        ) : summary.error ? (
          <div className="col-span-full"><ErrorState onRetry={summary.load} message={summary.error.message} /></div>
        ) : (
          <>
            <StatCard label="Pipeline Value" value={s?.total_pipeline_value ?? 0} formatter={(v) => formatCurrency(v, true)} icon={<DollarSign className="h-4 w-4" />} index={0} />
            <StatCard label="Open Deals" value={s?.open_deals ?? 0} icon={<Handshake className="h-4 w-4" />} index={1} />
            <StatCard label="Win Rate" value={s?.win_rate ?? 0} formatter={(v) => formatPercent(v)} icon={<Target className="h-4 w-4" />} index={2} />
            <StatCard label="Active Leads" value={s?.total_leads ?? 0} formatter={formatNumber} icon={<Users className="h-4 w-4" />} index={3} />
          </>
        )}
      </motion.div>
<div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* Revenue Trends Chart */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="lg:col-span-2">
          <GlassCard className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[var(--text-primary)]">Revenue Trends</p>
                <p className="text-[11.5px] text-[var(--text-tertiary)]">Closed-won revenue over time</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[var(--card-hover)] px-2 py-1">
                <BarChart3 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <span className="text-[11px] text-[var(--text-tertiary)]">Real data</span>
              </div>
            </div>
            <Suspense fallback={<div className="h-[220px] skeleton" />}>
              <RevenueChart />
            </Suspense>
          </GlassCard>
        </motion.div>

        {/* Pipeline Insights */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="lg:col-span-1">
          <GlassCard className="h-full p-5 sm:p-6">
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">Pipeline Health</p>
            {insights.isLoading ? (
              <div className="mt-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            ) : insights.error ? (
              <ErrorState onRetry={insights.load} message={insights.error.message} />
            ) : insights.data ? (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-medium text-[var(--text-primary)]">{insights.data.pipeline_health_score}</span>
                  <span className="text-[12px] text-[var(--text-tertiary)]">/100</span>
                </div>
                <p className="mb-4 mt-1 text-[11.5px] text-[var(--text-tertiary)]">Across {insights.data.total_deals} deals</p>
                <div className="space-y-2">
                  {insights.data.insights.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl bg-[var(--card-hover)] px-3 py-2.5">
                      <p className="text-[12px] font-medium leading-snug text-[var(--text-primary)]">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)] line-clamp-2">{item.description}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </GlassCard>
        </motion.div>
      </div>

      {/* Secondary KPI row */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Closed Won Value" value={s?.closed_won_value ?? 0} formatter={(v) => formatCurrency(v, true)} icon={<DollarSign className="h-4 w-4" />} index={0} />
        <StatCard label="Avg Deal Size" value={s?.avg_deal_value ?? 0} formatter={(v) => formatCurrency(v, true)} index={1} />
        <StatCard label="High-Value Deals" value={s?.high_value_deals ?? 0} icon={<Target className="h-4 w-4" />} index={2} />
        <StatCard label="At-Risk Accounts" value={s?.at_risk_accounts ?? 0} icon={<AlertTriangle className="h-4 w-4" />} delta={s && s.at_risk_accounts > 0 ? -1 : 0} deltaInverted index={3} />
      </motion.div>
    </DashboardLayout>
  );
}

function RevenueChart() {
  const { data: trends, isLoading, error } = useApi(() => api.trends());
  if (isLoading) return <div className="skeleton h-[220px]" />;
  if (error) return <p className="py-8 text-center text-[12px] text-[var(--text-tertiary)]">Could not load trend data.</p>;
  if (!trends || trends.points.length === 0) return <p className="py-8 text-center text-[12px] text-[var(--text-tertiary)]">No closed-won revenue yet.</p>;
  return <AreaChart data={trends.points.map((p) => ({ label: p.period, value: p.revenue }))} color="#06b6d4" prefix="$" />;
}