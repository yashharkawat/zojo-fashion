'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

const EMPTY_FORM = {
  slug: '',
  title: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  tags: '',
  isPublished: false,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminBlogPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/admin/blog?pageSize=50`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ data: BlogPost[] }>)
      .then(({ data }) => setPosts(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(post: BlogPost) {
    setEditId(post.id);
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? '',
      content: '',
      coverImageUrl: post.coverImageUrl ?? '',
      tags: post.tags.join(', '),
      isPublished: post.isPublished,
    });
    setError('');
    setShowForm(true);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await fetch(`${apiBase}/admin/blog/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const body = {
      slug: form.slug || slugify(form.title),
      title: form.title,
      excerpt: form.excerpt || undefined,
      content: form.content || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      tags,
      isPublished: form.isPublished,
    };
    try {
      const url = editId ? `${apiBase}/admin/blog/${editId}` : `${apiBase}/admin/blog`;
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? 'Failed to save');
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-fg-muted hover:text-accent">← Admin</Link>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-fg-primary">Blog</h1>
        </div>
        <button
          onClick={openCreate}
          className="h-10 rounded-lg bg-accent px-5 text-sm font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover"
        >
          + New post
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-bg-border bg-bg-elevated p-6 space-y-4">
          <h2 className="font-display text-xl tracking-tight text-fg-primary">
            {editId ? 'Edit post' : 'New post'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-fg-muted">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => { field('title', e.target.value); if (!editId) field('slug', slugify(e.target.value)); }}
                className="h-10 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => field('slug', e.target.value)}
                className="h-10 w-full rounded-lg border border-bg-border bg-bg-base px-3 font-mono text-sm text-fg-primary focus:border-accent focus:outline-none"
                placeholder="auto-generated from title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Cover image URL</label>
              <input
                value={form.coverImageUrl}
                onChange={(e) => field('coverImageUrl', e.target.value)}
                className="h-10 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary focus:border-accent focus:outline-none"
                placeholder="https://..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-fg-muted">Excerpt</label>
              <input
                value={form.excerpt}
                onChange={(e) => field('excerpt', e.target.value)}
                maxLength={500}
                className="h-10 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-fg-muted">Tags (comma-separated)</label>
              <input
                value={form.tags}
                onChange={(e) => field('tags', e.target.value)}
                className="h-10 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary focus:border-accent focus:outline-none"
                placeholder="drops, editorial, anime"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="published"
                checked={form.isPublished}
                onChange={(e) => field('isPublished', e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <label htmlFor="published" className="text-sm text-fg-secondary">Publish immediately</label>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-fg-muted">
                Content (Markdown){editId && ' — leave blank to keep existing'}
              </label>
              <textarea
                value={form.content}
                onChange={(e) => field('content', e.target.value)}
                rows={12}
                required={!editId}
                className="w-full resize-y rounded-lg border border-bg-border bg-bg-base px-3 py-2 font-mono text-sm text-fg-primary focus:border-accent focus:outline-none"
                placeholder="Write your post in Markdown…"
              />
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-lg bg-accent px-6 text-sm font-semibold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Create post'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-10 rounded-lg border border-bg-border px-5 text-sm text-fg-secondary hover:border-accent hover:text-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Post list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-bg-elevated" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-bg-border bg-bg-elevated p-8 text-center text-fg-secondary">
          No posts yet. Click &quot;+ New post&quot; to create your first.
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bg-border bg-bg-elevated px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', post.isPublished ? 'bg-[#22c55e]' : 'bg-fg-muted')} />
                  <p className="truncate text-sm font-medium text-fg-primary">{post.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {post.isPublished ? 'Published' : 'Draft'} · {formatDate(post.publishedAt ?? post.createdAt)} · /{post.slug}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  className="h-8 rounded-md border border-bg-border px-3 text-xs text-fg-secondary hover:border-accent hover:text-accent flex items-center"
                >
                  Preview
                </Link>
                <button
                  onClick={() => openEdit(post)}
                  className="h-8 rounded-md border border-bg-border px-3 text-xs text-fg-secondary hover:border-accent hover:text-accent"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(post.id, post.title)}
                  className="h-8 rounded-md border border-danger/30 px-3 text-xs text-danger hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
