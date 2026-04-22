'use client';
// src/app/error.tsx
// Root route-level error boundary. Rendered by Next.js whenever a server
// component under / throws. Sits inside the root layout so the nav still shows.

import { ErrorFallback } from '@/components/ErrorFallback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Something went wrong"
      description="We hit an unexpected error loading this page."
      error={error}
      reset={reset}
      secondaryHref="/schedule"
      secondaryLabel="Schedule"
    />
  );
}
