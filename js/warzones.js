/* Warzones view: front bars, faction stats, SVG maps, systems table.
   Depends on config.js, i18n.js, esi.js, fwlogic.js (SDATA). */
"use strict";

const WarzonesView = (() => {
  let data = null;         // { systems, stats }
  let occupier = null;     // system_id -> occupier_faction_id
  let classes = null;      // system_id -> frontline | command | rearguard
  let kills = new Map();   // system_id -> ship+pod kills last hour
  let traffic = new Map(); // system_id -> ship jumps last hour
  let jumps = null;        // system_id -> gate jumps from home (or null)
  let filterMode = "contested";
  let sortMode = "vp";
  let controlsBound = false;

  function homeId() {
    const stored = Number(localStorage.getItem("tow_home_id"));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  }

  async function load() {
    const [systems, stats, killRows, jumpRows] = await Promise.all([
      ESI.get("/fw/systems"),
      ESI.get("/fw/stats"),
      ESI.get("/universe/system_kills"),
      ESI.get("/universe/system_jumps")
    ]);
    data = { systems, stats };
    occupier = new Map(systems.map(s => [s.solar_system_id, s.occupier_faction_id]));
    classes = FwLogic.classify(occupier);
    kills = new Map(killRows.map(k => [k.system_id, (k.ship_kills || 0) + (k.pod_kills || 0)]));
    traffic = new Map(jumpRows.map(j => [j.system_id, j.ship_jumps || 0]));
    jumps = FwLogic.jumpsFrom(homeId());
  }

  function sysName(id) {
    return SDATA.fw[id]?.n ?? SDATA.names[id] ?? String(id);
  }

  function sysRegion(id) {
    return SDATA.fw[id]?.r ?? "?";
  }

  function pct(s) {
    return s.victory_points_threshold > 0
      ? (s.victory_points / s.victory_points_threshold) * 100
      : 0;
  }

  /* ---------- warzone summary cards ---------- */

  function renderCards() {
    const container = document.getElementById("warzones");
    container.innerHTML = "";

    for (const wz of WARZONES) {
      const facA = factionOf(wz.a);
      const facB = factionOf(wz.b);

      const wzSystems = data.systems
        .filter(s => s.occupier_faction_id === wz.a || s.occupier_faction_id === wz.b)
        .sort((x, y) => x.solar_system_id - y.solar_system_id);

      const heldA = wzSystems.filter(s => s.occupier_faction_id === wz.a).length;
      const heldB = wzSystems.length - heldA;

      const statA = data.stats.find(s => s.faction_id === wz.a) || {};
      const statB = data.stats.find(s => s.faction_id === wz.b) || {};

      const segs = wzSystems.map(s => {
        const fac = factionOf(s.occupier_faction_id);
        const flag = s.contested !== "uncontested" ? " contested-flag" : "";
        return `<div class="seg${flag}" style="background:${fac.color}" title="${esc(sysName(s.solar_system_id))}"></div>`;
      }).join("");

      const card = document.createElement("div");
      card.className = "wz-card";
      card.innerHTML = `
        <div class="wz-head">
          <span style="color:${facA.color}">${facA.name}</span>
          <span style="color:${facB.color}">${facB.name}</span>
        </div>
        <div class="wz-counts">
          <span>${heldA} ${t("systems_held")}</span>
          <span>${heldB} ${t("systems_held")}</span>
        </div>
        <div class="front-bar">${segs}</div>
        <div class="wz-stats">
          <div class="stat">
            <div class="label">${t("pilots")}</div>
            <div class="vals">
              <span style="color:${facA.color}">${fmtNum(statA.pilots)}</span>
              <span style="color:${facB.color}">${fmtNum(statB.pilots)}</span>
            </div>
          </div>
          <div class="stat">
            <div class="label">${t("kills_yd")}</div>
            <div class="vals">
              <span style="color:${facA.color}">${fmtNum(statA.kills?.yesterday)}</span>
              <span style="color:${facB.color}">${fmtNum(statB.kills?.yesterday)}</span>
            </div>
          </div>
          <div class="stat">
            <div class="label">${t("vp_yd")}</div>
            <div class="vals">
              <span style="color:${facA.color}">${fmtNum(statA.victory_points?.yesterday)}</span>
              <span style="color:${facB.color}">${fmtNum(statB.victory_points?.yesterday)}</span>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    }
  }

  /* ---------- SVG warzone maps ---------- */

  const MAP_W = 640;
  const MAP_H = 420;
  const MAP_PAD = 30;

  function renderMap(wz) {
    const ids = data.systems
      .filter(s => s.occupier_faction_id === wz.a || s.occupier_faction_id === wz.b)
      .map(s => s.solar_system_id)
      .filter(id => SDATA.fw[id]?.x != null);
    if (ids.length === 0) return "";

    const xs = ids.map(id => SDATA.fw[id].x);
    const ys = ids.map(id => SDATA.fw[id].y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const px = id => MAP_PAD + ((SDATA.fw[id].x - minX) / spanX) * (MAP_W - 2 * MAP_PAD);
    /* SDE 2D y grows northward; SVG y grows downward — flip. */
    const py = id => MAP_H - MAP_PAD - ((SDATA.fw[id].y - minY) / spanY) * (MAP_H - 2 * MAP_PAD);

    const inZone = new Set(ids);
    const edges = [];
    const seen = new Set();
    for (const id of ids) {
      for (const n of FwLogic.fwNeighbors.get(id) || []) {
        if (!inZone.has(n)) continue;
        const key = id < n ? `${id}-${n}` : `${n}-${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(`<line x1="${px(id).toFixed(1)}" y1="${py(id).toFixed(1)}" x2="${px(n).toFixed(1)}" y2="${py(n).toFixed(1)}"/>`);
      }
    }

    const byId = new Map(data.systems.map(s => [s.solar_system_id, s]));
    const maxKills = Math.max(1, ...ids.map(id => kills.get(id) || 0));
    const nodes = ids.map(id => {
      const s = byId.get(id);
      const fac = factionOf(s.occupier_faction_id);
      const k = kills.get(id) || 0;
      const r = 4 + 8 * Math.sqrt(k / maxKills);
      const contested = s.contested !== "uncontested";
      const ring = contested
        ? `<circle cx="${px(id).toFixed(1)}" cy="${py(id).toFixed(1)}" r="${(r + 3).toFixed(1)}" class="map-ring"/>`
        : "";
      const cls = classes.get(id) || "rearguard";
      const jmp = jumps?.get(id);
      const tip = [
        sysName(id),
        sysRegion(id),
        t("class_" + cls),
        t("status_" + s.contested) + (contested ? ` ${pct(s).toFixed(1)}%` : ""),
        `${t("th_kills1h")}: ${k}`,
        jmp !== undefined && jmp !== null ? `${t("th_jumps")}: ${jmp}` : null
      ].filter(Boolean).join(" · ");
      return `${ring}<circle cx="${px(id).toFixed(1)}" cy="${py(id).toFixed(1)}" r="${r.toFixed(1)}" fill="${fac.color}" class="map-node"><title>${esc(tip)}</title></circle>`;
    }).join("");

    const labels = ids
      .filter(id => (classes.get(id) === "frontline") || (kills.get(id) || 0) > maxKills * 0.5)
      .map(id => `<text x="${px(id).toFixed(1)}" y="${(py(id) - 12).toFixed(1)}" class="map-label">${esc(sysName(id))}</text>`)
      .join("");

    const facA = factionOf(wz.a);
    const facB = factionOf(wz.b);
    return `
      <div class="map-card">
        <div class="map-head">
          <span style="color:${facA.color}">${facA.name}</span> vs
          <span style="color:${facB.color}">${facB.name}</span>
        </div>
        <svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="wz-map" role="img">
          <g class="map-edges">${edges.join("")}</g>
          ${nodes}
          ${labels}
        </svg>
      </div>
    `;
  }

  function renderMaps() {
    document.getElementById("wz-maps").innerHTML = WARZONES.map(renderMap).join("");
  }

  /* ---------- systems table ---------- */

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;

    const filterSel = document.getElementById("wz-filter");
    filterSel.addEventListener("change", () => { filterMode = filterSel.value; renderTable(); });

    const sortSel = document.getElementById("wz-sort");
    sortSel.addEventListener("change", () => { sortMode = sortSel.value; renderTable(); });

    const home = document.getElementById("wz-home");
    home.value = localStorage.getItem("tow_home_name") || "";
    const list = document.getElementById("wz-home-list");
    home.addEventListener("input", () => {
      list.innerHTML = FwLogic.searchSystems(home.value)
        .map(e => `<option value="${esc(e.name)}"></option>`)
        .join("");
      const id = FwLogic.systemIdByName(home.value);
      if (id) {
        localStorage.setItem("tow_home_id", String(id));
        localStorage.setItem("tow_home_name", home.value.trim());
        jumps = FwLogic.jumpsFrom(id);
        render();
      } else if (home.value.trim() === "") {
        localStorage.removeItem("tow_home_id");
        localStorage.removeItem("tow_home_name");
        jumps = null;
        render();
      }
    });
  }

  function fillSelect(id, options, current) {
    const sel = document.getElementById(id);
    sel.innerHTML = options
      .map(([v, label]) => `<option value="${v}"${v === current ? " selected" : ""}>${label}</option>`)
      .join("");
  }

  function visibleRows() {
    let rows = data.systems;
    if (filterMode === "contested") rows = rows.filter(s => s.contested !== "uncontested");
    if (filterMode === "frontline") rows = rows.filter(s => classes.get(s.solar_system_id) === "frontline");

    const withMeta = rows.map(s => ({
      s,
      pct: pct(s),
      kills: kills.get(s.solar_system_id) || 0,
      jmp: jumps?.get(s.solar_system_id) ?? null
    }));

    if (sortMode === "kills") withMeta.sort((a, b) => b.kills - a.kills || b.pct - a.pct);
    else if (sortMode === "jumps") withMeta.sort((a, b) => (a.jmp ?? 9e9) - (b.jmp ?? 9e9) || b.pct - a.pct);
    else withMeta.sort((a, b) => b.pct - a.pct || b.kills - a.kills);

    return withMeta.slice(0, filterMode === "all" ? 160 : CONFIG.CONTESTED_ROWS);
  }

  function renderTable() {
    fillSelect("wz-filter", [
      ["contested", t("wz_filter_contested")],
      ["frontline", t("wz_filter_frontline")],
      ["all", t("wz_filter_all")]
    ], filterMode);
    fillSelect("wz-sort", [
      ["vp", t("wz_sort_vp")],
      ["kills", t("wz_sort_kills")],
      ["jumps", t("wz_sort_jumps")]
    ], sortMode);
    bindControls();

    const body = document.getElementById("contested-body");
    body.innerHTML = "";

    const rows = visibleRows();
    if (rows.length === 0) {
      body.innerHTML = `<tr><td colspan="8" class="status-pill">${t("contested_none")}</td></tr>`;
      return;
    }

    for (const { s, pct: p, kills: k, jmp } of rows) {
      const id = s.solar_system_id;
      const fac = factionOf(s.occupier_faction_id);
      const cls = classes.get(id) || "rearguard";
      const hot = s.contested === "vulnerable" ? " hot" : "";
      const dim = s.contested === "uncontested" ? " dim" : "";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${esc(sysName(id))}</td>
        <td class="mono sub">${esc(sysRegion(id))}</td>
        <td><span class="fac-tag" style="color:${fac.color};border-color:${fac.color}">${fac.name}</span></td>
        <td><span class="class-tag class-${cls}">${t("class_" + cls)}</span></td>
        <td><span class="status-pill${hot}${dim}">${t("status_" + s.contested)}</span></td>
        <td>
          <div class="vp-bar">
            <div class="fill" style="width:${Math.min(100, p).toFixed(1)}%;background:${fac.color}"></div>
          </div>
          <span class="mono sub">${p.toFixed(1)}%</span>
        </td>
        <td class="mono${k > 0 ? " strong" : ""}">${fmtNum(k)}</td>
        <td class="mono">${jmp === null || jmp === undefined ? "—" : jmp}</td>
      `;
      body.appendChild(row);
    }
  }

  function render() {
    if (!data) return;
    renderCards();
    renderMaps();
    renderTable();
  }

  return { load, render };
})();
