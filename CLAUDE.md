# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TBL Stats (tblstats.com) is the stats site for Team Boxing League. It is a Next.js 14 App Router app on Vercel. The data source is a Google Sheet; Supabase is used only for user features.

## Commands

```bash
npm run dev            # http://localhost:3000
npm run build          # production build (what Vercel runs)
npm run lint           # next lint
npx tsc --noEmit       # type-check (no script for it)
npm test               # node:test suites in scripts/*.test.mjs (WPA, ratings, WAR)
```

- **Run one test file:** `node --experimental-strip-types --test scripts/war.test.mjs`
- **Run one test by name:** add `--test-name-pattern "<regex>"` to the command above.
- **About the tests:** they import the pure `src/lib/**/core.ts` modules directly as `.ts` files. That only works because those cores have **no runtime imports** (no `@/` aliases, no React, no Next). Keep it that way when editing them.
- `npm run gen:wpa` regenerates `src/lib/wpa/wp-table-2026.json` from `wpa-model-2026.json`. Run it after any WPA model change. The script checks checksums and exits non-zero on any mismatch.
- `cap:*` scripts drive the iOS Capacitor wrapper. It is a thin shell that loads `https://tblstats.com` (`capacitor.config.ts`), so web changes ship to the app without an app release.

## Data architecture

### Everything comes from one function

`getAllData()` in `src/lib/data.ts` is wrapped in React `cache`. It fetches the published-CSV tabs of the league sheet (URLs are in the `SHEETS` constant) in parallel and parses them into `ParsedSheetData` (`src/types/index.ts`).

- **Each tab and each parser is isolated in try/catch.** A broken tab degrades to an empty result instead of crashing pages. Preserve this pattern.
- **Every fetch has a 20s timeout.** A hung Google fetch would otherwise stall `next build`, because static pages fetch at build time.

### Tabs

| Tab | What it's used for |
|---|---|
| Data (gid=0) | Source of truth for **all** fighter and match stats |
| Standings | Team records |
| Fighter Stats | Only Instagram URLs and the "Last Updated" date (row 2). Not stats, despite the README. |
| Schedule | Weeks and venues, joined to matches by Match ID (`matchIndex`) |
| Highlights | Highlight links |
| Awards | Awards |

### How the Data tab is read

- **One row = one fighter's side of one round/bout.**
  - Rows are grouped by `Match ID`, then by `Round ID`.
  - `Round ID` is season-unique and monotonic, so it is the stable sort key.
  - `Round Num` repeats across matches.
- **Header lookup is fuzzy.** It goes through `pick()` / `normKey()`, which match case- and punctuation-insensitively. Duplicate headers get a `__N` suffix.
- **The team column is detected by content** (`detectTeamColumn`), because the sheet's team header has been mislabeled.
- **Never match columns by position.** The sheet's layout changes.

### Derived stats and domain rules

- **Fighter stats are computed in code.** `buildFighters()` (`src/lib/warStats.ts`) derives record, net points, NPPR, WAR and finishing stats from bout history. Formulas live in `src/lib/war/core.ts`.
- **DQ bouts** count toward team match totals (box score, PF/PA, standings), but are excluded from every per-fighter stat.
- **Match winner = higher total points.** It is not rounds won. Tied totals are a draw, even if the sheet's `Match Result` column says otherwise.
- **Box score orientation:** each team's `teamMatches` entry stores its box score from that team's perspective (`score1` = us).
- **Team streaks** are recomputed from match data.

### Season phases

- Each match has a `regular` | `playoffs` phase, from a `Game Phase` column. Blank means regular.
- `src/lib/phaseStats.ts` provides the per-phase views:
  - `fightersByPhase` (fighters, pre-built per scope)
  - `aggregateTeamStandingsByPhase` (team standings recomputed from phase-filtered matches)
  - `filterTeamMatchesByPhase`
- The phase toggle only appears once playoff data exists.

### Standings order

Use `sortStandings()` (`src/lib/standings.ts`) wherever teams are ranked, so every view agrees. The tiebreakers, in order:

1. record
2. head-to-head sweep
3. point differential
4. head-to-head point differential
5. points for
6. name

Clinch logic in the same file enumerates the remaining games.

### Identity and naming

- **Fighters are keyed by `toSlug(name)`** everywhere on the site.
- **`data.fighterIds`** maps slug → stable ID from an optional `Fighter ID` column on the Data tab. Only the public API uses it.
- **Team names vary between tabs** ("Las Vegas" vs "Las Vegas Hustle"). Resolve them through `src/lib/teams.ts`: city-key, prefix-matching helpers that also supply full names, colors and `/logos/{city}.png`. Some older code uses ad-hoc `startsWith` matching.

