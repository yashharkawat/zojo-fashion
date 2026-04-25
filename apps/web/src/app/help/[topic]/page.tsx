import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

const TOPICS: Record<string, { title: string; description: string; body: ReactNode }> = {
  shipping: {
    title: 'Shipping',
    description: 'Shipping times and delivery for ZOJO orders.',
    body: (
      <>
        <p>
          We ship across India. Processing usually takes 5–6 business days; transit time depends
          on your pin code and the courier assigned to your area.
        </p>
        <p>
          You will receive tracking details by email and SMS once your order ships. If your order
          hasn&apos;t moved in 7 business days, reach out at{' '}
          <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a>.
        </p>
      </>
    ),
  },
  returns: {
    title: 'Returns & exchanges',
    description: 'Returns and exchange policy for ZOJO.',
    body: (
      <>
        <p>
          Replacement is only available in the case of a verified printing defect or physical
          damage to the product on arrival. We do not accept returns for size or fit reasons.
        </p>
        <p>
          Please review the size guide carefully before placing your order. If you receive a
          defective item, email us at{' '}
          <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a> within 48
          hours of delivery with your order number and a photo of the defect.
        </p>
      </>
    ),
  },
  'size-guide': {
    title: 'Size guide',
    description: 'How to pick your size for ZOJO apparel.',
    body: (
      <>
        <p>
          All measurements are in inches. Measure your chest at the widest point and match to the
          chart below. If you are between sizes, size up for a relaxed oversized street fit.
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
              {[
                ['XS', 40, 27],
                ['S',  42, 28],
                ['M',  44, 29],
                ['L',  46, 30],
                ['XL', 48, 31],
                ['2XL', 50, 32],
              ].map(([size, chest, length]) => (
                <tr key={size} className="hover:bg-bg-elevated transition-colors">
                  <td className="py-3 pr-8 font-medium text-fg-primary">{size}</td>
                  <td className="py-3 pr-8 text-fg-secondary">{chest}</td>
                  <td className="py-3 text-fg-secondary">{length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          These measurements apply to our Unisex Oversized Classic T-Shirt (UC22) — drop
          shoulder, extra length, 240 GSM heavyweight cotton. All current Zojo tees use this fit.
        </p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    description: 'Get in touch with ZOJO support.',
    body: (
      <>
        <p>
          For order help, partnerships, or press inquiries, reach out at{' '}
          <a href="mailto:zojo.fashion.tee@gmail.com">zojo.fashion.tee@gmail.com</a>. We typically
          respond within 24–48 hours.
        </p>
        <p>
          You can also DM us on Instagram for quicker support on order-related questions.
        </p>
      </>
    ),
  },
};

type Props = { params: { topic: string } };

export function generateStaticParams() {
  return Object.keys(TOPICS).map((topic) => ({ topic }));
}

export function generateMetadata({ params }: Props): Metadata {
  const c = TOPICS[params.topic];
  if (!c) return { title: 'Help' };
  return { title: c.title, description: c.description };
}

export default function HelpTopicPage({ params }: Props) {
  const c = TOPICS[params.topic];
  if (!c) notFound();
  return (
    <StaticInfoPage title={c.title} backHref="/">
      {c.body}
    </StaticInfoPage>
  );
}