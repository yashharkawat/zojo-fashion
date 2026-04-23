/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Browsers still request /favicon.ico; map to the app icon to avoid 404s in the console.
    return [{ source: '/favicon.ico', destination: '/icon.svg' }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.zojofashion.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    /** Helps repeat visits; local `/catalog/*` still passes through the optimizer once per size. */
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
