import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, DM_Sans } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';

import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';
import { SecondaryNav } from '@/components/layout/SecondaryNav';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Toaster } from '@/components/ui/Toaster';
import { GlobalLoginModal } from '@/components/auth/GlobalLoginModal';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';

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
  description: 'Premium streetwear, printed in India. For the ones who wear their fandom with a straight face.',
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

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${dmSans.variable}`}>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}</Script>
        </>
      )}
      <body
        className="min-h-screen overflow-x-hidden bg-bg-base font-sans text-fg-primary antialiased"
        style={{ backgroundColor: '#0A0A0A', color: '#F5F5F5' }}
      >
        <Providers>
          <GoogleAnalytics />
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
