// src/app/api/admin/verify-analytics/route.ts
// Validates the password for /admin/analytics. Independent from RESOLVE_SECRET
// so the analytics URL can be shared without granting main-admin access.
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const expected = process.env.ANALYTICS_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'ANALYTICS_SECRET is not configured on the server.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
