#!/usr/bin/env python3
"""Generate the tab subpages and sitemap.xml from index.html.

index.html is the source template (the Warzones page). Every other tab gets
a real subpage directory (/map/index.html, /lp/index.html, ...) so each tab
has its own URL, survives reloads, and is indexable with its own title and
description. Run after every change to index.html:

  python tools/build_pages.py

Stdlib only, no network.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "index.html"
BASE_URL = "https://warzone.tonicbeacon.com"

PAGES = [
    {
        "tab": "map",
        "dir": "map",
        "title": "Warzone Map — Warzone Companion",
        "description": "Interactive EVE Online Factional Warfare warzone maps: "
                       "occupancy, frontline status, Advantage, insurgencies, and activity per system.",
    },
    {
        "tab": "history",
        "dir": "history",
        "title": "Warzone History — Warzone Companion",
        "description": "EVE Online Factional Warfare over time: systems held, pilots, "
                       "LP value per militia, and a full system flip log.",
    },
    {
        "tab": "lp",
        "dir": "lp",
        "title": "LP Store Optimizer — Warzone Companion",
        "description": "ISK per LP ranking for all EVE Online militia LP stores, "
                       "with live Jita order-book pricing and market depth.",
    },
    {
        "tab": "jobs",
        "dir": "jobs",
        "title": "Freelance Jobs — Warzone Companion",
        "description": "Public EVE Online freelance jobs board: open tasks, rewards, and progress.",
    },
    {
        "tab": "boards",
        "dir": "leaderboards",
        "title": "Leaderboards — Warzone Companion",
        "description": "EVE Online Factional Warfare leaderboards: top characters and "
                       "corporations by kills and victory points.",
    },
    {
        "tab": "campaigns",
        "dir": "campaigns",
        "title": "Military Campaigns — Warzone Companion",
        "description": "EVE Online Military Campaigns with official titles, objectives, and rewards.",
    },
    {
        "tab": "faq",
        "dir": "faq",
        "title": "FAQ — Warzone Companion",
        "description": "How the Warzone Companion works: data sources, frontline rules, "
                       "Advantage, insurgencies, and the flip feed.",
    },
]


def build_page(template, page):
    html = template
    html = re.sub(r"<title>.*?</title>", f"<title>{page['title']}</title>", html, count=1)
    html = re.sub(
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{page["description"]}">',
        html, count=1,
    )
    html = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{BASE_URL}/{page["dir"]}/">',
        html, count=1,
    )
    html = html.replace('<body data-tab="warzones">', f'<body data-tab="{page["tab"]}">', 1)
    html = html.replace(
        "<!-- Source template. After editing, run: python tools/build_pages.py\n"
        "     to regenerate the subpages (/map/, /lp/, ...) and sitemap.xml. -->",
        f"<!-- Generated from index.html by tools/build_pages.py — do not edit by hand. -->",
        1,
    )
    return html


def main():
    template = TEMPLATE.read_text(encoding="utf-8")
    for marker in ('<body data-tab="warzones">', "<title>", 'rel="canonical"'):
        if marker not in template:
            sys.exit(f"template marker missing: {marker}")

    for page in PAGES:
        out_dir = ROOT / page["dir"]
        out_dir.mkdir(exist_ok=True)
        (out_dir / "index.html").write_text(build_page(template, page), encoding="utf-8", newline="\n")
        print(f"wrote {page['dir']}/index.html")

    urls = [f"{BASE_URL}/"] + [f"{BASE_URL}/{p['dir']}/" for p in PAGES]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' \
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' \
              + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) \
              + "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"wrote sitemap.xml ({len(urls)} urls)")


if __name__ == "__main__":
    main()
