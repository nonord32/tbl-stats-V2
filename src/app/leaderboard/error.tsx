'use client';
// src/app/leaderboard/error.tsx

import { ErrorFallback } from '@/components/ErrorFallback';

export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Leaderboard is temporarily unavailable"
      description="We couldn't load the standings right now. Try again in a moment."
      error={error}
      reset={reset}
      secondaryHref="/picks"
      secondaryLabel="Picks"
    />
  );
}
