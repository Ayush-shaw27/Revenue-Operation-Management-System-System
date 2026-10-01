'use client';

/**
 * TopBar — sticky dashboard header: page title, live backend status,
 * theme toggle, unread-alert bell, command palette and account menu.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Search, Sun, Moon, ChevronDown, LogOut, Shield } from 'lucide-react';
import BackendConnectionBadge from './BackendConnectionBadge';
import { CommandPalette } from './CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/api/client';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

const ALERT_POLL_MS = 60_000;

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [unread, setUnread] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---- Unread alert count (polled, failures ignored) ----------------------
  const refreshUnread = useCallback(async () => {
    try {
      const res = await api.unreadAlertCount();
      setUnread(res.count ?? 0);
    } catch {
      // Offline or unauthenticated — keep the last known count.
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), ALERT_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  // ---- Cmd/Ctrl+K toggles the command palette -----------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Dismiss the account menu on outside click / Escape -----------------
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[12px] text-[var(--text-tertiary)]">{subtitle}</p>
            )}
          </div>
          {/* Command palette trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[12.5px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--text-secondary)] md:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <BackendConnectionBadge />

          <Link
            href="/dashboard/alerts"
            aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9.5px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>

          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          {/* Account menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="flex items-center gap-1.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-[var(--card-hover)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-violet-500 text-[11.5px] font-semibold text-white">
                {user ? initials(user.name) : 'U'}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform duration-200',
                  menuOpen && 'rotate-180',
                )}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-56 origin-top-right overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
                >
                  <div className="border-b border-[var(--border)] px-4 py-3">
                    <p className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                      {user?.name ?? 'Signed in'}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--text-tertiary)]">{user?.email}</p>
                    {user?.role && (
                      <span className="mt-1.5 inline-block rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-[var(--accent)]">
                        {user.role}
                      </span>
                    )}
                  </div>

                  {user?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push('/dashboard/admin');
                      }}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]"
                    >
                      <Shield className="h-4 w-4" />
                      Admin console
                    </button>
                  )}

                  <button
                    onClick={logout}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

