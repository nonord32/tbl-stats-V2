// src/app/api/profile/username/route.ts
// PATCH /api/profile/username — let signed-in users rename their public handle.
// Validates the format (3–20 chars, alnum + underscore) and uniqueness via the
// profiles table's UNIQUE(username) constraint.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { username?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = typeof body.username === 'string' ? body.username.trim() : '';
  if (!USERNAME_RE.test(raw)) {
    return NextResponse.json(
      {
        error:
          'Username must be 3–20 characters and contain only letters, numbers, or underscores.',
      },
      { status: 400 }
    );
  }
  // Lowercase for comparison/uniqueness — keeps "Foo" from clashing with "foo".
  const next = raw.toLowerCase();

  // Reject if any other user already owns this handle. The DB has a unique
  // constraint as a backstop, but checking first lets us return a friendly
  // 409 instead of a generic Postgres error.
  const { data: existing, error: lookupErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', next)
    .neq('id', user.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: 'That username is already taken.' },
      { status: 409 }
    );
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ username: next })
    .eq('id', user.id);
  if (updateErr) {
    // Race with another writer — surface the unique-constraint case nicely.
    if ((updateErr as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'That username is already taken.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ username: next });
}
