# Starting a new season (for example, 2027 · Season 5)

Each season has **its own Google Sheet**. The 2026 sheet stays as it is
forever, so 2026 numbers never change. The new season gets a fresh copy of
the same sheet. Fighter pages then show one line per season plus a **Career**
row, like the back of a baseball card, and `/leaders?season=career` shows
all-time leaders.

There are three parts:

- **Part A**, before the season: fill in Fighter IDs on the 2026 sheet.
- **Part B**, before the first fight: make the new sheet.
- **Part C**, a developer step: switch the site to the new season.

---

## Part A — Fighter ID checklist (do this before the 2027 season)

Careers are joined across seasons by **Fighter ID**. Without an ID the site
falls back to the fighter's name. That works until a name is spelled
differently, for example "Chris" one season and "Christopher" the next.
Then one person shows up as two.

1. Open the **2026** sheet, **Data** tab.
2. Make sure there is a column headed exactly **`Fighter ID`** (any position;
   the site finds it by its header, not its column letter).
3. Give every fighter an ID:
   - Use the format `TBL001`, `TBL002`, … One ID per **person**, not per row.
   - Type the same ID on **every** row for that fighter.
   - Never reuse an ID, even for someone who has retired.
   - Never change an ID once it's set. Fix name spellings in the name column instead.
4. Check it:
   - Open `https://www.tblstats.com/api/v1/fighters/TBL001`. It should show that fighter, with `"id_is_stable": true`.
   - Spot-check two or three others.
5. In the 2027 sheet, returning fighters **keep their 2026 ID**. New fighters
   get the next unused number.

Tip: keep a small "Fighter IDs" tab (ID, name) in each sheet so whoever enters
results can look IDs up quickly.

---

## Part B — Make the 2027 sheet

1. Open the 2026 sheet and choose **File → Make a copy**.
   - Copy the **whole spreadsheet**. A full copy keeps the same tabs and the same
     tab ids (`gid`s), which the site uses to find each tab.
   - Name it something like "TBL 2027".
2. In the copy, **delete the 2026 data rows** but **keep the header rows**:

   | Tab | What to clear | What must stay exactly the same |
   |---|---|---|
   | **Data** | All fight rows | The header row. Especially `Fighter Name`, `Fighter ID`, `Match ID`, `Round ID`, `Round Num`, `Round Phase`, `Weight Class`, `Gender`, `Date of Fight`, `Result`, `Points Earned`, `Net Points`, `Game Phase` |
   | **Standings** | Records, points and streaks (team names can stay) | `Team`, `Record`, `Points Scored`, `Points Allowed`, `Point Differential`, `Streak` |
   | **Fighter Stats** | Stats rows (you may keep fighter names, Instagram, Bio and Photo URL for returning fighters) | `Fighter`, `Instagram`, `Bio`, `Photo URL`, and the "Last Updated" cell in row 2 |
   | **Schedule** | Last season's games (then add the new schedule) | The header row |
   | **Highlights** | Old links (or keep them; they belong to 2026 match IDs) | The header row |
   | **Awards** | Leave it, or clear it | The header row |

   - Header names are matched loosely (case and punctuation don't matter), but
     don't rename them to something different.
   - Adding new columns is fine.
3. **Match IDs and Round IDs start again at 1** in the new sheet. That's expected:
   the site always knows which season a match belongs to.
4. Publish the new sheet. Choose **File → Share → Publish to web**, pick **Entire document** and **Comma-separated values (.csv)**, then click **Publish**.
5. From the link Google shows (it looks like `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?output=csv`), copy the part that starts with **`2PACX-`** up to the next `/`. That is the sheet's **published key**. Send it to whoever maintains tblstats.com.

---

## Part C — Switch the site over (developer)

All in `src/lib/seasons.ts`:

1. Add the season to `SEASONS`:
   ```ts
   {
     id: '2027',
     year: 2027,
     number: 5,
     label: '2027 · Season 5',
     publishedKey: '2PACX-…',   // from Part B, step 5
     gids: GIDS_2026,           // same tab ids, because the sheet is a full copy
     complete: false,
   },
   ```
   - If a tab id differs (for example, a tab was recreated), copy the `gid=` numbers from each tab's URL into a new `gids` object.
2. Set 2026 to `complete: true`. Its sheet is then cached for a day, since its numbers no longer change.
3. Set `CURRENT_SEASON_ID = '2027'`.
4. Check:
   - `npx tsc --noEmit`, `npm test`
   - after deploying:
     - `/api/v1/seasons` lists 2027 as current, and 2026 with `has_data: true`
     - `/api/v1/standings?season=2026` is unchanged
     - a returning fighter's `/api/v1/fighters/{id}` shows both seasons and a career line that adds up

### Things to know

- **Before the first 2027 fight**, the 2027 sheet has no matches.
  - Endpoints for the current season return `503 data_unavailable` until the Standings or Data tab has something in it.
  - Leave `CURRENT_SEASON_ID` on 2026 until the 2027 sheet has its teams or first results, then switch.
- **Win probability (WPA)** and **ratings** use the frozen 2026 model for every season until someone refits them for a new year (see `src/lib/wpa/`, `src/lib/ratings/`).
- **The tblstats.com pages** (not the API) show the current season.
- **teamboxingleague.com** reads the season list from `/api/v1/seasons`, so the theme needs no change when a season is added.
