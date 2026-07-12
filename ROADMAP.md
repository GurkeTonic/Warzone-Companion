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

- **System detail panel** — click a system on the map or in the table to get
  a side panel: contested trend sparkline, advantage history, kills, flips
  of that system, links. Data already collected; this is presentation.
- **Insurgency mirror** — the war report API also exposes pirate insurgency
  status (`/api/warzone/insurgency`, not in ESI). Mirror it like Advantage
  and show FOB systems + corruption/suppression on the map.
- **LP price history** — snapshot the top ISK/LP conversions per militia in
  the mirror workflow; chart payout trends and warn about price crashes.
- **Flip feed** — publish system flips as a static JSON/RSS feed so Discord
  bots and third parties can consume them without scraping.

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
