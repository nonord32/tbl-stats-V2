// src/lib/weightClasses.ts
// Canonical weight-class ordering from light to heavy. Used anywhere the
// app needs to render classes in boxing order instead of alphabetical.

export const WEIGHT_CLASS_ORDER: readonly string[] = [
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Super Lightweight',
  'Welterweight',
  'Super Welterweight',
  'Middleweight',
  'Super Middleweight',
  'Light Heavyweight',
  'Cruiserweight',
  'Heavyweight',
];

/** Comparator for Array.sort that puts canonical classes in weight order
 *  and pushes any unknown class to the end sorted alphabetically. */
export function compareWeightClass(a: string, b: string): number {
  const ai = WEIGHT_CLASS_ORDER.indexOf(a);
  const bi = WEIGHT_CLASS_ORDER.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.localeCompare(b);
}
