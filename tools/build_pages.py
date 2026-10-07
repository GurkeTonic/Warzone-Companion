#!/usr/bin/env python3
"""Generate the tab subpages and sitemap.xml from index.html.

index.html is the source template (the Overview page). Every other tab gets
a real subpage directory (/warzones/index.html, /map/index.html, ...) so each tab
has its own URL, survives reloads, and is indexable with its own title and
description. Run after every change to index.html:

  python tools/build_pages.py

Stdlib only, no network.
"""
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "index.html"
BASE_URL = "https://warzone.tonicdock.com"

ROOT_PAGE = {
    "tab": "overview",
    "dir": "",
    "h1": "Lage",
    "title": "Warzone Companion — Fraktionskrieg (Factional Warfare) in EVE Online",
    "description": "Fraktionskrieg in EVE Online: beide Warzones auf einen Blick, Live-Karten, "
                   "Frontlinien, LP-Store-Rechner, Ranglisten und Military Campaigns.",
}

PAGES = [
    {
        "tab": "warzones",
        "dir": "warzones",
        "h1": "Warzones",
        "title": "Warzones — Warzone Companion",
        "description": "Jedes umkämpfte System im Fraktionskrieg von EVE Online mit Besatzer, "
                       "Frontlinien-Rolle, Siegpunkten, Advantage und Kills der letzten Stunde.",
    },
    {
        "tab": "map",
        "dir": "map",
        "h1": "Karte",
        "title": "Karte der Warzones — Warzone Companion",
        "description": "Interaktive Karten der Warzones im Fraktionskrieg von EVE Online: "
                       "Besatzung, Frontlinie, Advantage, Insurgencies und Aktivität je System.",
    },
    {
        "tab": "history",
        "dir": "history",
        "h1": "Verlauf",
        "title": "Verlauf — Warzone Companion",
        "description": "Der Fraktionskrieg in EVE Online über die Zeit: gehaltene Systeme, Piloten, "
                       "LP-Wert je Miliz und ein vollständiges Wechsel-Protokoll.",
    },
    {
        "tab": "lp",
        "dir": "lp",
        "h1": "LP-Store",
        "title": "LP-Store-Rechner — Warzone Companion",
        "description": "ISK pro LP für alle Milizen-LP-Stores in EVE Online, "
                       "mit Live-Preisen aus dem Jita-Orderbuch und Markttiefe.",
    },
    {
        "tab": "boards",
        "dir": "leaderboards",
        "h1": "Ranglisten",
        "title": "Ranglisten — Warzone Companion",
        "description": "Ranglisten im Fraktionskrieg von EVE Online: die besten Charaktere und "
                       "Corporations nach Kills und Siegpunkten.",
    },
    {
        "tab": "campaigns",
        "dir": "campaigns",
        "h1": "Kampagnen",
        "title": "Kampagnen (Military Campaigns) — Warzone Companion",
        "description": "Military Campaigns in EVE Online mit Live-Fortschritt, Beteiligung, "
                       "offiziellen Titeln, Zielen und Belohnungen.",
    },
    {
        "tab": "faq",
        "dir": "faq",
        "h1": "Häufige Fragen",
        "title": "Häufige Fragen — Warzone Companion",
        "description": "Wie der Warzone Companion arbeitet: Datenquellen, Frontlinien-Regeln, "
                       "Advantage, Insurgencies und der Wechsel-Feed.",
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
        r'<meta property="og:title" content="[^"]*">',
        f'<meta property="og:title" content="{page["title"]}">',
        html, count=1,
    )
    html = re.sub(
        r'<meta property="og:description" content="[^"]*">',
        f'<meta property="og:description" content="{page["description"]}">',
        html, count=1,
    )
    html = re.sub(
        r'<meta property="og:url" content="[^"]*">',
        f'<meta property="og:url" content="{BASE_URL}/{page["dir"]}/">',
        html, count=1,
    )
    html = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{BASE_URL}/{page["dir"]}/">',
        html, count=1,
    )
    html = re.sub(
        r'<h1 id="page-title">[^<]*</h1>',
        f'<h1 id="page-title">{page["h1"]}</h1>',
        html, count=1,
    )
    html = html.replace('<body data-tab="overview">', f'<body data-tab="{page["tab"]}">', 1)
    html = html.replace(
        "<!-- Source template. After editing, run: python tools/build_pages.py\n"
        "     to regenerate the subpages (/warzones/, /map/, ...) and sitemap.xml. -->",
        f"<!-- Generated from index.html by tools/build_pages.py — do not edit by hand. -->",
        1,
    )
    return html


def build_routes_js():
    """Route table for js/router.js: soft (pushState) navigation needs the
    same per-tab title/description/canonical that build_page() bakes into
    each static subpage, so both stay driven by this one PAGES list."""
    entries = []
    for page in [ROOT_PAGE] + PAGES:
        path = f"/{page['dir']}/" if page["dir"] else "/"
        entries.append(
            "  %s: {tab: %s, title: %s, description: %s, canonical: %s}"
            % (
                json.dumps(path),
                json.dumps(page["tab"]),
                json.dumps(page["title"]),
                json.dumps(page["description"]),
                json.dumps(f"{BASE_URL}{path}"),
            )
        )
    return (
        "/* Generated from tools/build_pages.py's PAGES list — do not edit by hand.\n"
        "   Route table for js/router.js (soft navigation between tabs). */\n"
        '"use strict";\n\n'
        "const ROUTES = {\n" + ",\n".join(entries) + "\n};\n"
    )


def main():

    template = TEMPLATE.read_text(encoding="utf-8")
    for marker in ('<body data-tab="overview">', "<title>", 'rel="canonical"', '<h1 id="page-title">'):
        if marker not in template:
            sys.exit(f"template marker missing: {marker}")

    for page in PAGES:
        out_dir = ROOT / page["dir"]
        out_dir.mkdir(exist_ok=True)
        (out_dir / "index.html").write_text(build_page(template, page), encoding="utf-8", newline="\n")
        print(f"wrote {page['dir']}/index.html")

    (ROOT / "js" / "routes.js").write_text(build_routes_js(), encoding="utf-8", newline="\n")
    print("wrote js/routes.js")

    urls = [f"{BASE_URL}/"] + [f"{BASE_URL}/{p['dir']}/" for p in PAGES]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' \
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' \
              + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) \
              + "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"wrote sitemap.xml ({len(urls)} urls)")


if __name__ == "__main__":
    main()
