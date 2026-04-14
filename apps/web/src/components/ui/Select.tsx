import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string | null;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
          {label}
        </label>
      )}
      <div
        className={cn(
          'relative h-11 rounded-lg border bg-bg-elevated transition-colors',
          error
            ? 'border-danger focus-within:ring-1 focus-within:ring-danger'
            : 'border-bg-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent',
        )}
      >
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-full w-full appearance-none bg-transparent px-3 pr-9 text-sm text-fg-primary focus:outline-none',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
