/* ESI client. Depends on config.js. */
"use strict";

const ESI = (() => {
  const nameCache = new Map();

  /* Error with HTTP status attached, so views can special-case rate limits. */
  function httpError(what, status) {
    const err = new Error(`${what} -> HTTP ${status}`);
    err.status = status;
    err.rateLimited = status === 420 || status === 429;
    return err;
  }

  function url(path, params = {}) {
    const u = new URL(CONFIG.ESI_BASE + path);
    u.searchParams.set("compatibility_date", CONFIG.COMPAT_DATE);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
    }
    return u.toString();
  }

  async function get(path, params) {
    const res = await fetch(url(path, params), {
      headers: { "Accept": "application/json", "X-User-Agent": CONFIG.USER_AGENT }
    });
    if (!res.ok) throw httpError(`GET ${path}`, res.status);
    return res.json();
  }

  /* Resolve IDs (systems, types, characters, corporations, ...) to names. */
  async function names(ids) {
    const wanted = [...new Set(ids)].filter(id => Number.isFinite(id) && !nameCache.has(id));
    for (let i = 0; i < wanted.length; i += 900) {
      const chunk = wanted.slice(i, i + 900);
      if (chunk.length === 0) continue;
      const res = await fetch(url("/universe/names"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-User-Agent": CONFIG.USER_AGENT
        },
        body: JSON.stringify(chunk)
      });
      if (!res.ok) throw httpError("POST /universe/names", res.status);
      const data = await res.json();
      for (const item of data) nameCache.set(item.id, item.name);
    }
    return nameCache;
  }

  function name(id) {
    return nameCache.get(id) ?? String(id);
  }

  return { get, names, name };
})();
