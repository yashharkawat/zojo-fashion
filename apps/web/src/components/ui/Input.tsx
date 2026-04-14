import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Render a container that includes a leading element (icon/prefix). */
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-11 items-center gap-2 rounded-lg border bg-bg-elevated px-3 transition-colors',
          error
            ? 'border-danger focus-within:ring-1 focus-within:ring-danger'
            : 'border-bg-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent',
        )}
      >
        {leading && <span className="text-fg-muted">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'h-full w-full bg-transparent text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none',
            className,
          )}
          {...rest}
        />
        {trailing && <span className="text-fg-muted">{trailing}</span>}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
