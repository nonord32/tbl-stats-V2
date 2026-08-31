// src/app/api/admin/fighter-instagram/route.ts
// Admin-only: sets a fighter's Instagram URL in the `fighter_socials` table,
// overriding the Google Sheet value everywhere the site renders it. Same
// RESOLVE_SECRET bearer auth as the other admin routes; service-role client
// bypasses RLS. An empty value clears the override for that fighter.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cleanInstagramUrl } from '@/lib/data';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug?: string; instagram?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }
  const instagram = cleanInstagramUrl(body.instagram ?? '');

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from('fighter_socials').upsert(
    { fighter_slug: slug, instagram: instagram || null, updated_at: new Date().toISOString() },
    { onConflict: 'fighter_slug' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, instagram });
}
