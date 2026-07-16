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
  500001: { key: "caldari",  name: "Caldari State",       color: "var(--caldari)",  militiaCorp: 1000180, militiaName: "State Protectorate" },
  500002: { key: "minmatar", name: "Minmatar Republic",   color: "var(--minmatar)", militiaCorp: 1000182, militiaName: "Tribal Liberation Force" },
  500003: { key: "amarr",    name: "Amarr Empire",        color: "var(--amarr)",    militiaCorp: 1000179, militiaName: "24th Imperial Crusade" },
  500004: { key: "gallente", name: "Gallente Federation", color: "var(--gallente)", militiaCorp: 1000181, militiaName: "Federal Defense Union" }
};

function factionOf(id) {
  return FACTIONS[id] || { key: "unknown", name: `Faction ${id}`, color: "var(--muted)" };
}

/* Same faction lookup, colored with the Ops Room --ops-* tokens instead of
   the old --caldari/--gallente/... tokens — used by tabs migrated to the new
   design (see design_handoff_warzone_ops_room/README.md). Old, not-yet
   migrated tabs keep using factionOf() so their colors don't change. */
const OPS_FACTION_COLOR = {
  500001: { color: "var(--ops-cal)", bar: "var(--ops-cal-bar)" },
  500002: { color: "var(--ops-min)", bar: "var(--ops-min-bar)" },
  500003: { color: "var(--ops-ama)", bar: "var(--ops-ama-bar)" },
  500004: { color: "var(--ops-gal)", bar: "var(--ops-gal-bar)" }
};

function opsFactionOf(id) {
  return { ...factionOf(id), ...(OPS_FACTION_COLOR[id] || { color: "var(--ops-dim)", bar: "var(--ops-dim)" }) };
}

/* The faction on the other side of id's warzone — used to color VP bars by
   attacker (per the Ops Room spec), not occupier. */
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
  500010: { name: "Guristas Pirates", color: "var(--pirate)" },
  500011: { name: "Angel Cartel", color: "var(--pirate)" }
};

function pirateOf(id) {
  return PIRATES[id] || { name: `Faction ${id}`, color: "var(--pirate)" };
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
