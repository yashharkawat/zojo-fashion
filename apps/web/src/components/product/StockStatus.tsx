import { cn } from '@/lib/cn';

export interface StockStatusProps {
  stock: number;
  lowStockThreshold?: number;
  className?: string;
}

export function StockStatus({ stock, lowStockThreshold = 5, className }: StockStatusProps) {
  if (stock <= 0) {
    return (
      <p className={cn('inline-flex items-center gap-2 text-sm text-danger', className)}>
        <Dot className="bg-danger" /> Out of stock
      </p>
    );
  }
  if (stock <= lowStockThreshold) {
    return (
      <p className={cn('inline-flex items-center gap-2 text-sm text-warn', className)}>
        <Dot className="bg-warn animate-pulse" /> Only {stock} left — order soon
      </p>
    );
  }
  return (
    <p className={cn('inline-flex items-center gap-2 text-sm text-success', className)}>
      <Dot className="bg-success" /> In stock, ready to ship
    </p>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn('h-2 w-2 rounded-full', className)} aria-hidden />;
}
