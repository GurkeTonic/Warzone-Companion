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
    contested_none: "Aktuell keine umkämpften Systeme gemeldet.",
    status_contested: "umkämpft",
    status_vulnerable: "verwundbar",
    status_captured: "erobert",

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
    unknown_name: "Name unbestätigt",
    campaign_notice: "Kampagnendaten sind statisch gepflegt (Stand: Cradle of War, Juni 2026). Der ESI-Stack vom 2026-06-09 enthält keine Route für Live-Kampagnenfortschritt; der Fortschritt ist nur im In-Game-Dashboard \u201ETheaters of War\u201C sichtbar.",

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
    contested_none: "No contested systems reported right now.",
    status_contested: "contested",
    status_vulnerable: "vulnerable",
    status_captured: "captured",

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
    unknown_name: "Name unconfirmed",
    campaign_notice: "Campaign data is maintained statically (as of Cradle of War, June 2026). The 2026-06-09 ESI stack contains no route for live campaign progress; progress is only visible in the in-game \u201CTheaters of War\u201D dashboard.",

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
  document.getElementById("lang-de").classList.toggle("active", LANG === "de");
  document.getElementById("lang-en").classList.toggle("active", LANG === "en");
  document.documentElement.lang = LANG;
}
