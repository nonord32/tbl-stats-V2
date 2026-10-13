// Pages the scroll effects (ScrollFx) and the sticky masthead are switched on
// for while they're being rolled out. Widen this to cover more routes.
export function fxEnabled(pathname: string): boolean {
  return pathname === '/';
}
