/* ESI data, read from the snapshot under /data/esi/. Depends on config.js.

   Until 5.10.2026 this module called esi.evetech.net from the visitor's
   browser. The data is the same for everybody and ESI refreshes it every
   30 minutes at best, so tools/fetch_esi.py now fetches it once per build
   (.github/workflows/deploy.yml) and this module serves the files. The
   interface stayed the same, so the views did not have to change:

     get(path)        /data/esi<path>.json, e.g. get("/fw/systems")
     post(path, ids)  only /characters/affiliation, from affiliation.json
     names(ids)       from names.json, loaded once
     name(id)
     loadJita(), jita(typeId)   Jita 4-4 {buy, sell, buyDepth} from jita.json
     fetched(group)   when tools/fetch_esi.py fetched a group (meta.json)

   The visitor's browser no longer contacts CCP. */
"use strict";

const ESI = (() => {
  const nameCache = new Map();
  const once = new Map();  // file -> Promise, for files read once per page load

  function httpError(what, status) {
    const err = new Error(`${what} -> HTTP ${status}`);
    err.status = status;
    err.rateLimited = false;
    return err;
  }

  async function file(rel) {
    const res = await fetch(`/data/esi/${rel}`, { cache: "no-cache" });
    if (!res.ok) throw httpError(`/data/esi/${rel}`, res.status);
    return res.json();
  }

  function cached(rel) {
    if (!once.has(rel)) once.set(rel, file(rel).catch(err => { once.delete(rel); throw err; }));
    return once.get(rel);
  }

  /* Corporation info comes from one file instead of one request per corp. */
  async function get(path) {
    const corp = path.match(/^\/corporations\/(\d+)$/);
    if (corp) {
      const facs = await cached("corporations.json");
      return { faction_id: facs[corp[1]] ?? null };
    }
    return file(path.replace(/^\//, "") + ".json");
  }

  async function post(path, body) {
    if (path !== "/characters/affiliation") throw httpError(`POST ${path}`, 404);
    const aff = await cached("affiliation.json");
    return body.map(id => ({ character_id: id, faction_id: aff[id] ?? null }));
  }

  async function names(ids) {
    if (nameCache.size === 0) {
      try {
        const all = await cached("names.json");
        for (const [id, n] of Object.entries(all)) nameCache.set(Number(id), n);
      } catch { /* names stay as IDs */ }
    }
    return nameCache;
  }

  function name(id) {
    return nameCache.get(id) ?? String(id);
  }

  let jitaData = null;
  async function loadJita() {
    if (!jitaData) jitaData = await cached("jita.json");
    return jitaData;
  }

  function jita(typeId) {
    const j = jitaData?.[typeId];
    return j ? { buy: j[0], sell: j[1], buyDepth: j[2] } : null;
  }

  async function fetched(group) {
    try {
      const meta = await file("meta.json");
      return meta[group] ?? null;
    } catch {
      return null;
    }
  }

  return { get, post, names, name, jita, loadJita, fetched };
})();
