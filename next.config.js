/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Static pages fetch the Google-Sheets CSVs at build time; give slow (but
  // not hung — see the 20s fetch timeout in src/lib/data.ts) sheet responses
  // room before the build worker is killed.
  staticPageGenerationTimeout: 180,
};

module.exports = nextConfig;
