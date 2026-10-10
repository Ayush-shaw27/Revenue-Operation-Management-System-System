'use client';

/** AI Copilot — natural-language query bar grounded in real pipeline data. */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Sparkles, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlassCard from '@/components/ui/GlassCard';
import { api, ApiError } from '@/api/client';
import { fadeUp } from '@/lib/motion';
import type { CopilotResponse } from '@/api/types';

const SUGGESTIONS = [
  'What is our current pipeline health?',
  'Show me the forecast for next quarter',
  'Which deals are at risk?',
  'What is our win rate?',
  'How are leads converting?',
];

export default function CopilotPage() {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Array<{ q: string; r: CopilotResponse }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function handleSend(q?: string) {
    const question = q || query.trim();
    if (!question) return;
    setQuery('');
    setError(null);
    setLoading(true);
    try {
      const res = await api.copilotAsk(question);
      setHistory((h) => [...h, { q: question, r: res }]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : err instanceof Error ? err.message : 'Request failed',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout title="AI Copilot" subtitle="Ask anything about your pipeline, backed by real data">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 space-y-4">
          <AnimatePresence mode="popLayout">
            {history.map((item, i) => (
              <motion.div key={i} variants={fadeUp} initial="hidden" animate="show" layout className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-[13.5px] font-medium text-white">
                    {item.q}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-violet-500 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <GlassCard variant="elevated" className="max-w-[85%] px-4 py-3">
                    <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">{item.r.answer}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--text-tertiary)]">
                      <span className="rounded-md bg-[var(--card-hover)] px-1.5 py-0.5">{item.r.provider}</span>
                      {item.r.model && <span className="rounded-md bg-[var(--card-hover)] px-1.5 py-0.5">{item.r.model}</span>}
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-violet-500 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <GlassCard variant="elevated" className="px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
              </GlassCard>
            </motion.div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-400">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only when empty) */}
        {history.length === 0 && !loading && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { void handleSend(s); }}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]"
              >
                <Sparkles className="mr-1.5 inline h-3 w-3 text-[var(--accent)]" />
                {s}
              </button>
            ))}
          </motion.div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 transition-colors focus-within:border-[var(--accent)]"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about pipeline, revenue, leads, churn…"
            disabled={loading}
            className="flex-1 bg-transparent px-2.5 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <motion.button
            type="submit"
            disabled={loading || !query.trim()}
            whileTap={{ scale: 0.94 }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-opacity hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </form>
        <p className="mt-2 text-center text-[11px] text-[var(--text-tertiary)]">
          Answers are grounded in your live data. Powered by Grok (xAI).
        </p>
      </div>
    </DashboardLayout>
  );
}