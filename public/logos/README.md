# Logo Files

Place your 12 team logos and TBL logo in this directory.

## Naming Convention

Logo filenames must match the slug of your team name (lowercase, spaces → hyphens, no special chars).

Examples:
- Team name: "Fire Fists"  → file: `fire-fists.png`
- Team name: "Iron Hawks"  → file: `iron-hawks.png`
- Team name: "TBL"         → file: `../tbl-logo.png` (in /public root)

## TBL Logo
Place the main TBL logo as: `/public/tbl-logo.png`

## Team Logos
Place all 12 team logos as: `/public/logos/{team-slug}.png`

To find the correct slug for a team, the formula is:
  slug = teamName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

## Recommended Format
- PNG with transparency preferred
- Minimum 200×200px for crisp display
- 1:1 aspect ratio preferred (displayed as square)
