'use client';
// src/app/admin/error.tsx

import { ErrorFallback } from '@/components/ErrorFallback';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Admin page failed to load"
      description="The admin tools hit an error. Check the Supabase service role key and try again."
      error={error}
      reset={reset}
    />
  );
}
