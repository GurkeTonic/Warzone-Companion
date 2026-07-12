/* Global configuration and static data. Loaded first. */
"use strict";

const CONFIG = {
  ESI_BASE: "https://esi.evetech.net",
  COMPAT_DATE: "2026-06-09",
  CONTESTED_ROWS: 40,
  LP_ROWS: 50,
  LP_JITA_ROWS: 25,
  JITA_REGION: 10000002,
  JITA_STATION: 60003760,
  MARKET_CONCURRENCY: 4,
  JOBS_PAGE_LIMIT: 50,
  AUTO_REFRESH_MS: 5 * 60 * 1000
};

const FACTIONS = {
  500001: { key: "caldari",  name: "Caldari State",       color: "var(--caldari)",  militiaCorp: 1000180, militiaName: "State Protectorate" },
  500002: { key: "minmatar", name: "Minmatar Republic",   color: "var(--minmatar)", militiaCorp: 1000182, militiaName: "Tribal Liberation Force" },
  500003: { key: "amarr",    name: "Amarr Empire",        color: "var(--amarr)",    militiaCorp: 1000179, militiaName: "24th Imperial Crusade" },
  500004: { key: "gallente", name: "Gallente Federation", color: "var(--gallente)", militiaCorp: 1000181, militiaName: "Federal Defense Union" }
};

function factionOf(id) {
  return FACTIONS[id] || { key: "unknown", name: `Faction ${id}`, color: "var(--muted)" };
}

/* Warzone definitions: fixed empire pairings. */
const WARZONES = [
  { id: "cal-gal", a: 500001, b: 500004 },
  { id: "ama-min", a: 500003, b: 500002 }
];

function warzoneOf(factionId) {
  return WARZONES.find(w => w.a === factionId || w.b === factionId);
}

/* External references for a solar system. */
function zkillUrl(systemId) {
  return `https://zkillboard.com/system/${systemId}/`;
}

function dotlanUrl(systemName) {
  return `https://evemaps.dotlan.net/system/${encodeURIComponent(systemName.replace(/ /g, "_"))}`;
}

/*
 * Campaign content comes from the SDE via js/data/staticdata.js
 * (see tools/build_static_data.py). ESI exposes no route for live
 * campaign progress.
 */
