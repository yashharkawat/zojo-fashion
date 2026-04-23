import { Hero } from '@/components/home/Hero';
import { FeaturedCollection } from '@/components/home/FeaturedCollection';
import { InstagramFeed } from '@/components/home/InstagramFeed';
import { fetchFeaturedDropsForHome } from '@/lib/server-products';

export default async function HomePage() {
  const { products, hadError } = await fetchFeaturedDropsForHome();

  return (
    <>
      <Hero />

      {products.length > 0 ? (
        <FeaturedCollection
          subtitle="Most Loved"
          title="Featured Drops"
          products={products}
          viewAllHref="/products?sort=-soldCount"
        />
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-fg-secondary">
          {hadError ? (
            <p>Could not load the catalog. Check that the API is running and the seed has been applied.</p>
          ) : (
            <p>No products in the catalog yet. From the repo root, run: <code className="text-fg-primary">cd apps/api && npm run seed</code></p>
          )}
        </div>
      )}

      <InstagramFeed />
    </>
  );
}
