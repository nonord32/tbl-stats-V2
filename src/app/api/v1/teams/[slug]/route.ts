// GET /api/v1/teams/[slug] — one team with its roster and each fighter's record.
// [slug] is the Shopify page handle (e.g. la-elite). Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import { buildTeam, isDataUnavailable, KNOWN_TEAM_SLUGS, resolvePhase } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  return safely(request, async () => {
    const slug = (params.slug ?? '').toLowerCase();
    const phaseResult = resolvePhase(new URL(request.url).searchParams.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);
    const phase = phaseResult.phase;
    if (!KNOWN_TEAM_SLUGS.includes(slug)) {
      return jsonError(request, 404, 'team_not_found', `No team with slug "${slug}". Valid slugs: ${KNOWN_TEAM_SLUGS.join(', ')}.`);
    }
    const data = await getAllData();
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    const body = buildTeam(data, slug, phase);
    if (!body) return jsonError(request, 404, 'team_not_found', `Team "${slug}" was not found in the league data.`);
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
