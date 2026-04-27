import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Work with ZOJO — creative, ops, and customer experience.',
};

export default function CareersPage() {
  return (
    <StaticInfoPage title="Careers">
      <p>We are not listing open roles on the site yet.</p>
      <p>
        If you are excited about unique designs, streetwear, and building a brand from India, say hello
        through the contact page and we will keep you in mind.
      </p>
    </StaticInfoPage>
  );
}
