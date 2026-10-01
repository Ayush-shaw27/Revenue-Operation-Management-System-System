'use client';

/** CommandPalette — Cmd/Ctrl+K quick jump between screens + quick actions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Handshake, TrendingUp, Bot, Bell, Shield, ArrowRight, Search,
  Building2, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const COMMANDS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, keywords: 'home dashboard overview kpi' },
  { label: 'Leads', href: '/dashboard/leads', icon: Users, keywords: 'lead crm contact pipeline' },
  { label: 'Pipeline / Deals', href: '/dashboard/pipeline', icon: Handshake, keywords: 'deal stage revenue pipeline' },
  { label: 'Accounts', href: '/dashboard/accounts', icon: Building2, keywords: 'account customer health churn renewal' },
  { label: 'Forecast', href: '/dashboard/forecast', icon: TrendingUp, keywords: 'revenue forecast predict ml' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, keywords: 'analytics funnel cohort trends revenue chart' },
  { label: 'AI Copilot', href: '/dashboard/copilot', icon: Bot, keywords: 'ai ask question insights chat' },
  { label: 'Alerts', href: '/dashboard/alerts', icon: Bell, keywords: 'alert notification anomaly risk' },
  { label: 'Admin', href: '/dashboard/admin', icon: Shield, keywords: 'admin users models settings stats' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    // NOTE: the Cmd/Ctrl+K shortcut is owned by TopBar (it toggles `open`).
    // This component only reacts to Escape so the two never fight over state.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q),
    );
  }, [query]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, filtered.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            }
            if (e.key === 'Enter' && filtered[selected]) {
              go(filtered[selected].href);
            }
          }}
        >
          <motion.div
            initial={{ y: -12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
              <Search className="h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to leads, deals, reports…"
                className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">ESC</kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[13px] text-[var(--text-tertiary)]">
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.href}
                    onClick={() => go(cmd.href)}
                    onMouseEnter={() => setSelected(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] transition-colors',
                      selected === i
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'text-[var(--text-secondary)]',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{cmd.label}</span>
                    <ArrowRight
                      className={cn(
                        'h-3.5 w-3.5 transition-opacity',
                        selected === i ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}