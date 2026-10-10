'use client';

/**
 * AmbientBackground — the animated backdrop behind the dashboard shell.
 *
 * Why it is CSS and not framer-motion: this layer animates forever, so any JS
 * driving it would re-render on every frame. Keyframes on `transform`/`opacity`
 * run on the compositor instead, and cost nothing while the user reads.
 *
 * Accessibility and safety:
 * - `pointer-events-none` + `z-index: 0`, so it can never swallow a click or
 *   sit above a card.
 * - `aria-hidden`, since it conveys nothing to a screen reader.
 * - `prefers-reduced-motion` is handled globally in index.css and freezes all
 *   of these animations, so this component honours it without extra code.
 */
export default function AmbientBackground() {
  return (
    <div className="revops-bg" aria-hidden="true">
      {/* Drifting colour wash */}
      <div
        className="revops-bg__orb"
        style={{
          top: '-14%',
          left: '-8%',
          width: 560,
          height: 560,
          background:
            'radial-gradient(circle, rgba(6,182,212,0.16) 0%, rgba(6,182,212,0) 70%)',
          animation: 'drift-slow 24s ease-in-out infinite',
        }}
      />
      <div
        className="revops-bg__orb"
        style={{
          top: '18%',
          right: '-12%',
          width: 640,
          height: 640,
          background:
            'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0) 70%)',
          animation: 'drift-slower 31s ease-in-out infinite',
        }}
      />
      <div
        className="revops-bg__orb"
        style={{
          bottom: '-20%',
          left: '28%',
          width: 520,
          height: 520,
          background:
            'radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0) 70%)',
          animation: 'drift-slow 37s ease-in-out infinite reverse',
        }}
      />

      {/* Faint grid, slowly panning */}
      <div className="revops-bg__grid" />

      {/* Concentric pulse, top-right */}
      <div
        className="revops-bg__ring"
        style={{ top: '-140px', right: '-140px', width: 420, height: 420 }}
      />
      <div
        className="revops-bg__ring"
        style={{
          top: '-60px',
          right: '-60px',
          width: 260,
          height: 260,
          animationDelay: '-7s',
          borderColor: 'rgba(167,139,250,0.5)',
        }}
      />

      {/* Light sweep */}
      <div className="revops-bg__beam" />
    </div>
  );
}