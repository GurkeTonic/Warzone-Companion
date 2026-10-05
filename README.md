# Warzone Companion

A companion site for EVE Online's Factional Warfare.

**Live: https://warzone.tonicdock.com**

Built from EVE's own public game data every 30 minutes — no account, no
login, no cookies, no tracking, and your browser never talks to CCP.

## What you'll find

- **Warzones** — who holds which systems right now, frontline / command ops
  / rearguard roles, live contested status, kills in the last hour
- **Map** — interactive warzone map, click any system for details
- **History** — how the front has moved over the last 2–90 days: systems
  held, pilot counts, every system that changed hands and when
- **LP Store** — which loyalty point rewards are worth the most right now,
  per militia
- **Leaderboards** — top pilots and corporations by kills and victory points
- **Campaigns** — the official Military Campaigns, their goals and rewards
- **FAQ** — explains how to read each tab and where the data comes from,
  right on the site

Switch language (DE/EN) top right.

## How fresh is the data?

Every 30 minutes a GitHub Action (`.github/workflows/deploy.yml`) fetches
everything from ESI and the war report, checks it, and publishes the site
with the data as plain JSON files. ESI itself refreshes factional warfare
every 30 minutes, kills and prices hourly and leaderboards daily, so that
is as fresh as it gets. Auto-refresh (every 5 minutes) reloads those files.
The growing history is carried over from the live site on every run and
backed up daily in the `data` branch.

To run it locally, fetch the data first:

```
python3 tools/mirror_warzone.py && python3 tools/fetch_esi.py
python3 serve.py
```

## Legal

The code is MIT-licensed (see [LICENSE](LICENSE)). The EVE Online data
shown here belongs to CCP hf. and isn't covered by that license.

© CCP hf. All rights reserved. "EVE", "EVE Online", "CCP", and all related
logos and images are trademarks or registered trademarks of CCP hf.

This material is used with limited permission of CCP Games. No official
affiliation or endorsement by CCP Games is stated or implied.

## More

- [ROADMAP.md](ROADMAP.md) — what's planned next
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to help, developer setup
