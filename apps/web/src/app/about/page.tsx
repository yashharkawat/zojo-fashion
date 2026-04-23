import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'About',
  description: 'ZOJO — anime-inspired streetwear, printed in India.',
};

export default function AboutPage() {
  return (
    <StaticInfoPage title="About ZOJO">
      <p>
        ZOJO is a premium anime streetwear label for people who want their fandom on the outside.
        We design and print in India, with quality and fit you can live in.
      </p>
      <p>
        This page is a placeholder; product stories, the team, and lookbooks will show up here as
        the site grows.
      </p>
    </StaticInfoPage>
  );
}
