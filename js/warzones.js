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
  let advantage = null;    // system_id -> { occ, enemy } or null when unavailable
  let histSystems = null;  // per-system snapshots from data/history.json
  let histFlips = [];      // flip events from data/history.json
  let insurgency = null;   // system_id -> { pirate, corrState, corrPct, suppState, suppPct, origin }
  let wzFilter = "all";    // all | cal-gal | ama-min — which warzone's systems to show
  let sortKey = "vp";      // system | region | occ | vp | delta | adv | kills | jumps
  let sortDir = "desc";
  let mapWz = null;        // cal-gal | ama-min — which warzone's map is shown; set to WARZONES[0].id on first render
  let mapSel = null;       // system_id shown in the map's side detail panel
  /* Persisted pan/zoom so background re-renders (price/detail enrichment,
     auto-refresh) don't silently reset the user's view — only switching
     warzones (renderMapChips' click handler) resets this to null (=> base). */
  let mapViewBox = null;

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
    const cardHtml = `
      <div class="ops-card">
        <div class="skel-fill" style="height:17px;width:55%;margin-bottom:12px"></div>
        <div class="skel-fill" style="height:14px;margin-bottom:8px"></div>
        <div class="skel-fill" style="height:10.5px;width:70%"></div>
      </div>
    `;
    document.getElementById("warzones").innerHTML = cardHtml + cardHtml;
    document.getElementById("contested-body").innerHTML = Array.from({ length: 20 }, () =>
      `<div class="ops-row" style="cursor:default"><div class="skel-fill" style="height:14px;width:100%"></div></div>`
    ).join("");
  }

  /* ---------- warzone summary cards ---------- */

  function renderCards() {
    const container = document.getElementById("warzones");
    container.innerHTML = "";

    for (const wz of WARZONES) {
      const facA = opsFactionOf(wz.a);
      const facB = opsFactionOf(wz.b);

      const wzSystems = data.systems.filter(s => s.occupier_faction_id === wz.a || s.occupier_faction_id === wz.b);
      const heldA = wzSystems.filter(s => s.occupier_faction_id === wz.a).length;
      const heldB = wzSystems.length - heldA;
      const pctA = wzSystems.length ? (heldA / wzSystems.length) * 100 : 0;
      const pctB = wzSystems.length ? (heldB / wzSystems.length) * 100 : 0;
      const contestedN = wzSystems.filter(s => s.contested !== "uncontested").length;

      const card = document.createElement("div");
      card.className = "ops-card";
      card.innerHTML = `
        <div class="ops-wz-head">
          <span class="ops-wz-title">${facA.name.toUpperCase()} — ${facB.name.toUpperCase()}</span>
          <span class="ops-wz-count">${wzSystems.length} ${t("systems_held")}</span>
        </div>
        <div class="ops-frontbar">
          <div class="fb-a" style="width:${pctA.toFixed(1)}%;background:${facA.bar}"></div>
          <div class="fb-mid"></div>
          <div class="fb-b" style="width:${pctB.toFixed(1)}%;background:${facB.bar}"></div>
        </div>
        <div class="ops-wz-legend">
          <span style="color:${facA.color}">${facA.name.toUpperCase()} ${heldA}</span>
          <span style="color:var(--ops-dim)">${contestedN} ${t("contested_n")}</span>
          <span style="color:${facB.color}">${heldB} ${facB.name.toUpperCase()}</span>
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
  /* Node radius by status — matches the Ops Room design's 10/13/16px
     diamond diameters (stable/contested/critical). */
  const NODE_R_BY_STATUS = { stab: 5, cont: 6.5, crit: 8 };

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
    const nodes = ids.map(id => {
      const s = byId.get(id);
      const fac = opsFactionOf(s.occupier_faction_id);
      const enemy = opsFactionOf(enemyFactionOf(s.occupier_faction_id));
      const p = pct(s);
      const st = statusTag(p);
      const r = NODE_R_BY_STATUS[st.key];
      const sel = mapSel === id;
      const x = px(id).toFixed(1);
      const y = py(id).toFixed(1);
      const k = kills.get(id) || 0;
      const cls = classes.get(id) || "rearguard";
      const jmp = traffic.get(id) || 0;
      const adv = advantage?.get(id);
      const ins = insurgency?.bySystem.get(id);
      const tip = [
        sysName(id),
        sysRegion(id),
        t("class_" + cls),
        t("status_" + s.contested) + ` ${p.toFixed(1)}%`,
        `${t("th_kills1h")}: ${k}`,
        adv && adv.occ !== null ? `${t("th_adv")}: ${adv.occ}:${adv.enemy}` : null,
        ins ? `${pirateOf(ins.pirate).name} — ${t("ins_corruption")} ${ins.corrPct.toFixed(0)}% / ${t("ins_suppression")} ${ins.suppPct.toFixed(0)}%` : null,
        `${t("th_jumps")}: ${jmp}`
      ].filter(Boolean).join(" · ");
      const insRing = ins
        ? `<circle cx="${x}" cy="${y}" r="${r + 4}" data-r="${r + 4}" fill="none" stroke="${pirateOf(ins.pirate).color}" stroke-width="${ins.origin?.id === id ? 3 : 1.5}" stroke-opacity=".7"/>`
        : "";
      /* Glow ring: stable systems only glow when selected (occupier color);
         contested/critical always glow, in the enemy's color — brighter
         when selected. Approximates the design's box-shadow ring in SVG. */
      const glowColor = st.key === "stab" ? fac.color : enemy.color;
      const glowOpacity = st.key === "stab" ? (sel ? 0.3 : 0) : (sel ? 0.5 : 0.3);
      const glow = glowOpacity > 0
        ? `<circle cx="${x}" cy="${y}" r="${r + 3}" data-r="${r + 3}" fill="none" stroke="${glowColor}" stroke-width="3" stroke-opacity="${glowOpacity}"/>`
        : "";
      const fillPct = sel ? 60 : 28;
      return `<g class="ops-map-node${st.key === "crit" ? " critical" : ""}${sel ? " selected" : ""}" data-id="${id}">
        ${insRing}
        ${glow}
        <rect class="diamond" x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" transform="rotate(45 ${x} ${y})" data-r="${r}" data-cx="${x}" data-cy="${y}" style="fill:color-mix(in srgb, ${fac.color} ${fillPct}%, var(--ops-bg2));stroke:${fac.color};stroke-width:1.5"><title>${esc(tip)}</title></rect>
        <text x="${x}" y="${(Number(y) + r + 9).toFixed(1)}" class="ops-map-label ops-map-label-minor" text-anchor="middle">${esc(sysName(id))}</text>
      </g>`;
    }).join("");

    return `
        <svg viewBox="0 0 ${MAP_W} ${MAP_H}" role="img">
          <g class="ops-map-edges">${edges.join("")}</g>
          ${nodes}
        </svg>
        <div class="ops-map-controls">
          <button type="button" data-zoom="in" title="${t("map_zoom_in")}">+</button>
          <button type="button" data-zoom="out" title="${t("map_zoom_out")}">−</button>
          <button type="button" data-zoom="reset" title="${t("map_zoom_reset")}">⌂</button>
        </div>
    `;
  }

  /* Pan/zoom via viewBox: wheel zooms toward the cursor, drag pans,
     double click or the home button resets. Zoomed in, all labels show. */
  function bindMapInteractions(svg, startVb) {
    const base = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    let vb = startVb ? { ...startVb } : { ...base };
    const MIN_W = MAP_W / 10;

    function apply() {
      svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      mapViewBox = { ...vb };
      svg.classList.toggle("zoomed", base.w / vb.w >= 2);
      /* Counter-scale nodes, labels, and edges (damped via sqrt) so zooming
         magnifies distances, not symbols. */
      const f = Math.min(1, Math.max(0.3, Math.sqrt(vb.w / base.w)));
      svg.style.setProperty("--fk", f);
      svg.querySelectorAll("circle[data-r]").forEach(c => {
        c.setAttribute("r", (Number(c.dataset.r) * f).toFixed(2));
      });
      svg.querySelectorAll("rect[data-r]").forEach(rect => {
        const rr = Number(rect.dataset.r) * f;
        const cx = Number(rect.dataset.cx), cy = Number(rect.dataset.cy);
        rect.setAttribute("x", (cx - rr).toFixed(2));
        rect.setAttribute("y", (cy - rr).toFixed(2));
        rect.setAttribute("width", (rr * 2).toFixed(2));
        rect.setAttribute("height", (rr * 2).toFixed(2));
        rect.setAttribute("transform", `rotate(45 ${cx} ${cy})`);
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
      if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) > 5) dragged = true;
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
     * so a plain click listener never sees the node. Re-rendering the map
     * (to update the selection glow + side panel) would normally reset pan/
     * zoom, so the current viewBox is captured and restored on the fresh svg.
     */
    svg.addEventListener("pointerup", e => {
      const wasDragged = dragged;
      endDrag();
      if (wasDragged) return;
      const sys = document.elementFromPoint(e.clientX, e.clientY)?.closest(".ops-map-node");
      if (!sys) return;
      mapSel = Number(sys.dataset.id);
      renderMapTab();
    });

    svg.addEventListener("dblclick", () => { vb = { ...base }; apply(); });

    svg.parentElement.querySelectorAll(".ops-map-controls button").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.zoom;
        if (mode === "reset") { vb = { ...base }; apply(); return; }
        zoomAt(mode === "in" ? 0.75 : 1 / 0.75, vb.x + vb.w / 2, vb.y + vb.h / 2);
      });
    });

    apply();
  }

  const WZ_TABS = [
    { id: "cal-gal", label: "CALDARI — GALLENTE" },
    { id: "ama-min", label: "AMARR — MINMATAR" }
  ];

  function renderMapChips() {
    const container = document.getElementById("map-wz-chips");
    container.innerHTML = WZ_TABS.map(f => `
      <button class="ops-chip${mapWz === f.id ? " active" : ""}" data-id="${f.id}">${f.label}</button>
    `).join("");
    container.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        if (mapWz === btn.dataset.id) return;
        mapWz = btn.dataset.id;
        mapSel = null;
        mapViewBox = null;
        renderMapTab();
      });
    });
  }

  function renderMapDetail() {
    const el = document.getElementById("map-detail");
    if (!el) return;
    if (mapSel == null) {
      el.innerHTML = `<div class="ops-map-detail-hint">◈<br><br>${t("map_hint")}</div>`;
      return;
    }
    const s = data.systems.find(x => x.solar_system_id === mapSel);
    if (!s) { el.innerHTML = `<div class="ops-map-detail-hint">◈<br><br>${t("map_hint")}</div>`; return; }
    const fac = opsFactionOf(s.occupier_faction_id);
    const enemy = opsFactionOf(enemyFactionOf(s.occupier_faction_id));
    const p = pct(s);
    const st = statusTag(p);
    el.innerHTML = `
      <div>
        <div class="ops-map-detail-name">${esc(sysName(mapSel))}</div>
        <div class="ops-map-detail-region">${esc(sysRegion(mapSel))}</div>
      </div>
      <div class="ops-map-detail-tags">
        <span class="ops-status-tag" style="background:${st.bg};color:${st.color};border-color:${st.border}">${st.label}</span>
        <span style="font-size:11px;color:${fac.color}">${esc(fac.name)}</span>
      </div>
      <div class="ops-ext-links" style="margin-top:10px">
        <a class="ops-ext-link" href="${zkillUrl(mapSel)}" target="_blank" rel="noopener">zKillboard</a>
        <a class="ops-ext-link" href="${dotlanUrl(sysName(mapSel))}" target="_blank" rel="noopener">Dotlan</a>
      </div>
      <div class="ops-map-detail-vp">
        <div class="ops-map-detail-vp-row"><span>VICTORY POINTS</span><span style="color:${enemy.color}">${p.toFixed(1)}%</span></div>
        <div class="ops-map-detail-vp-track"><div class="ops-map-detail-vp-fill" style="width:${Math.min(100, p).toFixed(1)}%;background:${enemy.color}"></div></div>
      </div>
      <div class="ops-map-detail-activity">
        <div><div class="dl" style="color:var(--ops-dim);letter-spacing:.12em;font-size:8.5px;margin-bottom:3px;text-transform:uppercase">${t("det_activity")}</div><div style="color:var(--ops-text);font-size:12px">${fmtNum(kills.get(mapSel) || 0)} Kills · ${fmtNum(traffic.get(mapSel) || 0)} Jumps</div></div>
      </div>
      <div class="ops-map-detail-note">
        <div class="dl" style="color:var(--ops-dim);letter-spacing:.12em;font-size:8.5px;margin-bottom:4px;text-transform:uppercase">${t("det_note")}</div>
        <div style="color:var(--ops-dim2);font-size:10.5px;line-height:1.55">${esc(rowNote(s))}</div>
      </div>
    `;
  }

  function renderMapTab() {
    if (!data) return;
    if (!mapWz) mapWz = WARZONES[0].id;
    renderMapChips();
    renderMapDetail();
    const wz = WARZONES.find(w => w.id === mapWz);
    document.getElementById("map-frame").innerHTML = renderMap(wz);
    const svg = document.querySelector("#map-frame svg");
    if (svg) bindMapInteractions(svg, mapViewBox);
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
        <div class="ops-ins-card">
          <div class="ops-ins-head">${esc(pirate.name)}</div>
          <div class="ops-ins-body">
            ${t("ins_origin")}: <span class="strong">${esc(c.origin?.name ?? "?")}</span>
            · ${entries.length} ${t("ins_affected")}
            · ${t("ins_corruption")} 5/5: ${corrupted}
            · ${t("ins_suppression")} 5/5: ${suppressed}
          </div>
        </div>
      `;
    }).join("");
  }


  /* ---------- systems table ---------- */

  /* Status is derived purely from VP% (not ESI's contested/vulnerable enum)
     per the Ops Room design: >=85 critical, >=30 contested, else stable. */
  function statusTag(p) {
    if (p >= 85) return {
      key: "crit", label: t("st_critical"), color: "var(--ops-min)",
      bg: "color-mix(in srgb, var(--ops-min) 14%, transparent)", border: "color-mix(in srgb, var(--ops-min) 35%, transparent)"
    };
    if (p >= 30) return {
      key: "cont", label: t("st_contested"), color: "var(--ops-ama)",
      bg: "color-mix(in srgb, var(--ops-ama) 12%, transparent)", border: "color-mix(in srgb, var(--ops-ama) 35%, transparent)"
    };
    return {
      key: "stab", label: t("st_stable"), color: "var(--ops-dim2)",
      bg: "color-mix(in srgb, var(--ops-dim) 15%, transparent)", border: "var(--ops-line)"
    };
  }

  const openRows = new Set();

  /* Real advantage data is {occ, enemy} (0-100 each, from the war report);
     the Ops Room design shows a single signed net number instead. */
  function netAdvantage(id) {
    const a = advantage?.get(id);
    return a && a.occ !== null ? a.occ - a.enemy : null;
  }

  function fmtAdv(v) {
    return v === null ? "—" : (v > 0 ? "+" : "") + v;
  }

  /* Advantage colored by whichever side it favors: positive = occupier,
     negative = the enemy (attacker), zero/unknown = neutral. */
  function advColor(v, occColor, enemyColor) {
    if (v === null || v === 0) return "var(--ops-body)";
    return v > 0 ? occColor : enemyColor;
  }

  function visibleRows() {
    let rows = data.systems.filter(s => s.contested !== "uncontested");
    if (wzFilter !== "all") rows = rows.filter(s => warzoneOf(s.occupier_faction_id)?.id === wzFilter);

    const withMeta = rows.map(s => {
      const p = pct(s);
      return {
        s,
        pct: p,
        kills: kills.get(s.solar_system_id) || 0,
        jmp: traffic.get(s.solar_system_id) || 0,
        delta: delta24h(s.solar_system_id, p, s.occupier_faction_id),
        adv: netAdvantage(s.solar_system_id)
      };
    });

    const deltaRank = d => d === "flip" ? 1e9 : (typeof d === "number" ? Math.abs(d) : -1);
    const cmp = {
      system: (a, b) => sysName(a.s.solar_system_id).localeCompare(sysName(b.s.solar_system_id)),
      region: (a, b) => sysRegion(a.s.solar_system_id).localeCompare(sysRegion(b.s.solar_system_id)),
      occ: (a, b) => factionOf(a.s.occupier_faction_id).name.localeCompare(factionOf(b.s.occupier_faction_id).name),
      delta: (a, b) => deltaRank(a.delta) - deltaRank(b.delta),
      adv: (a, b) => (a.adv ?? -999) - (b.adv ?? -999),
      kills: (a, b) => a.kills - b.kills,
      jumps: (a, b) => a.jmp - b.jmp,
      vp: (a, b) => a.pct - b.pct
    }[sortKey] || ((a, b) => a.pct - b.pct);

    withMeta.sort((a, b) => sortDir === "asc" ? cmp(a, b) : -cmp(a, b));
    return withMeta.slice(0, CONFIG.CONTESTED_ROWS);
  }

  const WZ_FILTERS = [
    { id: "all", labelKey: "wz_all" },
    { id: "cal-gal", label: "CAL/GAL" },
    { id: "ama-min", label: "AMA/MIN" }
  ];

  function renderFilterChips() {
    const container = document.getElementById("wz-filter-chips");
    container.innerHTML = WZ_FILTERS.map(f => `
      <button class="ops-chip${wzFilter === f.id ? " active" : ""}" data-id="${f.id}">${f.labelKey ? t(f.labelKey) : f.label}</button>
    `).join("");
    container.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => { wzFilter = btn.dataset.id; renderTable(); });
    });
  }

  /* key === sortKey's own key normally, but the STATUS column sorts by VP
     without ever showing itself as the active/arrowed column (design spec). */
  const TABLE_COLS = () => [
    { key: "system", label: t("th_system"), cls: "c-system" },
    { key: "region", label: t("th_region"), cls: "c-region" },
    { key: "occ", label: t("th_occupier"), cls: "c-occ" },
    { key: "vp", label: t("th_status"), cls: "c-status", noActive: true },
    { key: "vp", label: t("th_vp").replace(" ", "\n"), cls: "c-vp" },
    { key: "delta", label: t("th_delta"), cls: "c-delta" },
    { key: "adv", label: t("th_adv_short"), cls: "c-adv" },
    { key: "kills", label: t("th_kills1h").replace(" ", "\n"), cls: "c-kills" },
    { key: "jumps", label: t("th_jumps"), cls: "c-jumps" }
  ];

  function renderTableHead() {
    const head = document.getElementById("contested-head");
    head.innerHTML = TABLE_COLS().map(c => {
      const active = !c.noActive && c.key === sortKey;
      const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
      return `<button class="${c.cls}${active ? " active" : ""}" data-key="${c.key}">${esc(c.label)} ${arrow}</button>`;
    }).join("");
    head.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        /* New column: name/region default ascending (A-Z), everything else
           starts high-to-low. Same column again: flip direction. */
        sortDir = (key === sortKey) ? (sortDir === "asc" ? "desc" : "asc") : (key === "system" || key === "region") ? "asc" : "desc";
        sortKey = key;
        renderTable();
      });
    });
  }

  function rowDetailHtml(s, netAdv, delta) {
    const id = s.solar_system_id;
    const fac = opsFactionOf(s.occupier_faction_id);
    const enemy = opsFactionOf(enemyFactionOf(s.occupier_faction_id));
    let deltaTxt = "—";
    if (delta === "flip") deltaTxt = t("delta_flip");
    else if (typeof delta === "number") deltaTxt = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% / 24h`;
    return `
      <div class="ops-detail">
        <div><div class="dl">${t("th_occupier")}</div><div class="dv" style="color:${fac.color}">${esc(fac.name)}</div></div>
        <div><div class="dl">${t("th_adv")}</div><div class="dv" style="color:${advColor(netAdv, fac.color, enemy.color)}">${fmtAdv(netAdv)}</div></div>
        <div><div class="dl">${t("det_activity")}</div><div class="dv">${fmtNum(kills.get(id) || 0)} Kills · ${fmtNum(traffic.get(id) || 0)} Jumps</div></div>
        <div><div class="dl">${t("det_trend_short")}</div><div class="dv">${deltaTxt}</div></div>
        <div style="flex:1;min-width:200px"><div class="dl">${t("det_note")}</div><div class="dv" style="color:var(--ops-dim2);font-size:11px;line-height:1.5">${esc(rowNote(s))}</div></div>
      </div>
    `;
  }

  /* Short auto-generated situation line — the design mock uses free text here;
     ours is derived from what we already know about the system. */
  function rowNote(s) {
    const cls = classes.get(s.solar_system_id) || "rearguard";
    return `${t("class_" + cls)} · ${t("status_" + s.contested)}`;
  }

  function renderTable() {
    renderFilterChips();
    renderTableHead();

    const body = document.getElementById("contested-body");
    body.innerHTML = "";

    const rows = visibleRows();
    if (rows.length === 0) {
      body.innerHTML = `<div class="ops-row" style="cursor:default">${t("contested_none")}</div>`;
      return;
    }

    for (const { s, pct: p, kills: k, jmp, delta, adv: netAdv } of rows) {
      const id = s.solar_system_id;
      const fac = opsFactionOf(s.occupier_faction_id);
      const enemy = opsFactionOf(enemyFactionOf(s.occupier_faction_id));
      const st = statusTag(p);
      /* Delta color: enemy's color while contested% is rising (bad for the
         occupier), dim otherwise — not a fixed red/green scale. */
      let deltaTxt = "—", deltaColor = "var(--ops-dim)";
      if (delta === "flip") { deltaTxt = t("delta_flip"); deltaColor = enemy.color; }
      else if (typeof delta === "number" && delta > 0) { deltaTxt = `▲ ${delta.toFixed(1)}%`; deltaColor = enemy.color; }
      else if (typeof delta === "number" && delta < 0) { deltaTxt = `▼ ${Math.abs(delta).toFixed(1)}%`; }

      const row = document.createElement("div");
      row.className = "ops-row" + (st.key === "crit" ? " critical" : "");
      row.innerHTML = `
        <span class="c-system">
          <span class="sys-name">${esc(sysName(id))}</span>
          <a class="ops-ext-icon" href="${zkillUrl(id)}" target="_blank" rel="noopener" title="zKillboard">ZKB</a>
          <a class="ops-ext-icon" href="${dotlanUrl(sysName(id))}" target="_blank" rel="noopener" title="Dotlan">DTL</a>
        </span>
        <span class="c-region">${esc(sysRegion(id))}</span>
        <span class="c-occ" style="color:${fac.color}">${esc(fac.key[0].toUpperCase() + fac.key.slice(1))}</span>
        <span class="c-status"><span class="ops-status-tag" style="background:${st.bg};color:${st.color};border-color:${st.border}">${st.label}</span></span>
        <span class="c-vp" style="color:${enemy.color}">${p.toFixed(1)}%</span>
        <span class="c-delta" style="color:${deltaColor}">${deltaTxt}</span>
        <span class="c-adv" style="color:${advColor(netAdv, fac.color, enemy.color)}">${fmtAdv(netAdv)}</span>
        <span class="c-kills">${fmtNum(k)}</span>
        <span class="c-jumps">${fmtNum(jmp)}</span>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.closest(".ops-ext-icon")) return;
        openRows.has(id) ? openRows.delete(id) : openRows.add(id);
        renderTable();
      });
      body.appendChild(row);
      if (openRows.has(id)) body.insertAdjacentHTML("beforeend", rowDetailHtml(s, netAdv, delta));
    }
  }

  /* ---------- recent system changes (last 48h) ---------- */

  function renderChangesPanel() {
    const list = document.getElementById("changes-list");
    if (!list) return;
    const cutoff = Date.now() / 1000 - 48 * 3600;
    const recent = histFlips.filter(f => f.t >= cutoff).sort((a, b) => b.t - a.t).slice(0, 8);
    if (recent.length === 0) {
      list.innerHTML = `<div class="ops-changes-empty">${t("flips_none")}</div>`;
      return;
    }
    list.innerHTML = recent.map(f => {
      const from = opsFactionOf(f.from);
      const to = opsFactionOf(f.to);
      const time = fmtDate(new Date(f.t * 1000), { hour: "2-digit", minute: "2-digit" });
      return `
        <div class="ops-changes-row">
          <span style="flex:0 0 44px;color:var(--ops-dim)">${time}</span>
          <span style="flex:1;color:var(--ops-text)">${esc(sysName(f.id))}</span>
          <span style="color:${from.color}">${from.key.slice(0, 3).toUpperCase()}</span>
          <span style="color:var(--ops-dim)">▶</span>
          <span style="color:${to.color}">${to.key.slice(0, 3).toUpperCase()}</span>
        </div>
      `;
    }).join("");
  }

  function render() {
    if (!data) return;
    renderCards();
    renderInsurgencies();
    renderTable();
    renderChangesPanel();
  }

  return [
    { load, render, skeleton },
    { load, render: renderMapTab }
  ];
})();
