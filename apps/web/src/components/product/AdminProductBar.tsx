'use client';

import { useAuth } from '@/hooks/useAuth';
import { useSetDefaultColor } from '@/features/admin/hooks';
import { cn } from '@/lib/cn';

interface AdminProductBarProps {
  productId: string;
  selectedColor: string | null;
  currentDefaultColor: string | null;
}

export function AdminProductBar({
  productId,
  selectedColor,
  currentDefaultColor,
}: AdminProductBarProps) {
  const { user } = useAuth();
  const { mutate, isPending } = useSetDefaultColor();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) return null;
  if (!selectedColor) return null;

  const isAlreadyDefault = selectedColor === currentDefaultColor;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
        Admin
      </span>
      <span className="text-fg-muted">·</span>
      {isAlreadyDefault ? (
        <span className="text-fg-muted">
          <span className="text-fg-primary font-medium">{selectedColor}</span> is the default color
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate({ id: productId, color: selectedColor })}
          className={cn(
            'font-medium transition-colors',
            isPending
              ? 'cursor-wait text-fg-muted'
              : 'text-accent hover:text-accent-hover hover:underline',
          )}
        >
          {isPending ? 'Saving…' : `Set "${selectedColor}" as default`}
        </button>
      )}
    </div>
  );
}
