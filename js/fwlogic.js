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

  /* Breadth-first search over the full k-space gate graph. */
  function jumpsFrom(originId) {
    if (!originId || !SDATA.graph[originId]) return null;
    const dist = new Map([[originId, 0]]);
    let frontier = [originId];
    while (frontier.length > 0) {
      const next = [];
      for (const cur of frontier) {
        for (const n of SDATA.graph[cur] || []) {
          if (!dist.has(n)) {
            dist.set(n, dist.get(cur) + 1);
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    return dist;
  }

  const nameIndex = Object.entries(SDATA.names)
    .map(([id, n]) => ({ id: Number(id), name: n, lower: n.toLowerCase() }));

  function searchSystems(query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const starts = [];
    const contains = [];
    for (const e of nameIndex) {
      if (e.lower.startsWith(q)) starts.push(e);
      else if (e.lower.includes(q)) contains.push(e);
      if (starts.length >= limit) break;
    }
    return starts.concat(contains).slice(0, limit);
  }

  function systemIdByName(name) {
    const q = name.trim().toLowerCase();
    const hit = nameIndex.find(e => e.lower === q);
    return hit ? hit.id : null;
  }

  return { fwIds, fwNeighbors, classify, jumpsFrom, searchSystems, systemIdByName };
})();
