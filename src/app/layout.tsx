// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PageviewTracker } from '@/components/PageviewTracker';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TopStrip } from '@/components/chrome/TopStrip';
import { TopNav } from '@/components/chrome/TopNav';
import { MobileTabBar } from '@/components/chrome/MobileTabBar';
import { GazetteFooter } from '@/components/chrome/GazetteFooter';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://tblstats.com'),
  title: {
    default: 'Team Boxing League | Rankings, Leaders, & Results',
    template: '%s | TBL Stats',
  },
  description:
    'Independent stats, standings, and fight results for Team Boxing League. Track fighter performance, team trends, and match outcomes all season long.',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico',       sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    siteName: 'TBL Stats',
    type: 'website',
    url: 'https://tblstats.com',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TBL Stats' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <TopStrip />
          <TopNav />
          <main>{children}</main>
          <GazetteFooter />
          <MobileTabBar />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
        <PageviewTracker />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-2G5HV9RKGS"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-2G5HV9RKGS');
          `}
        </Script>
      </body>
    </html>
  );
}
