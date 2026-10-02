'use client';

/** CreateLeadModal — glass modal for creating a new lead (real API call). */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import { api } from '@/api/client';
import Button from '@/components/ui/Button';

interface CreateLeadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SOURCES = ['Website', 'LinkedIn', 'Referral', 'Email Campaign', 'Cold Outreach', 'Event'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];
const SIZES = ['Startup', 'Mid-Market', 'Enterprise'];

export default function CreateLeadModal({ open, onClose, onCreated }: CreateLeadModalProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'Website',
    value: 25000,
    industry: 'Technology',
    company_size: 'Mid-Market',
    touchpoints: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createLead(form);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create lead');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]';
  const labelCls = 'mb-1.5 block text-[12px] font-medium text-[var(--text-tertiary)]';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-[540px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">Add new lead</p>
                  <p className="text-[11.5px] text-[var(--text-tertiary)]">AI scoring runs on creation</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
<form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
              {error && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-500">{error}</div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Full name *</label>
                  <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Smith" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Company *</label>
                  <input required value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Acme Corp" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@acme.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 1234" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Source</label>
                  <select value={form.source} onChange={(e) => set('source', e.target.value)} className={inputCls}>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Deal value ($)</label>
                  <input type="number" min={0} step={1000} value={form.value} onChange={(e) => set('value', Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Industry</label>
                  <select value={form.industry} onChange={(e) => set('industry', e.target.value)} className={inputCls}>
                    {INDUSTRIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Company size</label>
                  <select value={form.company_size} onChange={(e) => set('company_size', e.target.value)} className={inputCls}>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Scoring…' : 'Create lead'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}