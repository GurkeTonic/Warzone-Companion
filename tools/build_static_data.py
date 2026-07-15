#!/usr/bin/env python3
"""Generate js/data/staticdata.js from the EVE SDE (JSONL zip) and ESI.

Produces a single plain-script data file consumed by the frontend:
  - k-space stargate adjacency graph (for jump counts and frontline logic)
  - system names and regions (for search, tables, and the warzone map)
  - factional warfare system set with 2D map positions (from ESI + SDE)
  - Military Campaigns with objectives (official titles, DE/EN texts)

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

from esi_shared import ESI_BASE, COMPAT_DATE, USER_AGENT

ESI_FW_SYSTEMS = f"{ESI_BASE}/fw/systems?compatibility_date={COMPAT_DATE}"
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


def fetch_fw_system_ids():
    req = urllib.request.Request(
        ESI_FW_SYSTEMS,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return {row["solar_system_id"] for row in json.load(res)}


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
                "career": o.get("careerPath"),
                "subtitle": loc(o.get("subtitle")),
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
        }

    payload = {
        "build": meta.get("buildNumber"),
        "released": meta.get("releaseDate"),
        "names": names,
        "graph": graph,
        "fw": fw,
        "campaigns": campaigns,
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
    print(f"systems: {len(names)}, fw: {len(fw)}, campaigns: {len(campaigns)}")


if __name__ == "__main__":
    main()
