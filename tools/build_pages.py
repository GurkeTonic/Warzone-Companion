#!/usr/bin/env python3
"""Generate every page in both languages, js/routes.js and sitemap.xml.

English lives at the root (/, /warzones/, /map/, ...), German under /de/
(/de/, /de/warzones/, ...). Each page names both versions with
<link rel="alternate" hreflang>, x-default pointing to English, and carries
its language, title, description, h1 and OpenGraph tags in the HTML itself,
so a crawler without JavaScript or Accept-Language sees the right language
on every URL. Nothing redirects by browser language; the EN/DE button is a
plain link to the same page in the other language.

index.html is the source template and at the same time the English root
page: building it from itself must change nothing (tools/check_site.py
--pages checks that). Static texts marked data-i18n are filled from
js/i18n.js, so the two languages never drift apart. legal/index.html and
de/legal/index.html are written by hand; only their alternate links are
kept in step here. Run after every change to index.html:

  python tools/build_pages.py

Stdlib only, no network.
"""
import html as htmllib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "index.html"
I18N_JS = ROOT / "js" / "i18n.js"
BASE_URL = "https://warzone.tonicdock.com"
LANGS = ("en", "de")          # en first: it is the root and x-default
PREFIX = {"en": "", "de": "/de"}
OG_LOCALE = {"en": "en_US", "de": "de_DE"}

# h1 comes from the pt_<tab> keys in js/i18n.js, the same text app.js sets.
PAGES = [
    {
        "tab": "overview",
        "dir": "",
        "en": {"title": "Warzone Companion — EVE Online Factional Warfare",
               "description": "Factional Warfare companion for EVE Online: both warzones at a glance, live maps, "
                              "frontline roles, LP store optimizer, leaderboards and Military Campaigns."},
        "de": {"title": "Warzone Companion — Fraktionskrieg (Factional Warfare) in EVE Online",
               "description": "Fraktionskrieg in EVE Online: beide Warzones auf einen Blick, Live-Karten, "
                              "Frontlinien, LP-Store-Rechner, Ranglisten und Military Campaigns."},
    },
    {
        "tab": "warzones",
        "dir": "warzones",
        "en": {"title": "Warzones — Warzone Companion",
               "description": "Every contested EVE Online Factional Warfare system with its occupier, "
                              "frontline role, victory points, Advantage and kills in the last hour."},
        "de": {"title": "Warzones — Warzone Companion",
               "description": "Jedes umkämpfte System im Fraktionskrieg von EVE Online mit Besatzer, "
                              "Frontlinien-Rolle, Siegpunkten, Advantage und Kills der letzten Stunde."},
    },
    {
        "tab": "map",
        "dir": "map",
        "en": {"title": "Warzone Map — Warzone Companion",
               "description": "Interactive EVE Online Factional Warfare warzone maps: "
                              "occupancy, frontline status, Advantage, insurgencies and activity per system."},
        "de": {"title": "Karte der Warzones — Warzone Companion",
               "description": "Interaktive Karten der Warzones im Fraktionskrieg von EVE Online: "
                              "Besatzung, Frontlinie, Advantage, Insurgencies und Aktivität je System."},
    },
    {
        "tab": "history",
        "dir": "history",
        "en": {"title": "Warzone History — Warzone Companion",
               "description": "EVE Online Factional Warfare over time: systems held, pilots, "
                              "LP value per militia and a full system flip log."},
        "de": {"title": "Verlauf — Warzone Companion",
               "description": "Der Fraktionskrieg in EVE Online über die Zeit: gehaltene Systeme, Piloten, "
                              "LP-Wert je Miliz und ein vollständiges Wechsel-Protokoll."},
    },
    {
        "tab": "lp",
        "dir": "lp",
        "en": {"title": "LP Store Optimizer — Warzone Companion",
               "description": "ISK per LP for all EVE Online militia LP stores, "
                              "with live Jita order-book prices and market depth."},
        "de": {"title": "LP-Store-Rechner — Warzone Companion",
               "description": "ISK pro LP für alle Milizen-LP-Stores in EVE Online, "
                              "mit Live-Preisen aus dem Jita-Orderbuch und Markttiefe."},
    },
    {
        "tab": "boards",
        "dir": "leaderboards",
        "en": {"title": "Leaderboards — Warzone Companion",
               "description": "EVE Online Factional Warfare leaderboards: top characters and "
                              "corporations by kills and victory points."},
        "de": {"title": "Ranglisten — Warzone Companion",
               "description": "Ranglisten im Fraktionskrieg von EVE Online: die besten Charaktere und "
                              "Corporations nach Kills und Siegpunkten."},
    },
    {
        "tab": "campaigns",
        "dir": "campaigns",
        "en": {"title": "Military Campaigns — Warzone Companion",
               "description": "EVE Online Military Campaigns with live progress, participation, "
                              "official titles, objectives and rewards."},
        "de": {"title": "Kampagnen (Military Campaigns) — Warzone Companion",
               "description": "Military Campaigns in EVE Online mit Live-Fortschritt, Beteiligung, "
                              "offiziellen Titeln, Zielen und Belohnungen."},
    },
    {
        "tab": "faq",
        "dir": "faq",
        "en": {"title": "FAQ — Warzone Companion",
               "description": "How the Warzone Companion works: data sources, frontline rules, "
                              "Advantage, insurgencies and the flip feed."},
        "de": {"title": "Häufige Fragen — Warzone Companion",
               "description": "Wie der Warzone Companion arbeitet: Datenquellen, Frontlinien-Regeln, "
                              "Advantage, Insurgencies und der Wechsel-Feed."},
    },
]

