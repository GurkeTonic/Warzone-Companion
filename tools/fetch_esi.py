#!/usr/bin/env python3
"""Fetch everything the frontend used to ask ESI for, into data/esi/.

Until 5.10.2026 every visitor's browser called ESI directly: /fw/systems,
kills, jumps, leaderboards, LP store offers, market prices, Jita order books,
character affiliations and names. That data is the same for everybody, and
ESI itself refreshes it every 30 minutes at best (kills and prices hourly,
leaderboards daily). So it is fetched once per build here, and js/esi.js
reads the files instead of ESI. Visitors' browsers no longer contact CCP.

Run by .github/workflows/deploy.yml before the site is built; works locally:

  python3 tools/fetch_esi.py

Output (all under data/esi/, paths mirror the ESI routes the frontend used):

  fw/systems.json, fw/stats.json             as ESI returns them
  universe/system_kills.json, system_jumps.json   only the FW systems
  fw/leaderboards/characters.json, corporations.json
  loyalty/stores/<corp>/offers.json          the four militia stores
  markets/prices.json                        only types the LP store uses
  jita.json        {type_id: [buy, sell, buyDepth]} at Jita 4-4, for the
                   shortlist the LP store reprices (top LP_JITA_ROWS per
                   militia by average price, plus their required items).
                   Same formula as the old js/lpstore.js fetchJitaOrders.
                   Reused for JITA_MAX_AGE_H if a previous file is present.
  affiliation.json {character_id: faction_id|null} for leaderboard pilots
  corporations.json {corporation_id: faction_id|null}
  names.json       {id: name} for every ID the views print
  meta.json        when each group was fetched

Stdlib only. Exit 1 if the core FW data cannot be fetched; everything else
degrades to "missing file", which the views already handle.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from esi_client import Halted
from esi_shared import client

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "esi"

MILITIA_CORPS = [1000180, 1000182, 1000179, 1000181]  # js/config.js FACTIONS
JITA_REGION = 10000002
JITA_STATION = 60003760
LP_JITA_ROWS = 25        # js/config.js CONFIG.LP_JITA_ROWS
JITA_MAX_AGE_H = 2
WORKERS = 4   # parallel requests; the docs ask to spread, not burst

now = datetime.now(timezone.utc)
NOW_ISO = now.strftime("%Y-%m-%dT%H:%M:%SZ")


ESI = client()


def request(path, params=None, body=None):
    """Through tools/esi_client.py: expires, ETag, error and rate limits."""
    if body is not None:
        return ESI.post(path, body)
    return ESI.get(path, params)


def write(rel, payload):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    return p.stat().st_size


meta = {}
sizes = {}


def prev_file(rel):
    try:
        return json.loads((OUT / rel).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


prev_meta_all = prev_file("meta.json")


def age_of(group):
    stamp = prev_meta_all.get(group)
    if not stamp:
        return None
    return (now - datetime.fromisoformat(stamp.replace("Z", "+00:00"))).total_seconds() / 3600


def done(group, *files):
    meta[group] = NOW_ISO
    for f, payload in files:
        sizes[f] = write(f, payload)


# ---------- core FW data: without it the build must fail ----------

try:
    systems = request("/fw/systems")
    stats = request("/fw/stats")
except Halted as e:
    sys.exit(f"ESI halted before the core data: {e}")
if not systems or not stats:
    sys.exit("ESI returned no factional warfare data")
fw_ids = {s["solar_system_id"] for s in systems}
kills = [k for k in request("/universe/system_kills") if k["system_id"] in fw_ids]
jumps = [j for j in request("/universe/system_jumps") if j["system_id"] in fw_ids]
done("fw", ("fw/systems.json", systems), ("fw/stats.json", stats),
     ("universe/system_kills.json", kills), ("universe/system_jumps.json", jumps))

names = {}
unresolved = set()


# ---------- leaderboards, affiliations ----------

def collect(board, key):
    ids = set()
    for cat in ("kills", "victory_points"):
        for period in (board.get(cat) or {}).values():
            for e in period or []:
                ids.add(e[key])
    return ids


try:
    chars = request("/fw/leaderboards/characters")
    corps = request("/fw/leaderboards/corporations")
    char_ids = sorted(collect(chars, "character_id"))
    corp_ids = sorted(collect(corps, "corporation_id"))
    # POST routes carry no cache headers. A pilot's militia changes rarely,
    # so known pilots are taken from the previous file for up to a day and
    # only new ones are asked for.
    prev_aff = {int(k): v for k, v in prev_file("affiliation.json").items()}
    fresh = age_of("affiliation") is not None and age_of("affiliation") < 24
    affiliation = {c: prev_aff[c] for c in char_ids if fresh and c in prev_aff}
    ask = [c for c in char_ids if c not in affiliation]
    for i in range(0, len(ask), 1000):
        for e in request("/characters/affiliation", body=ask[i:i + 1000]):
            affiliation[e["character_id"]] = e.get("faction_id")
    if ask or not fresh:
        meta["affiliation"] = NOW_ISO
    else:
        meta["affiliation"] = prev_meta_all.get("affiliation")

    def corp_faction(cid):
        try:
            return cid, request(f"/corporations/{cid}").get("faction_id")
        except Exception as e:  # one unknown corp must not lose the board
            print(f"  corporation {cid}: {e}")
            return cid, None

    with ThreadPoolExecutor(WORKERS) as pool:
        corp_fac = dict(pool.map(corp_faction, corp_ids))
    unresolved |= set(char_ids) | set(corp_ids)
    done("leaderboards",
         ("fw/leaderboards/characters.json", chars),
         ("fw/leaderboards/corporations.json", corps),
         ("affiliation.json", affiliation),
         ("corporations.json", corp_fac))
except Exception as e:
    print(f"leaderboards unavailable, keeping previous files: {e}")


# ---------- LP stores, prices, Jita shortlist ----------

def offer_ratio(o, price_of):
    """Average-price ISK/LP, the ranking js/lpstore.js evaluate() uses."""
    if o.get("lp_cost", 0) <= 0:
        return None
    value = price_of(o["type_id"]) * o.get("quantity", 0)
    if value <= 0:
        return None
    req = sum(price_of(r["type_id"]) * r.get("quantity", 0) for r in o.get("required_items", []))
    return (value - o.get("isk_cost", 0) - req) / o["lp_cost"]


def jita_summary(type_id):
    orders = request(f"/markets/{JITA_REGION}/orders", {"type_id": type_id, "order_type": "all"})
    buys = [o for o in orders if o["location_id"] == JITA_STATION and o["is_buy_order"]]
    sells = [o["price"] for o in orders if o["location_id"] == JITA_STATION and not o["is_buy_order"]]
    buy = max((o["price"] for o in buys), default=0)
    depth = sum(o.get("volume_remain", 0) for o in buys if o["price"] >= buy * 0.95)
    return type_id, [buy, min(sells, default=0), depth]


try:
    offers = {c: request(f"/loyalty/stores/{c}/offers") for c in MILITIA_CORPS}
    lp_types = set()
    for lst in offers.values():
        for o in lst:
            lp_types.add(o["type_id"])
            lp_types.update(r["type_id"] for r in o.get("required_items", []))
    prices_all = request("/markets/prices")
    prices = [p for p in prices_all if p["type_id"] in lp_types]
    avg = {p["type_id"]: p.get("average_price") or p.get("adjusted_price") or 0 for p in prices}
    files = [(f"loyalty/stores/{c}/offers.json", lst) for c, lst in offers.items()]
    files.append(("markets/prices.json", prices))
    done("lp", *files)
    unresolved |= lp_types

    shortlist = set()
    for lst in offers.values():
        ranked = sorted((o for o in lst if offer_ratio(o, lambda t: avg.get(t, 0)) is not None),
                        key=lambda o: offer_ratio(o, lambda t: avg.get(t, 0)), reverse=True)
        for o in ranked[:LP_JITA_ROWS]:
            shortlist.add(o["type_id"])
            shortlist.update(r["type_id"] for r in o.get("required_items", []))

    prev_meta = {}
    try:
        prev_meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
        prev_jita = {int(k): v for k, v in json.loads((OUT / "jita.json").read_text(encoding="utf-8")).items()}
    except (OSError, ValueError):
        prev_jita = {}
    age_h = None
    if prev_meta.get("jita"):
        age_h = (now - datetime.fromisoformat(prev_meta["jita"].replace("Z", "+00:00"))).total_seconds() / 3600
    if prev_jita and age_h is not None and age_h < JITA_MAX_AGE_H and shortlist <= set(prev_jita):
        meta["jita"] = prev_meta["jita"]
        sizes["jita.json"] = write("jita.json", {str(k): v for k, v in prev_jita.items()})
        print(f"jita: reused ({age_h:.1f} h old)")
    else:
        with ThreadPoolExecutor(WORKERS) as pool:
            jita = dict(pool.map(jita_summary, sorted(shortlist)))
        done("jita", ("jita.json", {str(k): v for k, v in jita.items()}))
except Exception as e:
    print(f"LP data unavailable, keeping previous files: {e}")


# ---------- names ----------

try:
    # Names of items, pilots and corporations do not change in practice
    # (renames are rare); only IDs not in the previous file are resolved.
    names = {int(k): v for k, v in prev_file("names.json").items() if int(k) in unresolved}
    ids = sorted(i for i in unresolved if isinstance(i, int) and i not in names)
    for i in range(0, len(ids), 900):
        for e in request("/universe/names", body=ids[i:i + 900]):
            names[e["id"]] = e["name"]
    print(f"names: {len(ids)} resolved, {len(names) - len(ids)} reused")
    done("names", ("names.json", names))
except Exception as e:
    print(f"names unavailable, keeping previous file: {e}")

prev = {}
try:
    prev = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
except (OSError, ValueError):
    pass
write("meta.json", {**prev, **meta})
total = sum(sizes.values())
write("files.json", sorted(str(p.relative_to(OUT)) for p in OUT.rglob("*.json") if p.name != "files.json"))
print(f"data/esi: {len(sizes)} files, {total // 1024} kB, groups {', '.join(sorted(meta))}")
print(ESI.summary())
