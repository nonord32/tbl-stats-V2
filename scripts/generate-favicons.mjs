// scripts/generate-favicons.mjs
// Run once: node scripts/generate-favicons.mjs
import sharp from 'sharp';
import { copyFileSync, mkdirSync } from 'fs';

const src = 'public/tbl-logo.png';

const sizes = [
  { size: 16,  out: 'public/favicon-16x16.png' },
  { size: 32,  out: 'public/favicon-32x32.png' },
  { size: 48,  out: 'public/favicon-48x48.png' },
  { size: 180, out: 'public/apple-touch-icon.png' },
  { size: 192, out: 'public/icon-192.png' },
  { size: 512, out: 'public/icon-512.png' },
];

for (const { size, out } of sizes) {
  await sharp(src).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  console.log(`✓ ${out}`);
}

// Copy 48x48 as favicon.ico placeholder (browsers accept PNG served as .ico)
copyFileSync('public/favicon-48x48.png', 'public/favicon.ico');
console.log('✓ public/favicon.ico');
