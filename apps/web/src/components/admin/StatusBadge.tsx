import { cn } from '@/lib/cn';
import type { OrderStatus } from '@/features/admin/types';

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:   'bg-fg-muted/15 text-fg-secondary border-fg-muted/30',
  CONFIRMED: 'bg-cyan/15 text-cyan border-cyan/30',
  PRINTING:  'bg-accent/15 text-accent border-accent/30',
  SHIPPED:   'bg-warn/15 text-warn border-warn/30',
  DELIVERED: 'bg-success/15 text-success border-success/30',
  CANCELLED: 'bg-danger/15 text-danger border-danger/30',
  REFUNDED:  'bg-pink/15 text-pink border-pink/30',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Pill className={ORDER_STATUS_STYLES[status]}>{status}</Pill>;
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </span>
  );
}
