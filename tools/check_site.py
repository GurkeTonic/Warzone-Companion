#!/usr/bin/env python3
"""Checks that keep broken data and stale pages off the live site.

The site is served straight from main (GitHub Pages, deploy from branch), so
whatever is committed is live within a minute. These checks run where a commit
is made:

  --data    before the mirror workflow commits data/*.json: every file parses
            and has the shape the front end reads. A failed check means no
            commit, and the site keeps the last good snapshot.
  --static  before the SDE workflow commits js/data/staticdata.js: the file is
            there, is not truncated, and is valid JavaScript (node --check).
  --pages   on every push: the subpages, routes.js and sitemap.xml match what
            tools/build_pages.py generates from index.html.
  --esi     the snapshot from tools/fetch_esi.py is complete and fresh.
  --history PREV   history.json did not lose data against the previous
            published version PREV (a shrinking history means a broken run).

Stdlib only (plus node for --static). Exit 1 on any failure.
"""
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
errors = []


def fail(msg):
    errors.append(msg)
    print(f"FAIL {msg}")


def ok(msg):
    print(f"ok   {msg}")


def load(name):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        fail(f"{name}: {e}")
        return None


def recent(name, stamp, hours):
    try:
        t = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        fail(f"{name}: timestamp {stamp!r} unreadable")
        return
    age = datetime.now(timezone.utc) - t
    if age > timedelta(hours=hours) or age < timedelta(minutes=-5):
        fail(f"{name}: timestamp {stamp} is {age} old (limit {hours} h)")


def check_data():
    w = load("warzone.json")
    if w is not None:
        n = len(w.get("systems") or [])
        if n < 100:
            fail(f"warzone.json: only {n} systems (expected about 160)")
        else:
            ok(f"warzone.json: {n} systems")
        # The war report API is unofficial; when it is down the mirror keeps
        # the last snapshot, and the frontend drops it after 24 h.
        recent("warzone.json", w.get("fetched"), 24)
    i = load("insurgency.json")
    if i is not None:
        if not isinstance(i.get("campaigns"), list):
            fail("insurgency.json: 'campaigns' is not a list")
        else:
            ok(f"insurgency.json: {len(i['campaigns'])} campaigns")
    c = load("campaigns.json")
    if c is not None:
        if not isinstance(c.get("campaigns"), list):
            fail("campaigns.json: 'campaigns' is not a list")
        else:
            ok(f"campaigns.json: {len(c['campaigns'])} campaigns")
    f = load("feed-flips.json")
    if f is not None:
        if not isinstance(f.get("flips"), list):
            fail("feed-flips.json: 'flips' is not a list")
        else:
            ok(f"feed-flips.json: {len(f['flips'])} flips")
    h = load("history.json")
    if h is not None:
        missing = [k for k in ("factions", "systems", "occ") if k not in h]
        if missing:
            fail(f"history.json: missing {', '.join(missing)}")
        else:
            ok("history.json: shape ok")


def check_static():
    p = ROOT / "js" / "data" / "staticdata.js"
    if not p.exists():
        fail("js/data/staticdata.js missing")
        return
    size = p.stat().st_size
    if size < 100_000:
        fail(f"staticdata.js: only {size} bytes, looks truncated")
    else:
        ok(f"staticdata.js: {size // 1024} kB")
    r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
    if r.returncode:
        fail(f"staticdata.js: not valid JavaScript: {r.stderr.strip()[:200]}")
    else:
        ok("staticdata.js: valid JavaScript")


def check_pages():
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "build_pages.py")],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        fail(f"build_pages.py failed: {r.stderr.strip()[:200]}")
        return
    # Only what build_pages.py writes; index.html is its source, not its output.
    d = subprocess.run(["git", "diff", "--name-only", "--", "*/index.html", "js/routes.js", "sitemap.xml"],
                       capture_output=True, text=True, cwd=ROOT)
    changed = d.stdout.split()
    if changed:
        fail("generated files out of date, run tools/build_pages.py: " + ", ".join(changed))
    else:
        ok("subpages, routes.js and sitemap.xml match index.html")


def check_esi():
    base = DATA / "esi"
    need = ["fw/systems.json", "fw/stats.json", "universe/system_kills.json",
            "universe/system_jumps.json", "fw/leaderboards/characters.json",
            "fw/leaderboards/corporations.json", "affiliation.json", "corporations.json",
            "markets/prices.json", "jita.json", "names.json", "meta.json"]
    need += [f"loyalty/stores/{c}/offers.json" for c in (1000180, 1000182, 1000179, 1000181)]
    for rel in need:
        try:
            d = json.loads((base / rel).read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            fail(f"esi/{rel}: {e}")
            continue
        if not d:
            fail(f"esi/{rel}: empty")
    try:
        meta = json.loads((base / "meta.json").read_text(encoding="utf-8"))
        recent("esi/meta.json fw", meta.get("fw"), 1)
        for group in ("leaderboards", "lp", "names"):
            recent(f"esi/meta.json {group}", meta.get(group), 26)
        recent("esi/meta.json jita", meta.get("jita"), 6)
        ok(f"esi snapshot: {len(need)} files, fw fetched {meta.get('fw')}")
    except (OSError, ValueError) as e:
        fail(f"esi/meta.json: {e}")


def check_history(prev_path):
    try:
        prev = json.loads(Path(prev_path).read_text(encoding="utf-8"))
        new = json.loads((DATA / "history.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        fail(f"history: {e}")
        return
    for key in ("factions", "systems", "flips", "lp"):
        a, b = len(prev.get(key) or []), len(new.get(key) or [])
        # Old entries are pruned by age, a few per run; losing more than a
        # tenth at once means the run started from a wrong or empty state.
        if b < a * 0.9:
            fail(f"history.json: {key} shrank from {a} to {b} entries")
    last_prev = max((e["t"] for e in prev.get("factions") or []), default=0)
    last_new = max((e["t"] for e in new.get("factions") or []), default=0)
    if last_new < last_prev:
        fail(f"history.json: newest entry {last_new} older than before ({last_prev})")
    else:
        ok(f"history.json: {len(new.get('factions') or [])} faction snapshots, none lost")


args = sys.argv[1:]
if "--history" in args:
    i = args.index("--history")
    check_history(args[i + 1])
    del args[i:i + 2]
if "--esi" in args:
    args.remove("--esi")
    check_esi()
modes = set(args) or ({"--data", "--static", "--pages"} if not errors and not sys.argv[1:] else set())
if "--data" in modes:
    check_data()
if "--static" in modes:
    check_static()
if "--pages" in modes:
    check_pages()
sys.exit(1 if errors else 0)
