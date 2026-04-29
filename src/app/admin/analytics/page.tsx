// src/app/admin/analytics/page.tsx
// Gated link-out page: visitor analytics live in Vercel Web Analytics and
// Google Analytics (already wired in src/app/layout.tsx). Rather than
// duplicating that pipeline, this page password-gates direct links to the
// existing dashboards.
import { AnalyticsClient } from './AnalyticsClient';

export const dynamic = 'force-dynamic';

export default function AnalyticsAdminPage() {
  const vercelUrl =
    process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_URL ||
    'https://vercel.com/dashboard';
  const gaUrl =
    process.env.NEXT_PUBLIC_GA_DASHBOARD_URL ||
    'https://analytics.google.com/analytics/web/';

  return <AnalyticsClient vercelUrl={vercelUrl} gaUrl={gaUrl} />;
}
