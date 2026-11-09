# TBL Stats Public API (v1)

A free, public, **read-only** JSON API for live Team Boxing League stats, built
for the official website (teamboxingleague.com on Shopify).

**Base URL:** `https://www.tblstats.com/api/v1`

> Call the `www` address directly from browsers. `tblstats.com` redirects to
> `www.tblstats.com`, and that redirect doesn't carry CORS headers, so a
> browser request to the bare domain is blocked.

| Endpoint | What it returns |
|---|---|
| [`GET /standings`](#get-standings) | Every team with W-L-D record, ordered by rank |
| [`GET /leaders`](#get-leaders) | Top fighters in each main stat category |
| [`GET /results/latest`](#get-resultslatest) | Every match from the most recent fight date, round by round |
| [`GET /schedule`](#get-schedule) | The season schedule: upcoming fights and completed results with final scores |
| [`GET /teams/{slug}`](#get-teamsslug) | One team, its standing, and its roster with each fighter's record |
| [`GET /fighters/{id}`](#get-fightersid) | One fighter's profile and full fight history |

The numbers come from the same Google Sheet and the same calculations as
tblstats.com, so the API always agrees with the stats site.

---

## Conventions

### Season phase: `?phase=`

**All records and stats in this API are regular season only.** This is
intentional. Every response says which phase it covers in `meta.phase`.

Every endpoint accepts an optional `phase` query parameter:

| Value | Status |
|---|---|
| `regular` | **Default** for every endpoint. The same as leaving `phase` off. |
| `playoffs` | Planned, not available yet. Returns **400 `phase_not_available`**. |
| `all` | Planned (regular season + playoffs combined), not available yet. Returns **400 `phase_not_available`**. |

`https://tblstats.com/api/v1/standings` and
`https://tblstats.com/api/v1/standings?phase=regular` return the same thing.

You don't need to send `phase` today. If the theme sends `?phase=regular`
anyway, it will keep working unchanged after playoffs are added.

*For maintainers:* the playoff calculations already exist internally. To offer
them, add `'playoffs'` (and/or `'all'`) to `AVAILABLE_PHASES` in
`src/lib/api/v1.ts` and update this section.

### Team slugs

Team slugs match the Shopify page handles exactly:

| Team | Slug |
|---|---|
| Los Angeles Elite | `la-elite` |
| Las Vegas Hustle | `las-vegas-hustle-1` |
| Phoenix Fury | `phoenix-fury` |
| Dallas Enforcers | `dallas-enforcers` |
| Houston Hitmen | `houston-hitmen` |
| San Antonio Snipers | `san-antonio-snipers` |
| Boston Butchers | `boston-butchers` |
| Philadelphia Smoke | `philly-smoke` |
| NYC Attitude | `nyc-attitude-1` |
| Atlanta Attack | `atlanta-attack` |
| Miami Assassins | `miami-assassins` |
| Nashville Smash | `nashville-smash-1` |

The mapping lives in `SHOPIFY_TEAM_HANDLES` in `src/lib/api/v1.ts`. If a Shopify
handle ever changes, update it there.

### Team names: `name` vs `short_name`

Every team object, on every endpoint, has both fields:

| Field | Example | Use it for |
|---|---|---|
| `short_name` | `"LA Elite"` | **TBL's official display name.** Use this on the website. |
| `name` | `"Los Angeles Elite"` | The long-standing full name. It is kept unchanged for compatibility. |
| `city` | `"Los Angeles"` | City only |

The official `short_name` values:

LA Elite · Las Vegas Hustle · Phoenix Fury · Dallas Enforcers · Houston Hitmen ·
San Antonio Snipers · Boston Butchers · Philadelphia Smoke · NYC Attitude ·
Atlanta Attack · Miami Assassins · Nashville Smash

They live in `OFFICIAL_SHORT_NAMES` in `src/lib/api/v1.ts`.

### Fighter IDs

Fighters are identified by the stable **Fighter ID** from the **Data** tab of
the league Google Sheet: the column headed exactly `Fighter ID` (planned for
column B). IDs never change when a fighter's name is corrected.

Until that column is filled in, each fighter gets a **temporary** ID based on
their name, marked `"id_is_stable": false`. Temporary IDs stop working once a
fighter has a real ID. **Only save or link to IDs where `id_is_stable` is
`true`.**

Every fighter object carries the ID:

```json
{ "id": "TBL019", "id_is_stable": true, "name": "Jordan Reyes" }
```

### Response envelope

Successful responses look like this:

```json
{
  "data": { "...": "the endpoint's payload" },
  "meta": {
    "phase": "regular",
    "sheet_last_updated": "2026-11-09T17:46:31.000Z",
    "sheet_last_updated_source": "data_fetched",
    "generated_at": "2026-11-09T17:49:02.118Z"
  }
}
```

| `meta` field | Meaning |
|---|---|
| `phase` | Which part of the season the numbers cover. Always `"regular"` for now. |
| `sheet_last_updated` | When the stats data was last updated, as an ISO 8601 UTC timestamp. See below. |
| `sheet_last_updated_source` | Which clock `sheet_last_updated` uses: `"sheet_modified"` or `"data_fetched"`. See below. |
| `generated_at` | When this response was built. With caching, it can be a few minutes older than "now". |

#### `sheet_last_updated`

This is the time the stats changed or were last refreshed. The stats come from
the **Data** tab of the league Google Sheet. The timestamp is in UTC, so format
it for display in the browser, e.g.
`new Date(meta.sheet_last_updated).toLocaleString()`.

`sheet_last_updated_source` tells you what the time means:

| Source | Meaning |
|---|---|
| `"sheet_modified"` | Google's own "last modified" time for the Data tab. This is the true edit time. It's used whenever Google provides it. |
| `"data_fetched"` | The last time tblstats.com downloaded the Data tab from Google **and** parsed it successfully. Google doesn't always report a modified time for published sheets, so this is the fallback. The site re-downloads the sheet every couple of minutes while the API is in use, so this shows how fresh the data is, **not** when someone last edited the sheet. |

If the Data tab couldn't be loaded or parsed, both fields are `null`. In that
case the endpoints usually return `503 data_unavailable` anyway.

### Errors

Errors always come back as JSON with a matching HTTP status code. They never
come back as an HTML page.

```json
{ "error": { "status": 404, "code": "team_not_found", "message": "No team with slug \"dalas\". Valid slugs: la-elite, ..." } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_phase`, `invalid_limit`, `invalid_min_rounds`, `invalid_category`, `invalid_status` | A query parameter has a bad value |
| 400 | `phase_not_available` | `phase` is `playoffs` or `all`, which aren't offered yet |
| 404 | `team_not_found` | Unknown team slug |
| 404 | `fighter_not_found` | Unknown fighter ID |
| 404 | `no_results` | `/results/latest`: no completed regular-season matches yet |
| 500 | `internal_error` | Unexpected server error |
| 503 | `data_unavailable` | The Google Sheet couldn't be reached. Retry in a minute. |

### Caching

Successful responses send
`Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`:

- browsers reuse a response for 1 minute
- Vercel's CDN serves it for 5 minutes
- after that, the CDN refreshes it in the background

The Google Sheet itself is read at most every couple of minutes, no matter how
much traffic the API gets. **A change in the sheet can take up to about 5–7
minutes to show up in the API.**

### CORS (which websites can call the API)

Browsers may call the API from these sites:

- `https://teamboxingleague.com` and `https://www.teamboxingleague.com`
- any `https://*.myshopify.com` store or theme preview
- any `https://*.shopifypreview.com` shareable theme preview link
- `http://127.0.0.1:9292` (local theme development with `shopify theme dev`)

Other websites' browser requests are blocked. Server-to-server requests (curl,
scripts) work from anywhere because the data is public.

---

## `GET /standings`

Every team, ordered by rank. Ranking uses the same tiebreakers as
tblstats.com/teams:

1. record
2. head-to-head sweep
3. point differential
4. head-to-head point differential
5. points for

Teams that haven't played yet in the chosen phase are listed last at 0-0-0.

`record` is `W-L-D`. Wins and losses match tblstats.com. Draws are counted from
match results (a match with tied total points).

**Example:** `GET /api/v1/standings`

```json
{
  "data": [
    {
      "rank": 1,
      "team": {
        "slug": "la-elite",
        "name": "Los Angeles Elite",
        "short_name": "LA Elite",
        "city": "Los Angeles",
        "color": "#552583",
        "logo_url": "https://tblstats.com/logos/los-angeles.png"
      },
      "wins": 2,
      "losses": 0,
      "draws": 1,
      "record": "2-0-1",
      "matches_played": 3,
      "points_for": 68,
      "points_against": 61,
      "point_diff": 7,
      "streak": "W2"
    },
    {
      "rank": 2,
      "team": {
        "slug": "las-vegas-hustle-1",
        "name": "Las Vegas Hustle",
        "short_name": "Las Vegas Hustle",
        "city": "Las Vegas",
        "color": "#b4975a",
        "logo_url": "https://tblstats.com/logos/las-vegas.png"
      },
      "wins": 2,
      "losses": 1,
      "draws": 0,
      "record": "2-1-0",
      "matches_played": 3,
      "points_for": 60,
      "points_against": 56,
      "point_diff": 4,
      "streak": "L1"
    }
  ],
  "meta": { "phase": "regular", "sheet_last_updated": "2026-11-09T17:46:31.000Z", "sheet_last_updated_source": "data_fetched", "generated_at": "2026-11-08T05:02:58.575Z" }
}
```

*(Only 2 of the 12 teams are shown here.)*

---

## `GET /leaders`

The top fighters in each category, in this order:

| `key` | Label | Best is | Qualifier? |
|---|---|---|---|
| `net_points` | Net Points | highest | – |
| `points_scored` | Points Scored | highest | – |
| `points_allowed_per_round` | Fewest Points Allowed per Round | lowest | yes |
| `war` | WAR | highest | – |
| `wins` | Wins | highest | – |
| `win_pct` | Win % | highest | yes |
| `nppr` | Net Points per Round | highest | yes |
| `ko_tko` | KO / TKO | highest | – |
| `knockdowns` | Knockdowns | highest | – |

**Qualifier:** per-round and percentage stats only include fighters with at
least `min_rounds` rounds. That stops a fighter who went 1-0 from leading the
league. By default the cutoff is half the league-average number of rounds
(minimum 1), and it is reported in each category as `min_rounds`.

Tied fighters share a rank (1, 2, 2, 4).

**Query parameters**

| Param | Default | Notes |
|---|---|---|
| `phase` | `regular` | See [Season phase](#season-phase-phase) |
| `limit` | `10` | Fighters per category, 1–50 |
| `category` | all | Return only one category, e.g. `?category=net_points` |
| `min_rounds` | auto | Override the qualifier, e.g. `?min_rounds=5` |

**Example:** `GET /api/v1/leaders?limit=2&category=net_points`

```json
{
  "data": [
    {
      "key": "net_points",
      "label": "Net Points",
      "order": "highest_first",
      "min_rounds": null,
      "leaders": [
        {
          "rank": 1,
          "value": 6,
          "fighter": {
            "id": "TBL016",
            "id_is_stable": true,
            "name": "Marcus Hale",
            "team": {
              "slug": "la-elite",
              "name": "Los Angeles Elite",
              "short_name": "LA Elite",
              "city": "Los Angeles",
              "color": "#552583",
              "logo_url": "https://tblstats.com/logos/los-angeles.png"
            },
            "weight_class": "Lightweight",
            "gender": "Male",
            "profile_url": "https://tblstats.com/fighters/marcus-hale"
          },
          "record": "3-0-0",
          "rounds": 3
        },
        {
          "rank": 2,
          "value": 5,
          "fighter": {
            "id": "TBL001",
            "id_is_stable": true,
            "name": "Dre Collins",
            "team": {
              "slug": "atlanta-attack",
              "name": "Atlanta Attack",
              "short_name": "Atlanta Attack",
              "city": "Atlanta",
              "color": "#c8102e",
              "logo_url": "https://tblstats.com/logos/atlanta.png"
            },
            "weight_class": "Lightweight",
            "gender": "Male",
            "profile_url": "https://tblstats.com/fighters/dre-collins"
          },
          "record": "3-0-0",
          "rounds": 3
        }
      ]
    }
  ],
  "meta": { "phase": "regular", "sheet_last_updated": "2026-11-09T17:46:31.000Z", "sheet_last_updated_source": "data_fetched", "generated_at": "2026-11-08T05:02:58.575Z", "limit": 2 }
}
```

---

## `GET /results/latest`

Every team-vs-team match from the **most recent fight date**. A fight night can
have several matches. Each match includes its rounds in order, with both
fighters' scores.

- `team1` / `team2` are the two teams. Each has a `score` (total points) and
  `rounds_won`.
- `winner` is `"team1"`, `"team2"` or `"draw"`. This applies to the whole match
  and to each round.
- `round_phase` is the bout label from the sheet (e.g. Launch, Middle, Money).
  `season_phase` is the part of the season the match belongs to. It is always
  `regular` for now.
- `week` and `venue` come from the Schedule tab. They are `null` when not listed.

This shows the most recent **regular-season** fight date. When playoffs are
added, this endpoint's default will be revisited.

**Example:** `GET /api/v1/results/latest`

```json
{
  "data": {
    "date": "2026-10-18",
    "matches": [
      {
        "match_id": 19,
        "date": "2026-10-18",
        "week": 3,
        "season_phase": "regular",
        "venue": { "name": "Main Arena", "city": "Dallas" },
        "stats_url": "https://tblstats.com/matches/19",
        "team1": {
          "slug": "miami-assassins",
          "name": "Miami Assassins",
          "short_name": "Miami Assassins",
          "city": "Miami",
          "color": "#98002e",
          "logo_url": "https://tblstats.com/logos/miami.png",
          "score": 26,
          "rounds_won": 2
        },
        "team2": {
          "slug": "dallas-enforcers",
          "name": "Dallas Enforcers",
          "short_name": "Dallas Enforcers",
          "city": "Dallas",
          "color": "#003594",
          "logo_url": "https://tblstats.com/logos/dallas.png",
          "score": 22,
          "rounds_won": 1
        },
        "winner": "team1",
        "rounds": [
          {
            "round": 1,
            "round_id": 55,
            "round_phase": "Launch",
            "weight_class": "Lightweight",
            "method": "KO / TKO",
            "team1_fighter": { "id": "TBL019", "id_is_stable": true, "name": "Jordan Reyes", "score": 7 },
            "team2_fighter": { "id": "TBL007", "id_is_stable": true, "name": "Cole Barnes", "score": 4 },
            "winner": "team1"
          },
          {
            "round": 2,
            "round_id": 56,
            "round_phase": "Middle",
            "weight_class": "Welterweight",
            "method": "Decision",
            "team1_fighter": { "id": "TBL020", "id_is_stable": true, "name": "Luis Ortega", "score": 8 },
            "team2_fighter": { "id": "TBL008", "id_is_stable": true, "name": "Ty Morgan", "score": 10 },
            "winner": "team2"
          },
          {
            "round": 3,
            "round_id": 57,
            "round_phase": "Money",
            "weight_class": "Middleweight",
            "method": "KO / TKO",
            "team1_fighter": { "id": "TBL021", "id_is_stable": true, "name": "Andre Price", "score": 11 },
            "team2_fighter": { "id": "TBL009", "id_is_stable": true, "name": "Sam Whitfield", "score": 8 },
            "winner": "team1"
          }
        ]
      }
    ]
  },
  "meta": { "phase": "regular", "sheet_last_updated": "2026-11-09T17:46:31.000Z", "sheet_last_updated_source": "data_fetched", "generated_at": "2026-11-08T05:02:58.575Z" }
}
```

---

## `GET /schedule`

The season schedule from the **Schedule** tab, joined to final scores by
Match ID. One entry per scheduled match, ordered by date.

- `status` is `upcoming`, `completed` or `cancelled`. An entry is `completed`
  as soon as its match has results on the Data tab.
- `team1` / `team2` are team objects, or `null` while a team is TBD.
- Completed entries use the match's own team order, so `result` lines up with
  `/results/latest`. `result` and `stats_url` are `null` until the match is played.
- `date` is `YYYY-MM-DD`. `time` is the sheet's text (for example `7:00PM`, the
  venue's local time) or `null`.
- `data.next` is the first upcoming entry (or `null`), handy for a "next
  fight night" banner.
- With the default `phase=regular`, completed playoff matches are left out.
  Upcoming entries are always listed, because the sheet doesn't say which
  phase a future match belongs to.

**Query parameters**

| Param | Default | Notes |
|---|---|---|
| `phase` | `regular` | See [Season phase](#season-phase-phase) |
| `status` | `all` | `all`, `upcoming` or `completed`. Anything else is `400 invalid_status` |
| `team` | none | A team slug. Only that team's matches. Unknown slugs are `404 team_not_found` |

**Example:** `GET /api/v1/schedule?team=phoenix-fury`

```json
{
  "data": {
    "next": {
      "match_id": null,
      "week": 22,
      "date": "2027-03-14",
      "time": "7:00PM",
      "status": "upcoming",
      "season_phase": null,
      "venue": { "name": "We-Ko-Pa Casino Resort", "city": "Fort McDowell, AZ" },
      "team1": { "slug": "phoenix-fury", "name": "Phoenix Fury", "short_name": "Phoenix Fury", "city": "Phoenix", "color": "#e56020", "logo_url": "https://tblstats.com/logos/phoenix.png" },
      "team2": null,
      "result": null,
      "stats_url": null
    },
    "entries": [
      {
        "match_id": 6,
        "week": 2,
        "date": "2026-03-29",
        "time": "7:00PM",
        "status": "completed",
        "season_phase": "regular",
        "venue": { "name": "Roadrunner Boston", "city": "Boston, MA" },
        "team1": { "slug": "phoenix-fury", "name": "Phoenix Fury", "short_name": "Phoenix Fury", "city": "Phoenix", "color": "#e56020", "logo_url": "https://tblstats.com/logos/phoenix.png" },
        "team2": { "slug": "boston-butchers", "name": "Boston Butchers", "short_name": "Boston Butchers", "city": "Boston", "color": "#ba0c2f", "logo_url": "https://tblstats.com/logos/boston.png" },
        "result": { "team1_score": 24, "team2_score": 21, "team1_rounds_won": 13, "team2_rounds_won": 11, "winner": "team1" },
        "stats_url": "https://tblstats.com/matches/6"
      }
    ]
  },
  "meta": { "phase": "regular", "status": "all", "team": "phoenix-fury", "sheet_last_updated": "2026-11-02T18:00:00.000Z", "sheet_last_updated_source": "sheet_modified", "generated_at": "2026-11-09T19:00:00.000Z" }
}
```

*(Entries shortened to one match. Values are illustrative.)*

---

## `GET /teams/{slug}`

One team: its details, its current standing, and its roster. Each roster entry
includes the fighter's stats for the chosen phase. The roster is sorted by net
points, highest first. Unknown slugs return **404 `team_not_found`**.

**Example:** `GET /api/v1/teams/la-elite`

```json
{
  "data": {
    "slug": "la-elite",
    "name": "Los Angeles Elite",
    "short_name": "LA Elite",
    "city": "Los Angeles",
    "color": "#552583",
    "logo_url": "https://tblstats.com/logos/los-angeles.png",
    "stats_url": "https://tblstats.com/teams/los-angeles",
    "standing": {
      "rank": 1,
      "team": { "slug": "la-elite", "name": "Los Angeles Elite", "short_name": "LA Elite", "city": "Los Angeles", "color": "#552583", "logo_url": "https://tblstats.com/logos/los-angeles.png" },
      "wins": 2,
      "losses": 0,
      "draws": 1,
      "record": "2-0-1",
      "matches_played": 3,
      "points_for": 68,
      "points_against": 61,
      "point_diff": 7,
      "streak": "W2"
    },
    "roster": [
      {
        "id": "TBL016",
        "id_is_stable": true,
        "name": "Marcus Hale",
        "team": { "slug": "la-elite", "name": "Los Angeles Elite", "short_name": "LA Elite", "city": "Los Angeles", "color": "#552583", "logo_url": "https://tblstats.com/logos/los-angeles.png" },
        "weight_class": "Lightweight",
        "gender": "Male",
        "profile_url": "https://tblstats.com/fighters/marcus-hale",
        "stats": {
          "wins": 3,
          "losses": 0,
          "draws": 0,
          "record": "3-0-0",
          "rounds": 3,
          "win_pct": 1,
          "net_points": 6,
          "nppr": 2,
          "points_scored": 23,
          "points_allowed": 17,
          "points_allowed_per_round": 5.667,
          "war": 0.393,
          "ko_tko": 2,
          "knockdowns": 0,
          "double_knockdowns": 0
        }
      }
    ]
  },
  "meta": { "phase": "regular", "sheet_last_updated": "2026-11-09T17:46:31.000Z", "sheet_last_updated_source": "data_fetched", "generated_at": "2026-11-08T05:03:29.087Z" }
}
```

*(Roster shortened to one fighter.)*

### The `stats` object

The same `stats` object appears on team rosters and fighter profiles. Each
"round" is one bout.

| Field | Meaning |
|---|---|
| `wins`, `losses`, `draws`, `record` | Bout results (`W-L-D`). Disqualified bouts are excluded, as on tblstats.com. |
| `rounds` | Bouts fought |
| `win_pct` | Wins ÷ (wins + losses), from 0 to 1 |
| `net_points` | Points scored minus points allowed |
| `nppr` | Net points per round |
| `points_scored`, `points_allowed` | Totals |
| `points_allowed_per_round` | Points allowed ÷ rounds |
| `war` | Wins Above Replacement |
| `ko_tko`, `knockdowns`, `double_knockdowns` | Finishes in bouts won |

---

## `GET /fighters/{id}`

One fighter's profile, stats for the chosen phase, and every bout in that
phase, newest first. `{id}` is the fighter's ID (see [Fighter IDs](#fighter-ids)).
Matching ignores upper/lower case. Unknown IDs return
**404 `fighter_not_found`**.

If the fighter has no bouts in the chosen phase, `stats` is all zeros and
`fights` is empty. The fighter's profile still comes back.

**Example:** `GET /api/v1/fighters/TBL019`

```json
{
  "data": {
    "id": "TBL019",
    "id_is_stable": true,
    "name": "Jordan Reyes",
    "team": { "slug": "miami-assassins", "name": "Miami Assassins", "short_name": "Miami Assassins", "city": "Miami", "color": "#98002e", "logo_url": "https://tblstats.com/logos/miami.png" },
    "weight_class": "Lightweight",
    "gender": "Male",
    "profile_url": "https://tblstats.com/fighters/jordan-reyes",
    "weight_classes": ["Lightweight"],
    "instagram": "https://www.instagram.com/jordanreyes/",
    "streak": "W1",
    "stats": {
      "wins": 2,
      "losses": 1,
      "draws": 1,
      "record": "2-1-1",
      "rounds": 4,
      "win_pct": 0.667,
      "net_points": 4,
      "nppr": 1,
      "points_scored": 25,
      "points_allowed": 21,
      "points_allowed_per_round": 5.25,
      "war": 0.25,
      "ko_tko": 1,
      "knockdowns": 1,
      "double_knockdowns": 0
    },
    "fights": [
      {
        "date": "2026-10-18",
        "match_id": 19,
        "round_id": 55,
        "round": 1,
        "round_phase": "Launch",
        "season_phase": "regular",
        "week": 3,
        "weight_class": "Lightweight",
        "opponent": {
          "id": "TBL007",
          "id_is_stable": true,
          "name": "Cole Barnes",
          "team": { "slug": "dallas-enforcers", "name": "Dallas Enforcers", "short_name": "Dallas Enforcers", "city": "Dallas", "color": "#003594", "logo_url": "https://tblstats.com/logos/dallas.png" }
        },
        "result": "W",
        "method": "KO / TKO",
        "points_scored": 7,
        "points_allowed": 4,
        "net_points": 3,
        "match_url": "https://tblstats.com/matches/19"
      }
    ]
  },
  "meta": { "phase": "regular", "sheet_last_updated": "2026-11-09T17:46:31.000Z", "sheet_last_updated_source": "data_fetched", "generated_at": "2026-11-08T05:03:00.000Z" }
}
```

*(Fight list shortened to one bout.)*

---

## Using it from the Shopify theme

A minimal example for a section or snippet (`.liquid`) that shows standings:

```html
<div id="tbl-standings">Loading standings…</div>
<script>
  fetch('https://tblstats.com/api/v1/standings')
    .then((r) => r.json())
    .then(({ data, error }) => {
      const el = document.getElementById('tbl-standings');
      if (error) { el.textContent = 'Standings are unavailable right now.'; return; }
      el.innerHTML = data.map((row) =>
        `<div>${row.rank}. <a href="/pages/${row.team.slug}">${row.team.short_name}</a> ${row.record}</div>`
      ).join('');
    })
    .catch(() => {
      document.getElementById('tbl-standings').textContent = 'Standings are unavailable right now.';
    });
</script>
```

On a team page, `{{ page.handle }}` is already the team slug:

```js
fetch('https://tblstats.com/api/v1/teams/{{ page.handle }}')
```

---

## For maintainers

- Routes: `src/app/api/v1/**/route.ts`
- JSON shapes: `src/lib/api/v1.ts`
- CORS, caching and errors: `src/lib/api/http.ts`
- This API is versioned. Adding new fields is safe. Renaming or removing fields
  would break the website, so do that in a new `/api/v2` instead.
