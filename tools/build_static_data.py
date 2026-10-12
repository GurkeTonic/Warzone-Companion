#!/usr/bin/env python3
"""Generate js/data/staticdata.js from the EVE SDE (JSONL zip) and ESI.

Produces a single plain-script data file consumed by the frontend:
  - k-space stargate adjacency graph (for jump counts and frontline logic)
  - system names and regions (for search, tables, and the warzone map)
  - factional warfare system set with schematic 2D and geographic 3D
    map positions (from ESI + SDE)
  - Military Campaigns with objectives (official titles, DE/EN texts)
  - Factional Warfare complexes: which ships each kind admits, resolved
    from dungeons.allowedShipsList and typeLists

Usage:
  python tools/build_static_data.py <path-to-sde-jsonl-zip>

Stdlib only. Network access: one GET to ESI /fw/systems to learn the
current warzone membership (160 systems).
"""
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

from esi_shared import client
OUT_PATH = Path(__file__).resolve().parent.parent / "js" / "data" / "staticdata.js"

# Wormhole/abyssal/void regions start at 11000000; k-space regions are below.
KSPACE_REGION_MAX = 11000000

TAG_RE = re.compile(r"<[^>]+>")


def read_jsonl(zf, name):
    with zf.open(name) as fh:
        for line in io.TextIOWrapper(fh, encoding="utf-8"):
            line = line.strip()
            if line:
                yield json.loads(line)


def clean_text(value):
    """Strip client markup (<a href=showinfo:...>) and collapse whitespace."""
    return re.sub(r"\s+", " ", TAG_RE.sub("", value or "")).strip()


def loc(obj, keys=("de", "en")):
    if not isinstance(obj, dict):
        return {}
    return {k: clean_text(obj[k]) for k in keys if obj.get(k)}


# --- Factional Warfare complexes ------------------------------------------
#
# Each FW complex (dungeon) names a typeList in allowedShipsList; the list is
# a set expression resolved in CCP's order: categories in, categories out,
# groups in, groups out, types in, types out (V.A.U.L.T 30-Wissen/
# Was-durchs-Tor-passt.md). Only published ships count.
#
# Dungeon names carry the kind and the code the client shows, e.g.
# "Caldari Small NVY-1" / "Caldari-NVY-1 (klein)". The kind's title comes
# from the dungeon archetype ("Kleiner Komplex"); "Moderate" shares the
# Medium archetype and has no title of its own.
PLEX_NAME_RE = re.compile(r"^(Amarr|Caldari|Gallente|Minmatar) "
                          r"(Scout|Small|Medium|Moderate|Large|Battlefield) (NVY|ADV|AF)-(\d+)$")
PLEX_ORDER = ["Scout", "Small", "Medium", "Moderate", "Large", "Battlefield"]
VARIANT_ORDER = ["NVY", "ADV", "AF"]
SHIP_CATEGORY = 6
# The largest hull a list admits, read from CCP's own English sentence
# ("... of Destroyer size or smaller"). Order matters: Battlecruiser before
# Cruiser, Battleship before both.
SIZE_WORDS = [("battlecruiser", 4), ("battleship", 5), ("cruiser", 3),
              ("destroyer", 2), ("frigate", 1)]
# The German text of these lists in the SDE is the English one; this is the
# same sentence in German, checked against the resolved ship groups.
PLEX_DESC_DE = {
    "FWNoviceNavy": "Tech-1- und Navy-Schiffe der Imperien in Fregattengröße.",
    "FWSmallNavy": "Tech-1- und Navy-Schiffe der Imperien bis Zerstörergröße.",
    "FWMediumNavy": "Tech-1- und Navy-Schiffe der Imperien bis Kreuzergröße.",
    "FWLargeNavy": "Tech-1- und Navy-Schiffe der Imperien bis Schlachtschiffgröße.",
    "FWSmallAdvanced": "Schiffe bis Tech 2 in Zerstörergröße oder kleiner.",
    "FWMediumAdvanced": "Schiffe bis Tech 2 in Kreuzergröße oder kleiner, dazu Tech-3-Zerstörer.",
    "FWLargeAdvanced": "Schiffe bis Schlachtschiffgröße.",
    "FWAssaultFrigatesOnly": "Nur Angriffsfregatten.",
}


