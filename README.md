# Theatres of War — Warzone Companion

Local web application for EVE Online Factional Warfare and Military Campaigns.
Runs entirely client-side against public ESI endpoints. No build step, no
backend, no dependencies.

## Run

```
python3 serve.py
```

Opens http://localhost:8080 automatically (caching disabled, edits are
picked up on reload). Stop with Ctrl+C.

Alternatives: `python3 -m http.server 8080` in the project directory, or
opening `index.html` directly via `file://` — both work, `serve.py` is just
the most convenient for development.

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
js/i18n.js          DE/EN strings, formatting helpers
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
active tab.

## Known limitations

- Default LP valuation uses ESI average prices (`/markets/prices`).
  The "Load Jita prices" button refines the top offers with the live Jita 4-4
  order book (highest buy for the product, lowest sell for materials),
  fetched with a concurrency limit of 4 to respect ESI rate limits.
- Military Campaign progress is not exposed by ESI (verified against the
  2026-06-09 OpenAPI spec, 203 paths). The Campaigns tab is static data,
  maintained in `js/config.js`.
- The Amarr campaign name is unconfirmed and rendered as such.
- No persistence. Historical tracking requires a polling backend (planned).

## Roadmap

1. Polling backend + database for front-line history over time.
2. EVE SSO login for personal stats: achievements, LP wallet, standings
   (`/characters/{id}/fw/stats`, `/characters/{id}/loyalty/points`).
3. Campaign progress, as soon as ESI exposes a route. Until then: manual
   updates in `js/config.js`, or a feature request via esi-issues.

## Legal

EVE Online and all related trademarks are the property of CCP hf. /
Fenris Creations. This is an unofficial fan project and is not affiliated
with or endorsed by the rights holder.
