/* Internationalization. Depends on nothing. */
"use strict";

const I18N = {
  de: {
    subtitle: "Factional-Warfare-Begleiter für EVE Online — Live-Frontverlauf, LP-Optimierung und Military Campaigns",
    refresh: "Aktualisieren",
    err_prefix: "ESI-Abruf fehlgeschlagen: ",
    err_hint: "Prüfe die Internetverbindung oder den ESI-Status unter esi.evetech.net.",
    err_rate_limit: "ESI-Rate-Limit erreicht. Kurz warten, dann erneut versuchen.",

    tab_warzones: "Warzones",
    tab_map: "Karte",
    tab_history: "History",
    tab_lp: "LP-Store",
    tab_boards: "Leaderboards",
    tab_campaigns: "Campaigns",
    tab_faq: "FAQ",

    faq_q_data: "Woher kommen die Daten?",
    faq_a_data: "Live-Daten kommen direkt von ESI (öffentliche Endpoints, client-seitig bei Tab-Aufruf abgerufen — kein Login, kein Tracking). Advantage stammt vom offiziellen War Report auf eveonline.com und wird alle 30 Minuten per GitHub Action gespiegelt. Statische Inhalte (Kartenpositionen, Systemnamen, Kampagnen) kommen aus CCPs offiziellem Static Data Export. Alles ist im GitHub-Repo öffentlich nachprüfbar — jeder Daten-Snapshot ist ein Commit.",
    faq_q_map: "Wie lese ich die Karte?",
    faq_a_map: "Jeder Kreis ist ein System, die Farbe zeigt den Besatzer, das Kürzel die ersten zwei Buchstaben des Namens. Weißer Ring = umkämpft, roter Ring = verwundbar (iHub angreifbar), Leuchten = Kills der letzten Stunde, Linien = Stargate-Verbindungen. Mausrad zoomt auf den Cursor, Ziehen verschiebt, Doppelklick setzt zurück — ab doppeltem Zoom erscheinen die vollen Systemnamen. Details pro System im Tooltip.",
    faq_q_roles: "Was bedeuten Frontline, Command Ops und Rearguard?",
    faq_a_roles: "Offizielle Regeln aus Patch 20.10, hier live aus Besatzung + Stargate-Nachbarschaft berechnet: Frontline grenzt an Feindgebiet, Command Ops an eigene Frontline, Rearguard ist der Rest. Praktisch wichtig: LP-Multiplikator ×1,5 / ×1,0 / ×0,01 und Plex-Respawn 20 / 40 / 60 Minuten — Plexen in Rearguard lohnt nicht. Battlefields spawnen nur in Frontline-Systemen.",
    faq_q_adv: "Was ist Advantage und was sagen die Zahlen?",
    faq_a_adv: "Jede Fraktion hat pro System einen Advantage-Wert von 0–100, angezeigt als Besatzer : Angreifer. Er setzt sich aus Terrain (+10 pro gehaltenem Nachbarsystem) und erspielten Anteilen zusammen (Battlefield-Siege, Combat-Sites, Propaganda-/Abhörstrukturen) und verfällt ohne Pflege. Mehr Advantage erhöht die Victory Points pro Plex-Capture — die exakte Formel hat CCP nie veröffentlicht. Quelle ist der War Report auf eveonline.com — ein inoffizielles, von CCP nicht supportetes API. Stellt CCP es ein, verschwindet die Spalte; alle anderen Funktionen laufen unabhängig davon über ESI weiter.",
    faq_q_delta: "Woher kommen Δ 24h, FLIP und die History?",
    faq_a_delta: "Alle 30 Minuten wird ein Snapshot des Frontverlaufs archiviert. Δ 24h vergleicht den Contested-Stand eines Systems mit dem Snapshot von vor ~24 Stunden (rot = heizt auf, grün = kühlt ab); FLIP markiert einen Besatzerwechsel in dem Zeitraum. Der History-Tab zeichnet Systeme und Piloten pro Miliz über bis zu 90 Tage und listet alle Systemwechsel. Die Sammlung läuft seit Juli 2026 — die Charts werden mit jeder Woche aussagekräftiger.",
    faq_q_lp: "Wie bewertet der LP-Store die Angebote?",
    faq_a_lp: "Standardansicht: Bewertung über ESI-Durchschnittspreise — schnelle Näherung, reale Margen können abweichen. Der Jita-Knopf bepreist die Top-Angebote mit dem echten Jita-4-4-Orderbuch: höchste Buy-Order für den Produkterlös, niedrigste Sell-Order für Materialkosten; gerankt werden dann nur neu bepreiste Angebote. Buy-Tiefe = Stückzahl, die sofort in Buy-Orders (bis 5 % unter Bestpreis) verkäuflich ist — rot heißt: weniger als eine Kaufmenge, dünner Markt. ISK/LP ist der Nettoerlös (Wert minus ISK-Kosten minus Materialien) pro Loyalty Point. Der Trend-Chart darüber nutzt den täglichen Jita-Durchschnittskurs (The-Forge-Markthistorie) — er zeigt die Richtung, die Tabelle den ausführbaren Ist-Erlös.",
    faq_q_home: "Was macht das Heimatsystem-Feld?",
    faq_a_home: "Trage ein System ein (z. B. dein Staging), und die Tabelle zeigt die Entfernung in Gate-Jumps zu jedem Warzone-System — kürzeste Route, Security wird ignoriert. Die Angabe wird nur lokal im Browser gespeichert und nie übertragen.",
    faq_q_campaigns: "Warum zeigen die Campaigns keinen Fortschritt?",
    faq_a_campaigns: "Titel, Beschreibungen und Objectives stammen aus dem offiziellen Static Data Export. Für den Live-Fortschritt bietet ESI schlicht keine Route — der ist nur im In-Game-Dashboard „Theaters of War“ sichtbar. Sobald CCP eine Route liefert, wird sie eingebaut.",
    faq_q_insurgency: "Was bedeuten die lila Ringe (Insurgency)?",
    faq_a_insurgency: "Piraten-Insurgencies (Havoc): Guristas oder Angel Cartel eröffnen eine FOB in einem Warzone-System und breiten Corruption aus; Milizen kontern mit Suppression. Beides läuft pro System in Stufen 0–5 — Corruption 5 ändert die Systemregeln spürbar (z. B. keine Gate-Gun-Unterstützung). Lila Ring auf der Karte = System mit aktiver Insurgency, Details im Tooltip und im System-Detailpanel. Quelle ist der War Report auf eveonline.com (inoffiziell, nicht von CCP supportet — kann wegfallen); ESI bietet diese Daten nicht.",
    faq_q_feed: "Gibt es einen Feed für Bots und andere Tools?",
    faq_a_feed: "Ja: Systemwechsel stehen als stabiles JSON unter data/feed-flips.json bereit (Zeitpunkt, System, verlierende und erobernde Fraktion, IDs und Namen), aktualisiert alle 30 Minuten, 90 Tage Tiefe. Discord-Bots und andere Tools dürfen den Feed direkt abfragen — Quellenangabe genügt.",

    hist_systems: "Systeme",
    hist_pilots: "Piloten",
    hist_range_2: "48 h",
    hist_range_7: "7 Tage",
    hist_range_30: "30 Tage",
    hist_range_90: "90 Tage",
    hist_empty: "Noch keine Daten im gewählten Zeitraum. Die Sammlung läuft — schau später wieder rein.",
    th_delta: "Δ 24h",
    delta_flip: "FLIP",
    wz_sort_delta: "Δ 24h",
    sec_flips: "Systemwechsel",
    th_time: "Zeit",
    th_from: "Verloren von",
    th_to: "Erobert von",
    flips_none: "Keine Systemwechsel im gewählten Zeitraum.",
    hist_lp: "LP-Kurs je Miliz — Median der Top-20-Angebote, Jita-Tageskurs (1× täglich)",

    ins_origin: "FOB",
    ins_affected: "Systeme betroffen",
    ins_corruption: "Corruption",
    ins_suppression: "Suppression",

    det_trend: "Contested-Verlauf (48 h)",
    det_no_trend: "Noch keine Verlaufsdaten.",
    det_traffic: "Traffic (1h)",
    det_flips: "Letzte Flips",
    det_neighbors: "Nachbarsysteme:",
    det_close: "Schließen",
    det_hint: "System in Karte oder Tabelle anklicken für Details.",
    det_more: "Mehr Details",

    sec_contested: "Umkämpfte Systeme",
    systems_held: "Systeme",
    pilots: "Piloten",
    kills_yd: "Kills (gestern)",
    vp_yd: "VP (gestern)",
    th_system: "System",
    th_warzone: "Warzone",
    th_occupier: "Besatzer",
    th_status: "Status",
    th_vp: "Victory Points",
    contested_none: "Keine Systeme für diesen Filter.",
    status_contested: "umkämpft",
    status_vulnerable: "verwundbar",
    status_captured: "erobert",
    status_uncontested: "ruhig",

    th_region: "Region",
    th_class: "Rolle",
    th_kills1h: "Kills (1h)",
    th_jumps: "Jumps",
    class_frontline: "Frontline",
    class_command: "Command Ops",
    class_rearguard: "Rearguard",
    class_frontline_tip: "LP ×1,5 · Plex-Respawn 20 min · Battlefields nur hier",
    class_command_tip: "LP ×1,0 · Plex-Respawn 40 min",
    class_rearguard_tip: "LP ×0,01 · Plex-Respawn 60 min — Plexen lohnt hier nicht",
    th_adv: "Advantage",
    adv_tip: "Advantage Besatzer : Angreifer (0–100, aus dem offiziellen War Report)",
    wz_filter_label: "Anzeige",
    wz_filter_contested: "Umkämpfte Systeme",
    wz_filter_frontline: "Frontline-Systeme",
    wz_filter_all: "Alle Systeme",
    wz_sort_label: "Sortierung",
    wz_sort_vp: "VP %",
    wz_sort_kills: "Kills (letzte Stunde)",
    wz_sort_jumps: "Entfernung",
    home_label: "Heimatsystem",
    home_placeholder: "z. B. Jita",
    map_zoom_in: "Reinzoomen",
    map_zoom_out: "Rauszoomen",
    map_zoom_reset: "Ansicht zurücksetzen",
    auto_refresh: "Auto-Refresh",
    auto_refresh_title: "Aktiven Tab alle 5 Minuten neu laden",

    lp_militia: "Militia-Corporation",
    lp_jita_btn: "Jita-Preise laden",
    lp_jita_loading: "Lade Jita-Orderbuch ...",
    lp_mode_avg: "Preisbasis: ESI-Durchschnitt",
    lp_mode_jita: "Preisbasis: Jita 4-4 (Buy für Produkt, Sell für Materialien)",
    th_item: "Item",
    th_qty: "Menge",
    th_lp: "LP",
    th_isk_cost: "ISK-Kosten",
    th_req: "Benötigte Items",
    th_value: "Marktwert",
    th_isk_per_lp: "ISK/LP",
    th_depth: "Buy-Tiefe",
    lp_thin: "dünner Markt",
    lp_none: "Keine bewertbaren Angebote gefunden.",
    req_none: "—",

    boards_kills: "Kills",
    boards_vp: "Victory Points",
    boards_chars: "Charaktere",
    boards_corps: "Corporations",
    boards_none: "Keine Leaderboard-Daten.",

    cmp_target: "Kampagnenziel",
    cmp_stages: "Stufen",
    cmp_objectives: "Objectives",
    cmp_reward_each: "pro Abschluss",

    footer_source: "Datenquelle: EVE Swagger Interface (ESI), ausschließlich öffentliche Endpoints. Abruf erfolgt client-seitig bei Tab-Aufruf.",
    ts_label: "Stand"
  },
  en: {
    subtitle: "Factional Warfare companion for EVE Online — live front lines, LP optimization, and Military Campaigns",
    refresh: "Refresh",
    err_prefix: "ESI request failed: ",
    err_hint: "Check your internet connection or the ESI status at esi.evetech.net.",
    err_rate_limit: "ESI rate limit reached. Wait a moment, then try again.",

    tab_warzones: "Warzones",
    tab_map: "Map",
    tab_history: "History",
    tab_lp: "LP store",
    tab_boards: "Leaderboards",
    tab_campaigns: "Campaigns",
    tab_faq: "FAQ",

    faq_q_data: "Where does the data come from?",
    faq_a_data: "Live data comes straight from ESI (public endpoints, fetched client-side when a tab is opened — no login, no tracking). Advantage comes from the official war report on eveonline.com, mirrored every 30 minutes by a GitHub Action. Static content (map positions, system names, campaigns) comes from CCP's official Static Data Export. Everything is publicly auditable in the GitHub repo — every data snapshot is a commit.",
    faq_q_map: "How do I read the map?",
    faq_a_map: "Each circle is a system, the color shows the occupier, the code shows the first two letters of the name. White ring = contested, red ring = vulnerable (iHub attackable), glow = kills in the last hour, lines = stargate connections. The wheel zooms toward the cursor, dragging pans, double click resets — full system names appear from 2× zoom. Per-system details are in the tooltip.",
    faq_q_roles: "What do Frontline, Command Ops, and Rearguard mean?",
    faq_a_roles: "Official rules from patch 20.10, computed live here from occupancy + stargate adjacency: frontline borders enemy territory, command ops border your own frontline, rearguard is the rest. What matters in practice: LP multiplier ×1.5 / ×1.0 / ×0.01 and plex respawn 20 / 40 / 60 minutes — plexing in rearguard is pointless. Battlefields only spawn in frontline systems.",
    faq_q_adv: "What is Advantage and what do the numbers mean?",
    faq_a_adv: "Each faction has a per-system Advantage value from 0–100, shown as occupier : attacker. It combines terrain (+10 per adjacent held system) and earned components (battlefield wins, combat sites, propaganda/listening structures) and decays without upkeep. More Advantage increases victory points per plex capture — CCP never published the exact formula. Source is the war report on eveonline.com — an unofficial API not supported by CCP. If CCP retires it, the column disappears; everything else runs on ESI independently.",
    faq_q_delta: "Where do Δ 24h, FLIP, and the history come from?",
    faq_a_delta: "A snapshot of the front lines is archived every 30 minutes. Δ 24h compares a system's contested level with the snapshot from ~24 hours ago (red = heating up, green = cooling down); FLIP marks an occupier change in between. The History tab charts systems and pilots per militia over up to 90 days and lists all system flips. Collection has been running since July 2026 — the charts get more meaningful every week.",
    faq_q_lp: "How does the LP store rank offers?",
    faq_a_lp: "Default view: valuation via ESI average prices — a quick approximation; real margins may differ. The Jita button reprices the top offers with the live Jita 4-4 order book: highest buy order for product revenue, lowest sell order for material cost; only repriced offers are then ranked. Buy depth = units sellable instantly into buy orders (within 5% of best price) — red means less than one purchase quantity, thin market. ISK/LP is the net return (value minus ISK cost minus materials) per loyalty point. The trend chart above it uses the daily Jita average (The Forge market history) — it shows direction, the table shows the executable payout.",
    faq_q_home: "What does the home system field do?",
    faq_a_home: "Enter a system (e.g. your staging) and the table shows the distance in gate jumps to every warzone system — shortest route, security ignored. The value is stored locally in your browser only and never transmitted.",
    faq_q_campaigns: "Why don't the campaigns show progress?",
    faq_a_campaigns: "Titles, descriptions, and objectives come from the official Static Data Export. ESI simply exposes no route for live progress — that is only visible in the in-game “Theaters of War” dashboard. As soon as CCP ships a route, it will be added.",
    faq_q_insurgency: "What do the purple rings (insurgency) mean?",
    faq_a_insurgency: "Pirate insurgencies (Havoc): Guristas or Angel Cartel open a FOB in a warzone system and spread corruption; militias counter with suppression. Both run per system in stages 0–5 — corruption 5 noticeably changes system rules (e.g. no gate gun support). Purple ring on the map = system with an active insurgency; details in the tooltip and the system detail panel. Source is the war report on eveonline.com (unofficial, not supported by CCP — may go away); ESI does not expose this data.",
    faq_q_feed: "Is there a feed for bots and other tools?",
    faq_a_feed: "Yes: system flips are published as stable JSON at data/feed-flips.json (time, system, losing and capturing faction, IDs and names), refreshed every 30 minutes with 90 days of depth. Discord bots and other tools are welcome to poll the feed directly — attribution is appreciated.",

    hist_systems: "Systems",
    hist_pilots: "Pilots",
    hist_range_2: "48 h",
    hist_range_7: "7 days",
    hist_range_30: "30 days",
    hist_range_90: "90 days",
    hist_empty: "No data in the selected range yet. Collection is running — check back later.",
    th_delta: "Δ 24h",
    delta_flip: "FLIP",
    wz_sort_delta: "Δ 24h",
    sec_flips: "System flips",
    th_time: "Time",
    th_from: "Lost by",
    th_to: "Captured by",
    flips_none: "No system flips in the selected range.",
    hist_lp: "LP value per militia — median of top 20 offers, Jita daily price (1× per day)",

    ins_origin: "FOB",
    ins_affected: "systems affected",
    ins_corruption: "Corruption",
    ins_suppression: "Suppression",

    det_trend: "Contested trend (48 h)",
    det_no_trend: "No trend data yet.",
    det_traffic: "Traffic (1h)",
    det_flips: "Recent flips",
    det_neighbors: "Neighboring systems:",
    det_close: "Close",
    det_hint: "Click a system on the map or in the table for details.",
    det_more: "More details",

    sec_contested: "Contested systems",
    systems_held: "systems",
    pilots: "Pilots",
    kills_yd: "Kills (yesterday)",
    vp_yd: "VP (yesterday)",
    th_system: "System",
    th_warzone: "Warzone",
    th_occupier: "Occupier",
    th_status: "Status",
    th_vp: "Victory points",
    contested_none: "No systems match this filter.",
    status_contested: "contested",
    status_vulnerable: "vulnerable",
    status_captured: "captured",
    status_uncontested: "quiet",

    th_region: "Region",
    th_class: "Role",
    th_kills1h: "Kills (1h)",
    th_jumps: "Jumps",
    class_frontline: "Frontline",
    class_command: "Command Ops",
    class_rearguard: "Rearguard",
    class_frontline_tip: "LP ×1.5 · plex respawn 20 min · battlefields only here",
    class_command_tip: "LP ×1.0 · plex respawn 40 min",
    class_rearguard_tip: "LP ×0.01 · plex respawn 60 min — plexing is pointless here",
    th_adv: "Advantage",
    adv_tip: "Advantage occupier : attacker (0–100, from the official war report)",
    wz_filter_label: "Show",
    wz_filter_contested: "Contested systems",
    wz_filter_frontline: "Frontline systems",
    wz_filter_all: "All systems",
    wz_sort_label: "Sort by",
    wz_sort_vp: "VP %",
    wz_sort_kills: "Kills (last hour)",
    wz_sort_jumps: "Distance",
    home_label: "Home system",
    home_placeholder: "e.g. Jita",
    map_zoom_in: "Zoom in",
    map_zoom_out: "Zoom out",
    map_zoom_reset: "Reset view",
    auto_refresh: "Auto refresh",
    auto_refresh_title: "Reload the active tab every 5 minutes",

    lp_militia: "Militia corporation",
    lp_jita_btn: "Load Jita prices",
    lp_jita_loading: "Loading Jita order book ...",
    lp_mode_avg: "Pricing: ESI average",
    lp_mode_jita: "Pricing: Jita 4-4 (buy for product, sell for materials)",
    th_item: "Item",
    th_qty: "Qty",
    th_lp: "LP",
    th_isk_cost: "ISK cost",
    th_req: "Required items",
    th_value: "Market value",
    th_isk_per_lp: "ISK/LP",
    th_depth: "Buy depth",
    lp_thin: "thin market",
    lp_none: "No valuable offers found.",
    req_none: "—",

    boards_kills: "Kills",
    boards_vp: "Victory points",
    boards_chars: "Characters",
    boards_corps: "Corporations",
    boards_none: "No leaderboard data.",

    cmp_target: "Campaign target",
    cmp_stages: "stages",
    cmp_objectives: "Objectives",
    cmp_reward_each: "per completion",

    footer_source: "Data source: EVE Swagger Interface (ESI), public endpoints only. Fetched client-side when a tab is opened.",
    ts_label: "As of"
  }
};

