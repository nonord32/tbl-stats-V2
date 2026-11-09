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
| [`GET /matches/{id}`](#get-matchesid) | One match: box score, round by round, win probability, comeback, highlights |
| [`GET /schedule`](#get-schedule) | The season schedule: upcoming fights and completed results with final scores |
| [`GET /teams/{slug}`](#get-teamsslug) | One team: standing, roster, match log, next match, comeback totals, highlights |
| [`GET /fighters/{id}`](#get-fightersid) | One fighter's profile, fight history, a stat line per season, and career totals |
| [`GET /seasons`](#get-seasons) | Every league season, newest first, and which one is current |
| [`GET /fighters`](#get-fighters) | Every fighter in a season with stats, division and Instagram (for a directory) |
| [`GET /playoffs`](#get-playoffs) | The playoff bracket: seeds, every round, champion, or the live projection |
| [`GET /awards`](#get-awards) | Every season's awards and champions, grouped by award |
| [`GET /advanced`](#get-advanced) | Win probability added, leverage, clutch, opponent-adjusted ratings, comebacks |

The numbers come from the same Google Sheet and the same calculations as
tblstats.com, so the API always agrees with the stats site.

---

## Conventions

### Season: `?season=`

Each league season has its own Google Sheet. Every endpoint accepts an
optional `season` query parameter with a season id from
[`GET /seasons`](#get-seasons), for example `?season=2026`.

| Value | Meaning |
|---|---|
| *(left off)* | **The current season.** The same as sending its id. |
| `2026` | 2026 · Season 4 |
| `career` | **Only on `/leaders`:** all seasons added together. See [career leaders](#career-leaders). |

Unknown values return **400 `invalid_season`**. Every response names its
season in `meta.season`.

**Match IDs restart each season**, so match `1` in 2026 and match `1` in 2027
are different matches. Every match and fight object carries a `season` field.
When you link to a match, pass it along: `/matches/1?season=2026`.

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
their name, marked `"id_is_stable": false`. That name ID **keeps working** with
`/fighters/{id}` even after the fighter gets a real ID, so links built from it
don't break. Prefer the real ID when there is one: a name ID changes if the
fighter's name is corrected on the sheet.

### Fighter bio and photo

Every fighter object also has `bio` and `photo_url`, both `null` unless filled
in. They come from two optional columns on the **Fighter Stats** tab, found by
header name:

| Column header | Field | Notes |
|---|---|---|
| `Bio` | `bio` | Plain text |
| `Photo URL` (or `Photo`, `Headshot`) | `photo_url` | Must start with `https://`; anything else is ignored |

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
    "season": { "id": "2026", "year": 2026, "number": 4, "label": "2026 · Season 4", "is_current": true },
    "phase": "regular",
    "sheet_last_updated": "2026-11-09T17:46:31.000Z",
    "sheet_last_updated_source": "data_fetched",
    "generated_at": "2026-11-09T17:49:02.118Z"
  }
}
```

| `meta` field | Meaning |
|---|---|
| `season` | Which season the numbers are from: `id`, `year`, league season `number`, display `label` and `is_current`. For `/leaders?season=career` it is `{ "id": "career", "label": "Career", ... }`. |
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
| 404 | `match_not_found` | Unknown match ID |
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

<a id="career-leaders"></a>
**Career leaders: `?season=career`.** All seasons added together, like an
all-time leaderboard. The same fighter is matched across seasons by Fighter ID
(or by name when a season has no ID for them). Counting stats (wins, points,
WAR, knockouts…) are added up, and rates (win %, per-round stats) are
recalculated from the career totals, never averaged. Each fighter shows the
name, team and photo from their most recent season. `meta.seasons_included`
lists the seasons that were added. A season whose sheet can't be loaded is
left out rather than failing the request.

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

## `GET /matches/{id}`

Everything tblstats.com's match page shows, for one match. `{id}` is the
**Match ID** (`match_id` in `/results/latest`, `/schedule` and fighter fight
histories). Unknown IDs return **404 `match_not_found`**.

The match fields are the same as one entry of [`/results/latest`](#get-resultslatest),
plus:

| Field | Meaning |
|---|---|
| `rounds[].team1_win_prob_after` | Team 1's chance of winning the match after this round (0–1) |
| `rounds[].team1_wpa` | How much this round changed that chance (team 1's view; negative = it helped team 2) |
| `rounds[].leverage` | How much the round mattered going in (1 = average, higher = bigger moment) |
| `rounds[].is_peak_leverage` | `true` for the single biggest-moment round |
| `playoff_round` | `Quarterfinals`, `Semifinals` or `MegaBrawl` for playoff matches, else `null` |
| `comeback` | `null`, or the comeback story: `winner`, `lowest_win_prob`, `low_round`, `deficit_at_low`, `final_margin` and the three `key_rounds` (fighter, opponent, `wpa`, `method`) |
| `highlights` | Highlight links for this match (`label`, `url`, `type` such as `youtube` or `instagram`) |

Win-probability values are `null` for rounds left out of the model (for
example a disqualification).

**Example:** `GET /api/v1/matches/19` (shortened)

```json
{
  "data": {
    "match_id": 19,
    "date": "2026-08-30",
    "season_phase": "playoffs",
    "playoff_round": "MegaBrawl",
    "team1": { "slug": "miami-assassins", "name": "Miami Assassins", "score": 26, "rounds_won": 13 },
    "team2": { "slug": "philly-smoke", "name": "Philadelphia Smoke", "score": 22, "rounds_won": 11 },
    "winner": "team1",
    "rounds": [
      { "round": 1, "round_phase": "Launch", "winner": "team2", "team1_win_prob_after": 0.418, "team1_wpa": -0.082, "leverage": 1.319, "is_peak_leverage": false }
    ],
    "comeback": { "winner": "team1", "lowest_win_prob": 0.12, "low_round": 12, "deficit_at_low": -5, "final_margin": 4, "key_rounds": [] },
    "highlights": []
  },
  "meta": { "phase": "all", "sheet_last_updated": "2026-11-09T19:50:53.000Z", "generated_at": "2026-11-09T21:00:00.000Z" }
}
```

*(Values are illustrative.)*

---

## `GET /schedule`

The season schedule from the **Schedule** tab, joined to final scores by
Match ID. One entry per scheduled match, ordered by date.

- `status` is `upcoming`, `completed` or `cancelled`. An entry is `completed`
  as soon as its match has results on the Data tab.
- `team1` / `team2` are team objects, or `null` while a team is TBD.
- `playoff_round` is the round name for played playoff matches
  ("Quarterfinals", "Semifinals", or the final's name, e.g. "MegaBrawl IV"),
  otherwise `null`.
- Completed entries use the match's own team order, so `result` lines up with
  `/results/latest`. `result` and `stats_url` are `null` until the match is played.
- `date` is `YYYY-MM-DD`. Played matches use the match date. For unplayed
  ones, when the sheet's date has no year, the year closest to today is used.
- `time` is the start time as written on the sheet, without the word "Local"
  (for example `7:00 PM`), in the **venue's** local time; or `null`.
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
      "time": "7:00 PM",
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
        "time": "7:00 PM",
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

It also includes:

| Field | Meaning |
|---|---|
| `matches[]` | The team's matches in the chosen phase, newest first: `match_id`, `season`, `date`, `week`, `season_phase`, `playoff_round`, `opponent` (team object), `result` (`W`/`L`/`D`, from this team's side), `points_for`, `points_against`. |
| `next_match` | The team's next upcoming match, in the same shape as a [`/schedule`](#get-schedule) entry, or `null`. |
| `comebacks` | `comeback_wins`, `deepest_hole` (lowest win probability they came back from, 0–1), `blown_leads`, `highest_lead_blown`. `null` if unavailable. |
| `highlights[]` | Highlight links for the team from the Highlights tab: `label`, `url`, `type` (`youtube`, `instagram`…). |

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

One fighter's profile, stats for the chosen season and phase, every bout in
that season, a stat line for **every** season they fought in, and career
totals. `{id}` is the fighter's ID (see [Fighter IDs](#fighter-ids)).
It can also be the fighter's name ID (for example `jordan-reyes`). Matching
ignores upper/lower case. Unknown IDs return **404 `fighter_not_found`**.

If the fighter has no bouts in the chosen phase, `stats` is all zeros and
`fights` is empty. The fighter's profile still comes back.

**Which season?** With `?season=`, that season only (404 if they didn't fight
in it). Without it, the current season; a fighter who only fought in earlier
seasons gets their most recent season instead, so saved links keep working.

**`seasons` and `career`** (the back of a baseball card):

| Field | Meaning |
|---|---|
| `seasons[]` | One line per season the fighter fought in, oldest first: `season` (same shape as `meta.season`), `team`, `weight_class` and a [`stats`](#the-stats-object) object. |
| `career.seasons_played` | How many seasons are in `seasons[]`. |
| `career.stats` | All seasons added together. Counting stats are summed; win %, NPPR and points allowed per round are recalculated from the totals. |

The same fighter is matched across seasons by Fighter ID, falling back to the
name when a season has no ID for them. Filling in Fighter IDs keeps careers
correct even if a fighter's name is spelled differently later.

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
    "bio": null,
    "photo_url": null,
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
        "match_url": "https://tblstats.com/matches/19",
        "season": "2026"
      }
    ],
    "seasons": [
      {
        "season": { "id": "2026", "year": 2026, "number": 4, "label": "2026 · Season 4", "is_current": true },
        "team": { "slug": "miami-assassins", "name": "Miami Assassins", "short_name": "Miami Assassins", "city": "Miami", "color": "#98002e", "logo_url": "https://tblstats.com/logos/miami.png" },
        "weight_class": "Lightweight",
        "stats": { "wins": 2, "losses": 1, "draws": 1, "record": "2-1-1", "rounds": 4, "win_pct": 0.667, "net_points": 4, "nppr": 1, "points_scored": 25, "points_allowed": 21, "points_allowed_per_round": 5.25, "war": 0.25, "ko_tko": 1, "knockdowns": 1, "double_knockdowns": 0 }
      }
    ],
    "career": {
      "seasons_played": 1,
      "stats": { "wins": 2, "losses": 1, "draws": 1, "record": "2-1-1", "rounds": 4, "win_pct": 0.667, "net_points": 4, "nppr": 1, "points_scored": 25, "points_allowed": 21, "points_allowed_per_round": 5.25, "war": 0.25, "ko_tko": 1, "knockdowns": 1, "double_knockdowns": 0 }
    }
  },
  "meta": { "season": { "id": "2026", "year": 2026, "number": 4, "label": "2026 · Season 4", "is_current": true }, "phase": "regular", "sheet_last_updated": "2026-11-09T17:46:31.000Z", "sheet_last_updated_source": "data_fetched", "generated_at": "2026-11-08T05:03:00.000Z" }
}
```

*(Fight list shortened to one bout.)*

---

## `GET /seasons`

Every league season, newest first. Use it to build a season picker.

**Example:** `GET /api/v1/seasons`

```json
{
  "data": [
    { "id": "2026", "year": 2026, "number": 4, "label": "2026 · Season 4", "is_current": true, "complete": false, "has_data": true }
  ],
  "meta": { "current": "2026", "generated_at": "2026-11-09T17:49:02.118Z" }
}
```

| Field | Meaning |
|---|---|
| `id` | Pass this as `?season=` to any endpoint. |
| `number` | The league's season number (2026 is Season 4). |
| `label` | Display name. |
| `is_current` | The season every endpoint uses when `season` is left off. |
| `complete` | The season is over; its numbers no longer change. |
| `has_data` | Its sheet loaded and has teams or matches. `false` for a brand-new empty sheet or one that can't be reached right now. |

---

## `GET /fighters`

Every fighter who fought in the season (and phase), with their stats. Built
for a fighters directory: the website sorts, searches and filters it. Sorted by
net points, highest first.

Each entry has the same fields as a fighter in [`/leaders`](#get-leaders)
(`id`, `name`, `team`, `weight_class`, `gender`, `bio`, `photo_url`…) plus:

| Field | Meaning |
|---|---|
| `primary_weight_class` | The class they fought in most (ties: the most recent). |
| `division` | `primary_weight_class`, or "Female …" for women in classes with separate women's divisions (Bantamweight, Featherweight, Super Lightweight). Same rule as tblstats.com's weight filter. |
| `instagram` | Instagram URL or `null`. |
| `streak` | Current streak, e.g. `"W3"`, or `null`. |
| `stats` | A [`stats` object](#the-stats-object) plus `ko_pct` (KO/TKO wins ÷ wins). |

`meta.count` is the number of fighters. `meta.filters` lists the values to
offer in filters: `teams` (team objects), `divisions` (light to heavy) and
`genders`.

---

## `GET /playoffs`

The playoff bracket: the top 8 of the regular-season table, seeded 1–8
(quarterfinals 1v8, 4v5, 3v6, 2v7), the same bracket tblstats.com shows.
Takes `?season=`.

| Field | Meaning |
|---|---|
| `status` | `projection` (regular season still going: "if the playoffs started today"), `set` (field locked), `underway` (a playoff match has been played) or `complete` (there is a champion). |
| `final_name` | The final's name, e.g. `"MegaBrawl IV"` (from the season number). |
| `seeds[]` | `seed`, `team`, `record`, `point_diff`, `streak`. |
| `quarterfinals[]`, `semifinals[]`, `final` | Bracket slots (below). |
| `champion` | Team object, or `null`. |
| `on_the_bubble[]` | Seeds 9–12, while the field is still a projection. Empty once it's set. |
| `tiebreaks[]` | Head-to-head tiebreaks between teams with the same record: `team`, `seed`, `won_tiebreak_over` (team objects). |

A **slot** is `{ round, label, status, team1, team2, score, winner, match_id, season }`:

- `round` is `quarterfinal`, `semifinal` or `final`. `label` is its display name.
- `status`:
  - `played`
  - `pending` (both teams known, not played yet)
  - `tbd` (waiting on earlier rounds)
- `team1` / `team2` are `{ seed, team, record }` or `null` when TBD.
- `score` is `{ team1, team2 }` once played.
- `winner` is `team1`, `team2` or `null`.
- `match_id` + `season` link to [`/matches/{id}`](#get-matchesid).

---

## `GET /awards`

Every season's awards and champions, grouped by award in tblstats.com's
order (MegaBrawl Champions, Most Valuable Fighter, …). All the "MegaBrawl …
Champions" rows are one group. Covers every season, so it takes no
`?season=`. Rows that appear in more than one season's sheet are listed once.

Each group is `{ award, kind, winners[] }`. `kind` is `team` or `fighter`.
Each winner:

| Field | Meaning |
|---|---|
| `season` | Season id (`"2026"`) when the row's season is in [`/seasons`](#get-seasons), else `null` (older seasons). |
| `season_label` | e.g. `"2026 · Season 4"`, or the year/number from the sheet. |
| `season_value` | The raw Season/Year value from the Awards tab. |
| `is_latest` | The most recent winner of this award. |
| `winner` | As written on the sheet. |
| `fighter` | `{ id, id_is_stable, name }` when the winner is a known fighter (links to `/fighters/{id}`), else `null`. |
| `teams[]` | Team objects (two for awards like Fight of the Year). |
| `notes` | Notes column, or `null`. |

---

## `GET /advanced`

tblstats.com's advanced stats for a season. Takes `?season=` and `?phase=`,
plus `rounds_limit` (1–200, default 50).

| Field | Meaning |
|---|---|
| `headlines` | Picks for fan-friendly cards. Each item is `null` when there's no data: `biggest_comeback` (a `matches[]` row), `highest_stakes_round` (a `rounds[]` row), `most_clutch`, `best_adjusted` and `toughest_schedule` (`fighters[]` rows). |
| `rounds[]` | Rounds with the most at stake (highest **leverage**), highest first: `match_id`, `season`, `date`, `playoff_round`, `round`, `rounds_to_go`, `team1`, `team2`, `team1_fighter` / `team2_fighter` (`{ id, name, score }`), `winner`, `team1_lead_before`, `leverage`, `swing` (win probability that changed hands, 0–1), `method`. |
| `fighters[]` | Every fighter, by WPA: `fighter`, `matches`, `rounds`, `round_wins`, `wpa` (wins added through their rounds), `wpa_per_round`, `avg_leverage`, `clutch` (WPA minus what the same results would be worth at average stakes), `net_points`, `nppr`, `war`, and `rating`. |
| `fighters[].rating` | Opponent-adjusted rating, full season only: `rounds`, `strength_of_schedule`, `adjusted_nppr`, `adjustment`, `low` / `high` (likely range), `uncertain`, `qualified`. `null` when unrated. |
| `matches[]` | Every decided match, by how close the winner came to losing: `match_id`, `season`, `date`, `playoff_round`, `winner`, `loser`, `lowest_win_prob`, `low_round`, `deficit_at_low`, `final_margin`, `is_comeback`, `note`. |

`meta` adds `wpa_model_version`, `ratings_model_version`, `min_rounds` (the
qualifier for `most_clutch` and ratings), `comeback_threshold`,
`comeback_count`, `decided_matches` and `rounds_limit`.

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
- Seasons (which sheet each season reads): `src/lib/seasons.ts`. Starting a new season: `docs/NEW-SEASON.md`
- Career totals and matching fighters across seasons: `src/lib/api/career.ts`
- This API is versioned. Adding new fields is safe. Renaming or removing fields
  would break the website, so do that in a new `/api/v2` instead.
