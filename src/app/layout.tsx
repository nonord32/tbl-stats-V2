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
    default: 'TBL Stats | Rankings, Leaders, & Results',
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