# Hand-written, noindex, not in the sitemap; only their alternates are built.
LEGAL_DIR = "legal"

# Static texts in the template without a data-i18n hook, because a script
# rewrites them at runtime (theme button) or they are links (legal).
EXTRA = {
    "en": {"theme": "Light", "legal": "Privacy &amp; legal"},
    "de": {"theme": "Hell", "legal": "Datenschutz &amp; Rechtliches"},
}


def path_of(lang, d):
    return f"{PREFIX[lang]}/{d}/" if d else f"{PREFIX[lang]}/"


def url_of(lang, d):
    return BASE_URL + path_of(lang, d)


def load_i18n():
    """The two string tables from js/i18n.js. One `key: "value",` per line;
    the values are JSON-compatible string literals."""
    tables, cur = {}, None
    for line in I18N_JS.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^  (\w\w): \{$", line)
        if m:
            cur = tables.setdefault(m.group(1), {})
            continue
        if line.startswith("  }"):
            cur = None
            continue
        m = re.match(r'^\s+(\w+): ("(?:[^"\\]|\\.)*"),?$', line)
        if cur is not None and m:
            cur[m.group(1)] = json.loads(m.group(2))
    for lang in LANGS:
        if len(tables.get(lang, {})) < 100:
            sys.exit(f"js/i18n.js: could not read the {lang} table")
    return tables


def alternates(d):
    """hreflang block for one page, indented like the rest of <head>."""
    links = [f'<link rel="alternate" hreflang="{lang}" href="{url_of(lang, d)}">' for lang in LANGS]
    links.append(f'<link rel="alternate" hreflang="x-default" href="{url_of("en", d)}">')
    return "\n".join(links)


def set_alternates(html, d):
    html = re.sub(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n', "", html)
    return re.sub(r'(<link rel="canonical" href="[^"]*">\n)', lambda m: m.group(1) + alternates(d) + "\n",
                  html, count=1)


def sub1(pattern, repl, html):
    out, n = re.subn(pattern, lambda m: repl, html, count=1)
    if n != 1:
        sys.exit(f"template marker missing: {pattern}")
    return out


def build_page(template, page, lang, i18n):
    meta = page[lang]
    title = htmllib.escape(meta["title"], quote=False)
    desc = htmllib.escape(meta["description"])
    other = "de" if lang == "en" else "en"
    html = template
    if lang != "en" or page["dir"]:
        html = sub1(r"(?s)<!-- Source template.*?-->",
                    "<!-- Generated from index.html by tools/build_pages.py — do not edit by hand. -->", html)
    html = sub1(r'<html lang="[^"]*">', f'<html lang="{lang}">', html)
    html = sub1(r"<title>.*?</title>", f"<title>{title}</title>", html)
    html = sub1(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', html)
    html = sub1(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url_of(lang, page["dir"])}">', html)
    html = set_alternates(html, page["dir"])
    html = sub1(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{title}">', html)
    html = sub1(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{desc}">', html)
    html = sub1(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url_of(lang, page["dir"])}">', html)
    html = sub1(r'<meta property="og:locale" content="[^"]*">', f'<meta property="og:locale" content="{OG_LOCALE[lang]}">', html)
    html = sub1(r'<meta property="og:locale:alternate" content="[^"]*">',
                f'<meta property="og:locale:alternate" content="{OG_LOCALE[other]}">', html)
    html = sub1(r'<body data-tab="[^"]*">', f'<body data-tab="{page["tab"]}">', html)
    html = sub1(r'<h1 id="page-title">[^<]*</h1>',
                f'<h1 id="page-title">{htmllib.escape(i18n[lang]["pt_" + page["tab"]], quote=False)}</h1>', html)

    # Texts the script would otherwise only set after load.
    def fill(m):
        key = m.group(3)
        if key not in i18n[lang]:
            sys.exit(f"index.html: data-i18n=\"{key}\" not in js/i18n.js ({lang})")
        return m.group(1) + htmllib.escape(i18n[lang][key], quote=False) + m.group(4)
    html = re.sub(r'(<(\w+)\b[^>]*\sdata-i18n="(\w+)"[^>]*>)[^<]*(</\2>)', fill, html)
    html = sub1(r'<button class="btn" id="theme-toggle">[^<]*</button>',
                f'<button class="btn" id="theme-toggle">{EXTRA[lang]["theme"]}</button>', html)
    html = sub1(r'<a class="btn" id="lang-toggle"[^>]*>[^<]*</a>',
                f'<a class="btn" id="lang-toggle" href="{path_of(other, page["dir"])}" '
                f'hreflang="{other}" lang="{other}">{other.upper()}</a>', html)
    html = sub1(r'<a class="hdr-brand" href="[^"]*">', f'<a class="hdr-brand" href="{path_of(lang, "")}">', html)
    html = sub1(r'<a id="legal-link" href="[^"]*">[^<]*</a>',
                f'<a id="legal-link" href="{path_of(lang, LEGAL_DIR)}">{EXTRA[lang]["legal"]}</a>', html)
    return html


def build_routes_js(i18n):
    """Route table for js/router.js: soft (pushState) navigation needs the
    same per-tab title/description/canonical that build_page() bakes into
    each static page, so both stay driven by this one PAGES list. `alt` is
    the same page in the other language, for the EN/DE link."""
    entries = []
    for lang in LANGS:
        other = "de" if lang == "en" else "en"
        for page in PAGES:
            entries.append(
                "  %s: {lang: %s, tab: %s, title: %s, description: %s, canonical: %s, alt: %s}"
                % (
                    json.dumps(path_of(lang, page["dir"])),
                    json.dumps(lang),
                    json.dumps(page["tab"]),
                    json.dumps(page[lang]["title"]),
                    json.dumps(page[lang]["description"]),
                    json.dumps(url_of(lang, page["dir"])),
                    json.dumps(path_of(other, page["dir"])),
                )
            )
    return (
        "/* Generated from tools/build_pages.py's PAGES list — do not edit by hand.\n"
        "   Route table for js/router.js (soft navigation between tabs). */\n"
        '"use strict";\n\n'
        "const ROUTES = {\n" + ",\n".join(entries) + "\n};\n"
    )


def build_sitemap():
    """Both languages, each entry naming all versions (Google's sitemap
    variant of hreflang)."""
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
           '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for page in PAGES:
        alts = [(lang, url_of(lang, page["dir"])) for lang in LANGS] + [("x-default", url_of("en", page["dir"]))]
        for lang in LANGS:
            out.append("  <url>")
            out.append(f"    <loc>{url_of(lang, page['dir'])}</loc>")
            for hl, u in alts:
                out.append(f'    <xhtml:link rel="alternate" hreflang="{hl}" href="{u}"/>')
            out.append("  </url>")
    out.append("</urlset>")
    return "\n".join(out) + "\n"


def write(rel, text):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {rel}")


def main():
    template = TEMPLATE.read_text(encoding="utf-8")
    i18n = load_i18n()

    for lang in LANGS:
        for page in PAGES:
            rel = path_of(lang, page["dir"]).lstrip("/") + "index.html"
            write(rel, build_page(template, page, lang, i18n))

    for lang in LANGS:
        rel = path_of(lang, LEGAL_DIR).lstrip("/") + "index.html"
        p = ROOT / rel
        if not p.exists():
            sys.exit(f"{rel} missing (written by hand)")
        old = p.read_text(encoding="utf-8")
        new = set_alternates(old, LEGAL_DIR)
        if new != old:
            write(rel, new)

    write("js/routes.js", build_routes_js(i18n))
    write("sitemap.xml", build_sitemap())


if __name__ == "__main__":
    main()
