// src/app/sitemap.ts
import { MetadataRoute } from 'next';
import { getAllData, extractUniqueMatches } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getAllData();
  const base = 'https://tblstats.com';

  const fighterUrls = data.fighters.map((f) => ({
    url: `${base}/fighters/${f.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const teamUrls = data.teams.map((t) => ({
    url: `${base}/teams/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const matchUrls = extractUniqueMatches(data.teamMatches).map((m) => ({
    url: `${base}/matches/${m.matchIndex}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Leaderboards built on the advanced stats. These change with the season, so
  // they refresh daily alongside the core pages.
  const statLeaderboards = ['/wpa', '/ratings', '/comebacks', '/moments'].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // The methodology pages. Evergreen explainers — they only change when a model
  // does — but they need to be indexed, since they are what a search for
  // "win probability added boxing" should land on.
  const statMethodology = [
    '/stats/wpa',
    '/stats/leverage',
    '/stats/comebacks',
    '/stats/ratings',
    '/stats/war',
    '/stats/glossary',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    { url: base,                    lastModified: new Date(), changeFrequency: 'daily',  priority: 1   },
    { url: `${base}/fighters`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/teams`,         lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/results`,       lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    { url: `${base}/schedule`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    { url: `${base}/playoffs`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.7 },
    { url: `${base}/awards`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ...statLeaderboards,
    ...statMethodology,
    ...fighterUrls,
    ...teamUrls,
    ...matchUrls,
  ];
}
