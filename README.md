# Theatres of War — Warzone Companion

Web companion for EVE Online Factional Warfare and Military Campaigns.
Runs entirely client-side against public ESI endpoints. No build step, no
backend, no dependencies.

Live: https://gurketonic.github.io/Warzone-Companion/ (GitHub Pages, served
straight from `main`).

## Run locally

```
python serve.py
```

(`py serve.py` also works; on Linux/macOS use `python3`.) Opens
http://localhost:8080 automatically, caching disabled, stop with Ctrl+C.

Alternatives: `python -m http.server 8080` in the project directory, or
opening `index.html` directly via `file://` — ESI allows any origin
(`Access-Control-Allow-Origin: *`), so both work.

## Features

| Tab            | Data source                                        | Notes                                        |
|----------------|----------------------------------------------------|----------------------------------------------|
| Warzones       | `/fw/systems`, `/fw/stats`, `/universe/system_kills`, `/universe/system_jumps` + SDE | Front bars, SVG warzone maps, frontline/command/rearguard roles, kills last hour, jump distance from a home system |
| LP store       | `/loyalty/stores/{corp}/offers`, `/markets/prices`, `/markets/{region}/orders` | ISK/LP ranking; Jita 4-4 order-book refinement with executable buy depth |
| Freelance jobs | `/freelance-jobs`, `/freelance-jobs/{id}`          | Public jobs board, cursor pagination         |
| Leaderboards   | `/fw/leaderboards/characters`, `/corporations`     | Top 10 by kills and VP (yesterday)           |
| Campaigns      | SDE (`js/data/staticdata.js`)                      | Official titles/objectives; no ESI route for live progress |

All requests are pinned to compatibility date `2026-06-09`
(see `CONFIG.COMPAT_DATE` in `js/config.js`).

## Architecture

Plain scripts, loaded in order, no modules — this keeps `file://` usage
working without a dev server.

```
index.html               shell, tab navigation, panels
serve.py                 local dev server (http://localhost:8080)
css/app.css              design system (ops-console theme, empire colors)
js/data/staticdata.js    generated: gate graph, names, FW systems, campaigns
js/config.js             constants, factions, militia corps
js/i18n.js               DE/EN strings, formatting helpers, HTML escaping
js/esi.js                fetch helpers, /universe/names cache
js/fwlogic.js            frontline classification, BFS jumps, system search
js/warzones.js           warzones view (cards, SVG maps, systems table)
js/lpstore.js            LP store view (avg + Jita pricing, buy depth)
js/jobs.js               freelance jobs view
js/boards.js             leaderboards view
js/campaigns.js          campaigns view (SDE data)
js/app.js                tab router, auto refresh, error states, bootstrap
tools/build_static_data.py  regenerates js/data/staticdata.js from an SDE zip
```

Regenerate the static data after an SDE release:

```
python tools/build_static_data.py path/to/eve-online-static-data-<build>-jsonl.zip
```

Each view exposes `load()` (async data fetch) and `render()`. The router in
`app.js` lazy-loads a tab on first open and caches it; Refresh re-fetches the
active tab. HTTP 420/429 (ESI rate limit) is reported in the UI with a
dedicated hint. Player-authored strings (job names, descriptions, character
and corporation names) are HTML-escaped before rendering.

## Known limitations

- Default LP valuation uses ESI average prices (`/markets/prices`).
  The "Load Jita prices" button reprices the top offers with the live Jita
  4-4 order book (highest buy for the product, lowest sell for materials,
  buy depth within 5% of best price), fetched with a concurrency limit of 4
  to respect ESI rate limits. In Jita mode only repriced offers are ranked.
- The Advantage value is not exposed by ESI
  (open since 2022: github.com/esi/esi-issues/issues/1335). Frontline /
  Command Ops / Rearguard roles are computed from occupancy + stargate
  adjacency instead.
- Military Campaign progress is not exposed by ESI (verified against the
  2026-06-09 OpenAPI spec, 203 paths). Campaign content comes from the SDE.
- Jump distances use the shortest gate route and ignore security status.
- No persistence. Front-line history needs polling over time (see roadmap).

## Roadmap

1. Front-line history: local poller (`poller.py`, stdlib + SQLite) writing
   snapshots of `/fw/systems` and `/fw/stats`, visualized in a History tab.
   Local-first; a GitHub Actions poller with static JSON snapshots may later
   make the history available on the hosted site.
2. EVE SSO login (PKCE) for personal stats
   (`/characters/{id}/fw/stats`, `/characters/{id}/loyalty/points`).
3. Campaign progress, as soon as ESI exposes a route. Until then: manual
   updates in `js/config.js`, or a feature request via esi-issues.

## Legal

EVE Online and all related trademarks are the property of CCP hf. /
Fenris Creations. This is an unofficial fan project and is not affiliated
with or endorsed by the rights holder.
