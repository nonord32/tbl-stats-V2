'use client';
// src/app/picks/error.tsx
// Isolates pick'em failures so a Supabase outage doesn't take down other pages.

import { ErrorFallback } from '@/components/ErrorFallback';

export default function PicksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Picks are temporarily unavailable"
      description="We couldn't load your picks right now. Try again in a moment."
      error={error}
      reset={reset}
      secondaryHref="/leaderboard"
      secondaryLabel="Leaderboard"
    />
  );
}
