import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { PageTransition } from '@/components/motion/PageTransition';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
}

async function fetchPost(slug: string): Promise<BlogPost | null> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/blog/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: BlogPost };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Post not found' };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: { images: post.coverImageUrl ? [post.coverImageUrl] : [] },
  };
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  return (
    <PageTransition>
      <article className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/blog" className="text-sm text-fg-muted transition-colors hover:text-accent">
          ← Blog
        </Link>

        <header className="mt-6">
          {post.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs uppercase tracking-wider text-accent">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-display text-3xl tracking-tight text-fg-primary sm:text-4xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-3 text-lg leading-relaxed text-fg-secondary">{post.excerpt}</p>
          )}
          <p className="mt-3 text-xs text-fg-muted">{formatDate(post.publishedAt ?? post.createdAt)}</p>
        </header>

        {post.coverImageUrl && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-bg-elevated">
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}

        <div className="prose-zojo mt-10">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </PageTransition>
  );
}
