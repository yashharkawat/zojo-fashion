'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null };
}

function Stars({ value, interactive = false, onChange }: { value: number; interactive?: boolean; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? 'button' : undefined}
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={cn(
            'text-xl leading-none',
            (hover || value) >= star ? 'text-warn' : 'text-bg-border',
            interactive && 'cursor-pointer transition-colors hover:scale-110',
          )}
          aria-label={interactive ? `Rate ${star} stars` : undefined}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(user: Review['user']) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || 'Anonymous';
}

export function ReviewSection({ slug, avgRating, reviewCount }: { slug: string; avgRating: number | null; reviewCount: number }) {
  const { isAuthenticated } = useAuth();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(reviewCount);
  const [loading, setLoading] = useState(true);

  // Form state
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/products/${encodeURIComponent(slug)}/reviews?pageSize=20`)
      .then((r) => r.json() as Promise<{ data: Review[]; meta: { total: number } }>)
      .then(({ data, meta }) => {
        setReviews(data);
        setTotal(meta.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase, slug]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setSubmitError('Please select a rating'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${apiBase}/products/${encodeURIComponent(slug)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, title: title || undefined, body: body || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? 'Could not submit review');
      }
      setSubmitted(true);
      setRating(0); setTitle(''); setBody('');
      load();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-14 border-t border-bg-border pt-10">
      <div className="flex flex-wrap items-end gap-4">
        <h2 className="font-display text-2xl tracking-tight text-fg-primary">Reviews</h2>
        {avgRating !== null && total > 0 && (
          <span className="mb-0.5 flex items-center gap-1.5 text-sm text-fg-secondary">
            <span className="text-warn text-base">★</span>
            <strong className="text-fg-primary">{avgRating.toFixed(1)}</strong>
            <span className="text-fg-muted">({total})</span>
          </span>
        )}
      </div>

      {/* Write a review */}
      <div className="mt-6 rounded-xl border border-bg-border bg-bg-elevated p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-fg-secondary">
          Write a review
        </h3>
        {!isAuthenticated ? (
          <p className="text-sm text-fg-muted">
            <a href="/login" className="text-accent underline underline-offset-2">Login</a> to leave a review.
          </p>
        ) : submitted ? (
          <p className="text-sm text-[#22c55e]">Thanks for your review! It&apos;s now live.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-fg-muted">Your rating</label>
              <Stars value={rating} interactive onChange={setRating} />
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              maxLength={120}
              className="h-10 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts… (optional)"
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-lg border border-bg-border bg-bg-base px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {submitError && <p className="text-xs text-danger">{submitError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-lg bg-accent px-6 text-sm font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </form>
        )}
      </div>

      {/* Review list */}
      <div className="mt-6 space-y-4">
        {loading ? (
          [1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-bg-elevated" />)
        ) : reviews.length === 0 ? (
          <p className="text-sm text-fg-muted">No reviews yet. Be the first!</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-bg-border bg-bg-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    {r.title && <span className="text-sm font-medium text-fg-primary">{r.title}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {displayName(r.user)} · {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
              {r.body && <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{r.body}</p>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
