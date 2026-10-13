// Pages the scroll effects (ScrollFx) and the sticky masthead run on: every
// Gazette page. Fantasy and the 8-0 game are their own products with their own
// chrome, and admin is a tool, so they stay still.
export function fxEnabled(pathname: string): boolean {
  if (pathname === '/8-0') return false;
  if (pathname === '/fantasy' || pathname.startsWith('/fantasy/')) return false;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return false;
  return true;
}
