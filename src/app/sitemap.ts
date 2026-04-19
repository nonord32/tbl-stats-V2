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

  return [
    { url: base,                    lastModified: new Date(), changeFrequency: 'daily',  priority: 1   },
    { url: `${base}/fighters`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/rankings`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/teams`,         lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
    { url: `${base}/results`,       lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    { url: `${base}/schedule`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    ...fighterUrls,
    ...teamUrls,
    ...matchUrls,
  ];
}
