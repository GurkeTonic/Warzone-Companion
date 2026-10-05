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
        recent("warzone.json", w.get("fetched"), 2)
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


modes = set(sys.argv[1:]) or {"--data", "--static", "--pages"}
if "--data" in modes:
    check_data()
if "--static" in modes:
    check_static()
if "--pages" in modes:
    check_pages()
sys.exit(1 if errors else 0)
