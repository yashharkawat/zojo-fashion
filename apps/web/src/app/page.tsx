import { Hero } from '@/components/home/Hero';
import { CategoryPills } from '@/components/home/CategoryPills';
import { FeaturedCollection } from '@/components/home/FeaturedCollection';
import { InstagramFeed } from '@/components/home/InstagramFeed';
import type { FlipProductCardData } from '@/components/home/FlipProductCard';

// ──────────────────────────────────────────────────────────────
// Demo data — replace with a server-side fetch once products are seeded:
//
//   const res = await fetch(`${API}/products?sort=-soldCount&pageSize=8`, {
//     next: { revalidate: 60 },
//   });
//   const { data: products } = await res.json();
//
// Keeping placeholders lets the page ship visually complete today.
// ──────────────────────────────────────────────────────────────

const placeholder = (title: string, series: string, color = '141414'): FlipProductCardData => ({
  id: `demo-${title}`,
  slug: title.toLowerCase().replace(/\s+/g, '-'),
  title,
  basePrice: 89900,
  compareAtPrice: 119900,
  animeSeries: series,
  frontImage: {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><defs><radialGradient id='g' cx='50%' cy='30%'><stop offset='0%' stop-color='%23FF4500' stop-opacity='0.25'/><stop offset='100%' stop-color='%23${color}'/></radialGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/><text x='50%' y='50%' fill='%23FF4500' font-family='Impact,sans-serif' font-size='42' text-anchor='middle' dy='.35em' letter-spacing='4'>${series.toUpperCase()}</text></svg>`,
    )}`,
    alt: `${title} front`,
  },
  backImage: {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><rect width='100%' height='100%' fill='%23${color}'/><text x='50%' y='48%' fill='%23F5F5F5' font-family='Impact,sans-serif' font-size='28' text-anchor='middle' letter-spacing='3'>ZOJO</text><text x='50%' y='56%' fill='%23A3A3A3' font-family='sans-serif' font-size='14' text-anchor='middle'>BACK PRINT</text></svg>`,
    )}`,
    alt: `${title} back`,
  },
  defaultVariantId: `demo-v-${title}`,
  defaultVariantLabel: 'M / Black',
});

const FEATURED: FlipProductCardData[] = [
  placeholder('Sage Mode Oversized',       'Naruto'),
  placeholder('Scout Regiment Hoodie',     'AOT'),
  placeholder('Straw Hat Crew Tee',        'One Piece'),
  placeholder('Demon Slayer Corps',        'Demon Slayer'),
  placeholder('Sukuna King of Curses',     'Jujutsu Kaisen'),
  placeholder('Saiyan Beyond Limits',      'Dragon Ball'),
  placeholder('Titan Shifter',             'AOT'),
  placeholder('Uchiha Clan',               'Naruto'),
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <CategoryPills />

      <FeaturedCollection
        subtitle="Most Loved"
        title="Featured Drops"
        products={FEATURED}
        viewAllHref="/products?sort=-soldCount"
      />

      <InstagramFeed />
    </>
  );
}
