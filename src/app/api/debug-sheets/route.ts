// Diagnostic endpoint — returns the first 3 rows of each source sheet so we
// can inspect actual column headers when parsing breaks. Remove once stable.
import Papa from 'papaparse';

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
  const out: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(SHEETS)) {
    out[name] = await preview(url);
  }
  return Response.json(out, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
