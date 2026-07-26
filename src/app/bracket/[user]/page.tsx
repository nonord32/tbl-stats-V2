// src/app/bracket/[user]/page.tsx
// Read-only spectator view of another player's bracket, reached from the
// leaderboard. Only available once entries lock — before that, everyone's picks
// stay private, so this redirects back to the leaderboard. Entries are read with
// the service-role key because RLS restricts the normal client to a user's own
// row.
import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAllData } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { safeQuery } from '@/lib/supabase/safe';
import { BracketClient } from '../BracketClient';
import type { BracketEntry } from '@/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { user: string };
}): Promise<Metadata> {
  const username = decodeURIComponent(params.user);
  return {
    title: `${username}'s Bracket — TBL Playoff Predictions`,
    description: `${username}'s Team Boxing League playoff bracket — quarterfinal, semifinal, and championship picks, plus their spot on the bracket leaderboard.`,
    // Personal spectator pages shouldn't clutter the search index.
    robots: { index: false, follow: true },
  };
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
}
interface EntryRow {
  user_id: string;
  qf_winners: string[] | null;
  sf_winners: string[] | null;
  champion: string | null;
  final_total: number | null;
  created_at: string;
  updated_at: string;
}

export default async function SpectatorBracketPage({
  params,
}: {
  params: { user: string };
}) {
  const username = decodeURIComponent(params.user);

  const sheetData = await getAllData();
  const { seeds, bracket, open } = getBracketContext(sheetData);

  // Picks are private until the field locks.
  if (open) {
    redirect('/leaderboard');
  }

  let service: SupabaseClient | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) service = createServiceClient(url, key);
  } catch (err) {
    console.error('[bracket/[user]] service client construction failed:', err);
  }
  if (!service) notFound();

  const profiles = await safeQuery<ProfileRow[]>(
    service.from('profiles').select('id, username, display_name').eq('username', username).limit(1),
    [],
    'bracket.spectator.profile'
  );
  const profile = profiles[0];
  if (!profile) notFound();

  const entries = await safeQuery<EntryRow[]>(
    service.from('bracket_entries').select('*').eq('user_id', profile.id).limit(1),
    [],
    'bracket.spectator.entry'
  );
  const row = entries[0] ?? null;
  const entry: BracketEntry | null = row
    ? {
        user_id: row.user_id,
        qf_winners: row.qf_winners ?? [],
        sf_winners: row.sf_winners ?? [],
        champion: row.champion,
        final_total: row.final_total,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    : null;

  return (
    <BracketClient
      seeds={seeds}
      bracket={bracket}
      entry={entry}
      open={false}
      lockISO={null}
      ownerName={profile.username}
    />
  );
}
