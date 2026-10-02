'use client';

/** Admin — system stats, model registry, users, audit log (admin only). */
import { motion } from 'framer-motion';
import {
  Cpu, Database, Shield, Activity, Users, BrainCircuit, Gauge, Timer,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();
  const stats = useApi(() => api.adminStats());
  const models = useApi(() => api.adminModels());
  const users = useApi(() => api.listUsers());
  const activity = useApi(() => api.adminActivity());

  if (user && user.role !== 'admin') {
    return (
      <DashboardLayout title="Admin" subtitle="Administration">
        <GlassCard className="p-8 text-center">
          <p className="text-[14px] text-[var(--text-secondary)]">This area requires an admin account.</p>
        </GlassCard>
      </DashboardLayout>
    );
  }

  const s = stats.data;
  const modelEntries = models.data ? Object.values(models.data) : [];

  return (
    <DashboardLayout title="Admin" subtitle="System health, models, users, and audit trail">
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-[130px]" />)}
        </div>
      ) : stats.error ? (
        <GlassCard className="mb-6"><ErrorState onRetry={stats.load} message={stats.error.message} /></GlassCard>
      ) : s ? (
        <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Uptime" value={s.uptime_hours} formatter={(v) => `${v.toFixed(1)}h`} icon={<Timer className="h-4 w-4" />} index={0} />
          <StatCard label="CPU Usage" value={s.cpu_usage} formatter={(v) => `${v.toFixed(1)}%`} icon={<Cpu className="h-4 w-4" />} index={1} />
          <StatCard label="Memory Usage" value={s.memory_usage} formatter={(v) => `${v.toFixed(1)}%`} icon={<Database className="h-4 w-4" />} index={2} />
          <StatCard label="Active Users" value={s.active_users} icon={<Users className="h-4 w-4" />} index={3} />
          <StatCard label="Models Loaded" value={s.models_loaded} icon={<BrainCircuit className="h-4 w-4" />} index={4} />
          <StatCard label="Pipeline Value" value={s.pipeline_value} formatter={(v) => formatCurrency(v, true)} icon={<Gauge className="h-4 w-4" />} index={5} />
          <StatCard label="Total Leads" value={s.total_leads} formatter={formatNumber} icon={<Activity className="h-4 w-4" />} index={6} />
          <StatCard label="Total Deals" value={s.total_deals} formatter={formatNumber} icon={<Shield className="h-4 w-4" />} index={7} />
        </motion.div>
      ) : null}
<div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Model registry */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="p-5">
            <p className="mb-3 text-[13px] font-medium text-[var(--text-primary)]">Model Registry</p>
            {models.isLoading ? (
              <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            ) : models.error ? (
              <ErrorState onRetry={models.load} message={models.error.message} />
            ) : modelEntries.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-[var(--text-tertiary)]">No models registered yet.</p>
            ) : (
              <div className="space-y-2.5">
                {modelEntries.map((m) => (
                  <div key={m.name} className="flex items-center justify-between rounded-xl bg-[var(--card-hover)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">{m.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">v{m.version} · {m.kind}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-[var(--accent)]">{m.accuracy}%</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Users */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="p-5">
            <p className="mb-3 text-[13px] font-medium text-[var(--text-primary)]">Users</p>
            {users.isLoading ? (
              <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            ) : users.error ? (
              <ErrorState onRetry={users.load} message={users.error.message} />
            ) : users.data ? (
              <div className="space-y-2.5">
                {users.data.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl bg-[var(--card-hover)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">{u.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={u.role === 'admin' ? 'red' : u.role === 'manager' ? 'amber' : 'blue'}>{u.role}</Badge>
                      <Badge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </GlassCard>
        </motion.div>
      </div>

      {/* Audit log */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <GlassCard className="overflow-hidden p-0">
          <div className="p-5 pb-3">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">Audit Log</p>
          </div>
          {activity.isLoading ? (
            <SkeletonTable rows={4} />
          ) : activity.error ? (
            <ErrorState onRetry={activity.load} message={activity.error.message} />
          ) : activity.data && activity.data.activity.length > 0 ? (
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[var(--card)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">User</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">Action</th>
                    <th className="hidden px-5 py-2.5 text-[11px] font-semibold uppercase text-[var(--text-tertiary)] sm:table-cell">Resource</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase text-[var(--text-tertiary)]">When</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.data.activity.slice(0, 12).map((a) => (
                    <tr key={a.id} className="border-b border-[var(--border)]/40">
                      <td className="px-5 py-2.5 text-[12.5px] text-[var(--text-primary)]">{a.user}</td>
                      <td className="px-5 py-2.5 text-[12.5px] text-[var(--text-secondary)]">{a.action}</td>
                      <td className="hidden px-5 py-2.5 text-[12px] text-[var(--text-tertiary)] sm:table-cell">{a.resource}</td>
                      <td className="px-5 py-2.5 text-[12px] text-[var(--text-tertiary)]">{formatDate(a.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 pb-6 pt-3 text-center text-[12.5px] text-[var(--text-tertiary)]">No audit entries yet.</p>
          )}
        </GlassCard>
      </motion.div>
    </DashboardLayout>
  );
}