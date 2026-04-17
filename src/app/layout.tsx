// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://tblstats.com'),
  title: {
    default: 'TBL Stats — Official Stats of Team Boxing League',
    template: '%s | TBL Stats',
  },
  description:
    'Official statistics for Team Boxing League (TBL). Fighter rankings, WAR, NPPR, team standings, box scores, and fight history.',
  openGraph: {
    siteName: 'TBL Stats',
    type: 'website',
    url: 'https://tblstats.com',
  },
  twitter: {
    card: 'summary',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
        <Analytics />
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
