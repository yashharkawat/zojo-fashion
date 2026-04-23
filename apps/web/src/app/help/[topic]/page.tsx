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
          We ship across India. Processing usually takes 1–2 business days; transit time depends
          on your pin code and the courier.
        </p>
        <p>You will get tracking details by email and SMS when your order ships.</p>
      </>
    ),
  },
  returns: {
    title: 'Returns & exchanges',
    description: 'Returns and exchange policy for ZOJO.',
    body: (
      <>
        <p>
          We want you to love your order. If something does not fit or arrives damaged, contact
          us within 7 days of delivery with your order number and photos where relevant.
        </p>
        <p>We will share return or exchange steps based on your case.</p>
      </>
    ),
  },
  'size-guide': {
    title: 'Size guide',
    description: 'How to pick your size for ZOJO apparel.',
    body: (
      <>
        <p>
          Our tees and hoodies use standard unisex sizing. If you are between sizes, most people
          size up for a relaxed street fit.
        </p>
        <p>Exact measurements per product will be added to each product page over time.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    description: 'Get in touch with ZOJO support.',
    body: (
      <>
        <p>For order help, partnerships, or press, reach out via the email we publish on this site
          once support is fully wired. Until then, use the social links in the footer.</p>
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
