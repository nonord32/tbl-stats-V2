'use client';
// src/app/bracket/error.tsx
// Isolates Bracket Challenge failures so a Supabase outage doesn't take down
// other pages.

import { ErrorFallback } from '@/components/ErrorFallback';

export default function BracketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="The Bracket Challenge is temporarily unavailable"
      description="We couldn't load your bracket right now. Try again in a moment."
      error={error}
      reset={reset}
      secondaryHref="/leaderboard"
      secondaryLabel="Leaderboard"
    />
  );
}
