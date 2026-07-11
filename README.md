# Warzone Companion

Web companion for EVE Online Factional Warfare.

**Live: https://warzone.tonicbeacon.com**

Runs entirely client-side against public ESI endpoints — every visitor gets
live data on each visit. No accounts, no cookies, no tracking, no third-party
requests except ESI.

## Features

| Tab            | What it does |
|----------------|--------------|
| Warzones       | Front bars, faction stats, systems table: frontline / command ops / rearguard roles, Advantage, contested status with VP progress and 24h trend, kills last hour, jump distance from your home system |
| Map            | Interactive warzone maps: uniform system nodes with name codes, occupier colors, contested/vulnerable rings, activity glow, zoom/pan |
| History        | Systems held and pilots per militia over time (48h–90 days) plus a system flip log, from the mirrored snapshot archive |
| FAQ            | Explains data sources, mechanics (roles, Advantage), and how to read each tab (DE/EN) |
| LP store       | ISK/LP ranking per militia corporation; optional Jita 4-4 order-book repricing with executable buy depth |
| Freelance jobs | Public jobs board with details on click |
| Leaderboards   | Top 10 characters and corporations by kills and victory points (yesterday) |
| Campaigns      | Military Campaigns with official titles, objectives, and rewards |

## Data sources

- **ESI** (`esi.evetech.net`), public endpoints only, pinned to compatibility
  date `2026-06-09` (`CONFIG.COMPAT_DATE` in `js/config.js`). Fetched by the
  visitor's browser when a tab is opened; the refresh button and the optional
  auto-refresh (5 min) re-fetch.
- **Advantage** comes from the official war report on eveonline.com, mirrored
  into `data/warzone.json` by a scheduled GitHub Action
  (`.github/workflows/warzone-data.yml`, every 30 minutes). Data older than
  24 hours is discarded by the frontend.
- **History** (`data/history.json`) is appended by the same workflow:
  systems held and pilots per militia (90 days) plus per-system contested
  values (49 hours, feeds the 24h trend column). The git history of the
  data files is a full, publicly auditable archive of every snapshot.
- **Static universe data** (map positions, stargate graph, system names,
  campaign content) is generated from the official Static Data Export into
  `js/data/staticdata.js`. Regenerate after an SDE release:

  ```
  python tools/build_static_data.py path/to/eve-online-static-data-<build>-jsonl.zip
  ```

## Architecture

Plain scripts in a fixed load order, no framework, no build step, no
dependencies. Each view exposes `load()` and `render()`; the router in
`app.js` lazy-loads tabs and caches them.

```
index.html               shell, tab navigation, panels
css/app.css              design system, self-hosted fonts (fonts/)
js/data/staticdata.js    generated: gate graph, names, FW systems, campaigns
js/config.js             constants, factions, militia corps
js/i18n.js               DE/EN strings, formatting, HTML escaping
js/esi.js                ESI client, /universe/names cache
js/fwlogic.js            frontline classification, BFS jumps, system search
js/warzones.js           warzones view (cards, maps, systems table)
js/history.js            history view (SVG time-series charts)
js/lpstore.js            LP store view
js/jobs.js               freelance jobs view
js/boards.js             leaderboards view
js/campaigns.js          campaigns view
js/app.js                tab router, auto refresh, error handling
serve.py                 development server with /api/warzone proxy
tools/                   static data generator, warzone mirror script
```

Frontline / Command Operations / Rearguard is computed from live occupancy
plus stargate adjacency (rules from patch 20.10). All player-authored strings
from the APIs are HTML-escaped before rendering; ESI rate limits (HTTP
420/429) are reported in the UI.

## Legal

© CCP hf. All rights reserved. "EVE", "EVE Online", "CCP", and all related
logos and images are trademarks or registered trademarks of CCP hf.

This material is used with limited permission of CCP Games. No official
affiliation or endorsement by CCP Games is stated or implied.
