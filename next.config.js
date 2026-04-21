/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/rankings', destination: '/fighters', permanent: true },
    ];
  },
};

module.exports = nextConfig;
