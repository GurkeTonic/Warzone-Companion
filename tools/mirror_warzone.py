#!/usr/bin/env python3
"""Mirror the war report API into data/warzone.json.

Fetches per-system Advantage from www.eveonline.com (no CORS headers, hence
unreachable from browser JavaScript) and writes a compact, precomputed file
the frontend can serve statically (GitHub Pages). Run by the scheduled
GitHub Action in .github/workflows/warzone-data.yml; works locally too.

The file is only rewritten when the payload actually changed, so the Action
can skip empty commits. Exit code 0 either way.
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WARZONE_API = "https://www.eveonline.com/api/warzone/status"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "warzone.json"

# Empire militia factions; pirate factions (Guristas/Angels) are ignored.
EMPIRES = {500001, 500002, 500003, 500004}


def fetch_status():
    req = urllib.request.Request(WARZONE_API, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def build_systems(rows):
    systems = {}
    for row in rows:
        entries = [a for a in row.get("advantage", []) if a.get("factionID") in EMPIRES]
        occ = next(
            (a.get("totalAmount") for a in entries
             if a.get("factionID") == row.get("occupierFaction")),
            None,
        )
        enemy = max(
            (a.get("totalAmount", 0) for a in entries
             if a.get("factionID") != row.get("occupierFaction")),
            default=0,
        )
        if occ is None:
            continue
        systems[str(row["solarSystemID"] if "solarSystemID" in row else row["solarsystemID"])] = {
            "occ": occ,
            "enemy": enemy,
        }
    return systems


def main():
    systems = build_systems(fetch_status())
    if not systems:
        sys.exit("war report API returned no usable systems")

    if OUT_PATH.exists():
        try:
            old = json.loads(OUT_PATH.read_text(encoding="utf-8"))
            if old.get("systems") == systems:
                print("unchanged")
                return
        except (OSError, ValueError):
            pass

    payload = {
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "systems": systems,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(payload, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH} ({len(systems)} systems)")


if __name__ == "__main__":
    main()
