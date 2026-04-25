'use client';

import { Modal } from '@/components/ui/Modal';
import type { SizeChartRow } from '@/types/product';

export interface SizeGuideProps {
  open: boolean;
  onClose: () => void;
  rows?: SizeChartRow[];
}

const FALLBACK_CHART: SizeChartRow[] = [
  { id: 'S',   size: 'S',   chest: '42', length: '27', sleeve: '9.0',  sortOrder: 0 },
  { id: 'M',   size: 'M',   chest: '44', length: '28', sleeve: '9.5',  sortOrder: 1 },
  { id: 'L',   size: 'L',   chest: '46', length: '29', sleeve: '10.0', sortOrder: 2 },
  { id: 'XL',  size: 'XL',  chest: '48', length: '30', sleeve: '10.5', sortOrder: 3 },
  { id: 'XXL', size: 'XXL', chest: '50', length: '31', sleeve: '11.0', sortOrder: 4 },
];

export function SizeGuide({ open, onClose, rows }: SizeGuideProps) {
  const chart = rows && rows.length > 0 ? rows : FALLBACK_CHART;
  return (
    <Modal open={open} onClose={onClose} title="Size Guide" widthClass="max-w-2xl">
      <div className="space-y-6">
        <p className="text-sm text-fg-secondary">
          Measurements below are garment dimensions (not body). For a relaxed fit, pick your usual
          size. For an oversized look, size up.
        </p>

        <div className="overflow-x-auto rounded-lg border border-bg-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-overlay text-left text-xs uppercase tracking-wider text-fg-secondary">
              <tr>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Chest (in)</th>
                <th className="px-4 py-3">Length (in)</th>
                <th className="px-4 py-3">Sleeve (in)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border">
              {chart.map((row) => (
                <tr key={row.size} className="transition-colors hover:bg-bg-overlay/50">
                  <td className="px-4 py-3 font-semibold text-fg-primary">{row.size}</td>
                  <td className="px-4 py-3 font-mono text-fg-secondary">{row.chest}</td>
                  <td className="px-4 py-3 font-mono text-fg-secondary">{row.length}</td>
                  <td className="px-4 py-3 font-mono text-fg-secondary">{row.sleeve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section>
          <h3 className="mb-3 font-display text-xl tracking-wide text-fg-primary">How to measure</h3>
          <ol className="space-y-3 text-sm text-fg-secondary">
            <li className="flex gap-3">
              <span className="font-mono font-bold text-accent">01</span>
              <span>
                <strong className="text-fg-primary">Chest:</strong> Measure around the fullest part
                of your chest, keeping the tape horizontal.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-accent">02</span>
              <span>
                <strong className="text-fg-primary">Length:</strong> From the highest point of the
                shoulder down to the hem you want.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-accent">03</span>
              <span>
                <strong className="text-fg-primary">Sleeve:</strong> From the shoulder seam to the
                end of the sleeve.
              </span>
            </li>
          </ol>
        </section>

        <p className="text-xs text-fg-muted">
          Tolerance ±0.5". Still unsure? Chat with us on Instagram{' '}
          <a
            href="https://instagram.com/zojo.fashion"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline-offset-4 hover:underline"
          >
            @zojo.fashion
          </a>
          .
        </p>
      </div>
    </Modal>
  );
}
