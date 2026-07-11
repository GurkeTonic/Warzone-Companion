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
  JOBS_PAGE_LIMIT: 50
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

/*
 * Static campaign data (Cradle of War, June 2026).
 * The 2026-06-09 ESI spec exposes no route for Military Campaign progress;
 * this block is maintained manually until such a route exists.
 */
const CAMPAIGNS = [
  {
    faction: 500001,
    name: "The State Corridor Initiative",
    nameConfirmed: true,
    desc: {
      de: "Die Caldari wollen ihre direkten Stargate-Routen stärken: Bau eines Stargates von Black Rise nach Syndicate.",
      en: "The Caldari aim to strengthen their direct stargate routes: construction of a stargate from Black Rise to Syndicate."
    },
    goal: {
      de: "Ziel: Neue Stargate-Verbindung Black Rise → Syndicate.",
      en: "Goal: New stargate connection Black Rise → Syndicate."
    }
  },
  {
    faction: 500002,
    name: "The Starkmanir Restoration",
    nameConfirmed: true,
    desc: {
      de: "Aufruf an die Minmatar-Stämme, die Souveränität über Arzad und Ezzara zurückzuerobern.",
      en: "A rallying cry for the Minmatar tribes to reclaim sovereignty of Arzad and Ezzara."
    },
    goal: {
      de: "Ziel: Rückeroberung von Arzad & Ezzara, Phased Fields im Minmatar-Highsec.",
      en: "Goal: Reclaim Arzad & Ezzara, reveal Phased Fields in Minmatar highsec."
    }
  },
  {
    faction: 500003,
    name: null,
    nameConfirmed: false,
    desc: {
      de: "Amarr-Kampagne rund um eine Station: Bei Erfolg werden Steuern und Brokergebühren an dieser Station deutlich gesenkt.",
      en: "Amarr campaign centered on a station: on success, taxes and brokerage fees at that station will be significantly reduced."
    },
    goal: {
      de: "Ziel: Reduzierte Steuern und Brokergebühren.",
      en: "Goal: Reduced taxes and brokerage fees."
    }
  },
  {
    faction: 500004,
    name: "Operation Rogue Edge",
    nameConfirmed: true,
    desc: {
      de: "Die Gallente wollen Rogue-Drone-Technologie für ihre Militärlogistik nutzbar machen.",
      en: "The Gallente aim to master Rogue Drone technologies to strengthen their military logistics."
    },
    goal: {
      de: "Ziel: Route Dodixie–Intaki auf 6 Jumps verkürzen, Low-Waste-Variante der Excavator-Drohne.",
      en: "Goal: Shorten the Dodixie–Intaki route to 6 jumps, develop a low-waste Excavator drone variant."
    }
  }
];
