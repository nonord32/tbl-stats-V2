'use client';
// src/components/AuthButton.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function AuthButton() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        setUsername(profile?.username ?? user.email?.split('@')[0] ?? 'account');
      } else {
        setUsername(null);
      }
      setLoading(false);
    }

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  if (!username) {
    return (
      <Link
        href="/login"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.8)',
          textDecoration: 'none',
          padding: '5px 12px',
          borderRadius: 'var(--radius)',
          border: '1px solid rgba(255,255,255,0.2)',
          whiteSpace: 'nowrap',
        }}
      >
        Log in
      </Link>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: '0.04em',
        maxWidth: 100,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {username}
      </span>
      <form action="/auth/signout" method="POST">
        <button
          type="submit"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 'var(--radius)',
            padding: '4px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
