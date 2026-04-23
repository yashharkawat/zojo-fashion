import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, drops, and style notes from ZOJO.',
};

export default function BlogPage() {
  return (
    <StaticInfoPage title="Blog">
      <p>Drop announcements, behind-the-scenes, and editorials will live here.</p>
      <p>Check back soon or follow us on social for the latest.</p>
    </StaticInfoPage>
  );
}
