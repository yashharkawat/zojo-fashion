'use client';

import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h2 className="font-display text-4xl text-fg-primary">Something broke.</h2>
      <p className="mt-2 text-fg-secondary">
        {process.env.NODE_ENV === 'development' ? error.message : 'Please try again in a moment.'}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
