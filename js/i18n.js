/* Internationalization. Depends on nothing. */
"use strict";

const I18N = {
  de: {
    subtitle: "Factional-Warfare-Begleiter für EVE Online — Live-Frontverlauf, LP-Optimierung, Freelance Jobs und Military Campaigns",
    refresh: "Aktualisieren",
    loading: "Lade Daten von ESI ...",
    err_prefix: "ESI-Abruf fehlgeschlagen: ",
    err_hint: "Prüfe die Internetverbindung oder den ESI-Status unter esi.evetech.net.",
    err_rate_limit: "ESI-Rate-Limit erreicht. Kurz warten, dann erneut versuchen.",

    tab_warzones: "Warzones",
    tab_history: "History",
    tab_lp: "LP-Store",
    tab_jobs: "Freelance Jobs",
    tab_boards: "Leaderboards",
    tab_campaigns: "Campaigns",

    sec_history: "Frontverlauf über Zeit",
    hist_systems: "Systeme",
    hist_pilots: "Piloten",
    hist_range_2: "48 h",
    hist_range_7: "7 Tage",
    hist_range_30: "30 Tage",
    hist_range_90: "90 Tage",
    hist_note: "Snapshots alle 30 Minuten via GitHub Action (öffentlich nachprüfbar im Repo). Die Historie füllt sich ab jetzt — Charts werden mit jedem Tag aussagekräftiger.",
    hist_empty: "Noch keine Daten im gewählten Zeitraum. Die Sammlung läuft — schau später wieder rein.",
    th_delta: "Δ 24h",
    delta_flip: "FLIP",
    wz_sort_delta: "Δ 24h",

    sec_warzones: "Warzones",
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
    sec_map: "Warzone-Karten",
    map_hint: "Kreis = System (Farbe: Besatzer, Ring: umkämpft, Größe: Kills der letzten Stunde). Linien = Stargates innerhalb der Warzone. Mausrad = Zoom, Ziehen = Verschieben, Doppelklick = Reset. Beim Reinzoomen erscheinen alle Systemnamen.",
    map_zoom_in: "Reinzoomen",
    map_zoom_out: "Rauszoomen",
    map_zoom_reset: "Ansicht zurücksetzen",
    advantage_note: "Frontline/Command/Rearguard wird aus Besatzung + Stargate-Nachbarschaft berechnet (Regeln aus Patch 20.10). Advantage kommt vom offiziellen War Report: lokal live via serve.py-Proxy, auf der gehosteten Seite über einen ~30-minütlich aktualisierten Spiegel.",
    auto_refresh: "Auto-Refresh",
    auto_refresh_title: "Aktiven Tab alle 5 Minuten neu laden",

    sec_lp: "LP-Store — ISK pro LP",
    lp_militia: "Militia-Corporation",
    lp_jita_btn: "Jita-Preise laden",
    lp_jita_loading: "Lade Jita-Orderbuch ...",
    lp_mode_avg: "Preisbasis: ESI-Durchschnitt",
    lp_mode_jita: "Preisbasis: Jita 4-4 (Buy für Produkt, Sell für Materialien)",
    lp_note: "Bewertung auf Basis der ESI-Durchschnittspreise (/markets/prices). Kein Jita-Orderbuch — Werte sind eine Näherung; reale Margen können abweichen.",
    th_item: "Item",
    th_qty: "Menge",
    th_lp: "LP",
    th_isk_cost: "ISK-Kosten",
    th_req: "Benötigte Items",
    th_value: "Marktwert",
    th_isk_per_lp: "ISK/LP",
    th_depth: "Buy-Tiefe",
    lp_thin: "dünner Markt",
    lp_depth_note: "Buy-Tiefe = sofort verkaufbare Stückzahl in Jita 4-4 (Buy-Orders bis 5 % unter Bestpreis). Rot = weniger als eine Kaufmenge.",
    lp_none: "Keine bewertbaren Angebote gefunden.",
    req_none: "—",

    sec_jobs: "Freelance Jobs (öffentlich)",
    jobs_filter_state: "Status",
    jobs_state_all: "Alle",
    jobs_note: "Öffentliches Jobs-Board aus /freelance-jobs. Laut Roadmap wird dieses System zu Military Contracts ausgebaut.",
    th_job: "Job",
    th_progress: "Fortschritt",
    th_reward_rem: "Reward (verbleibend)",
    th_state: "Status",
    jobs_none: "Keine Jobs gefunden.",
    jobs_more: "Weitere laden",
    job_career: "Karriere",
    job_expires: "Läuft ab",
    job_creator: "Ersteller",
    job_reward_contrib: "Reward pro Contribution",
    job_desc_missing: "Keine Beschreibung.",

    sec_boards: "FW-Leaderboards (gestern)",
    boards_kills: "Kills",
    boards_vp: "Victory Points",
    boards_chars: "Charaktere",
    boards_corps: "Corporations",
    boards_none: "Keine Leaderboard-Daten.",

    sec_campaigns: "Military Campaigns",
    cmp_target: "Kampagnenziel",
    cmp_stages: "Stufen",
    cmp_objectives: "Objectives",
    cmp_reward_each: "pro Abschluss",
    campaign_notice: "Kampagnendaten stammen aus dem offiziellen Static Data Export (SDE). ESI bietet keine Route für Live-Fortschritt; der ist nur im In-Game-Dashboard „Theaters of War“ sichtbar.",

    footer_source: "Datenquelle: EVE Swagger Interface (ESI), ausschließlich öffentliche Endpoints. Abruf erfolgt client-seitig bei Tab-Aufruf.",
    ts_label: "Stand"
  },
  en: {
    subtitle: "Factional Warfare companion for EVE Online — live front lines, LP optimization, freelance jobs, and Military Campaigns",
    refresh: "Refresh",
    loading: "Loading data from ESI ...",
    err_prefix: "ESI request failed: ",
    err_hint: "Check your internet connection or the ESI status at esi.evetech.net.",
    err_rate_limit: "ESI rate limit reached. Wait a moment, then try again.",

    tab_warzones: "Warzones",
    tab_history: "History",
    tab_lp: "LP store",
    tab_jobs: "Freelance jobs",
    tab_boards: "Leaderboards",
    tab_campaigns: "Campaigns",

    sec_history: "Front lines over time",
    hist_systems: "Systems",
    hist_pilots: "Pilots",
    hist_range_2: "48 h",
    hist_range_7: "7 days",
    hist_range_30: "30 days",
    hist_range_90: "90 days",
    hist_note: "Snapshots every 30 minutes via GitHub Action (publicly auditable in the repo). History starts filling now — charts get more meaningful every day.",
    hist_empty: "No data in the selected range yet. Collection is running — check back later.",
    th_delta: "Δ 24h",
    delta_flip: "FLIP",
    wz_sort_delta: "Δ 24h",

    sec_warzones: "Warzones",
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
    sec_map: "Warzone maps",
    map_hint: "Circle = system (color: occupier, ring: contested, size: kills last hour). Lines = stargates within the warzone. Wheel = zoom, drag = pan, double click = reset. Zooming in reveals all system names.",
    map_zoom_in: "Zoom in",
    map_zoom_out: "Zoom out",
    map_zoom_reset: "Reset view",
    advantage_note: "Frontline/Command/Rearguard is computed from occupancy + stargate adjacency (rules from patch 20.10). Advantage comes from the official war report: live via the serve.py proxy locally, via a mirror refreshed every ~30 minutes on the hosted site.",
    auto_refresh: "Auto refresh",
    auto_refresh_title: "Reload the active tab every 5 minutes",

    sec_lp: "LP store — ISK per LP",
    lp_militia: "Militia corporation",
    lp_jita_btn: "Load Jita prices",
    lp_jita_loading: "Loading Jita order book ...",
    lp_mode_avg: "Pricing: ESI average",
    lp_mode_jita: "Pricing: Jita 4-4 (buy for product, sell for materials)",
    lp_note: "Valuation based on ESI average prices (/markets/prices). No Jita order book — values are an approximation; real margins may differ.",
    th_item: "Item",
    th_qty: "Qty",
    th_lp: "LP",
    th_isk_cost: "ISK cost",
    th_req: "Required items",
    th_value: "Market value",
    th_isk_per_lp: "ISK/LP",
    th_depth: "Buy depth",
    lp_thin: "thin market",
    lp_depth_note: "Buy depth = units sellable instantly in Jita 4-4 (buy orders within 5% of best price). Red = less than one purchase quantity.",
    lp_none: "No valuable offers found.",
    req_none: "—",

    sec_jobs: "Freelance jobs (public)",
    jobs_filter_state: "State",
    jobs_state_all: "All",
    jobs_note: "Public jobs board from /freelance-jobs. Per the roadmap, this system is being extended toward Military Contracts.",
    th_job: "Job",
    th_progress: "Progress",
    th_reward_rem: "Reward (remaining)",
    th_state: "State",
    jobs_none: "No jobs found.",
    jobs_more: "Load more",
    job_career: "Career",
    job_expires: "Expires",
    job_creator: "Creator",
    job_reward_contrib: "Reward per contribution",
    job_desc_missing: "No description.",

    sec_boards: "FW leaderboards (yesterday)",
    boards_kills: "Kills",
    boards_vp: "Victory points",
    boards_chars: "Characters",
    boards_corps: "Corporations",
    boards_none: "No leaderboard data.",

    sec_campaigns: "Military Campaigns",
    cmp_target: "Campaign target",
    cmp_stages: "stages",
    cmp_objectives: "Objectives",
    cmp_reward_each: "per completion",
    campaign_notice: "Campaign data comes from the official Static Data Export (SDE). ESI exposes no route for live progress; that is only visible in the in-game \u201CTheaters of War\u201D dashboard.",

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
