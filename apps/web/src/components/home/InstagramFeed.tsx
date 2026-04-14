'use client';

import { motion, useReducedMotion } from 'framer-motion';

export interface InstaPost {
  id: string;
  imageUrl: string;
  permalink: string;
  caption?: string;
  isVideo?: boolean;
}

/**
 * Instagram grid section. Pass real posts (fetched via Instagram Basic Display API
 * or oEmbed, cached server-side 1h). Falls back to a placeholder grid if empty.
 */
export function InstagramFeed({ posts = [] }: { posts?: InstaPost[] }) {
  const reduce = useReducedMotion();
  const tiles = posts.length > 0 ? posts : placeholderPosts();

  return (
    <section
      aria-label="Follow us on Instagram"
      className="mx-auto max-w-7xl px-4 py-12 md:py-16"
    >
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mb-8 flex items-end justify-between gap-4"
      >
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-accent">
            @zojo.fashion
          </p>
          <h2 className="font-display text-4xl tracking-tight text-fg-primary md:text-5xl">
            As seen on the gram
          </h2>
        </div>
        <a
          href="https://instagram.com/zojo.fashion"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-bg-border bg-bg-elevated px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-fg-primary transition-all hover:border-accent hover:text-accent"
        >
          <InstaIcon className="h-4 w-4" />
          Follow
        </a>
      </motion.header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 md:gap-3">
        {tiles.slice(0, 6).map((post, i) => (
          <motion.a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="group relative aspect-square overflow-hidden rounded-lg bg-bg-elevated"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt={post.caption ?? 'Instagram post'}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
            >
              <InstaIcon className="h-6 w-6 text-white drop-shadow" />
            </div>
            {post.isVideo && (
              <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                REEL
              </span>
            )}
          </motion.a>
        ))}
      </div>
    </section>
  );
}

function placeholderPosts(): InstaPost[] {
  return Array.from({ length: 6 }).map((_, i) => ({
    id: `ph-${i}`,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='#141414'/><text x='50%' y='50%' fill='#FF4500' font-family='sans-serif' font-size='22' text-anchor='middle' dy='.35em'>@zojo.fashion</text></svg>`,
    )}`,
    permalink: 'https://instagram.com/zojo.fashion',
    caption: 'Zojo drop',
    isVideo: i % 2 === 0,
  }));
}

function InstaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
