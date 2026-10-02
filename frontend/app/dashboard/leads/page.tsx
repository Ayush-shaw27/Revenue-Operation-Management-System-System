'use client';

/** Leads — data table with AI scoring, filterable, with create dialog. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, Users, Building2, Zap, BarChart3, Inbox,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import Badge, { ScoreBadge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api/client';
import { formatCurrency, formatDate, STAGE_LABELS, STAGE_COLORS } from '@/lib/format';
import { STAGGER, fadeUp } from '@/lib/motion';
import type { Lead } from '@/api/types';
import CreateLeadModal from '@/components/leads/CreateLeadModal';

export default function LeadsPage() {
  const { data: leads, isLoading, error, load } = useApi<Lead[]>(() => api.listLeads());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!leads) return [];
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.ai_label || '').toLowerCase().includes(q)
      );
    });
  }, [leads, query, statusFilter]);

  return (
    <DashboardLayout title="Leads" subtitle="Your pipeline of potential customers">
      {/* Filter bar */}
      <motion.div
        variants={STAGGER.container}
        initial="hidden"
        animate="show"
        className="mb-5 flex flex-wrap items-center gap-3"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, email…"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
        >
          <option value="all">All statuses</option>
          {Object.entries(STAGE_COLORS).map(([k, v]) => (
            <option key={k} value={k}>{STAGE_LABELS[k] || k}</option>
          ))}
        </select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add Lead
        </Button>
      </motion.div>
{isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <GlassCard><ErrorState onRetry={load} message={error.message} /></GlassCard>
      ) : !leads || leads.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No leads yet"
            message="Create your first lead to start scoring and tracking."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add Lead</Button>}
          />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matching leads"
            message="Try adjusting your search or filters."
          />
        </GlassCard>
      ) : (
        <motion.div variants={STAGGER.container} initial="hidden" animate="show">
          <GlassCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]/50">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Lead</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Company</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Value</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Status</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">AI Score</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Source</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, i) => (
                    <LeadRow key={lead.id} lead={lead} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      )}

      <CreateLeadModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />
    </DashboardLayout>
  );
}

function LeadRow({ lead, index }: { lead: Lead; index: number }) {
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
            {lead.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{lead.name}</p>
            <p className="truncate text-[11px] text-[var(--text-tertiary)]">{lead.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
          <Building2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          {lead.company}
        </span>
      </td>
      <td className="px-5 py-3.5 text-[13px] font-medium text-[var(--text-primary)]">{formatCurrency(lead.value, true)}</td>
      <td className="px-5 py-3.5"><Badge tone="blue">{STAGE_LABELS[lead.status] || lead.status}</Badge></td>
      <td className="px-5 py-3.5">
        {lead.ai_score !== null && lead.ai_score !== undefined ? (
          <ScoreBadge score={lead.ai_score} />
        ) : (
          <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className="px-5 py-3.5"><Badge tone="cyan">{lead.source}</Badge></td>
      <td className="px-5 py-3.5 text-[12px] text-[var(--text-tertiary)]">{formatDate(lead.created_at)}</td>
    </motion.tr>
  );
}