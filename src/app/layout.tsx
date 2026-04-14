// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

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
      </body>
    </html>
  );
}
