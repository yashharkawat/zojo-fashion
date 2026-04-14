'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { EmberParticles } from './EmberParticles';

/**
 * Cinematic hero: full-bleed dark banner with a warrior visual (swap the
 * background image for your licensed asset), animated headline, and ember
 * particle field. Uses CSS gradients + noise for that filmic, premium feel.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label="Featured drop"
      // Use svh for stable mobile viewport (iOS URL bar no-jump); fall back to vh
      className="relative h-[92vh] h-[92svh] min-h-[560px] w-full overflow-hidden bg-bg-base grain vignette"
    >
      {/* Background visual — swap for licensed anime warrior key-art.
          Using a dark cinematic gradient as placeholder so it looks great
          out of the box. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(255,69,0,0.28),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(139,26,0,0.35),transparent_60%),linear-gradient(180deg,#0A0A0A_0%,#1A0500_55%,#0A0A0A_100%)]"
      />

      {/* Slanted highlight — katana-like streak */}
      <div
        aria-hidden
        className="absolute -left-1/4 top-0 h-full w-[180%] rotate-[-12deg] bg-[linear-gradient(90deg,transparent_0%,rgba(255,69,0,0.06)_48%,rgba(255,255,255,0.04)_50%,rgba(255,69,0,0.06)_52%,transparent_100%)]"
      />

      {/* Ember particles */}
      <EmberParticles className="absolute inset-0 h-full w-full" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col items-start justify-end px-4 pb-16 md:justify-center md:pb-0">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.25em] text-accent backdrop-blur-sm"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          New Drop · Limited
        </motion.p>

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-[22vw] leading-[0.8] tracking-tight text-fg-primary md:text-[13vw] lg:text-[11rem]"
        >
          WEAR THE <span className="text-ember">BOLD</span>
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-5 max-w-md text-base leading-relaxed text-fg-secondary md:text-lg"
        >
          Premium anime streetwear, printed in India. For the ones who wear
          their fandom with a straight face.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <Link
            href="/products"
            className="
              group relative inline-flex items-center gap-2
              rounded-lg bg-accent px-7 py-3.5 font-semibold uppercase
              tracking-widest text-white shadow-glow
              transition-all duration-300
              hover:bg-accent-hover hover:shadow-glow-lg hover:scale-[1.02]
              active:scale-[0.98]
            "
          >
            Shop Now
            <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/products?sort=-createdAt"
            className="inline-flex items-center gap-2 rounded-lg border border-bg-border/80 bg-black/30 px-6 py-3.5 text-sm font-semibold uppercase tracking-widest text-fg-primary backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
          >
            New Drops
          </Link>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 text-xs uppercase tracking-widest text-fg-muted md:flex"
      >
        <span>Scroll</span>
        <span className="block h-px w-10 bg-fg-muted" />
      </motion.div>
    </section>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