### Advanced models

- **WPA / comebacks:** `src/lib/wpa/`. Runtime only does table lookups.
- **Opponent-adjusted ratings:** `src/lib/ratings/`. A ridge solve runs at request time, full season only.

Both are versioned per season via `*-2026.json` model files, so past figures stay reproducible. Live validation endpoints: `/api/admin/wpa-validate` and `/api/admin/ratings-validate`.

## Caching

- **Pages:** most set `export const revalidate = 300` (ISR).
- **CSV fetches:** use `next: { revalidate: 120 }`. Next's data cache persists on disk in `.next/cache/fetch-cache`, so in local dev stale sheet data survives a server restart until that folder is deleted.

## Supabase (user features only)

- **Schema:** `supabase/schema.sql`. Tables: `profiles`, `picks` (pick'em), `leaderboard` (a view), `bracket_entries`, `fantasy_rosters`, `fantasy_weeks`, `fighter_socials`.
- **Clients:** `src/lib/supabase/{server,client}.ts`. `safe.ts` wraps calls so an outage returns fallbacks instead of throwing.
- **`src/middleware.ts`** refreshes auth cookies only for an explicit allow-list (`/bracket`, `/admin`, `/leaderboard`, `/fantasy` and their APIs). Public stat pages are deliberately excluded so they serve from the edge cache. Don't widen the matcher casually.
- **Scoring is lazy.** `ensureResolved()` (`src/lib/resolve-on-read.ts`) scores pending picks and fantasy weeks during page renders. It uses the idempotent updates in `src/lib/resolve.ts`, which are also called by `/api/resolve` and `/api/fantasy/score`.
- **Admin API routes** (`/api/admin/*`, `/api/resolve`) require `Authorization: Bearer $RESOLVE_SECRET` and use the service-role key.
- **Instagram overrides:** the `fighter_socials` table overrides the sheet's Instagram URLs.
- **Env vars:** see `.env.local.example`.

## Public API (`/api/v1`)

- **What it is:** read-only JSON for teamboxingleague.com (Shopify).
- **Files:** routes in `src/app/api/v1/`, response shapes in `src/lib/api/v1.ts`, CORS allow-list, caching and JSON errors in `src/lib/api/http.ts`.
- **Contract:** documented in `API.md`, and it's versioned.
  - Team slugs are the Shopify page handles (`SHOPIFY_TEAM_HANDLES`), not site slugs.
  - Team objects carry `short_name`, TBL's official display names (`OFFICIAL_SHORT_NAMES`). `name` is kept for compatibility.
  - The API is regular season only. `?phase=` is validated against `AVAILABLE_PHASES`, which is currently `['regular']`. The builders already support playoffs/all, so enabling them is a one-line change plus an API.md update.
  - `meta.sheet_last_updated` comes from `ParsedSheetData.dataUpdated`: Google's Last-Modified header when present, else the Data-tab CSV's `Date` header, which Next's fetch cache preserves. The site's own `lastUpdated` is separate.
  - `/fighters/{id}` accepts the stable Fighter ID **or** the fighter's name slug, even after a stable ID exists, so links the website saved never break (`findFighterSlug`).
  - Fighter `bio` / `photo_url` come from optional `Bio` / `Photo URL` columns on the Fighter Stats tab (`parseFighterProfiles` in `data.ts`, stored as `fighterProfiles`).
  - Adding fields is safe. Renames and removals need a `/api/v2`.

## Testing against fake sheet data

The Google Sheet may be unreachable from sandboxes. To exercise pages or the API offline:

1. Write a Node preload (`--require`) that replaces `globalThis.fetch` and returns fixture CSVs for `docs.google.com` URLs, keyed by the `gid` query param.
2. Start the server with it:
   ```bash
   NODE_OPTIONS="--require ./mock.cjs" npm run dev
   ```
   Next wraps whatever `fetch` exists at startup, so the mock is used.
3. Clear `.next/cache/fetch-cache` whenever you switch fixtures.

## Repo notes

- **`README.md` is partly outdated.**
  - Its file tree lists `Nav.tsx` and `Footer.tsx`; chrome components now live in `src/components/chrome/`.
  - It says the Fighter Stats tab supplies stats; it no longer does.
  - Its sheet column tables are stale. The parsers in `data.ts` are authoritative.
- **Redirects:** old URLs (`/wpa`, `/ratings`, `/stats/*`, etc.) redirect in `next.config.js` because they've been shared. Keep those redirects when restructuring routes.
- **`vercel.json`** sets security headers on all routes, including `X-Frame-Options: DENY`.
