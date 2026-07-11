/* Internationalization. Depends on nothing. */
"use strict";

const I18N = {
  de: {
    subtitle: "Live-Frontverlauf, LP-Optimierung, Freelance Jobs und Military Campaigns",
    refresh: "Aktualisieren",
    loading: "Lade Daten von ESI ...",
    err_prefix: "ESI-Abruf fehlgeschlagen: ",
    err_hint: "Prüfe die Internetverbindung oder den ESI-Status unter esi.evetech.net.",
    err_rate_limit: "ESI-Rate-Limit erreicht. Kurz warten, dann erneut versuchen.",

    tab_warzones: "Warzones",
    tab_lp: "LP-Store",
    tab_jobs: "Freelance Jobs",
    tab_boards: "Leaderboards",
    tab_campaigns: "Campaigns",

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
    map_hint: "Kreis = System (Farbe: Besatzer, Ring: umkämpft, Größe: Kills der letzten Stunde). Linien = Stargates innerhalb der Warzone.",
    advantage_note: "Frontline/Command/Rearguard wird aus Besatzung + Stargate-Nachbarschaft berechnet. Advantage ist nicht über ESI verfügbar und fehlt hier bewusst.",
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
    subtitle: "Live front lines, LP optimization, freelance jobs, and Military Campaigns",
    refresh: "Refresh",
    loading: "Loading data from ESI ...",
    err_prefix: "ESI request failed: ",
    err_hint: "Check your internet connection or the ESI status at esi.evetech.net.",
    err_rate_limit: "ESI rate limit reached. Wait a moment, then try again.",

    tab_warzones: "Warzones",
    tab_lp: "LP store",
    tab_jobs: "Freelance jobs",
    tab_boards: "Leaderboards",
    tab_campaigns: "Campaigns",

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
    map_hint: "Circle = system (color: occupier, ring: contested, size: kills last hour). Lines = stargates within the warzone.",
    advantage_note: "Frontline/Command/Rearguard is computed from occupancy + stargate adjacency. Advantage is not exposed by ESI and is deliberately absent here.",
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
