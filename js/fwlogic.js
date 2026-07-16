/* Factional warfare logic: adjacency, frontline classification, jump counts,
   system search. Depends on js/data/staticdata.js (SDATA). */
"use strict";

const FwLogic = (() => {
  const fwIds = new Set(Object.keys(SDATA.fw).map(Number));

  /* Direct stargate neighbors within the warzone system set. */
  const fwNeighbors = new Map();
  for (const id of fwIds) {
    fwNeighbors.set(id, (SDATA.graph[id] || []).filter(n => fwIds.has(n)));
  }

  /*
   * Classify each FW system given the current occupier map
   * (solar_system_id -> occupier_faction_id):
   *   frontline  — direct gate to a system occupied by the enemy militia
   *   command    — adjacent to a friendly frontline system
   *   rearguard  — everything else
   */
  function classify(occupier) {
    const status = new Map();
    for (const id of fwIds) {
      const own = occupier.get(id);
      if (!own) continue;
      const hostileBorder = fwNeighbors.get(id).some(n => {
        const o = occupier.get(n);
        return o && o !== own;
      });
      if (hostileBorder) status.set(id, "frontline");
    }
    for (const id of fwIds) {
      if (status.has(id) || !occupier.has(id)) continue;
      const own = occupier.get(id);
      const nearFront = fwNeighbors.get(id).some(
        n => status.get(n) === "frontline" && occupier.get(n) === own
      );
      status.set(id, nearFront ? "command" : "rearguard");
    }
    return status;
  }

  return { fwIds, fwNeighbors, classify };
})();
