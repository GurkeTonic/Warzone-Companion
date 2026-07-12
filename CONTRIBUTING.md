# Contributing

Contributions are welcome — this is a community tool for all four militias.

## What helps most

- **Bug reports** with the page, what you expected, and what happened
- **Data corrections** (wrong mechanics, outdated rules) with a source
  (patch notes, dev blog, verifiable in-game behavior)
- **Translations**: DE and EN live in `js/i18n.js`; keep both in sync
- **Corp directory entries** once the Corps tab ships (see ROADMAP.md):
  corps will add themselves via pull request to `data/corps.json`

## Ground rules

- No frameworks, no build tooling, no npm dependencies — plain scripts only.
  Python (stdlib) is fine for tooling under `tools/`.
- Code and comments in English. UI strings only via `js/i18n.js`, always
  both languages.
- All player-authored strings from APIs must go through `esc()` before
  rendering.
- Undocumented APIs beyond the war report are off limits; everything must
  degrade gracefully when a data source is missing.
- Commit messages: one short line.

## Development setup

```
python serve.py            # http://localhost:8080 with the /api proxies
python tools/build_pages.py       # after editing index.html (regenerates subpages)
python tools/build_static_data.py <sde-zip>   # after an SDE release
python tools/mirror_warzone.py    # refresh data/ locally
```

## Data feed

`data/feed-flips.json` is a stable interface for third-party tools.
Schema changes to it need a very good reason and a heads-up in the PR.
