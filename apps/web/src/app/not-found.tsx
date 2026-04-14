import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-accent">404</p>
      <h2 className="mt-2 font-display text-4xl text-fg-primary">This page doesn't exist.</h2>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-hover"
      >
        Back to home
      </Link>
    </div>
  );
}
