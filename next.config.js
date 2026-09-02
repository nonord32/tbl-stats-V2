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

  // The four advanced-stat leaderboards became one /advanced page with three
  // views, and the six methodology pages became one /stats page with anchored
  // sections. These URLs have been shared, so they redirect rather than 404.
  async redirects() {
    return [
      // Leaderboards → the matching view on /advanced.
      { source: '/moments', destination: '/advanced?view=rounds', permanent: true },
      { source: '/comebacks', destination: '/advanced?view=matches', permanent: true },
      { source: '/wpa', destination: '/advanced?view=fighters', permanent: true },
      { source: '/ratings', destination: '/advanced?view=fighters&stat=ratings', permanent: true },

      // Explainers → their section anchor. A hash in the destination rides
      // along in the Location header.
      { source: '/stats/wpa', destination: '/stats#wpa', permanent: true },
      { source: '/stats/leverage', destination: '/stats#leverage', permanent: true },
      { source: '/stats/comebacks', destination: '/stats#comebacks', permanent: true },
      { source: '/stats/ratings', destination: '/stats#ratings', permanent: true },
      { source: '/stats/war', destination: '/stats#war', permanent: true },
      { source: '/stats/glossary', destination: '/stats#glossary', permanent: true },

      // Retired earlier; its content is covered by the /advanced division filter.
      { source: '/rankings', destination: '/advanced?view=fighters', permanent: true },
    ];
  },
};

module.exports = nextConfig;
