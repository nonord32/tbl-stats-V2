// GET /api/v1/schedule — the season schedule (upcoming and completed), joined to
// final scores by Match ID. Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import {
  buildSchedule,
  isDataUnavailable,
  KNOWN_TEAM_SLUGS,
  resolvePhase,
  SCHEDULE_STATUSES,
  type ScheduleStatusFilter,
  resolveSeason,
} from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const params = new URL(request.url).searchParams;
    const phaseResult = resolvePhase(params.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);

    const status = (params.get('status')?.trim().toLowerCase() || 'all') as ScheduleStatusFilter;
    if (!SCHEDULE_STATUSES.includes(status)) {
      return jsonError(request, 400, 'invalid_status', `status must be one of: ${SCHEDULE_STATUSES.join(', ')}.`);
    }

    const team = params.get('team')?.trim().toLowerCase() || null;
    if (team && !KNOWN_TEAM_SLUGS.includes(team)) {
      return jsonError(request, 404, 'team_not_found', `No team with slug "${team}". Valid slugs: ${KNOWN_TEAM_SLUGS.join(', ')}.`);
    }

    const seasonResult = resolveSeason(params.get('season'));
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);
    const data = await getAllData(seasonResult.season);
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    return jsonOk(request, buildSchedule(data, phaseResult.phase, { status, team }));
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
