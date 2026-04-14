import { cn } from '@/lib/cn';

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  activeIndex: number;
  /** Furthest step the user has reached — allows backward navigation click */
  reachedIndex?: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, activeIndex, reachedIndex = activeIndex, onStepClick }: StepperProps) {
  return (
    <ol className="flex items-center" aria-label="Checkout progress">
      {steps.map((s, i) => {
        const isActive = i === activeIndex;
        const isDone = i < reachedIndex;
        const clickable = !!onStepClick && i <= reachedIndex;

        return (
          <li key={s.id} className="flex flex-1 items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick!(i) : undefined}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 text-left',
                clickable && 'cursor-pointer',
                !clickable && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border font-mono text-sm font-bold transition-all',
                  isActive && 'border-accent bg-accent text-white shadow-glow-sm',
                  isDone && 'border-accent bg-accent/15 text-accent',
                  !isActive && !isDone && 'border-bg-border bg-bg-elevated text-fg-muted',
                )}
              >
                {isDone ? <CheckIcon /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-semibold uppercase tracking-widest md:block',
                  isActive ? 'text-fg-primary' : isDone ? 'text-fg-secondary' : 'text-fg-muted',
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mx-3 h-px flex-1 transition-colors',
                  i < reachedIndex ? 'bg-accent' : 'bg-bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5 9-11" />
    </svg>
  );
}
