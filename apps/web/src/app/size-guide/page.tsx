import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'Size Guide',
  description: 'Find your perfect fit — ZOJO oversized tee size chart with chest and length measurements.',
};

const sizes = [
  { size: 'XS', chest: 40, length: 27 },
  { size: 'S',  chest: 42, length: 28 },
  { size: 'M',  chest: 44, length: 29 },
  { size: 'L',  chest: 46, length: 30 },
  { size: 'XL', chest: 48, length: 31 },
  { size: '2XL', chest: 50, length: 32 },
];

export default function SizeGuidePage() {
  return (
    <StaticInfoPage title="Size Guide">
      <p>
        All measurements are in <strong className="text-fg-primary">inches</strong>. Measure your
        chest at the widest point and match to the chart below. If you are between sizes, size up
        for a relaxed oversized street fit.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-bg-border">
              <th className="py-3 pr-8 text-left font-display text-xs tracking-widest uppercase text-fg-muted">
                Size
              </th>
              <th className="py-3 pr-8 text-left font-display text-xs tracking-widest uppercase text-fg-muted">
                Chest (in)
              </th>
              <th className="py-3 text-left font-display text-xs tracking-widest uppercase text-fg-muted">
                Length (in)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-border">
            {sizes.map(({ size, chest, length }) => (
              <tr key={size} className="transition-colors hover:bg-bg-elevated">
                <td className="py-3 pr-8 font-medium text-fg-primary">{size}</td>
                <td className="py-3 pr-8 text-fg-secondary">{chest}</td>
                <td className="py-3 text-fg-secondary">{length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-lg text-fg-primary">How to Measure</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg-primary">Chest:</strong> Wrap a measuring tape around the
          fullest part of your chest, keeping it parallel to the floor.
        </li>
        <li>
          <strong className="text-fg-primary">Length:</strong> Measure from the highest point of
          the shoulder down to the hem.
        </li>
      </ul>

      <h2 className="font-display text-lg text-fg-primary">Fit Notes</h2>
      <p>
        All ZOJO tees use a <strong className="text-fg-primary">unisex oversized fit</strong> —
        drop shoulder, extra length, 240 GSM heavyweight cotton (UC22 base). The fit is designed
        to drape, not cling. If you prefer a closer fit, size down.
      </p>
      <p>
        Minimal shrinkage after cold wash — bio-washed fabric. Turn inside-out before washing to
        protect the print.
      </p>
    </StaticInfoPage>
  );
}
