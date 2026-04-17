// scripts/generate-og-image.mjs
// Run once: node scripts/generate-og-image.mjs
import sharp from 'sharp';

const W = 1200, H = 630;
const bg = { r: 19, g: 17, b: 26 }; // --nav-bg #13111a

// Center the logo (max 300px tall) on a dark background
const logo = await sharp('public/tbl-logo.png')
  .resize({ height: 220, fit: 'contain', background: { ...bg, alpha: 0 } })
  .toBuffer();

const { width: logoW, height: logoH } = await sharp(logo).metadata();

await sharp({
  create: { width: W, height: H, channels: 4, background: { ...bg, alpha: 255 } },
})
  .composite([
    {
      input: logo,
      left: Math.round((W - logoW) / 2),
      top: Math.round((H - logoH) / 2) - 20,
    },
  ])
  .png()
  .toFile('public/og-image.png');

console.log('✓ public/og-image.png (1200×630)');
