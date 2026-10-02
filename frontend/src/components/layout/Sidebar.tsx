'use client';

/** Sidebar — animated navigation for the authenticated dashboard. */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Handshake, TrendingUp, Bot, Bell, Shield, ChevronLeft,
  Building2, BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: Handshake },
  { href: '/dashboard/accounts', label: 'Accounts', icon: Building2 },
  { href: '/dashboard/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/copilot', label: 'AI Copilot', icon: Bot, badge: 'AI' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { href: '/dashboard/admin', label: 'Admin', icon: Shield, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === 'admin',
  );

  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] backdrop-blur-xl transition-[width] duration-300',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4 sm:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
          <span className="text-sm font-bold">R</span>
        </div>
        {!collapsed && (
          <Link href="/dashboard" className="text-[17px] font-medium tracking-tight text-[var(--text-primary)]">
            RevOps Pro
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="ml-auto rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mx-auto mb-2 rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--card-hover)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
{/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item, i) => {
            const active =
              pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <motion.li
                key={item.href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
                    active
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)]"
                      transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                    />
                  )}
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className="ml-auto rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[var(--accent)]">
                      {item.badge}
                    </span>
                  )}
                  {collapsed && item.badge && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2 text-[var(--text-secondary)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-violet-500 text-[12px] font-semibold text-white">
            {user ? initials(user.name) : 'U'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{user?.name}</p>
              <p className="truncate text-[11px] capitalize text-[var(--text-tertiary)]">{user?.role}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-500"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}