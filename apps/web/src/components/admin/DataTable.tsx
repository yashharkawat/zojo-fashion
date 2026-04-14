import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export interface ColumnDef<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Tailwind width utility, e.g. 'w-32' */
  widthClass?: string;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  skeletonRows?: number;
}

/**
 * Generic striped table for admin views. Mobile: horizontal scroll
 * (the caller's container decides container width).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  isLoading,
  emptyState,
  skeletonRows = 8,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-bg-border bg-bg-elevated">
      <table className="w-full border-collapse">
        <thead className="bg-bg-overlay">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-secondary',
                  col.widthClass,
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bg-border">
          {isLoading && rows.length === 0
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.id} className="px-4 py-3">
                      <span className="skeleton block h-4 w-24 rounded" aria-hidden />
                    </td>
                  ))}
                </tr>
              ))
            : rows.length === 0
            ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-fg-secondary">
                    {emptyState ?? 'No rows'}
                  </td>
                </tr>
              )
            : rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-bg-overlay/60' : undefined,
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'px-4 py-3 text-sm text-fg-primary',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
