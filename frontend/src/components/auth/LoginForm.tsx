'use client';

/** Login — animated, motion-first login screen (dark, glass, cursor-reactive). */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fadeUp, useReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { damping: 20, stiffness: 160 });
  const sy = useSpring(my, { damping: 20, stiffness: 160 });
  const [spot, setSpot] = useState({ x: 50, y: 50, visible: false });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    mx.set(x / 100);
    my.set(y / 100);
    setSpot({ x, y, visible: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        document.getElementById('login-submit')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#080A19] px-4"
      onMouseMove={handleMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, visible: false }))}
    >
      {/* Animated ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[160px]" />
        <motion.div
          animate={reduced ? {} : { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
          className="absolute left-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-[#06b6d4]/10 blur-[100px]"
        />
        <motion.div
          animate={reduced ? {} : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 15, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-1/4 right-1/4 h-[280px] w-[280px] rounded-full bg-violet-500/10 blur-[110px]"
        />
      </div>

      {/* Brand */}
      <motion.div
        variants={fadeUp}
        initial={reduced ? false : 'hidden'}
        animate="show"
        className="relative z-10 mb-8 flex items-center gap-2.5"
      >
        <svg width="30" height="30" viewBox="0 0 256 256" fill="none">
          <path d="M 256 256 L 178 256 C 150.386 256 128 233.614 128 206 L 128 256 L 0 256 L 0 192 C 0 156.654 28.654 128 64 128 C 99.346 128 128 156.654 128 192 L 128 128 L 256 128 Z M 78 0 C 105.614 0 128 22.386 128 50 L 128 0 L 256 0 L 256 64 C 256 99.346 227.346 128 192 128 C 156.654 128 128 99.346 128 64 L 128 128 L 0 128 L 0 0 Z" fill="white" />
        </svg>
        <span className="text-[24px] font-medium tracking-[-0.02em] text-white">RevOps Pro</span>
      </motion.div>
      {/* Glass card with cursor spotlight */}
      <motion.div
        variants={fadeUp}
        initial={reduced ? false : 'hidden'}
        animate="show"
        className="relative z-10 w-full max-w-[420px]"
      >
        <div
          className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[rgba(17,16,15,0.4)] p-8 backdrop-blur-[24px] sm:p-10"
          style={{
            background: spot.visible
              ? `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.05), rgba(17,16,15,0.5) 65%)`
              : 'rgba(17,16,15,0.45)',
          }}
        >
          <div className="mb-8">
            <motion.h1 initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="text-[26px] font-medium tracking-[-0.01em] text-white">Welcome back</motion.h1>
            <motion.p initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mt-1.5 text-[14px] font-[450] leading-relaxed text-white/60">Sign in to your workspace to continue.</motion.p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-400" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-[450] text-white/50">Email</label>
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-white/70" />
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-[46px] w-full rounded-[12px] border border-white/[0.08] bg-white/[0.04] pl-10 pr-3.5 text-[14px] text-white placeholder:text-white/25 outline-none transition-all duration-200 focus:border-[#06b6d4]/40 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#06b6d4]/15" />
              </div>
            </motion.div>

            <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-[450] text-white/50">Password</label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-white/70" />
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-[46px] w-full rounded-[12px] border border-white/[0.08] bg-white/[0.04] pl-10 pr-11 text-[14px] text-white placeholder:text-white/25 outline-none transition-all duration-200 focus:border-[#06b6d4]/40 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#06b6d4]/15" />
                <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide' : 'Show'} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/70">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="pt-2">
              <motion.button id="login-submit" type="submit" disabled={loading} whileHover={reduced ? undefined : { scale: 1.015 }} whileTap={reduced ? undefined : { scale: 0.98 }} className={cn('flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#E9E9E9] text-[14px] font-[450] text-[#0A0707] transition-all', loading ? 'opacity-60' : 'hover:bg-white', 'disabled:pointer-events-none')}>
                {loading ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="h-4 w-4 rounded-full border-2 border-[#0A0707]/30 border-t-[#0A0707]" />
                ) : (<><span>Sign in</span><ArrowRight className="h-4 w-4" /></>)}
              </motion.button>
            </motion.div>
          </form>

          <motion.p initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.5 }} className="mt-6 text-center text-[12.5px] text-white/40">Need access? Contact your administrator.</motion.p>
        </div>
      </motion.div>

      <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="relative z-10 mt-8">
        <Link href="/" className="text-[12.5px] text-white/40 hover:text-white/80">← Back to home</Link>
      </motion.div>
      <motion.p initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }} className="relative z-10 mt-6 text-[11px] tracking-wide text-white/25">SECURE ENTERPRISE ACCESS · AES-256 · SOC 2 TYPE II</motion.p>
    </div>
  );
}