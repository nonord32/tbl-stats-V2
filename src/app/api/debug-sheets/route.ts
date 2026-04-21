// Diagnostic endpoint — returns raw sheet structure + what our parser detects,
// so we can pinpoint why match parsing might be empty. Remove once stable.
import Papa from 'papaparse';
import { getAllData } from '@/lib/data';

const SHEETS: Record<string, string> = {
  fighters:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1927967888&single=true&output=csv',
  teams:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1404001793&single=true&output=csv',
  matches:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=0&single=true&output=csv',
  schedule:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1716719705&single=true&output=csv',
};

export const dynamic = 'force-dynamic';

async function preview(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
    const rows = parsed.data.slice(0, 8);
    return {
      rowCount: parsed.data.length,
      firstRows: rows,
      parseErrors: parsed.errors.slice(0, 3),
    };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function GET() {
  const raw: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(SHEETS)) {
    raw[name] = await preview(url);
  }

  // What the actual parser produces
  let parsed: Record<string, unknown> = {};
  try {
    const data = await getAllData();
    const teamMatchKeys = Object.keys(data.teamMatches);
    const fighterHistoryKeys = Object.keys(data.fighterHistory);
    const totalMatchEntries = teamMatchKeys.reduce((s, k) => s + data.teamMatches[k].length, 0);
    parsed = {
      teamsParsed: data.teams.length,
      fightersParsed: data.fighters.length,
      teamMatchKeys,
      totalMatchEntries,
      fighterHistoryCount: fighterHistoryKeys.length,
      sampleTeamMatch: teamMatchKeys[0]
        ? { team: teamMatchKeys[0], matches: data.teamMatches[teamMatchKeys[0]].slice(0, 1) }
        : null,
    };
  } catch (e) {
    parsed = { error: String(e) };
  }

  return Response.json({ raw, parsed }, { headers: { 'Cache-Control': 'no-store' } });
}
