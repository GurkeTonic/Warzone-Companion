#!/usr/bin/env python3
"""Mirror warzone data into data/ for the statically hosted frontend.

Run by the scheduled GitHub Action (.github/workflows/warzone-data.yml)
every 30 minutes; works locally too. Produces:

  data/warzone.json  — current Advantage per system, from the war report API
                       on www.eveonline.com (no CORS headers, hence
                       unreachable from browser JavaScript directly).
                       Only rewritten when the payload changed.
  data/history.json  — rolling time series, appended every run:
                       * factions: systems held + pilots per militia
                         (kept for HISTORY_DAYS)
                       * systems: occupier and contested permille for
                         systems with victory points (kept for
                         SYSTEM_WINDOW_HOURS, feeds the 24h trend column)

Git history of these files doubles as a full, publicly auditable archive.
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WARZONE_API = "https://www.eveonline.com/api/warzone/status"
ESI_BASE = "https://esi.evetech.net"
COMPAT_DATE = "2026-06-09"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WARZONE_PATH = DATA_DIR / "warzone.json"
HISTORY_PATH = DATA_DIR / "history.json"

HISTORY_DAYS = 90
SYSTEM_WINDOW_HOURS = 49

# Empire militia factions; pirate factions (Guristas/Angels) are ignored.
EMPIRES = {500001, 500002, 500003, 500004}


def get_json(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def esi(path):
    return get_json(f"{ESI_BASE}{path}?compatibility_date={COMPAT_DATE}")


# ---------- advantage mirror (data/warzone.json) ----------

def build_advantage(rows):
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
        key = str(row.get("solarSystemID") or row.get("solarsystemID"))
        systems[key] = {"occ": occ, "enemy": enemy}
    return systems


def write_advantage(now_iso, systems):
    if WARZONE_PATH.exists():
        try:
            old = json.loads(WARZONE_PATH.read_text(encoding="utf-8"))
            if old.get("systems") == systems:
                print("warzone.json unchanged")
                return
        except (OSError, ValueError):
            pass
    WARZONE_PATH.write_text(
        json.dumps({"fetched": now_iso, "systems": systems}, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {WARZONE_PATH} ({len(systems)} systems)")


# ---------- rolling history (data/history.json) ----------

def load_history():
    if HISTORY_PATH.exists():
        try:
            h = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
            if isinstance(h.get("factions"), list) and isinstance(h.get("systems"), list):
                return h
        except (OSError, ValueError):
            pass
    return {"factions": [], "systems": []}


def append_history(now_epoch, fw_systems, fw_stats):
    history = load_history()

    held = {f: 0 for f in EMPIRES}
    sys_snapshot = {}
    for s in fw_systems:
        occ = s.get("occupier_faction_id")
        if occ in held:
            held[occ] += 1
        vp = s.get("victory_points", 0)
        threshold = s.get("victory_points_threshold", 0)
        if vp > 0 and threshold > 0:
            permille = round(vp / threshold * 1000)
            sys_snapshot[str(s["solar_system_id"])] = [occ, permille]

    pilots = {s["faction_id"]: s.get("pilots", 0) for s in fw_stats}
    fac_snapshot = {
        str(f): [held[f], pilots.get(f, 0)] for f in sorted(EMPIRES)
    }

    history["factions"].append({"t": now_epoch, "f": fac_snapshot})
    history["systems"].append({"t": now_epoch, "s": sys_snapshot})

    fac_cutoff = now_epoch - HISTORY_DAYS * 86400
    sys_cutoff = now_epoch - SYSTEM_WINDOW_HOURS * 3600
    history["factions"] = [e for e in history["factions"] if e["t"] >= fac_cutoff]
    history["systems"] = [e for e in history["systems"] if e["t"] >= sys_cutoff]

    HISTORY_PATH.write_text(
        json.dumps(history, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"wrote {HISTORY_PATH} "
        f"({len(history['factions'])} faction / {len(history['systems'])} system snapshots)"
    )


def main():
    now = datetime.now(timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    now_epoch = int(now.timestamp())

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    advantage = build_advantage(get_json(WARZONE_API))
    if not advantage:
        sys.exit("war report API returned no usable systems")
    write_advantage(now_iso, advantage)

    fw_systems = esi("/fw/systems")
    fw_stats = esi("/fw/stats")
    if not fw_systems or not fw_stats:
        sys.exit("ESI returned no factional warfare data")
    append_history(now_epoch, fw_systems, fw_stats)


if __name__ == "__main__":
    main()
