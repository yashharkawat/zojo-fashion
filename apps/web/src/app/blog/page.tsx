import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageTransition } from '@/components/motion/PageTransition';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, drops, and style notes from ZOJO.',
};

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
}

async function fetchPosts(): Promise<BlogPost[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return [];
  try {
    const res = await fetch(`${base}/blog?pageSize=24`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: BlogPost[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPage() {
  const posts = await fetchPosts();

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-10 text-center sm:text-left">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Journal</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-fg-primary sm:text-4xl">
            Blog
          </h1>
          <p className="mt-2 text-sm text-fg-secondary">Drop announcements, behind-the-scenes, and style editorials.</p>
        </header>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-10 text-center text-fg-secondary">
            No posts yet. Check back soon or follow us on Instagram.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-bg-border bg-bg-elevated transition-colors hover:border-accent"
              >
                {post.coverImageUrl ? (
                  <div className="relative aspect-[16/9] overflow-hidden bg-bg-base">
                    <Image
                      src={post.coverImageUrl}
                      alt={post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center bg-bg-base">
                    <span className="font-display text-4xl text-accent opacity-30">ZOJO</span>
                  </div>
                )}
                <div className="p-5">
                  {post.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="line-clamp-2 font-display text-lg tracking-tight text-fg-primary group-hover:text-accent transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-2 text-sm text-fg-secondary">{post.excerpt}</p>
                  )}
                  <p className="mt-3 text-xs text-fg-muted">{formatDate(post.publishedAt ?? post.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
