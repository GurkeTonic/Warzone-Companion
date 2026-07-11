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
| Warzones       | `/fw/systems`, `/fw/stats`                         | Front bars, faction stats, contested table   |
| LP store       | `/loyalty/stores/{corp}/offers`, `/markets/prices`, `/markets/{region}/orders` | ISK/LP ranking; optional Jita 4-4 order-book refinement |
| Freelance jobs | `/freelance-jobs`, `/freelance-jobs/{id}`          | Public jobs board, cursor pagination         |
| Leaderboards   | `/fw/leaderboards/characters`, `/corporations`     | Top 10 by kills and VP (yesterday)           |
| Campaigns      | static (`js/config.js`)                            | No ESI route for campaign progress exists    |

All requests are pinned to compatibility date `2026-06-09`
(see `CONFIG.COMPAT_DATE` in `js/config.js`).

## Architecture

Plain scripts, loaded in order, no modules — this keeps `file://` usage
working without a dev server.

```
index.html          shell, tab navigation, panels
serve.py            local dev server (http://localhost:8080)
css/app.css         design system (ops-console theme, empire colors)
js/config.js        constants, factions, militia corps, static campaigns
js/i18n.js          DE/EN strings, formatting helpers, HTML escaping
js/esi.js           fetch helpers, /universe/names cache
js/warzones.js      warzones view
js/lpstore.js       LP store view (avg + Jita pricing)
js/jobs.js          freelance jobs view
js/boards.js        leaderboards view
js/campaigns.js     campaigns view
js/app.js           tab router, loading/error states, bootstrap
```

Each view exposes `load()` (async data fetch) and `render()`. The router in
`app.js` lazy-loads a tab on first open and caches it; Refresh re-fetches the
active tab. HTTP 420/429 (ESI rate limit) is reported in the UI with a
dedicated hint. Player-authored strings (job names, descriptions, character
and corporation names) are HTML-escaped before rendering.

## Known limitations

- Default LP valuation uses ESI average prices (`/markets/prices`).
  The "Load Jita prices" button refines the top offers with the live Jita 4-4
  order book (highest buy for the product, lowest sell for materials),
  fetched with a concurrency limit of 4 to respect ESI rate limits.
- Military Campaign progress is not exposed by ESI (verified against the
  2026-06-09 OpenAPI spec, 203 paths). The Campaigns tab is static data,
  maintained in `js/config.js`.
- The Amarr campaign name is unconfirmed and rendered as such.
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
