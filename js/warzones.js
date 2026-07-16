/* Warzones view (front bars, faction stats, systems table) and Map view
   (SVG warzone maps). Both share one data load.
   Depends on config.js, i18n.js, esi.js, fwlogic.js (SDATA). */
"use strict";

const [WarzonesView, MapView] = (() => {
  let data = null;         // { systems, stats }
  let occupier = null;     // system_id -> occupier_faction_id
  let classes = null;      // system_id -> frontline | command | rearguard
  let kills = new Map();   // system_id -> ship+pod kills last hour
  let traffic = new Map(); // system_id -> ship jumps last hour
  let jumps = null;        // system_id -> gate jumps from home (or null)
  let advantage = null;    // system_id -> { occ, enemy } or null when unavailable
  let histSystems = null;  // per-system snapshots from data/history.json
  let histFlips = [];      // flip events from data/history.json
  let insurgency = null;   // system_id -> { pirate, corrState, corrPct, suppState, suppPct, origin }
  let selectedId = null;   // system shown in the detail panel
  let filterMode = "contested";
  let sortMode = "vp";
  let controlsBound = false;

  /* Insurgency state (Havoc): same proxy/mirror pattern as Advantage. */
  async function loadInsurgency() {
    insurgency = null;
    let campaigns = null;
    try {
      const res = await fetch("/api/insurgency");
      if (res.ok) {
        campaigns = (await res.json())
          .filter(c => c.state === "ACTIVE")
          .map(c => ({
            pirate: c.pirateFactionId,
            origin: { id: c.originSolarSystem?.id, name: c.originSolarSystem?.name },
            systems: Object.fromEntries((c.insurgencies || []).map(e => [
              e.solarSystem?.id,
              [e.corruptionState || 0, e.corruptionPercentage || 0,
               e.suppressionState || 0, e.suppressionPercentage || 0]
            ]))
          }));
      }
    } catch { /* proxy unavailable — try the static mirror */ }
    if (!campaigns) {
      try {
        const res = await fetch("/data/insurgency.json", { cache: "no-cache" });
        if (!res.ok) return;
        const mirror = await res.json();
        if (Date.now() - Date.parse(mirror.fetched) > MIRROR_MAX_AGE_MS) return;
        campaigns = mirror.campaigns || [];
      } catch { return; }
    }
    insurgency = { campaigns, bySystem: new Map() };
    for (const c of campaigns) {
      for (const [id, v] of Object.entries(c.systems || {})) {
        insurgency.bySystem.set(Number(id), {
          pirate: c.pirate,
          origin: c.origin,
          corrState: v[0], corrPct: v[1], suppState: v[2], suppPct: v[3]
        });
      }
    }
  }

  /*
   * Advantage comes from the war report API on www.eveonline.com, which has
   * no CORS headers. Two optional sources, in order:
   *   1. /api/warzone — live proxy in serve.py (local development)
   *   2. data/warzone.json — static mirror committed by the scheduled
   *      GitHub Action (hosted site), discarded when older than 24 h
   * Without either, the column simply stays empty.
   */
  const MIRROR_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  async function loadAdvantage() {
    advantage = null;
    try {
      const res = await fetch("/api/warzone");
      if (res.ok) {
        const rows = await res.json();
        advantage = new Map(rows.map(r => {
          const entries = (r.advantage || []).filter(a => FACTIONS[a.factionID]);
          const occ = entries.find(a => a.factionID === r.occupierFaction)?.totalAmount ?? null;
          const enemy = Math.max(0,
            ...entries.filter(a => a.factionID !== r.occupierFaction).map(a => a.totalAmount));
          return [r.solarsystemID, { occ, enemy }];
        }));
        return;
      }
    } catch { /* proxy unavailable — try the static mirror */ }
    try {
      const res = await fetch("/data/warzone.json", { cache: "no-cache" });
      if (!res.ok) return;
      const mirror = await res.json();
      if (Date.now() - Date.parse(mirror.fetched) > MIRROR_MAX_AGE_MS) return;
      advantage = new Map(Object.entries(mirror.systems || {})
        .map(([id, v]) => [Number(id), v]));
    } catch { /* no advantage source available */ }
  }

  /* Per-system history window (49 h) for the 24 h contested trend. */
  async function loadHistory() {
    histSystems = null;
    try {
      const res = await fetch("/data/history.json", { cache: "no-cache" });
      if (!res.ok) return;
      const history = await res.json();
      if (Array.isArray(history.systems)) histSystems = history.systems;
      if (Array.isArray(history.flips)) histFlips = history.flips;
    } catch { /* trend column stays empty */ }
  }

  /*
   * Contested-% change vs ~24 h ago. Snapshots only include systems with
   * victory points, so a missing entry means 0%. Returns null without a
   * usable snapshot, or "flip" when the occupier changed in between.
   */
  function delta24h(id, currentPct, currentOcc) {
    if (!histSystems || histSystems.length === 0) return null;
    const target = Date.now() / 1000 - 24 * 3600;
    let best = null;
    for (const e of histSystems) {
      if (best === null || Math.abs(e.t - target) < Math.abs(best.t - target)) best = e;
    }
    if (Math.abs(best.t - target) > 3 * 3600) return null;
    const entry = best.s?.[String(id)];
    const oldPct = entry ? entry[1] / 10 : 0;
    const oldOcc = entry ? entry[0] : currentOcc;
    if (oldOcc !== currentOcc) return "flip";
    return currentPct - oldPct;
  }

  function homeId() {
    const stored = Number(localStorage.getItem("tow_home_id"));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  }

  /* Shared by the Warzones and Map tabs; a short reuse window avoids
     double-fetching when both tabs are opened back to back. */
  let loadedAt = 0;

  async function load() {
    if (data && Date.now() - loadedAt < 60 * 1000) return;
    const [systems, stats, killRows, jumpRows] = await Promise.all([
      ESI.get("/fw/systems"),
      ESI.get("/fw/stats"),
      ESI.get("/universe/system_kills"),
      ESI.get("/universe/system_jumps"),
      loadAdvantage(),
      loadHistory(),
      loadInsurgency()
    ]);
    data = { systems, stats };
    loadedAt = Date.now();
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

  /* ---------- loading skeleton ---------- */

  /* Shown the moment the tab opens, before the ESI fetch resolves — reserves
     space for the cards and a batch of table rows so the page doesn't jump
     from near-empty to full height once render() replaces this. */
  function skeleton() {
    const container = document.getElementById("warzones");
    container.innerHTML = `
      <div class="wz-card skeleton-card">
        <div class="skel-fill"></div>
        <div class="skel-fill"></div>
        <div class="skel-fill"></div>
        <div class="wz-stats">
          <div class="skel-fill"></div>
          <div class="skel-fill"></div>
          <div class="skel-fill"></div>
        </div>
      </div>
      <div class="wz-card skeleton-card">
        <div class="skel-fill"></div>
        <div class="skel-fill"></div>
        <div class="skel-fill"></div>
        <div class="wz-stats">
          <div class="skel-fill"></div>
          <div class="skel-fill"></div>
          <div class="skel-fill"></div>
        </div>
      </div>
    `;
    const body = document.getElementById("contested-body");
    body.innerHTML = Array.from({ length: 20 }, () =>
      `<tr class="skeleton-row"><td colspan="10"><div class="skel-fill"></div></td></tr>`
    ).join("");
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

  const MAP_W = 960;
  const MAP_H = 540;
  const MAP_PAD = 36;
  const NODE_R = 10;
  const NODE_GAP = 25;

  /* Push overlapping nodes apart so every system stays readable at base
     zoom. Small, symmetric displacements — geography stays recognizable. */
  function relaxPositions(pos, ids, minDist) {
    for (let iter = 0; iter < 60; iter++) {
      let moved = false;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos.get(ids[i]);
          const b = pos.get(ids[j]);
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d < 0.01) { dx = 1; dy = 0; d = 1; }
          if (d < minDist) {
            const push = (minDist - d) / 2;
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    for (const id of ids) {
      const p = pos.get(id);
      p.x = Math.min(MAP_W - MAP_PAD, Math.max(MAP_PAD, p.x));
      p.y = Math.min(MAP_H - MAP_PAD, Math.max(MAP_PAD, p.y));
    }
  }

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
    /* Uniform scale + centering: independent axis scaling would distort the
       geography (developers.eveonline.com/docs/guides/map-data). */
    const scale = Math.min((MAP_W - 2 * MAP_PAD) / spanX, (MAP_H - 2 * MAP_PAD) / spanY);
    const offX = (MAP_W - spanX * scale) / 2;
    const offY = (MAP_H - spanY * scale) / 2;
    /* SDE 2D y grows northward; SVG y grows downward — flip (y_img = -y_eve). */
    const pos = new Map(ids.map(id => [id, {
      x: offX + (SDATA.fw[id].x - minX) * scale,
      y: MAP_H - offY - (SDATA.fw[id].y - minY) * scale
    }]));
    relaxPositions(pos, ids, NODE_GAP);
    const px = id => pos.get(id).x;
    const py = id => pos.get(id).y;

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
      const x = px(id).toFixed(1);
      const y = py(id).toFixed(1);
      /* Activity as a soft halo behind the node, not as node size. */
      const halo = k > 0
        ? `<circle cx="${x}" cy="${y}" r="${(NODE_R + 3 + 14 * Math.sqrt(k / maxKills)).toFixed(1)}" fill="${fac.color}" class="map-halo"/>`
        : "";
      const state = s.contested === "vulnerable" ? " vulnerable"
        : s.contested !== "uncontested" ? " contested" : "";
      const cls = classes.get(id) || "rearguard";
      const jmp = jumps?.get(id);
      const adv = advantage?.get(id);
      const ins = insurgency?.bySystem.get(id);
      const tip = [
        sysName(id),
        sysRegion(id),
        t("class_" + cls),
        t("status_" + s.contested) + (state ? ` ${pct(s).toFixed(1)}%` : ""),
        `${t("th_kills1h")}: ${k}`,
        adv && adv.occ !== null ? `${t("th_adv")}: ${adv.occ}:${adv.enemy}` : null,
        ins ? `${pirateOf(ins.pirate).name} — ${t("ins_corruption")} ${ins.corrPct.toFixed(0)}% / ${t("ins_suppression")} ${ins.suppPct.toFixed(0)}%` : null,
        jmp !== undefined && jmp !== null ? `${t("th_jumps")}: ${jmp}` : null
      ].filter(Boolean).join(" · ");
      const insRing = ins
        ? `<circle cx="${x}" cy="${y}" r="${NODE_R + 4}" data-r="${NODE_R + 4}" class="map-ins${ins.origin?.id === id ? " fob" : ""}"/>`
        : "";
      const code = sysName(id).slice(0, 2);
      return `${halo}<g class="map-sys" data-id="${id}">
        ${insRing}
        <circle cx="${x}" cy="${y}" r="${NODE_R}" data-r="${NODE_R}" fill="${fac.color}" class="map-node${state}"><title>${esc(tip)}</title></circle>
        <text x="${x}" y="${y}" class="map-code">${esc(code)}</text>
      </g>`;
    }).join("");

    /* Full names appear once zoomed in (map-label-minor is zoom-gated). */
    const labels = ids
      .map(id => `<text x="${px(id).toFixed(1)}" y="${(py(id) + NODE_R + 9).toFixed(1)}" class="map-label map-label-minor">${esc(sysName(id))}</text>`)
      .join("");

    const facA = factionOf(wz.a);
    const facB = factionOf(wz.b);
    return `
      <div class="map-card">
        <div class="map-head">
          <span style="color:${facA.color}">${facA.name}</span> vs
          <span style="color:${facB.color}">${facB.name}</span>
        </div>
        <div class="map-frame">
          <svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="wz-map" role="img">
            <g class="map-edges">${edges.join("")}</g>
            ${nodes}
            ${labels}
          </svg>
          <div class="map-controls">
            <button type="button" data-zoom="in" title="${t("map_zoom_in")}">+</button>
            <button type="button" data-zoom="out" title="${t("map_zoom_out")}">−</button>
            <button type="button" data-zoom="reset" title="${t("map_zoom_reset")}">⌂</button>
          </div>
        </div>
      </div>
    `;
  }

  /* Pan/zoom via viewBox: wheel zooms toward the cursor, drag pans,
     double click or the home button resets. Zoomed in, all labels show. */
  function bindMapInteractions(svg) {
    const base = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    let vb = { ...base };
    const MIN_W = MAP_W / 10;

    function apply() {
      svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      svg.classList.toggle("zoomed", base.w / vb.w >= 2);
      /* Counter-scale nodes, labels, and edges (damped via sqrt) so zooming
         magnifies distances, not symbols. */
      const f = Math.min(1, Math.max(0.3, Math.sqrt(vb.w / base.w)));
      svg.style.setProperty("--fk", f);
      svg.querySelectorAll("circle[data-r]").forEach(c => {
        c.setAttribute("r", (Number(c.dataset.r) * f).toFixed(2));
      });
    }

    function toSvgPoint(evt) {
      const r = svg.getBoundingClientRect();
      return {
        x: vb.x + ((evt.clientX - r.left) / r.width) * vb.w,
        y: vb.y + ((evt.clientY - r.top) / r.height) * vb.h
      };
    }

    function zoomAt(factor, cx, cy) {
      const w = Math.min(base.w, Math.max(MIN_W, vb.w * factor));
      const scale = w / vb.w;
      vb = {
        x: cx - (cx - vb.x) * scale,
        y: cy - (cy - vb.y) * scale,
        w,
        h: vb.h * scale
      };
      if (w >= base.w) vb = { ...base };
      apply();
    }

    svg.addEventListener("wheel", e => {
      e.preventDefault();
      const p = toSvgPoint(e);
      zoomAt(e.deltaY < 0 ? 0.75 : 1 / 0.75, p.x, p.y);
    }, { passive: false });

    let drag = null;
    let dragged = false;
    svg.addEventListener("pointerdown", e => {
      drag = { px: e.clientX, py: e.clientY, vx: vb.x, vy: vb.y };
      dragged = false;
      svg.setPointerCapture(e.pointerId);
      svg.classList.add("panning");
    });
    svg.addEventListener("pointermove", e => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) > 5) {
        if (!dragged) hidePopover(svg);
        dragged = true;
      }
      const r = svg.getBoundingClientRect();
      vb.x = drag.vx - ((e.clientX - drag.px) / r.width) * vb.w;
      vb.y = drag.vy - ((e.clientY - drag.py) / r.height) * vb.h;
      apply();
    });
    const endDrag = () => { drag = null; svg.classList.remove("panning"); };
    svg.addEventListener("pointercancel", endDrag);

    /*
     * System selection happens on pointerup with an explicit hit test:
     * setPointerCapture retargets the synthesized click event to the svg,
     * so a plain click listener never sees the node.
     */
    svg.addEventListener("pointerup", e => {
      const wasDragged = dragged;
      endDrag();
      if (wasDragged) return;
      const sys = document.elementFromPoint(e.clientX, e.clientY)?.closest(".map-sys");
      if (sys) {
        selectSystem(Number(sys.dataset.id), { quiet: true });
        showPopover(svg.closest(".map-frame"), Number(sys.dataset.id), e);
      } else {
        hidePopover(svg);
      }
    });

    svg.addEventListener("dblclick", () => { vb = { ...base }; apply(); });

    svg.parentElement.querySelectorAll(".map-controls button").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.zoom;
        if (mode === "reset") { vb = { ...base }; apply(); return; }
        zoomAt(mode === "in" ? 0.75 : 1 / 0.75, vb.x + vb.w / 2, vb.y + vb.h / 2);
      });
    });
  }

  function renderMaps() {
    const container = document.getElementById("wz-maps");
    container.innerHTML = WARZONES.map(renderMap).join("");
    container.querySelectorAll(".wz-map").forEach(bindMapInteractions);
  }

  /* ---------- insurgency summary ---------- */

  function renderInsurgencies() {
    const container = document.getElementById("insurgencies");
    if (!insurgency || insurgency.campaigns.length === 0) {
      container.innerHTML = "";
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    container.innerHTML = insurgency.campaigns.map(c => {
      const pirate = pirateOf(c.pirate);
      const entries = Object.entries(c.systems || {});
      const corrupted = entries.filter(([, v]) => v[0] >= 5).length;
      const suppressed = entries.filter(([, v]) => v[2] >= 5).length;
      return `
        <div class="ins-card">
          <div class="ins-head">${esc(pirate.name)}</div>
          <div class="ins-body">
            ${t("ins_origin")}: <span class="strong">${esc(c.origin?.name ?? "?")}</span>
            · ${entries.length} ${t("ins_affected")}
            · ${t("ins_corruption")} 5/5: ${corrupted}
            · ${t("ins_suppression")} 5/5: ${suppressed}
          </div>
        </div>
      `;
    }).join("");
  }

  /* ---------- system detail panel ---------- */

  function sparkline(id) {
    if (!histSystems || histSystems.length < 2) return "";
    const points = histSystems
      .map(e => [e.t, (e.s?.[String(id)]?.[1] ?? 0) / 10])
      .sort((a, b) => a[0] - b[0]);
    const W = 260, H = 56, P = 4;
    const tMin = points[0][0];
    const span = Math.max(1, points[points.length - 1][0] - tMin);
    const vMax = Math.max(5, ...points.map(p => p[1]));
    const x = tv => P + ((tv - tMin) / span) * (W - 2 * P);
    const y = v => H - P - (v / vMax) * (H - 2 * P);
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    return `
      <svg viewBox="0 0 ${W} ${H}" class="spark" role="img">
        <path d="${d}"/>
      </svg>
      <div class="spark-scale mono">0–${vMax.toFixed(0)}%</div>
    `;
  }

  function selectSystem(id, opts = {}) {
    selectedId = id;
    renderDetail();
    if (!opts.quiet) {
      document.querySelector("section:not(.hidden) .sys-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /* ---------- map popover (compact detail at the clicked system) ---------- */

  function popHtml(id) {
    const s = data.systems.find(x => x.solar_system_id === id);
    if (!s) return "";
    const fac = factionOf(s.occupier_faction_id);
    const cls = classes.get(id) || "rearguard";
    const p = pct(s);
    const adv = advantage?.get(id);
    const ins = insurgency?.bySystem.get(id);
    const jmp = jumps?.get(id);
    const delta = delta24h(id, p, s.occupier_faction_id);
    let deltaTxt = "—";
    if (delta === "flip") deltaTxt = t("delta_flip");
    else if (typeof delta === "number") deltaTxt = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;

    const row = (label, value) => `
      <div class="det-stat"><span class="dlabel">${label}</span><span class="mono">${value}</span></div>`;

    return `
      <div class="pop-head">
        <a href="${zkillUrl(id)}" target="_blank" rel="noopener" class="sys-link" title="zKillboard">${esc(sysName(id))}</a>
        <a href="${dotlanUrl(sysName(id))}" target="_blank" rel="noopener" class="ext-link" title="Dotlan">D</a>
        <button type="button" class="det-close" title="${t("det_close")}">×</button>
      </div>
      <div class="pop-tags">
        <span class="fac-tag" style="color:${fac.color};border-color:${fac.color}">${fac.name}</span>
        <span class="class-tag class-${cls}">${t("class_" + cls)}</span>
        <span class="status-pill${s.contested === "vulnerable" ? " hot" : ""}">${t("status_" + s.contested)} ${p > 0 ? p.toFixed(1) + "%" : ""}</span>
      </div>
      ${row("Δ 24h", deltaTxt)}
      ${row(t("th_adv"), adv && adv.occ !== null ? `${adv.occ} : ${adv.enemy}` : "—")}
      ${row(t("th_kills1h"), fmtNum(kills.get(id) || 0))}
      ${row(t("det_traffic"), fmtNum(traffic.get(id) || 0))}
      ${row(t("th_jumps"), jmp ?? "—")}
      ${ins ? row(esc(pirateOf(ins.pirate).name), `${t("ins_corruption")} ${ins.corrState}/5 · ${t("ins_suppression")} ${ins.suppState}/5`) : ""}
      <button type="button" class="btn pop-more">${t("det_more")}</button>
    `;
  }

  /* anchor: any positioned container (.map-frame or the panel itself). */
  function showPopover(anchor, id, evt) {
    document.querySelectorAll(".map-pop").forEach(p => p.classList.add("hidden"));
    let pop = anchor.querySelector(":scope > .map-pop");
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "map-pop";
      anchor.appendChild(pop);
    }
    pop.innerHTML = popHtml(id);
    pop.classList.remove("hidden");
    const fr = anchor.getBoundingClientRect();
    const x = evt.clientX - fr.left;
    const y = evt.clientY - fr.top;
    pop.style.left = `${Math.max(8, Math.min(x + 16, fr.width - pop.offsetWidth - 8))}px`;
    pop.style.top = `${Math.max(8, Math.min(y - 24, fr.height - pop.offsetHeight - 8))}px`;
    pop.querySelector(".det-close").addEventListener("click", () => pop.classList.add("hidden"));
    const more = pop.querySelector(".pop-more");
    const detail = document.querySelector("section:not(.hidden) .sys-detail");
    if (detail) {
      more.addEventListener("click", () => {
        pop.classList.add("hidden");
        detail.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      more.classList.add("hidden");
    }
  }

  function hidePopover(el) {
    el.closest(".map-frame")?.querySelector(".map-pop")?.classList.add("hidden");
  }

  /* Click anywhere outside a popover or a system closes open popovers. */
  document.addEventListener("click", e => {
    if (e.target.closest(".map-pop") || e.target.closest(".sys-row") || e.target.closest(".map-sys")) return;
    document.querySelectorAll(".map-pop").forEach(p => p.classList.add("hidden"));
  });

  function detailHtml(id) {
    const s = data.systems.find(x => x.solar_system_id === id);
    if (!s) return "";
    const fac = factionOf(s.occupier_faction_id);
    const cls = classes.get(id) || "rearguard";
    const p = pct(s);
    const k = kills.get(id) || 0;
    const tr = traffic.get(id) || 0;
    const jmp = jumps?.get(id);
    const adv = advantage?.get(id);
    const ins = insurgency?.bySystem.get(id);
    const delta = delta24h(id, p, s.occupier_faction_id);

    const flipRows = histFlips
      .filter(f => f.id === id)
      .sort((a, b) => b.t - a.t)
      .slice(0, 3)
      .map(f => {
        const when = fmtDate(new Date(f.t * 1000), { day: "2-digit", month: "2-digit" });
        return `${when}: ${factionOf(f.from).name} → ${factionOf(f.to).name}`;
      });

    const neighbors = (FwLogic.fwNeighbors.get(id) || [])
      .filter(n => occupier.has(n))
      .map(n => {
        const nf = factionOf(occupier.get(n));
        return `<button type="button" class="chip" data-id="${n}" style="color:${nf.color};border-color:${nf.color}">${esc(sysName(n))}</button>`;
      }).join("");

    const stat = (label, value) => `
      <div class="det-stat"><span class="dlabel">${label}</span><span class="mono">${value}</span></div>`;

    let deltaTxt = "—";
    if (delta === "flip") deltaTxt = t("delta_flip");
    else if (typeof delta === "number") deltaTxt = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;

    return `
      <div class="det-card">
        <div class="det-head">
          <h3>
            <a href="${zkillUrl(id)}" target="_blank" rel="noopener" class="sys-link" title="zKillboard">${esc(sysName(id))}</a>
            <a href="${dotlanUrl(sysName(id))}" target="_blank" rel="noopener" class="ext-link" title="Dotlan">D</a>
          </h3>
          <span class="mono sub">${esc(sysRegion(id))}</span>
          <span class="fac-tag" style="color:${fac.color};border-color:${fac.color}">${fac.name}</span>
          <span class="class-tag class-${cls}" title="${t("class_" + cls + "_tip")}">${t("class_" + cls)}</span>
          <span class="status-pill${s.contested === "vulnerable" ? " hot" : ""}">${t("status_" + s.contested)} ${p > 0 ? p.toFixed(1) + "%" : ""}</span>
          <button type="button" class="det-close" title="${t("det_close")}">×</button>
        </div>
        <div class="det-grid">
          <div>
            <div class="dlabel">${t("det_trend")} · Δ24h ${deltaTxt}</div>
            ${sparkline(id) || `<div class="sub">${t("det_no_trend")}</div>`}
          </div>
          <div>
            ${stat(t("th_adv"), adv && adv.occ !== null ? `${adv.occ} : ${adv.enemy}` : "—")}
            ${stat(t("th_kills1h"), fmtNum(k))}
            ${stat(t("det_traffic"), fmtNum(tr))}
            ${stat(t("th_jumps"), jmp ?? "—")}
          </div>
          <div>
            ${ins ? `
              <div class="dlabel">${esc(pirateOf(ins.pirate).name)} · ${t("ins_origin")} ${esc(ins.origin?.name ?? "?")}</div>
              ${stat(t("ins_corruption"), `${ins.corrState}/5 (${ins.corrPct.toFixed(0)}%)`)}
              ${stat(t("ins_suppression"), `${ins.suppState}/5 (${ins.suppPct.toFixed(0)}%)`)}
            ` : ""}
            ${flipRows.length ? `
              <div class="dlabel">${t("det_flips")}</div>
              <div class="sub">${flipRows.map(esc).join("<br>")}</div>
            ` : ""}
          </div>
        </div>
        ${neighbors ? `<div class="det-neighbors"><span class="dlabel">${t("det_neighbors")}</span> ${neighbors}</div>` : ""}
      </div>
    `;
  }

  function renderDetail() {
    document.querySelectorAll(".sys-detail").forEach(el => {
      if (!data || selectedId === null) {
        el.innerHTML = `<div class="notice">${t("det_hint")}</div>`;
        return;
      }
      el.innerHTML = detailHtml(selectedId);
      el.querySelector(".det-close")?.addEventListener("click", () => {
        selectedId = null;
        renderDetail();
      });
      el.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => selectSystem(Number(chip.dataset.id)));
      });
    });
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

    const withMeta = rows.map(s => {
      const p = pct(s);
      return {
        s,
        pct: p,
        kills: kills.get(s.solar_system_id) || 0,
        jmp: jumps?.get(s.solar_system_id) ?? null,
        delta: delta24h(s.solar_system_id, p, s.occupier_faction_id)
      };
    });

    const deltaRank = d => d === "flip" ? 1e9 : (typeof d === "number" ? Math.abs(d) : -1);
    if (sortMode === "kills") withMeta.sort((a, b) => b.kills - a.kills || b.pct - a.pct);
    else if (sortMode === "jumps") withMeta.sort((a, b) => (a.jmp ?? 9e9) - (b.jmp ?? 9e9) || b.pct - a.pct);
    else if (sortMode === "delta") withMeta.sort((a, b) => deltaRank(b.delta) - deltaRank(a.delta) || b.pct - a.pct);
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
      ["delta", t("wz_sort_delta")],
      ["kills", t("wz_sort_kills")],
      ["jumps", t("wz_sort_jumps")]
    ], sortMode);
    bindControls();

    const body = document.getElementById("contested-body");
    body.innerHTML = "";

    const rows = visibleRows();
    if (rows.length === 0) {
      body.innerHTML = `<tr><td colspan="10" class="status-pill">${t("contested_none")}</td></tr>`;
      return;
    }

    for (const { s, pct: p, kills: k, jmp, delta } of rows) {
      const id = s.solar_system_id;
      const fac = factionOf(s.occupier_faction_id);
      const cls = classes.get(id) || "rearguard";
      const hot = s.contested === "vulnerable" ? " hot" : "";
      const dim = s.contested === "uncontested" ? " dim" : "";
      const adv = advantage?.get(id);
      const advCell = adv && adv.occ !== null
        ? `<span title="${t("adv_tip")}">${adv.occ}&thinsp;:&thinsp;${adv.enemy}</span>`
        : "—";
      let deltaCell = "—";
      if (delta === "flip") {
        deltaCell = `<span class="delta-flip">${t("delta_flip")}</span>`;
      } else if (typeof delta === "number" && Math.abs(delta) >= 0.05) {
        const cls = delta > 0 ? "delta-up" : "delta-down";
        deltaCell = `<span class="${cls}">${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}%</span>`;
      } else if (typeof delta === "number") {
        deltaCell = "±0";
      }
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="sys-cell">
          <a href="${zkillUrl(id)}" target="_blank" rel="noopener" class="sys-link" title="zKillboard">${esc(sysName(id))}</a>
          <a href="${dotlanUrl(sysName(id))}" target="_blank" rel="noopener" class="ext-link" title="Dotlan">D</a>
        </td>
        <td class="mono sub">${esc(sysRegion(id))}</td>
        <td><span class="fac-tag" style="color:${fac.color};border-color:${fac.color}">${fac.name}</span></td>
        <td><span class="class-tag class-${cls}" title="${t("class_" + cls + "_tip")}">${t("class_" + cls)}</span></td>
        <td><span class="status-pill${hot}${dim}">${t("status_" + s.contested)}</span></td>
        <td>
          <div class="vp-bar">
            <div class="fill" style="width:${Math.min(100, p).toFixed(1)}%;background:${fac.color}"></div>
          </div>
          <span class="mono sub">${p.toFixed(1)}%</span>
        </td>
        <td class="mono">${deltaCell}</td>
        <td class="mono">${advCell}</td>
        <td class="mono${k > 0 ? " strong" : ""}">${fmtNum(k)}</td>
        <td class="mono">${jmp === null || jmp === undefined ? "—" : jmp}</td>
      `;
      row.classList.add("sys-row");
      row.addEventListener("click", e => {
        if (e.target.closest("a")) return;
        selectSystem(id, { quiet: true });
        showPopover(document.getElementById("panel-warzones"), id, e);
      });
      body.appendChild(row);
    }
  }

  function render() {
    if (!data) return;
    renderCards();
    renderInsurgencies();
    renderTable();
    renderDetail();
  }

  function renderMapTab() {
    if (!data) return;
    renderMaps();
    renderDetail();
  }

  return [
    { load, render, skeleton },
    { load, render: renderMapTab }
  ];
})();
