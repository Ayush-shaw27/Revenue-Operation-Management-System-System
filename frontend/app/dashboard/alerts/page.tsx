'use client';

/** Alerts — anomaly/risk notification feed fed by the real anomaly detector. */
import { motion } from 'framer-motion';
import { Bell, AlertTriangle, CheckCheck, RefreshCcw, ShieldAlert, Clock } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import Badge from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { timeAgo } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import type { Alert } from '@/api/types';

export default function AlertsPage() {
  const { data: alerts, isLoading, error, load } = useApi<Alert[]>(() => api.listAlerts());

  const severityIcon = (severity: string) =>
    severity === 'high' ? <AlertTriangle className="h-4 w-4" /> : severity === 'medium' ? <ShieldAlert className="h-4 w-4" /> : <Bell className="h-4 w-4" />;

  return (
    <DashboardLayout title="Alerts" subtitle="Anomalies, risk crossings, and stalled deals">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text-secondary)]">
          {alerts?.filter((a) => !a.read).length ?? 0} unread {alerts?.filter((a) => !a.read).length === 1 ? 'alert' : 'alerts'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button variant="ghost" size="sm" onClick={() => void api.markAllAlertsRead().then(load)}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <GlassCard><ErrorState onRetry={load} message={error.message} /></GlassCard>
      ) : !alerts || alerts.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Bell className="h-6 w-6" />} title="All clear" message="No alerts right now. Anomaly detection is running continuously." />
        </GlassCard>
      ) : (
        <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="space-y-2.5">
          {alerts.map((alert, i) => (
            <motion.button
              key={alert.id}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: i * 0.05 }}
              onClick={() => void api.markAlertRead(alert.id).then(load)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                alert.read
                  ? 'border-[var(--border)] bg-[var(--card)]/50 opacity-60'
                  : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  alert.severity === 'high'
                    ? 'bg-red-500/10 text-red-500'
                    : alert.severity === 'medium'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-blue-500/10 text-blue-500'
                }`}>
                  {severityIcon(alert.severity)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-medium text-[var(--text-primary)]">{alert.entity_name}</p>
                    <Badge tone={alert.severity === 'high' ? 'red' : alert.severity === 'medium' ? 'amber' : 'blue'}>
                      {alert.kind.replace(/_/g, ' ')}
                    </Badge>
                    {!alert.read && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{alert.summary}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                    <Clock className="h-3 w-3" /> {timeAgo(alert.created_at)}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </DashboardLayout>
  );
}