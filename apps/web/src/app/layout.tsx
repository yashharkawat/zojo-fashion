import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, DM_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';
import { SecondaryNav } from '@/components/layout/SecondaryNav';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Toaster } from '@/components/ui/Toaster';
import { GlobalLoginModal } from '@/components/auth/GlobalLoginModal';

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-bebas',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'ZOJO — Wear The Bold',
    template: '%s | ZOJO',
  },
  description: 'Anime-inspired premium streetwear. Printed in India for the otakus who wear their fandom with a straight face.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'ZOJO',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A0A',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${dmSans.variable}`}>
      <body
        className="min-h-screen bg-bg-base font-sans text-fg-primary antialiased"
        style={{ backgroundColor: '#0A0A0A', color: '#F5F5F5' }}
      >
        <Providers>
          <Header />
          <SecondaryNav />
          <main>{children}</main>
          <CartDrawer />
          <GlobalLoginModal />
          <Toaster />
        </Providers>
        {/* Server-only footer: must NOT sit inside `Providers` (client tree) or async RSC
            composition can break styling/hydration on some pages (e.g. /login). */}
        <Footer />
      </body>
    </html>
  );
}
