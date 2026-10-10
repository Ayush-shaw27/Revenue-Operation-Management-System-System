'use client';

/** Analytics — revenue trends, funnel, cohorts, and forecast scenario simulator. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Filter, Users, SlidersHorizontal, RefreshCcw,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import AreaChart from '@/components/charts/AreaChart';
import BarChart from '@/components/charts/BarChart';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatPercent } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import type { FunnelResponse, CohortsResponse, TrendPoint, ForecastScenarioResponse } from '@/api/types';

export default function AnalyticsPage() {
  const trends = useApi<{ metric: string; points: TrendPoint[] }>(() => api.trends());
  const revHistory = useApi<{ points: TrendPoint[] }>(() => api.revenueHistory());
  const [funnelBy, setFunnelBy] = useState('source');
  const funnel = useApi<FunnelResponse>(() => api.funnel(funnelBy));
  const cohorts = useApi<CohortsResponse>(() => api.cohorts());

  // Read the value defensively. `reduce((s, p) => s + p.revenue, 0)` returns
  // NaN the moment any point is missing the field or carries a non-number —
  // which is exactly what happened when /revenue-history returned `actual`
  // instead of `revenue`, and the card rendered "$NaN". Coercing here means a
  // contract change degrades to a smaller number, never to a broken page.
  const revenuePoints = revHistory.data?.points ?? [];
  const totalRevenue = revenuePoints.reduce(
    (sum, p) => sum + (Number(p?.revenue) || 0),
    0,
  );

  return (
    <DashboardLayout title="Analytics" subtitle="Revenue insights, funnel, and cohort analysis">
      {/* KPI row */}
      <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={totalRevenue} formatter={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-4 w-4" />} index={0} />
        <StatCard label="Revenue Periods" value={revenuePoints.length} icon={<BarChart3 className="h-4 w-4" />} index={1} />
        <StatCard label="Funnel Segments" value={funnel.data?.funnel?.length ?? 0} icon={<Filter className="h-4 w-4" />} index={2} />
        <StatCard label="Cohort Groups" value={cohorts.data?.cohorts?.length ?? 0} icon={<Users className="h-4 w-4" />} index={3} />
      </motion.div>

      {/* Revenue Trend Area Chart */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
        <GlassCard className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">Revenue Trend</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Closed-won revenue over time</p>
            </div>
          </div>
          {trends.isLoading ? (
            <SkeletonCard className="h-[220px]" />
          ) : trends.error ? (
            <ErrorState onRetry={trends.load} message={trends.error.message} />
          ) : trends.data?.points?.length ? (
            <AreaChart data={trends.data.points.map((p) => ({ label: p.period, value: p.revenue }))} color="#06b6d4" prefix="$" />
          ) : (
            <p className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">No trend data available.</p>
          )}
        </GlassCard>
      </motion.div>
      {/* Revenue History Bar Chart */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
        <GlassCard className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">Revenue History</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Monthly closed-won amounts</p>
            </div>
          </div>
          {revHistory.isLoading ? (
            <SkeletonCard className="h-[220px]" />
          ) : revHistory.error ? (
            <ErrorState onRetry={revHistory.load} message={revHistory.error.message} />
          ) : revenuePoints.length ? (
            <BarChart data={revenuePoints.map((p) => ({ label: p.period, value: Number(p?.revenue) || 0, color: '#8b5cf6' }))} prefix="$" />
          ) : (
            <p className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">No revenue history available.</p>
          )}
        </GlassCard>
      </motion.div>

      {/* Funnel by Source / Stage */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
        <GlassCard className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">Lead Funnel</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Distribution by {funnelBy}</p>
            </div>
            <div className="flex gap-1.5">
              {(['source', 'stage'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setFunnelBy(opt); setTimeout(funnel.load, 0); }}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${funnelBy === opt ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card-hover)] text-[var(--text-secondary)] hover:bg-[var(--card)]'}`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {funnel.isLoading ? (
            <SkeletonCard className="h-[220px]" />
          ) : funnel.error ? (
            <ErrorState onRetry={funnel.load} message={funnel.error.message} />
          ) : funnel.data?.funnel?.length ? (
            <BarChart
              data={funnel.data.funnel.map((f) => ({ label: f.name, value: f.value, color: f.color || '#06b6d4' }))}
              horizontal
            />
          ) : (
            <p className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">No funnel data available.</p>
          )}
        </GlassCard>
      </motion.div>

      {/* Cohorts Conversion Table */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
        <GlassCard className="p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-[14px] font-medium text-[var(--text-primary)]">Cohort Conversion</p>
            <p className="text-[12px] text-[var(--text-tertiary)]">Monthly cohort lead-to-conversion rates</p>
          </div>
          {cohorts.isLoading ? (
            <SkeletonCard className="h-[200px]" />
          ) : cohorts.error ? (
            <ErrorState onRetry={cohorts.load} message={cohorts.error.message} />
          ) : cohorts.data?.cohorts?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Cohort</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Total Leads</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Converted</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.data.cohorts.map((c) => (
                    <tr key={c.cohort} className="border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--card-hover)]/40">
                      <td className="px-4 py-3 text-[13px] font-medium text-[var(--text-primary)]">{c.cohort}</td>
                      <td className="px-4 py-3 text-right text-[13px] text-[var(--text-secondary)]">{c.total}</td>
                      <td className="px-4 py-3 text-right text-[13px] text-[var(--text-secondary)]">{c.converted}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge tone={c.conversion_rate >= 50 ? 'green' : c.conversion_rate >= 20 ? 'amber' : 'red'}>
                          {formatPercent(c.conversion_rate)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">No cohort data available.</p>
          )}
        </GlassCard>
      </motion.div>

      {/* Forecast Scenario Simulator */}
      <ScenarioSimulator />
    </DashboardLayout>
  );
}

/* ---------- ScenarioSimulator sub-component ---------- */

function ScenarioSimulator() {
  const [discount, setDiscount] = useState(0);
  const [headcount, setHeadcount] = useState(1);
  const [factor, setFactor] = useState(1.0);
  const [result, setResult] = useState<ForecastScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScenario() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.forecastScenario({ discount, headcount, factor });
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
          <p className="text-[14px] font-medium text-[var(--text-primary)]">Forecast Scenario Simulator</p>
        </div>
        <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">Adjust parameters and run a what-if forecast scenario</p>

        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Discount %</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Headcount</label>
            <input
              type="number"
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Growth Factor</label>
            <input
              type="number"
              step="0.1"
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <Button onClick={runScenario} disabled={loading}>
          {loading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
          Run Scenario
        </Button>

        {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}

        {result && (
          <div className="mt-5">
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <GlassCard className="p-4">
                <p className="text-[11px] text-[var(--text-tertiary)]">ML Projected Total</p>
                <p className="text-lg font-medium text-[var(--text-primary)]">{formatCurrency(result.ml_projected_total, true)}</p>
              </GlassCard>
              <GlassCard className="p-4">
                <p className="text-[11px] text-[var(--text-tertiary)]">Traditional Total</p>
                <p className="text-lg font-medium text-[var(--text-primary)]">{formatCurrency(result.traditional_total, true)}</p>
              </GlassCard>
              <GlassCard className="p-4">
                <p className="text-[11px] text-[var(--text-tertiary)]">Variance</p>
                <p className="text-lg font-medium text-[var(--text-primary)]">{formatPercent(result.variance_percentage)}</p>
              </GlassCard>
            </div>
            {result.data.length > 0 && (
              <AreaChart
                data={result.data.map((d) => ({ label: d.period, value: d.actual > 0 ? d.actual : d.mlForecast }))}
                color="#f59e0b"
                prefix="$"
              />
            )}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}