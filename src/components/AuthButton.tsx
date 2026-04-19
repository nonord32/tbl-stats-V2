// src/components/AuthButton.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export async function AuthButton() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link
        href="/login"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: 'rgba(255,255,255,0.8)',
          textDecoration: 'none',
          padding: '5px 12px',
          borderRadius: 'var(--radius)',
          border: '1px solid rgba(255,255,255,0.2)',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap' as const,
        }}
      >
        Log in
      </Link>
    );
  }

  // Get username from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  const displayName = profile?.username ?? user.email?.split('@')[0] ?? 'account';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.6)',
          letterSpacing: '0.04em',
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}
      >
        {displayName}
      </span>
      <form action="/auth/signout" method="POST">
        <button
          type="submit"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.6)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 'var(--radius)',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap' as const,
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
