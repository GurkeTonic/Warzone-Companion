#!/usr/bin/env python3
"""Check CCP's SDE build number against js/data/staticdata.js and regenerate
it via build_static_data.py if a newer build is out.

Uses the automation endpoints from
https://developers.eveonline.com/docs/services/static-data/#automation:
  - latest.jsonl: current build number, no download needed to check
  - eve-online-static-data-latest-jsonl.zip: always redirects to the
    current build, so this never needs a version number hardcoded

Meant to run on a schedule (see .github/workflows/sde-update.yml). Exits 0
whether or not an update happened; the workflow diffs the file afterwards
to decide whether to commit. Stdlib only.

Usage:
  python tools/update_sde.py
"""
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from esi_shared import USER_AGENT

LATEST_BUILD_URL = "https://developers.eveonline.com/static-data/tranquility/latest.jsonl"
LATEST_ZIP_URL = "https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip"

ROOT = Path(__file__).resolve().parent.parent
STATICDATA = ROOT / "js" / "data" / "staticdata.js"
BUILD_STATIC_DATA = Path(__file__).resolve().parent / "build_static_data.py"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


def current_build():
    if not STATICDATA.exists():
        return None
    m = re.search(r'"build":(\d+)', STATICDATA.read_text(encoding="utf-8"))
    return int(m.group(1)) if m else None


def latest_build():
    for line in fetch(LATEST_BUILD_URL).decode("utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("_key") == "sde":
            return row["buildNumber"], row.get("releaseDate")
    sys.exit("latest.jsonl: no 'sde' record found")


def main():
    have = current_build()
    want, released = latest_build()
    print(f"staticdata.js build: {have}")
    print(f"latest SDE build:    {want} ({released})")

    if have == want:
        print("up to date, nothing to do")
        return

    print(f"downloading latest SDE ({LATEST_ZIP_URL}) ...")
    data = fetch(LATEST_ZIP_URL)
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    print(f"downloaded {len(data) // (1024 * 1024)} MiB")

    try:
        subprocess.run(
            [sys.executable, str(BUILD_STATIC_DATA), tmp_path],
            check=True,
            cwd=ROOT,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
