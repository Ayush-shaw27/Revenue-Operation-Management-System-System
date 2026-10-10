'use client';

/** DashboardLayout — sidebar + topbar + animated page transitions. */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AmbientBackground from '@/components/ui/AmbientBackground';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function DashboardLayout({
  title,
  subtitle,
  children,
  className = '',
}: DashboardLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="h-10 w-10 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
          />
          <p className="text-sm text-[var(--text-tertiary)]">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      {/* Ambient animated backdrop. Sits at z-index 0, behind everything. */}
      <AmbientBackground />
      <Sidebar />
      <div className={cn('relative z-10 ml-[72px] sm:ml-[248px] min-h-screen transition-[margin] duration-300', className)}>
        <TopBar title={title} subtitle={subtitle} />
        <main className="px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}