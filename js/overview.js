/* Overview ("Lage") view: where the front runs in both warzones and which
   systems are about to change sides.

   Redrawn 9.10.2026 around one picture: each warzone as CCP's schematic map
   (SDE position2D and stargates), every system a dot in its holder's colour,
   every gate between the two sides marked as the front, and a ring around
   each contested system that fills as far as the attacker has got. Colour
   means faction and nothing else; "critical" is said by the ring and the
   name next to it, not by a red that would read as Minmatar.

   Reads its data through FwData, the facade the Warzones/Map views expose,
   so opening this tab reuses their fetch instead of issuing a second round
   of ESI requests.
   Depends on config.js, i18n.js, fwlogic.js, warzones.js (FwData). */
"use strict";

const OverviewView = (() => {
  const CRIT_ROWS = 8;
  const CRIT_MIN = 30;        // % attacker progress to count as contested
  const FLIP_ROWS = 6;
  const FLIP_WINDOW_H = 48;

  /* Map units. Height is fixed, width follows the warzone's own shape, so
     both maps share a height and keep CCP's proportions. */
  const MAP_H = 600;
  const PAD = 26;
  const MIN_GAP = 24;         // dots closer than this are nudged apart
  /* A contested system needs room for its ring: two rings stay this far
     apart, a ring and a dot RING_GAP/2 + MIN_GAP/2. Without it the dense
     knot around Klogori and Ontorn drew rings over each other. */
  const RING_GAP = 38;
  const DOT_R = 6;
  const RING_R = 12;
  const TICK = 7;             // half length of a front mark, in screen px

  let animated = false;       // the rings fill once per page load, not on every refresh

  async function load() {
    await FwData.load();
  }

  function skeleton() {
    document.getElementById("ov-warzones").innerHTML = WARZONES.map(() => `
      <figure class="wz"><div class="skel-fill" style="height:min(60vh,480px)"></div></figure>`).join("");
    document.getElementById("ov-criticals").innerHTML =
      `<div class="skel-fill" style="height:33rem;margin-top:0.75rem"></div>`;
  }

  /* ---------- helpers ---------- */

  const shortName = facId => factionOf(facId).name.split(" ")[0];

  function fmtPct(p) {
    const s = p.toLocaleString(LANG === "de" ? "de-DE" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return LANG === "de" ? `${s} %` : `${s}%`;
  }

  function fmtDelta(d) {
    const s = Math.abs(d).toLocaleString(LANG === "de" ? "de-DE" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return (d > 0 ? "+" : d < 0 ? "−" : "") + s;
  }

  function agoLabel(seconds) {
    const h = Math.max(1, Math.floor(seconds / 3600));
    const d = Math.floor(h / 24);
    const n = LANG === "de"
      ? (d >= 1 ? `${d} ${d === 1 ? "Tag" : "Tagen"}` : `${h} Std.`)
      : (d >= 1 ? `${d} d` : `${h} h`);
    return t("ov_ago").replace("{n}", n);
  }

  const fill = (key, vals) => Object.entries(vals).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(key));

  /* ---------- the front, drawn ---------- */

  function layout(ids, ringed) {
    const xs = ids.map(id => SDATA.fw[id].x);
    const ys = ids.map(id => SDATA.fw[id].y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = (MAP_H - 2 * PAD) / ((maxY - minY) || 1);
    const W = Math.round((maxX - minX) * scale + 2 * PAD);
    /* position2D like the in-game 2D map: x east, y north (screen up). */
    const pos = new Map(ids.map(id => [id, {
      x: PAD + (SDATA.fw[id].x - minX) * scale,
      y: MAP_H - PAD - (SDATA.fw[id].y - minY) * scale
    }]));
    for (let iter = 0; iter < 120; iter++) {
      let moved = false;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos.get(ids[i]), b = pos.get(ids[j]);
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < 0.01) { dx = 1; dy = 0; d = 1; }
          const gap = ((ringed.has(ids[i]) ? RING_GAP : MIN_GAP) + (ringed.has(ids[j]) ? RING_GAP : MIN_GAP)) / 2;
          if (d < gap) {
            const push = (gap - d) / 2;
            a.x -= dx / d * push; a.y -= dy / d * push;
            b.x += dx / d * push; b.y += dy / d * push;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    for (const p of pos.values()) {
      p.x = Math.min(W - PAD / 2, Math.max(PAD / 2, p.x));
      p.y = Math.min(MAP_H - PAD / 2, Math.max(PAD / 2, p.y));
    }
    return { pos, W };
  }

  function frontMap(wz) {
    const systems = FwData.systems();
    const classes = FwData.classes();
    const kills = FwData.kills();
    const byId = new Map(systems.map(s => [s.solar_system_id, s]));
    const ids = systems
      .filter(s => (s.occupier_faction_id === wz.a || s.occupier_faction_id === wz.b) && SDATA.fw[s.solar_system_id]?.x != null)
      .map(s => s.solar_system_id);
    if (!ids.length) return "";

    const ringed = new Set(ids.filter(id => byId.get(id).contested !== "uncontested" && FwData.pct(byId.get(id)) >= CRIT_MIN));
    const { pos, W } = layout(ids, ringed);
    const inZone = new Set(ids);
    const occ = id => byId.get(id).occupier_faction_id;
    const f1 = v => v.toFixed(1);

    const gates = [], marks = [];
    const seen = new Set();
    for (const id of ids) {
      for (const n of FwLogic.fwNeighbors.get(id) || []) {
        if (!inZone.has(n)) continue;
        const key = id < n ? `${id}-${n}` : `${n}-${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pos.get(id), b = pos.get(n);
        const hostile = occ(id) !== occ(n);
        gates.push(`<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}"/>`);
        if (hostile) {
          /* The front: a short bar across the gate, halfway between. */
          /* Drawn at the origin and scaled by --u in css, so the mark has
             the same length on screen however large the map is. */
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          marks.push(`<g transform="translate(${f1(mx)} ${f1(my)}) rotate(${f1(deg)})"><line x1="0" y1="-${TICK}" x2="0" y2="${TICK}"/></g>`);
        }
      }
    }

    const contested = [];
    const dots = ids.map(id => {
      const s = byId.get(id);
      const p = FwData.pct(s);
      const holder = factionOf(s.occupier_faction_id);
      const { x, y } = pos.get(id);
      const tip = `${FwData.sysName(id)}, ${FwData.sysRegion(id)}: ${holder.name}` + (p > 0 ? `, ${fmtPct(p)}` : "");
      let ring = "";
      if (s.contested !== "uncontested" && p >= CRIT_MIN) {
        const att = factionOf(enemyFactionOf(s.occupier_faction_id));
        contested.push({ id, p, x, y });
        ring = `
          <circle class="ring-bed" cx="${f1(x)}" cy="${f1(y)}" r="${RING_R}"/>
          <circle class="ring-arc${animated ? "" : " ring-in"}" cx="${f1(x)}" cy="${f1(y)}" r="${RING_R}" pathLength="100"
            stroke-dasharray="${f1(Math.min(100, p))} 100" transform="rotate(-90 ${f1(x)} ${f1(y)})" style="stroke:${att.color}"/>`;
      }
      return `<g>${ring}<circle class="dot" cx="${f1(x)}" cy="${f1(y)}" r="${DOT_R}" style="fill:${holder.color}"><title>${esc(tip)}</title></circle></g>`;
    }).join("");

    /* Names in HTML, positioned in percent, so they keep their size on a
       phone where the map shrinks to a third. Only the contested ones. */
    const labels = contested.map(({ id, p, x, y }) => {
      const right = x / W < 0.62;
      return `<span class="wz-name${p >= 85 ? " is-crit" : ""}" data-p="${p.toFixed(1)}" data-side="${right ? "r" : "l"}" style="left:${(x / W * 100).toFixed(2)}%;top:${(y / MAP_H * 100).toFixed(2)}%">${esc(FwData.sysName(id))}</span>`;
    }).join("");

    const a = ids.filter(id => occ(id) === wz.a).length;
    const b = ids.length - a;
    const front = ids.filter(id => classes?.get(id) === "frontline").length;
    const contestedN = ids.filter(id => byId.get(id).contested !== "uncontested").length;
    /* Held systems against the snapshot from a day ago; only changes are named. */
    const changes = [[wz.a, a], [wz.b, b]].map(([f, now]) => {
      const then = FwData.heldDayAgo(f);
      return then === null ? null : [f, now - then];
    });
    const since = changes.some(c => c === null) ? ""
      : changes.every(([, d]) => d === 0) ? ` ${esc(t("ov_no_change"))}`
      : ` ${esc(t("ov_since_yesterday"))}: ${changes.filter(([, d]) => d !== 0)
          .map(([f, d]) => `${esc(shortName(f))} <span class="num">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>`).join(", ")}.`;
    const killsH = ids.reduce((sum, id) => sum + (kills.get(id) || 0), 0);
    const pilots = [wz.a, wz.b].reduce((sum, f) => sum + (FwData.stats().find(x => x.faction_id === f)?.pilots || 0), 0);
    const label = fill("ov_map_label", { a: shortName(wz.a), b: shortName(wz.b), na: a, nb: b, g: marks.length });

    return `
      <figure class="wz" style="--w:${W};flex-grow:${(W / MAP_H).toFixed(3)}">
        <figcaption>
          <h2>${esc(shortName(wz.a))} ${esc(t("ov_vs"))} ${esc(shortName(wz.b))}</h2>
          <p class="wz-key">
            <span style="--c:${factionOf(wz.a).color}"><i></i>${esc(shortName(wz.a))} <b class="num">${fmtNum(a)}</b></span>
            <span style="--c:${factionOf(wz.b).color}"><i></i>${esc(shortName(wz.b))} <b class="num">${fmtNum(b)}</b></span>
          </p>
        </figcaption>
        <div class="wz-map" style="aspect-ratio:${W} / ${MAP_H}">
          <svg viewBox="0 0 ${W} ${MAP_H}" role="img" aria-label="${esc(label)}">
            <g class="gates">${gates.join("")}</g>
            <g class="front-halo">${marks.join("")}</g>
            <g class="front">${marks.join("")}</g>
            ${dots}
          </svg>
          ${labels}
        </div>
        <p class="wz-foot"><span class="num">${fmtNum(front)}</span> ${esc(t("ov_n_front"))}, <span class="num">${fmtNum(contestedN)}</span> ${esc(t("ov_n_contested"))}, <span class="num">${fmtNum(killsH)}</span> ${esc(t("ov_n_kills"))}, <span class="num">${fmtNum(pilots)}</span> ${esc(t("ov_n_pilots"))}.${since}</p>
        <p class="wz-open"><a href="${localPath("/map/")}?wz=${wz.id}">${esc(t("ov_open_map"))}</a></p>
      </figure>`;
  }

  function renderWarzones() {
    document.getElementById("ov-warzones").innerHTML = WARZONES.map(frontMap).join("");
    placeNames();
  }

  /* Names go where they fit at the size the map is actually drawn: the most
     advanced attack first, each tried in eight places around its ring; no
     name may cover another name, a dot or a ring. A critical name that fits
     nowhere still shows, on a ground-coloured plate; any other stays out
     (the table lists it anyway). Runs again when the maps change size. */
  const G = 14;   // px from the dot's centre to the name
  const SPOTS = {  // [dx px, dy px, share of own width, share of own height]
    r: [G, 0, 0, -0.5], l: [-G, 0, -1, -0.5],
    t: [0, -G + 2, -0.5, -1], b: [0, G - 2, -0.5, 0],
    rt: [G - 4, -G + 4, 0, -1], rb: [G - 4, G - 4, 0, 0],
    lt: [-G + 4, -G + 4, -1, -1], lb: [-G + 4, G - 4, -1, 0]
  };
  function spot(el, key) {
    const [dx, dy, ax, ay] = SPOTS[key];
    el.style.transform = `translate(calc(${ax * 100}% + ${dx}px), calc(${ay * 100}% + ${dy}px))`;
  }
  function placeNames() {
    for (const map of document.querySelectorAll("#ov-warzones .wz-map")) {
      const frame = map.getBoundingClientRect();
      if (!frame.height) continue;
      map.style.setProperty("--u", (MAP_H / frame.height).toFixed(3));
      const placed = [];
      const names = [...map.querySelectorAll(".wz-name")].sort((a, b) => b.dataset.p - a.dataset.p);
      const marks = [...map.querySelectorAll(".dot, .ring-bed")].map(d => d.getBoundingClientRect());
      for (const el of names) {
        el.hidden = false;
        el.classList.remove("plate");
        const order = el.dataset.side === "r"
          ? ["r", "rt", "rb", "l", "lt", "lb", "t", "b"]
          : ["l", "lt", "lb", "r", "rt", "rb", "t", "b"];
        let ok = false;
        for (const key of order) {
          spot(el, key);
          const r = el.getBoundingClientRect();
          const box = { l: r.left - 2, r: r.right + 2, t: r.top - 1, b: r.bottom + 1 };
          const hits = o => box.l < o.right && box.r > o.left && box.t < o.bottom && box.b > o.top;
          if (box.l < frame.left || box.r > frame.right || box.t < frame.top - 4) continue;
          if (placed.some(hits) || marks.some(hits)) continue;
          placed.push(r);
          ok = true;
          break;
        }
        if (ok) continue;
        if (el.classList.contains("is-crit")) {
          /* First spot that clears the other names, on a plate. */
          el.classList.add("plate");
          const key = order.find(k => {
            spot(el, k);
            const r = el.getBoundingClientRect();
            return r.left >= frame.left && r.right <= frame.right &&
              !placed.some(o => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top);
          }) || order[0];
          spot(el, key);
          placed.push(el.getBoundingClientRect());
        } else el.hidden = true;
      }
    }
  }
  let resizeTimer = null;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(placeNames, 80);
  }).observe(document.getElementById("ov-warzones"));

  /* ---------- systems closest to flipping ---------- */

  function renderCriticals() {
    const rows = FwData.systems()
      .filter(s => s.contested !== "uncontested")
      .map(s => ({ s, p: FwData.pct(s) }))
      .filter(x => x.p >= CRIT_MIN)
      .sort((a, b) => b.p - a.p)
      .slice(0, CRIT_ROWS);

    const body = document.getElementById("ov-criticals");
    if (rows.length === 0) {
      body.innerHTML = `<p class="ov-empty">${esc(t("ov_crit_none"))}</p>`;
      return;
    }

    body.innerHTML = `
      <table class="crit">
        <thead><tr>
          <th scope="col">${esc(t("ov_col_sys"))}</th>
          <th scope="col">${esc(t("ov_col_att"))}</th>
          <th scope="col" class="r">${esc(t("ov_col_prog"))}</th>
          <th scope="col" class="r">${esc(t("ov_col_24"))}</th>
        </tr></thead>
        <tbody>${rows.map(({ s, p }) => {
          const id = s.solar_system_id;
          const att = enemyFactionOf(s.occupier_faction_id);
          const delta = FwData.delta24h(id, p, s.occupier_faction_id);
          const d = delta === "flip" ? esc(t("delta_flip")) : typeof delta === "number" ? fmtDelta(delta) : "";
          return `<tr${p >= 85 ? ' class="is-crit"' : ""}>
            <th scope="row"><span class="sys">${esc(FwData.sysName(id))}</span><span class="reg">${esc(FwData.sysRegion(id))}</span></th>
            <td><span class="fac" style="--c:${factionOf(att).color}"><i></i>${esc(shortName(att))}</span></td>
            <td class="r"><span class="meter" style="--c:${factionOf(att).color}"><span style="width:${Math.min(100, p).toFixed(1)}%"></span></span><span class="num">${fmtPct(p)}</span></td>
            <td class="r num d">${d}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;
  }

  /* ---------- recent flips ---------- */

  function renderFlips() {
    const now = Date.now() / 1000;
    const recent = FwData.flips()
      .filter(f => f.t >= now - FLIP_WINDOW_H * 3600)
      .sort((a, b) => b.t - a.t)
      .slice(0, FLIP_ROWS);

    const body = document.getElementById("ov-flips");
    if (recent.length === 0) {
      body.innerHTML = `<p class="ov-empty">${esc(t("ov_flips_none"))}</p>`;
      return;
    }
    body.innerHTML = `<ul class="flips">${recent.map(f => `
      <li>
        <span class="sys">${esc(FwData.sysName(f.id))}</span>
        <span class="fac" style="--c:${factionOf(f.to).color}"><i></i>${esc(shortName(f.to))}</span>
        <span class="prev">${esc(t("ov_flip_prev"))} ${esc(shortName(f.from))}</span>
        <span class="ago">${esc(agoLabel(now - f.t))}</span>
      </li>`).join("")}</ul>`;
  }

  /* ---------- insurgencies ---------- */

  function renderInsurgencies() {
    const ins = FwData.insurgency();
    const panel = document.getElementById("ov-ins-panel");
    if (!ins || ins.campaigns.length === 0) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");

    document.getElementById("ov-insurgencies").innerHTML = ins.campaigns.map(c => {
      const entries = Object.values(c.systems || {});
      /* Corruption and suppression run 0-5 per system; the number is how far
         the whole campaign has pushed each, averaged over its systems. */
      const avg = idx => entries.length
        ? entries.reduce((sum, v) => sum + (v[idx] || 0), 0) / entries.length / 5 * 100
        : 0;
      const started = c.started ? fmtDate(new Date(c.started), { day: "2-digit", month: "2-digit" }) : "?";
      const line = fill("ov_ins_line", {
        pirate: esc(pirateOf(c.pirate).name), date: esc(started),
        origin: esc(c.origin?.name ?? "?"), n: entries.length
      });
      return `
        <p class="ins-line">${line}</p>
        <div class="ins-bars">
          ${[[t("ins_corruption"), avg(0)], [t("ins_suppression"), avg(2)]].map(([k, v]) => `
            <div>
              <span>${esc(k)}</span><span class="num">${v.toFixed(0)}${LANG === "de" ? " %" : "%"}</span>
              <span class="meter" style="--c:var(--pir)"><span style="width:${v.toFixed(1)}%"></span></span>
            </div>`).join("")}
        </div>`;
    }).join("");
  }

  function render() {
    if (!FwData.systems().length) return;
    renderWarzones();
    renderCriticals();
    renderFlips();
    renderInsurgencies();
    animated = true;
  }

  return { load, render, skeleton };
})();
