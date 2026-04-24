#!/usr/bin/env node
// Copy fighter portrait AVIFs from a source dir into public/fighters/{slug}.avif
// Source filenames follow two conventions from the TBL website:
//   PHX_Judah_Yisrael_1.avif       (underscores separate name parts)
//   LV_KyeBrooks_2.avif            (CamelCase, no separator)
// Both normalize to slug format (judah-yisrael.avif, kye-brooks.avif) via toSlug().
//
// Usage:
//   node scripts/rename-fighter-photos.mjs <source-dir> [--dry-run]
//
// The script never deletes or overwrites originals — it only copies.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const srcDir = args.find((a) => !a.startsWith('--'));

if (!srcDir) {
  console.error('Usage: node scripts/rename-fighter-photos.mjs <source-dir> [--dry-run]');
  process.exit(1);
}

const absSrc = path.resolve(srcDir.replace(/^~/, process.env.HOME ?? ''));
if (!fs.existsSync(absSrc) || !fs.statSync(absSrc).isDirectory()) {
  console.error(`Source directory not found: ${absSrc}`);
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const destDir = path.join(repoRoot, 'public', 'fighters');
if (!dryRun) fs.mkdirSync(destDir, { recursive: true });

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function normalize(filename) {
  const base = filename.replace(/\.avif$/i, '');
  // Strip team prefix (2-4 uppercase letters + underscore)
  const withoutTeam = base.replace(/^[A-Z]{2,4}_/, '');
  // Strip numeric suffix (_1, _2, _3, …)
  const withoutSuffix = withoutTeam.replace(/_\d+$/, '');
  // Underscores → spaces; insert space at CamelCase boundaries
  const withSpaces = withoutSuffix
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
  return `${toSlug(withSpaces)}.avif`;
}

const entries = fs.readdirSync(absSrc).filter((f) => /\.avif$/i.test(f));
if (entries.length === 0) {
  console.error(`No .avif files found in ${absSrc}`);
  process.exit(1);
}

console.log(`${dryRun ? '[dry-run] ' : ''}Processing ${entries.length} .avif files from ${absSrc}`);
console.log(`Destination: ${destDir}`);
console.log();

const mapping = new Map(); // destName -> [srcNames...]
for (const src of entries) {
  const dest = normalize(src);
  if (!mapping.has(dest)) mapping.set(dest, []);
  mapping.get(dest).push(src);
}

let copied = 0;
let skipped = 0;
const collisions = [];

for (const [dest, sources] of mapping) {
  if (sources.length > 1) {
    collisions.push({ dest, sources });
  }
  // When multiple sources map to the same slug, keep the first (stable ordering).
  // User can manually pick a different one afterward.
  const chosen = sources[0];
  const srcPath = path.join(absSrc, chosen);
  const destPath = path.join(destDir, dest);

  if (dryRun) {
    console.log(`${chosen.padEnd(50)} -> ${dest}${sources.length > 1 ? `  (+${sources.length - 1} dup)` : ''}`);
    continue;
  }

  if (fs.existsSync(destPath)) {
    skipped++;
    continue;
  }

  fs.copyFileSync(srcPath, destPath);
  copied++;
}

console.log();
if (dryRun) {
  console.log(`[dry-run] Would copy ${mapping.size} unique files.`);
} else {
  console.log(`Copied: ${copied}. Skipped (already existed): ${skipped}.`);
}

if (collisions.length > 0) {
  console.log();
  console.log(`${collisions.length} filename collision(s) — first source kept for each:`);
  for (const { dest, sources } of collisions) {
    console.log(`  ${dest}`);
    for (const s of sources) console.log(`    - ${s}`);
  }
}
