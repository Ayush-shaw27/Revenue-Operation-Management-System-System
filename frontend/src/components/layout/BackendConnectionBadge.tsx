'use client';

/**
 * BackendConnectionBadge — live reachability indicator for the FastAPI backend.
 * Surfaces an explicit "can't reach server" state instead of silently failing,
 * so a stopped backend is never mistaken for empty data.
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plug, PlugZap } from 'lucide-react';
import { api } from '@/api/client';
import { cn } from '@/lib/cn';

type Status = 'checking' | 'online' | 'offline';

const POLL_MS = 15_000;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function BackendConnectionBadge() {
  const [status, setStatus] = useState<Status>('checking');
  const [detail, setDetail] = useState<string | null>(null);

  const check = useCallback(async () => {
    setStatus('checking');
    try {
      const health = await api.health();
      setStatus('online');
      setDetail(`v${health.version} · ${health.models_loaded ? 'models loaded' : 'models idle'}`);
    } catch {
      setStatus('offline');
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => window.clearInterval(id);
  }, [check]);

  const config = {
    checking: {
      label: 'Checking backend',
      dot: 'bg-amber-400',
      text: 'text-amber-400',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      pulse: false,
    },
    online: {
      label: detail ?? 'Backend online',
      dot: 'bg-emerald-400',
      text: 'text-emerald-400',
      icon: <PlugZap className="h-3 w-3" />,
      pulse: true,
    },
    offline: {
      label: "Can't reach server",
      dot: 'bg-red-500',
      text: 'text-red-400',
      icon: <Plug className="h-3 w-3" />,
      pulse: false,
    },
  }[status];

  return (
    <button
      onClick={() => void check()}
      title={
        status === 'offline'
          ? `Backend unreachable at ${API_BASE}. Click to retry.`
          : `Backend at ${API_BASE} — click to re-check.`
      }
      aria-label={`${config.label}. Click to re-check backend status.`}
      className={cn(
        'flex max-w-[180px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--card-hover)]',
        config.text,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {config.pulse && (
          <motion.span
            className={cn('absolute inline-flex h-full w-full rounded-full opacity-70', config.dot)}
            animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', config.dot)} />
      </span>
      {config.icon}
      <span className="truncate">{config.label}</span>
    </button>
  );
}

