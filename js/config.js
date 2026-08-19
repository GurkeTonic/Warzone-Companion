/* Global configuration and static data. Loaded first. */
"use strict";

const CONFIG = {
  /* ESI_BASE, COMPAT_DATE, USER_AGENT are synced from tools/esi_shared.py by
     tools/build_pages.py — edit the values there, not here, they get
     overwritten on the next build. Sent as X-User-Agent on every ESI request
     (browsers drop User-Agent on fetch) — see
     developers.eveonline.com/docs/services/esi/best-practices */
  ESI_BASE: "https://esi.evetech.net",
  COMPAT_DATE: "2026-06-09",
  USER_AGENT: "WarzoneCompanion/0.4 (webmaster@tonicbeacon.com; +https://github.com/GurkeTonic/Warzone-Companion)",
  CONTESTED_ROWS: 40,
  LP_ROWS: 50,
  LB_ROWS: 10,
  LP_JITA_ROWS: 25,
  JITA_REGION: 10000002,
  JITA_STATION: 60003760,
  MARKET_CONCURRENCY: 4,
  AUTO_REFRESH_MS: 5 * 60 * 1000
};

const FACTIONS = {
  500001: { key: "caldari",  short: "CAL", name: "Caldari State",       color: "var(--cal)", militiaCorp: 1000180, militiaName: "State Protectorate" },
  500002: { key: "minmatar", short: "MIN", name: "Minmatar Republic",   color: "var(--min)", militiaCorp: 1000182, militiaName: "Tribal Liberation Force" },
  500003: { key: "amarr",    short: "AMA", name: "Amarr Empire",        color: "var(--ama)", militiaCorp: 1000179, militiaName: "24th Imperial Crusade" },
  500004: { key: "gallente", short: "GAL", name: "Gallente Federation", color: "var(--gal)", militiaCorp: 1000181, militiaName: "Federal Defense Union" }
};

function factionOf(id) {
  return FACTIONS[id] || { key: "unknown", short: "???", name: `Faction ${id}`, color: "var(--dim)" };
}

/* The faction on the other side of id's warzone — VP bars are coloured by
   the attacker, not the occupier. */
function enemyFactionOf(id) {
  const wz = warzoneOf(id);
  return wz ? (wz.a === id ? wz.b : wz.a) : null;
}

/* Warzone definitions: fixed empire pairings. */
const WARZONES = [
  { id: "cal-gal", a: 500001, b: 500004 },
  { id: "ama-min", a: 500003, b: 500002 }
];

function warzoneOf(factionId) {
  return WARZONES.find(w => w.a === factionId || w.b === factionId);
}

/* Pirate factions running insurgencies in the warzones (Havoc). */
const PIRATES = {
  500010: { name: "Guristas Pirates", color: "var(--pir)" },
  500011: { name: "Angel Cartel", color: "var(--pir)" }
};

function pirateOf(id) {
  return PIRATES[id] || { name: `Faction ${id}`, color: "var(--pir)" };
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
