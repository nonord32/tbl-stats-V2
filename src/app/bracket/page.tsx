// src/app/bracket/page.tsx
// Bracket Challenge entry page. Signed-in users fill out the locked 8-team
// playoff bracket and a combined-final-score tiebreaker. Entries lock 1.5h
// after the first playoff game starts; after that this becomes a read-only
// scorecard comparing the user's picks to the live results.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { safeGetUser, safeQuery } from '@/lib/supabase/safe';
import { BracketClient } from './BracketClient';
import type { BracketEntry } from '@/types';

export const dynamic = 'force-dynamic';

export default async function BracketPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  if (!user) {
    redirect('/login');
  }

  const sheetData = await getAllData();
  const { seeds, bracket, lockTime, open } = getBracketContext(sheetData);

  const entries = await safeQuery<BracketEntry[]>(
    supabase.from('bracket_entries').select('*').eq('user_id', user.id).limit(1),
    [],
    'bracket.entry'
  );
  const entry = entries[0] ?? null;

  return (
    <BracketClient
      seeds={seeds}
      bracket={bracket}
      entry={entry}
      open={open}
      lockISO={lockTime ? lockTime.toISOString() : null}
    />
  );
}
