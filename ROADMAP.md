# Roadmap

Plans for making this the best Factional Warfare companion available.
Order reflects priority; nothing here is a promise with a date.

## Next: Corp directory (community-maintained)

A recruitment directory for all four militias, maintained by the corps
themselves via pull request — no forms, no backend, fully auditable.

- `data/corps.json`: one entry per corporation — corp ID, militia, languages,
  timezones, playstyle tags, Discord invite, recruitment status
- Corps add or update their own entry via PR; review just checks sanity
- The frontend enriches entries live via public ESI (`/corporations/{id}`):
  member count always current, and entries whose corp has left factional
  warfare are hidden automatically instead of going stale
- New "Corps" tab with filters (militia, language, timezone, playstyle),
  zKillboard link per corp; FAQ entry explaining how to get listed
- Seeding: invite corps from the existing community Discord directories

## Planned

- **Per-item LP crash warnings** — the militia-level LP history shipped;
  per-item price trend tracking is the next step.

## Shipped

- System detail panel (trend sparkline, Advantage, insurgency, flips,
  neighbors) — click any system on the map or in the table
- Insurgency mirror: FOB origin + corruption/suppression on map and details
- LP value history per militia (History tab)
- Flip feed: `data/feed-flips.json`, documented in README and FAQ

## Later

- **Long-term per-system history** — the snapshot archive (git history)
  keeps everything; expose multi-month system charts once enough data exists
- **Leaderboard history** — track top corps/characters over months
- **EVE SSO personal stats** — LP wallet, rank, personal contribution;
  requires an application registration and an architecture decision
  (client-side PKCE vs. backend), deliberately parked

## Non-goals

- Anything requiring accounts, tracking, or a paid backend
- Undocumented APIs beyond the war report (which degrades gracefully)
- Advantage/VP formulas CCP has not published — no guesswork presented as fact
