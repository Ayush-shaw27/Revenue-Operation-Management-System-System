'use client';

/** Forecast — revenue forecast chart with ML vs traditional, model details. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Settings2, RefreshCcw } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import AreaChart from '@/components/charts/AreaChart';
import StatCard from '@/components/ui/StatCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatPercent } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';

export default function ForecastPage() {
  const [timeframe, setTimeframe] = useState('monthly');
  const [modelType, setModelType] = useState('ridge');
  const { data: forecast, isLoading, error, load } = useApi(
    () => api.forecast(timeframe, modelType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  return (
    <DashboardLayout title="Revenue Forecast" subtitle="ML-powered revenue projections">
      {/* Controls */}
      <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-5 flex flex-wrap items-center gap-3">
        <select value={timeframe} onChange={(e) => { setTimeframe(e.target.value); setTimeout(load, 0); }} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
        <select value={modelType} onChange={(e) => { setModelType(e.target.value); setTimeout(load, 0); }} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none">
          <option value="ridge">Ridge Regression</option>
          <option value="linear">Linear Regression</option>
          <option value="gradient-boosting">Gradient Boosting</option>
        </select>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</Button>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[140px]" />)}
        </div>
      ) : error ? (
        <GlassCard><ErrorState onRetry={load} message={error.message} /></GlassCard>
      ) : forecast ? (
        <>
          <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="ML Projected Total" value={forecast.ml_projected_total} formatter={(v) => formatCurrency(v, true)} icon={<TrendingUp className="h-4 w-4" />} index={0} />
            <StatCard label="Model Accuracy (R²)" value={forecast.accuracy} formatter={(v) => formatPercent(v)} index={1} />
            <StatCard label="Data Points" value={forecast.data.length} index={2} />
            <StatCard label="Model" value={0} formatter={() => forecast.model_description} index={3} />
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <GlassCard className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">Revenue Forecast — {forecast.timeframe}</p>
                  <p className="text-[12px] text-[var(--text-tertiary)]">Historical actuals + ML projected values</p>
                </div>
              </div>
              {forecast.data.length > 0 ? (
                <AreaChart
                  data={forecast.data.map((d) => ({
                    label: d.period,
                    value: d.actual > 0 ? d.actual : d.mlForecast,
                  }))}
                  color="#06b6d4"
                  prefix="$"
                />
              ) : (
                <p className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">
                  No data available for this forecast.
                </p>
              )}
            </GlassCard>
          </motion.div>

          {/* Model metrics */}
          {(forecast.mae != null || forecast.rmse != null) && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-6 grid gap-4 sm:grid-cols-3">
              {forecast.mae != null && <GlassCard className="p-5"><p className="text-[11px] text-[var(--text-tertiary)]">MAE</p><p className="text-xl font-medium text-[var(--text-primary)]">{formatCurrency(forecast.mae)}</p></GlassCard>}
              {forecast.rmse != null && <GlassCard className="p-5"><p className="text-[11px] text-[var(--text-tertiary)]">RMSE</p><p className="text-xl font-medium text-[var(--text-primary)]">{formatCurrency(forecast.rmse)}</p></GlassCard>}
              {forecast.r2 != null && <GlassCard className="p-5"><p className="text-[11px] text-[var(--text-tertiary)]">R² Score</p><p className="text-xl font-medium text-[var(--text-primary)]">{forecast.r2.toFixed(3)}</p></GlassCard>}
            </motion.div>
          )}
        </>
      ) : null}
    </DashboardLayout>
  );
}