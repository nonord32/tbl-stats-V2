// src/lib/gameTime.ts
// Computes the exact UTC start time of a match using venue city timezone.
// Picks lock the moment the game starts, no matter where the user is.

const STATE_TIMEZONE: Record<string, string> = {
  AL: 'America/Chicago',    AK: 'America/Anchorage',  AZ: 'America/Phoenix',
  AR: 'America/Chicago',    CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York',   DE: 'America/New_York',    FL: 'America/New_York',
  GA: 'America/New_York',   HI: 'Pacific/Honolulu',    ID: 'America/Denver',
  IL: 'America/Chicago',    IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',    KS: 'America/Chicago',     KY: 'America/New_York',
  LA: 'America/Chicago',    ME: 'America/New_York',    MD: 'America/New_York',
  MA: 'America/New_York',   MI: 'America/Detroit',     MN: 'America/Chicago',
  MS: 'America/Chicago',    MO: 'America/Chicago',     MT: 'America/Denver',
  NE: 'America/Chicago',    NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York',   NM: 'America/Denver',      NY: 'America/New_York',
  NC: 'America/New_York',   ND: 'America/Chicago',     OH: 'America/New_York',
  OK: 'America/Chicago',    OR: 'America/Los_Angeles', PA: 'America/New_York',
  RI: 'America/New_York',   SC: 'America/New_York',    SD: 'America/Chicago',
  TN: 'America/Chicago',    TX: 'America/Chicago',     UT: 'America/Denver',
  VT: 'America/New_York',   VA: 'America/New_York',    WA: 'America/Los_Angeles',
  WV: 'America/New_York',   WI: 'America/Chicago',     WY: 'America/Denver',
};

/** Extract IANA timezone from a venue city string like "Houston, TX" or "College Park, GA" */
export function timezoneFromVenueCity(venueCity: string): string {
  const match = venueCity.trim().match(/,\s*([A-Z]{2})\s*$/);
  if (match && STATE_TIMEZONE[match[1]]) return STATE_TIMEZONE[match[1]];
  return 'America/New_York'; // safe default (ET)
}

/**
 * Parse a date string that may or may not include a year.
 * Handles "4/24/2026", "4/24", "2026-04-24", etc.
 * Always returns [year, month (1-based), day] or null.
 */
function parseDateParts(dateStr: string): [number, number, number] | null {
  if (!dateStr) return null;

  // ISO format: 2026-04-24
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return [parseInt(iso[1]), parseInt(iso[2]), parseInt(iso[3])];

  // US format: 4/24/2026 or 4/24
  const us = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (us) {
    const year = us[3] ? parseInt(us[3]) : 2026;
    return [year, parseInt(us[1]), parseInt(us[2])];
  }

  return null;
}

/**
 * Parse a time string like "7:00 PM Local" → { h: 19, m: 0 }
 */
function parseTimeParts(timeStr: string): { h: number; m: number } | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

/**
 * Given a local game date/time and venue timezone, return the exact UTC Date.
 *
 * Strategy: take noon UTC on game day, format it in the venue timezone to get
 * the UTC offset, then shift the game time accordingly.
 */
export function getGameStartUTC(
  dateStr: string,
  timeStr: string,
  venueCity: string
): Date | null {
  const dateParts = parseDateParts(dateStr);
  const timeParts = parseTimeParts(timeStr);
  if (!dateParts || !timeParts) return null;

  const [year, month, day] = dateParts;
  const { h, m } = timeParts;
  const tz = timezoneFromVenueCity(venueCity);

  // Use noon UTC as reference point to compute timezone offset on this date
  const refUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(refUTC);
  let localHour = 12;
  let localMin = 0;
  parts.forEach(({ type, value }) => {
    if (type === 'hour') localHour = parseInt(value) % 24; // handle "24" edge case
    if (type === 'minute') localMin = parseInt(value);
  });

  // offset in minutes: how many minutes ahead of UTC is the timezone
  // (negative = behind UTC, e.g. ET is -240 in summer)
  const offsetMinutes = (localHour * 60 + localMin) - 12 * 60;

  // Game UTC time = game local time - offset
  const gameUTCMinutes = (h * 60 + m) - offsetMinutes;

  return new Date(Date.UTC(year, month - 1, day, 0, gameUTCMinutes, 0));
}

/** Grace period after the scheduled start during which picks are still accepted. */
const PICK_GRACE_MS = 40 * 60 * 1000;

/** Returns true if picks are still open (within PICK_GRACE_MS of game start). */
export function isPickOpen(
  dateStr: string,
  timeStr: string,
  venueCity: string
): boolean {
  const gameStart = getGameStartUTC(dateStr, timeStr, venueCity);
  if (!gameStart || isNaN(gameStart.getTime())) {
    // Fallback: if we can't parse, allow picks (fail open)
    return true;
  }
  const lockTime = new Date(gameStart.getTime() + PICK_GRACE_MS);
  return new Date() < lockTime;
}
