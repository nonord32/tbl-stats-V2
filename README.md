# TBL Stats — Next.js Site

**Official stats site for Team Boxing League**  
Production domain: `tblstats.com` | Dev preview: your new Vercel project

---

## Stack

- **Next.js 14** (App Router, server components + ISR)
- **TypeScript**
- **PapaParse** — CSV parsing (runs server-side)
- **Vercel** — hosting + CDN
- **Google Sheets** — data source (published as CSV)

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout (Nav, Footer, ThemeProvider)
│   ├── globals.css         # Full design system (light/dark, all components)
│   ├── page.tsx            # Homepage (hero, top fighters, about TBL)
│   ├── not-found.tsx       # 404 page
│   ├── sitemap.ts          # Auto-generated sitemap for SEO
│   ├── robots.ts           # robots.txt
│   ├── fighters/
│   │   ├── page.tsx        # Fighter stats listing (server → client)
│   │   ├── FightersClient.tsx  # Sort/filter table + modal (client)
│   │   └── [slug]/
│   │       └── page.tsx    # Individual fighter profile + history
│   └── teams/
│       ├── page.tsx        # Team standings listing (server → client)
│       ├── TeamsClient.tsx # Sort table + box score modal (client)
│       └── [slug]/
│           └── page.tsx    # Individual team page + all box scores
├── components/
│   ├── Nav.tsx             # Sticky nav with active links + theme toggle
│   ├── Footer.tsx          # Footer with TBL links
│   └── ThemeProvider.tsx   # Light/dark context (default: light)
├── lib/
│   ├── data.ts             # All CSV fetching, parsing, streak calc
│   └── teams.ts            # Logo path mapping
└── types/
    └── index.ts            # All TypeScript interfaces
public/
├── tbl-logo.png            # ← ADD THIS
└── logos/
    ├── {team-slug}.png     # ← ADD 12 TEAM LOGOS
    └── README.md
```

---

## Setup & Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Deployment (Vercel)

**Create a NEW Vercel project** — do not connect to the existing `tbl-stats.vercel.app` project.

1. Push this repo to GitHub
2. Import into Vercel → "New Project"
3. Framework: Next.js (auto-detected)
4. Add custom domain: `tblstats.com`
5. Deploy

The old site at `tbl-stats.vercel.app` stays live — zero downtime.

---

## Google Sheets Column Requirements

The parser is flexible and handles common column name variants.  
These are the **exact column names** expected (case-sensitive):

### Fighter Stats Sheet (gid=1927967888)
| Column | Notes |
|--------|-------|
| `Name` | Fighter's full name |
| `Team` | Team name (must match exactly across sheets) |
| `Weight Class` | e.g. "Lightweight", "Welterweight" |
| `Gender` | "Male" or "Female" |
| `W` | Win count |
| `L` | Loss count |
| `WAR` | Wins Above Replacement (decimal) |
| `NPPR` | Net Points Per Round (decimal) |
| `Net Pts` | Total net points (decimal) |
| `Win%` | Win percentage as decimal (e.g. 0.75) |
| `Rounds` | Total rounds fought |

### Team Standings Sheet (gid=1404001793)
| Column | Notes |
|--------|-------|
| `Team` | Must match fighter sheet team names exactly |
| `W` | Wins |
| `L` | Losses |
| `PF` | Points For |
| `PA` | Points Against |
| `Diff` | Differential (or auto-calculated as PF−PA) |
| `Streak` | Optional — auto-calculated from match data if empty |

### Match Data Sheet (gid=0)
| Column | Notes |
|--------|-------|
| `Date` | Date of match (any parseable format) |
| `Team 1` | Home team name |
| `Team 2` | Away team name |
| `Fighter 1` | Home fighter full name |
| `Fighter 2` | Away fighter full name |
| `Weight Class` | Bout weight class |
| `Gender` | "Male" or "Female" |
| `Round` | Round number (integer) |
| `Phase` | Round phase label (e.g. "Prelim", "Main") |
| `Winner` | Winning fighter name OR team name |
| `Score 1` | Home fighter score for this round |
| `Score 2` | Away fighter score for this round |
| `Net Pts` | Net points for this bout |

---

## Adding Team Logos

1. Name each logo file using the team slug:
   ```
   "Fire Fists" → public/logos/fire-fists.png
   "Iron Hawks" → public/logos/iron-hawks.png
   ```
2. Place the TBL logo at `public/tbl-logo.png`
3. Logos load with graceful fallback (hidden if file not found)

To update `src/lib/teams.ts` with your actual team slugs:
```ts
export const TEAM_LOGOS: Record<string, string> = {
  'fire-fists': '/logos/fire-fists.png',
  'iron-hawks': '/logos/iron-hawks.png',
  // ... all 12 teams
};
```

---

## Streaks

- **Fighter streak** → calculated from the `Match Data` sheet (each row = 1 round). A `W3` means 3 consecutive winning rounds most recently.
- **Team streak** → calculated from match outcomes in the `Match Data` sheet (each match = 1 result). A `W2` means 2 consecutive match wins.
- If the Team Standings sheet has a pre-populated `Streak` column, that value is used directly.

---

## Data Caching

Data is cached server-side for **5 minutes** using Next.js ISR (`revalidate = 300`).  
This means after a sheet update, the site refreshes within 5 minutes automatically.

To force immediate refresh: trigger a Vercel deployment or call the revalidation API.

---

## Design System

| Token | Light | Dark |
|-------|-------|------|
| Background | `#f5f3f0` | `#13111a` |
| Card | `#ffffff` | `#1e1b2e` |
| Accent | `#e63500` | `#ff3c00` |
| Nav background | `#13111a` | `#0d0b12` |
| Font (mono) | IBM Plex Mono | IBM Plex Mono |
| Font (body) | Verdana | Verdana |

Default theme: **Light** (stored in `localStorage` as `tbl-theme`)

---

## SEO

Every page has:
- `<title>` and `<meta name="description">` via Next.js Metadata API
- OpenGraph tags (`og:title`, `og:description`)
- Auto-generated `/sitemap.xml` pulling all fighter + team slugs
- `/robots.txt`
- Canonical URLs via `metadataBase`

Fighter page example:
```
Title: Kye Brooks — Team Hammers | TBL Stats
Description: Kye Brooks TBL stats: 8-2 record, WAR 2.34, NPPR 0.182...
```

---

## Mobile

- Responsive table: on small screens, shows Rank / Name / Record / WAR columns only
- Modals are scrollable and full-height on mobile (`max-height: 95vh`)
- Nav collapses links on very small screens; theme toggle always visible
- Touch-friendly tap targets throughout

---

## Customization

| What | Where |
|------|-------|
| Season year label | Search `2026 TBL Season` → update in page headers |
| Accent color | `--accent` in `globals.css` |
| Cache duration | `revalidate = 300` in each page file |
| Sheet URLs | `SHEETS` object in `src/lib/data.ts` |
| TBL website link | `src/components/Footer.tsx` + homepage |
| Instagram handle | `src/components/Footer.tsx` + homepage |
