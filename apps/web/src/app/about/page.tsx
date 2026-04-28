import type { Metadata } from 'next';
import { StaticInfoPage } from '@/components/layout/StaticInfoPage';
import { fetchSiteSettings } from '@/lib/server-settings';

export const metadata: Metadata = {
  title: 'About',
  description: 'ZOJO — Premium streetwear, printed in India. For the ones who wear their fandom with a straight face.',
};

export default async function AboutPage() {
  const social = await fetchSiteSettings();

  return (
    <StaticInfoPage title="About ZOJO">
      <p>
        ZOJO is a unique designs streetwear, born in India.
      </p>
      <p>
        We don&apos;t make merch. We make wearable art. Every design is crafted to hit as hard as
        the moment that inspired it — dark, cinematic, and built to last. Heavyweight 240 GSM
        cotton. Fits that actually drape right. Printed and shipped from India.
      </p>
      <p>
        Zojo is new. The lookbooks, the drops, the collaborations — they&apos;re coming. But the
        foundation is already here: uncompromising quality, designs that mean something, and a
        community that gets it.
      </p>
      <p>
        Follow the journey on{' '}
        <a href={social.instagramUrl} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
        .
      </p>
    </StaticInfoPage>
  );
}