let LANG = "de";

function t(key) {
  return (I18N[LANG] && I18N[LANG][key]) || key;
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString(LANG === "de" ? "de-DE" : "en-US");
}

function fmtIsk(n) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const loc = LANG === "de" ? "de-DE" : "en-US";
  if (abs >= 1e9) return (v / 1e9).toLocaleString(loc, { maximumFractionDigits: 2 }) + " B";
  if (abs >= 1e6) return (v / 1e6).toLocaleString(loc, { maximumFractionDigits: 2 }) + " M";
  if (abs >= 1e3) return (v / 1e3).toLocaleString(loc, { maximumFractionDigits: 1 }) + " k";
  return v.toLocaleString(loc, { maximumFractionDigits: 0 });
}

/* EN always shows EVE time (UTC) — avoids ambiguity for an international
   audience in different real-world timezones; DE shows the visitor's local
   clock. suffix=true appends "UTC" (skipped for compact chart ticks etc.). */
function fmtTime(date, opts = {}, suffix = false) {
  const loc = LANG === "de" ? "de-DE" : "en-US";
  const o = LANG === "en" ? { ...opts, timeZone: "UTC" } : opts;
  const s = date.toLocaleTimeString(loc, o);
  return suffix && LANG === "en" ? s + " UTC" : s;
}

function fmtDate(date, opts = {}) {
  const loc = LANG === "de" ? "de-DE" : "en-US";
  const o = LANG === "en" ? { ...opts, timeZone: "UTC" } : opts;
  return date.toLocaleDateString(loc, o);
}

function fmtDateTime(date, opts = {}, suffix = false) {
  const loc = LANG === "de" ? "de-DE" : "en-US";
  const o = LANG === "en" ? { ...opts, timeZone: "UTC" } : opts;
  const s = date.toLocaleString(loc, o);
  return suffix && LANG === "en" ? s + " UTC" : s;
}

/* Escape untrusted strings (player-authored names, descriptions) for innerHTML. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.getElementById("lang-de").classList.toggle("active", LANG === "de");
  document.getElementById("lang-en").classList.toggle("active", LANG === "en");
  document.documentElement.lang = LANG;
}
