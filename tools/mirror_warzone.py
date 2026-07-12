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
                       * occ: last known occupier of every system
                       * flips: occupier changes between runs
                         (kept for HISTORY_DAYS)
                       * lp: best/median ISK per LP of the top store offers
                         per militia, average-price based (kept for
                         HISTORY_DAYS)
  data/insurgency.json — pirate insurgency state from the war report API
                       (FOB origin, corruption/suppression per system)
  data/feed-flips.json — system flips as a stable, documented feed for
                       third parties (Discord bots etc.)

Git history of these files doubles as a full, publicly auditable archive.
"""
import json
import statistics
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WARZONE_API = "https://www.eveonline.com/api/warzone/status"
INSURGENCY_API = "https://www.eveonline.com/api/warzone/insurgency"
ESI_BASE = "https://esi.evetech.net"
COMPAT_DATE = "2026-06-09"
USER_AGENT = "WarzoneCompanion/0.4 (webmaster@tonicbeacon.com; +https://github.com/GurkeTonic/Warzone-Companion)"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WARZONE_PATH = DATA_DIR / "warzone.json"
HISTORY_PATH = DATA_DIR / "history.json"
INSURGENCY_PATH = DATA_DIR / "insurgency.json"
FEED_FLIPS_PATH = DATA_DIR / "feed-flips.json"

HISTORY_DAYS = 90
SYSTEM_WINDOW_HOURS = 49
LP_TOP_OFFERS = 20

# Empire militia factions; pirate factions (Guristas/Angels) are ignored
# for occupancy, but reported for insurgencies.
EMPIRES = {500001, 500002, 500003, 500004}
FACTION_NAMES = {
    500001: "Caldari State",
    500002: "Minmatar Republic",
    500003: "Amarr Empire",
    500004: "Gallente Federation",
}
MILITIA_CORPS = {500001: 1000180, 500002: 1000182, 500003: 1000179, 500004: 1000181}


def get_json(url):
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
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


# ---------- insurgency mirror (data/insurgency.json) ----------

def write_insurgency(now_iso):
    try:
        rows = get_json(INSURGENCY_API)
    except Exception as err:
        print(f"insurgency API unavailable, skipping: {err}")
        return
    campaigns = []
    for c in rows:
        if c.get("state") != "ACTIVE":
            continue
        origin = c.get("originSolarSystem") or {}
        systems = {}
        for e in c.get("insurgencies", []):
            sysinfo = e.get("solarSystem") or {}
            if not sysinfo.get("id"):
                continue
            systems[str(sysinfo["id"])] = [
                e.get("corruptionState", 0),
                round(e.get("corruptionPercentage", 0), 1),
                e.get("suppressionState", 0),
                round(e.get("suppressionPercentage", 0), 1),
            ]
        campaigns.append({
            "pirate": c.get("pirateFactionId"),
            "origin": {"id": origin.get("id"), "name": origin.get("name")},
            "started": c.get("startDateTime"),
            "systems": systems,
        })
    INSURGENCY_PATH.write_text(
        json.dumps({"fetched": now_iso, "campaigns": campaigns}, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {INSURGENCY_PATH} ({len(campaigns)} active campaigns)")


# ---------- LP snapshot (appended into data/history.json) ----------

def lp_snapshot():
    """Best and median ISK/LP of the top offers per militia, average-priced."""
    prices = {
        p["type_id"]: p.get("average_price") or p.get("adjusted_price") or 0
        for p in esi("/markets/prices")
    }
    result = {}
    for faction, corp in MILITIA_CORPS.items():
        offers = get_json(
            f"{ESI_BASE}/loyalty/stores/{corp}/offers?compatibility_date={COMPAT_DATE}"
        )
        ratios = []
        for o in offers:
            lp = o.get("lp_cost", 0)
            value = prices.get(o.get("type_id"), 0) * o.get("quantity", 0)
            if lp <= 0 or value <= 0:
                continue
            req = sum(
                prices.get(r.get("type_id"), 0) * r.get("quantity", 0)
                for r in o.get("required_items", [])
            )
            ratios.append((value - o.get("isk_cost", 0) - req) / lp)
        top = sorted(ratios, reverse=True)[:LP_TOP_OFFERS]
        if top:
            result[str(faction)] = [round(top[0]), round(statistics.median(top))]
    return result


# ---------- flip feed (data/feed-flips.json) ----------

def resolve_names(ids):
    if not ids:
        return {}
    body = json.dumps(sorted(set(ids))).encode()
    req = urllib.request.Request(
        f"{ESI_BASE}/universe/names?compatibility_date={COMPAT_DATE}",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return {row["id"]: row["name"] for row in json.load(res)}


def write_flip_feed(flips):
    names = resolve_names([f["id"] for f in flips])
    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "https://warzone.tonicbeacon.com — snapshots every 30 minutes",
        "flips": [
            {
                "time": datetime.fromtimestamp(f["t"], timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "system_id": f["id"],
                "system_name": names.get(f["id"], str(f["id"])),
                "from_id": f["from"],
                "from_name": FACTION_NAMES.get(f["from"], str(f["from"])),
                "to_id": f["to"],
                "to_name": FACTION_NAMES.get(f["to"], str(f["to"])),
            }
            for f in sorted(flips, key=lambda f: f["t"], reverse=True)
        ],
    }
    FEED_FLIPS_PATH.write_text(
        json.dumps(payload, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {FEED_FLIPS_PATH} ({len(payload['flips'])} flips)")


# ---------- rolling history (data/history.json) ----------

def load_history():
    if HISTORY_PATH.exists():
        try:
            h = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
            if isinstance(h.get("factions"), list) and isinstance(h.get("systems"), list):
                h.setdefault("occ", {})
                h.setdefault("flips", [])
                h.setdefault("lp", [])
                return h
        except (OSError, ValueError):
            pass
    return {"factions": [], "systems": [], "occ": {}, "flips": [], "lp": []}


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

    # Flip detection: occupier changed since the previous run.
    prev_occ = history.get("occ", {})
    new_occ = {
        str(s["solar_system_id"]): s.get("occupier_faction_id")
        for s in fw_systems
        if s.get("occupier_faction_id") in EMPIRES
    }
    for sid, occ in new_occ.items():
        old = prev_occ.get(sid)
        if old is not None and old != occ:
            history["flips"].append({"t": now_epoch, "id": int(sid), "from": old, "to": occ})
            print(f"flip: {sid} {old} -> {occ}")
    history["occ"] = new_occ

    try:
        history["lp"].append({"t": now_epoch, "m": lp_snapshot()})
    except Exception as err:
        print(f"lp snapshot failed, skipping: {err}")

    fac_cutoff = now_epoch - HISTORY_DAYS * 86400
    sys_cutoff = now_epoch - SYSTEM_WINDOW_HOURS * 3600
    history["factions"] = [e for e in history["factions"] if e["t"] >= fac_cutoff]
    history["systems"] = [e for e in history["systems"] if e["t"] >= sys_cutoff]
    history["flips"] = [e for e in history["flips"] if e["t"] >= fac_cutoff]
    history["lp"] = [e for e in history["lp"] if e["t"] >= fac_cutoff]

    HISTORY_PATH.write_text(
        json.dumps(history, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"wrote {HISTORY_PATH} "
        f"({len(history['factions'])} faction / {len(history['systems'])} system snapshots, "
        f"{len(history['flips'])} flips, {len(history['lp'])} lp points)"
    )
    return history


def main():
    now = datetime.now(timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    now_epoch = int(now.timestamp())

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # The war report API is unofficial and unsupported by CCP; its failure
    # must never stop the ESI-based collection below.
    try:
        advantage = build_advantage(get_json(WARZONE_API))
        if advantage:
            write_advantage(now_iso, advantage)
        else:
            print("war report returned no usable systems, skipping advantage")
    except Exception as err:
        print(f"war report unavailable, skipping advantage: {err}")
    write_insurgency(now_iso)

    fw_systems = esi("/fw/systems")
    fw_stats = esi("/fw/stats")
    if not fw_systems or not fw_stats:
        sys.exit("ESI returned no factional warfare data")
    history = append_history(now_epoch, fw_systems, fw_stats)
    write_flip_feed(history["flips"])


if __name__ == "__main__":
    main()