def max_size(text_en):
    low = text_en.lower()
    first = None
    for word, size in SIZE_WORDS:
        i = low.find(word + " size") if word != "frigate" or "frigate size" in low else low.find("frigate")
        if i >= 0 and (first is None or i < first[0]):
            first = (i, size)
    if first is None:
        sys.exit(f"typeList text names no hull size: {text_en!r}")
    return first[1]


def resolve_ships(tlist, ships, groups):
    """Type IDs the list admits, in CCP's order of operations."""
    cats = set(tlist.get("includedCategoryIDs", [])) - set(tlist.get("excludedCategoryIDs", []))
    sel = {t for t, row in ships.items() if groups[row["groupID"]]["categoryID"] in cats}
    sel |= {t for t, row in ships.items() if row["groupID"] in set(tlist.get("includedGroupIDs", []))}
    sel -= {t for t in sel if ships[t]["groupID"] in set(tlist.get("excludedGroupIDs", []))}
    sel |= set(tlist.get("includedTypeIDs", [])) & ships.keys()
    sel -= set(tlist.get("excludedTypeIDs", []))
    return sel


def build_plexes(zf):
    groups = {g["_key"]: g for g in read_jsonl(zf, "groups.jsonl")}
    ships = {t["_key"]: t for t in read_jsonl(zf, "types.jsonl")
             if t.get("published") and groups.get(t["groupID"], {}).get("categoryID") == SHIP_CATEGORY}
    lists = {t["_key"]: t for t in read_jsonl(zf, "typeLists.jsonl")}
    archetypes = {a["_key"]: a for a in read_jsonl(zf, "archetypes.jsonl")}

    found = {}  # (kind, variant) -> {"list": id, "arch": id, "codes": {lang: set}}
    for d in read_jsonl(zf, "dungeons.jsonl"):
        m = PLEX_NAME_RE.match((d.get("name") or {}).get("en", ""))
        if not m or not d.get("allowedShipsList"):
            continue
        if len(d["allowedShipsList"]) != 1:
            sys.exit(f"FW complex {d['name']['en']} lists {d['allowedShipsList']}, expected one")
        kind, variant = m.group(2), m.group(3)
        slot = found.setdefault((kind, variant), {"list": d["allowedShipsList"][0],
                                                  "arch": d.get("archetypeID"), "codes": {"de": set(), "en": set()}})
        if slot["list"] != d["allowedShipsList"][0]:
            sys.exit(f"FW complexes {kind} {variant} disagree on their ship list")
        slot["codes"]["en"].add(f"{variant}-{m.group(4)}")
        de = (d.get("name") or {}).get("de")
        code_de = re.search(r"\b([A-Z]{2,3}-\d+)\b", de or "")
        slot["codes"]["de"].add(code_de.group(1) if code_de else f"{variant}-{m.group(4)}")

    def mass(t):
        return ships[t].get("mass") or 0

    rows = []
    for kind in PLEX_ORDER:
        cells = []
        for variant in VARIANT_ORDER:
            slot = found.get((kind, variant))
            if not slot:
                continue
            tl = lists[slot["list"]]
            desc = tl.get("displayDescription") or {}
            en = clean_text(desc.get("en", ""))
            de = clean_text(desc.get("de", ""))
            if not de or de == en:
                de = PLEX_DESC_DE.get(tl["name"]) or sys.exit(f"no German text for {tl['name']}")
            admitted = resolve_ships(tl, ships, groups)
            by_group = {}
            for t in admitted:
                by_group.setdefault(ships[t]["groupID"], []).append(t)
            # Groups from the lightest hull to the heaviest, by median mass.
            order = sorted(by_group, key=lambda g: sorted(mass(t) for t in by_group[g])[len(by_group[g]) // 2])
            excluded = sorted((t for t in tl.get("excludedTypeIDs", []) if t in ships),
                              key=lambda t: (mass(t), ships[t]["name"]["en"]))
            cells.append({
                "variant": variant,
                "list": tl["name"],
                "codes": {lang: sorted(c) for lang, c in slot["codes"].items()},
                "desc": {"de": de, "en": en},
                "max": max_size(en),
                "ships": len(admitted),
                "groups": [{**loc(groups[g]["name"]), "n": len(by_group[g])} for g in order],
                "excluded": [loc(ships[t]["name"]) for t in excluded],
            })
        if not cells:
            continue
        arch = archetypes.get(found[(kind, cells[0]["variant"])]["arch"], {})
        title = loc(arch.get("title"))
        if kind == "Moderate":
            # Same archetype as Medium; the client tells them apart by name
            # ("Moderate NVY-3" / "Mittlerer …-NVY-3").
            title = {"de": "Mittlerer Komplex", "en": "Moderate Complex"}
        rows.append({"kind": kind, "title": title, "cells": cells})
    if len(rows) < 5:
        sys.exit(f"only {len(rows)} kinds of FW complex found; did the dungeon names change?")
    return rows


def fetch_fw_system_ids():
    """Through tools/esi_client.py, like every ESI request."""
    return {row["solar_system_id"] for row in client().get("/fw/systems")}


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: build_static_data.py <sde-jsonl-zip>")
    zip_path = Path(sys.argv[1])
    if not zip_path.exists():
        sys.exit(f"SDE zip not found: {zip_path}")

    fw_ids = fetch_fw_system_ids()
    print(f"ESI: {len(fw_ids)} factional warfare systems")

    with zipfile.ZipFile(zip_path) as zf:
        meta = next(read_jsonl(zf, "_sde.jsonl"))

        regions = {}
        for r in read_jsonl(zf, "mapRegions.jsonl"):
            regions[r["_key"]] = r["name"]["en"]

        systems = {}
        for s in read_jsonl(zf, "mapSolarSystems.jsonl"):
            if s["regionID"] >= KSPACE_REGION_MAX:
                continue
            systems[s["_key"]] = {
                "name": s["name"]["en"],
                "region": s["regionID"],
                "sec": round(s["securityStatus"], 2),
                "pos": s.get("position2D"),
                "pos3": s.get("position"),
            }

        graph = {sid: [] for sid in systems}
        for g in read_jsonl(zf, "mapStargates.jsonl"):
            a = g["solarSystemID"]
            b = g["destination"]["solarSystemID"]
            if a in graph and b in systems and b not in graph[a]:
                graph[a].append(b)

        objectives = {}
        for o in read_jsonl(zf, "militaryCampaignObjectives.jsonl"):
            objectives.setdefault(o["campaignID"], []).append({
                "id": o["_key"],
                "career": o.get("careerPath"),
                "title": loc(o.get("title")),
                "subtitle": loc(o.get("subtitle")),
                "target": o.get("targetProgress"),
                "lp": (o.get("rewards", {}).get("lp") or {}).get("amountPerInterval"),
                "isk": (o.get("rewards", {}).get("isk") or {}).get("amountPerInterval"),
            })

        campaigns = []
        for c in read_jsonl(zf, "militaryCampaigns.jsonl"):
            campaigns.append({
                "id": c["_key"],
                "faction": (c.get("issuer") or {}).get("factionID"),
                "title": loc(c.get("title")),
                "subtitle": loc(c.get("subtitle")),
                "target": c.get("targetProgress"),
                "objectives": objectives.get(c["_key"], []),
            })
        campaigns.sort(key=lambda c: c["faction"] or 0)

        plexes = build_plexes(zf)

    missing = fw_ids - systems.keys()
    if missing:
        sys.exit(f"FW systems missing from SDE: {sorted(missing)}")

    # Compact name/graph tables for all of k-space (home-system search + BFS),
    # richer records only for the warzone systems.
    names = {sid: s["name"] for sid, s in systems.items()}
    fw = {}
    for sid in sorted(fw_ids):
        s = systems[sid]
        fw[sid] = {
            "n": s["name"],
            "r": regions.get(s["region"], "?"),
            "sec": s["sec"],
            "x": s["pos"]["x"] if s["pos"] else None,
            "y": s["pos"]["y"] if s["pos"] else None,
            # Geographic 3D position for the map's 3D view, in light years
            # (the SDE gives metres; 1 ly = 9.4607e15 m), two decimals.
            "p3": [round(s["pos3"][k] / 9.4607e15, 2) for k in ("x", "y", "z")] if s.get("pos3") else None,
        }

    payload = {
        "build": meta.get("buildNumber"),
        "released": meta.get("releaseDate"),
        "names": names,
        "graph": graph,
        "fw": fw,
        "campaigns": campaigns,
        "plexes": plexes,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT_PATH.write_text(
        "/* Generated by tools/build_static_data.py — do not edit by hand.\n"
        f" * SDE build {payload['build']} ({payload['released']}). */\n"
        "\"use strict\";\n"
        f"const SDATA = {body};\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size // 1024} KiB)")
    print(f"systems: {len(names)}, fw: {len(fw)}, campaigns: {len(campaigns)}, "
          f"complex kinds: {len(plexes)}")


if __name__ == "__main__":
    main()
