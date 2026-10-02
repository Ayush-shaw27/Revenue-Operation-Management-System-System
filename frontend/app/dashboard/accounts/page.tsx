'use client';

/** Accounts - customer account list with health scores, KPIs, search, and CSV export. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Search, AlertTriangle, DollarSign, Heart, Download, Inbox,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatNumber } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import type { Account } from '@/api/types';

export default function AccountsPage() {
  const { data: accounts, isLoading, error, load } = useApi<Account[]>(() => api.listAccounts());
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (!accounts) return [];
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (healthFilter !== 'all') {
        if (healthFilter === 'at-risk' && a.health_score >= 50) return false;
        if (healthFilter === 'healthy' && a.health_score < 50) return false;
        if (healthFilter === 'renewal-soon' && a.renewal_in_days > 90) return false;
      }
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.industry.toLowerCase().includes(q);
    });
  }, [accounts, query, healthFilter]);

  const totalValue = filtered.reduce((s, a) => s + a.contract_value, 0);
  const atRiskCount = accounts?.filter((a) => a.health_score < 50).length ?? 0;
  const avgHealth = accounts
    ? accounts.reduce((s, a) => s + a.health_score, 0) / (accounts.length || 1)
    : 0;

  function exportCSV() {
    if (!filtered.length) return;
    const headers = ['Name','Industry','Contract Value','Health Score','Last Activity (d)','Tickets','Renewal In (d)'];
    const rows = filtered.map((a) => [a.name, a.industry, a.contract_value, a.health_score, a.last_activity_days, a.ticket_count, a.renewal_in_days]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'accounts.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const subtitle = filtered.length + ' accounts | ' + formatCurrency(totalValue, true) + ' total value';

  return (
    <DashboardLayout title="Accounts" subtitle={subtitle}>
      {/* KPI row */}
      <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Accounts" value={accounts?.length ?? 0} formatter={formatNumber} icon={<Building2 className="h-4 w-4" />} index={0} />
        <StatCard label="Total Contract Value" value={totalValue} formatter={(v) => formatCurrency(v, true)} icon={<DollarSign className="h-4 w-4" />} index={1} />
        <StatCard label="Avg Health Score" value={avgHealth} formatter={(v) => v.toFixed(1)} icon={<Heart className="h-4 w-4" />} index={2} />
        <StatCard label="At-Risk Accounts" value={atRiskCount} icon={<AlertTriangle className="h-4 w-4" />} delta={atRiskCount > 0 ? -1 : 0} deltaInverted index={3} />
      </motion.div>

      {/* Filter bar */}
      <motion.div variants={STAGGER.container} initial="hidden" animate="show" className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, industry..."
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
          />
        </div>
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
        >
          <option value="all">All accounts</option>
          <option value="healthy">Healthy (score 50+)</option>
          <option value="at-risk">At-risk (score below 50)</option>
          <option value="renewal-soon">Renewal within 90 days</option>
        </select>
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </motion.div>

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <GlassCard><ErrorState onRetry={load} message={error.message} /></GlassCard>
      ) : !accounts || accounts.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="No accounts yet" message="Accounts will appear here once they are created from deals." />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="No accounts match your filters" />
        </GlassCard>
      ) : (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]/50">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Account</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Industry</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Contract</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Health</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Last Activity</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Tickets</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((account, i) => (
                    <AccountRow key={account.id} account={account} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </DashboardLayout>
  );
}

function AccountRow({ account, index }: { account: Account; index: number }) {
  const healthColor = account.health_score >= 70 ? '#10b981' : account.health_score >= 50 ? '#f59e0b' : '#ef4444';
  const healthTone = account.health_score >= 70 ? 'green' : account.health_score >= 50 ? 'amber' : 'red';
  const renewalTone = account.renewal_in_days <= 30 ? 'red' : account.renewal_in_days <= 90 ? 'amber' : 'green';

  return (
    <motion.tr
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.04 }}
      className="group border-b border-[var(--border)]/60 transition-colors hover:bg-[var(--card-hover)]/60"
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[11px] font-semibold text-[var(--accent)]">
            {account.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">{account.name}</span>
        </div>
      </td>
      <td className="px-5 py-3.5"><Badge tone="cyan">{account.industry}</Badge></td>
      <td className="px-5 py-3.5 text-[13px] font-medium text-[var(--text-primary)]">{formatCurrency(account.contract_value, true)}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--card-hover)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: Math.min(account.health_score, 100) + '%' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 + index * 0.05 }}
              className="h-full rounded-full"
              style={{ backgroundColor: healthColor }}
            />
          </div>
          <Badge tone={healthTone}>{account.health_score.toFixed(0)}</Badge>
        </div>
      </td>
      <td className="px-5 py-3.5 text-[12px] text-[var(--text-tertiary)]">{account.last_activity_days}d ago</td>
      <td className="px-5 py-3.5 text-[13px] text-[var(--text-secondary)]">{account.ticket_count}</td>
      <td className="px-5 py-3.5"><Badge tone={renewalTone}>{account.renewal_in_days}d</Badge></td>
    </motion.tr>
  );
}