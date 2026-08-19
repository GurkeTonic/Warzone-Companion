/* Overview ("Lage") view: both warzones on one screen — front line per
   warzone with the headline numbers, the systems closest to flipping, the
   most recent flips, and any running pirate insurgency.

   Reads its data through FwData, the facade the Warzones/Map views expose,
   so opening this tab reuses their fetch instead of issuing a second round
   of ESI requests.
   Depends on config.js, i18n.js, warzones.js (FwData). */
"use strict";

const OverviewView = (() => {
  /* A system is "critical" once the attacker is close enough to flipping it
     that it is worth showing here; same threshold the systems table tints on. */
  const CRIT_ROWS = 8;
  const FLIP_ROWS = 8;
  const FLIP_WINDOW_H = 48;

  async function load() {
    await FwData.load();
  }

  function skeleton() {
    document.getElementById("ov-warzones").innerHTML = Array.from({ length: 2 }, () => `
      <section class="panel panel-pad">
        <div class="skel-fill" style="height:17px;width:55%;margin-bottom:16px"></div>
        <div class="skel-fill" style="height:22px;margin-bottom:9px"></div>
        <div class="skel-fill" style="height:12px;width:70%"></div>
      </section>`).join("");
    document.getElementById("ov-criticals").innerHTML = Array.from({ length: 6 }, () =>
      `<div class="row-btn"><span class="skel-fill" style="height:26px;width:100%"></span></div>`).join("");
  }

  /* ---------- warzone cards ---------- */

  function statsFor(facId) {
    return FwData.stats().find(x => x.faction_id === facId) || {};
  }

  function renderWarzones() {
    const systems = FwData.systems();
    const classes = FwData.classes();
    const kills = FwData.kills();

    document.getElementById("ov-warzones").innerHTML = WARZONES.map(wz => {
      const facA = factionOf(wz.a);
      const facB = factionOf(wz.b);
      const inZone = systems.filter(s => s.occupier_faction_id === wz.a || s.occupier_faction_id === wz.b);
      const a = inZone.filter(s => s.occupier_faction_id === wz.a).length;
      const b = inZone.filter(s => s.occupier_faction_id === wz.b).length;
      const total = a + b;

      const frontlines = inZone.filter(s => classes?.get(s.solar_system_id) === "frontline").length;
      const killsH = inZone.reduce((sum, s) => sum + (kills.get(s.solar_system_id) || 0), 0);
      const pilots = (statsFor(wz.a).pilots || 0) + (statsFor(wz.b).pilots || 0);

      const stats = [
        { k: t("ov_stat_frontlines"), v: fmtNum(frontlines), color: "var(--txt)" },
        { k: t("ov_stat_kills"), v: fmtNum(killsH), color: killsH > 0 ? "var(--crit)" : "var(--txt)" },
        { k: t("ov_stat_pilots"), v: fmtNum(pilots), color: "var(--txt)" }
      ];

      return `
        <section class="panel panel-pad wz-card">
          <div class="wz-card-head">
            <h2>${esc(facA.name)} — ${esc(facB.name)}</h2>
            <span class="wz-card-total">${fmtNum(total)} ${esc(t("systems_held"))}</span>
          </div>
          <div class="frontbar">
            <span class="seg-a" style="width:${total ? (a / total * 100).toFixed(1) : 50}%;background:${facA.color}"></span>
            <span class="seg-gap"></span>
            <span class="seg-b" style="width:${total ? (b / total * 100).toFixed(1) : 50}%;background:${facB.color}"></span>
          </div>
          <div class="frontbar-legend">
            <span style="color:${facA.color}">${esc(facA.short)} · ${fmtNum(a)}</span>
            <span style="color:${facB.color}">${fmtNum(b)} · ${esc(facB.short)}</span>
          </div>
          <div class="stats stats-3">
            ${stats.map(x => `<div><div class="stat-k">${esc(x.k)}</div><div class="stat-v" style="color:${x.color}">${x.v}</div></div>`).join("")}
          </div>
        </section>`;
    }).join("");
  }

  /* ---------- systems closest to flipping ---------- */

  function renderCriticals() {
    const rows = FwData.systems()
      .filter(s => s.contested !== "uncontested")
      .map(s => ({ s, pct: FwData.pct(s) }))
      .filter(x => x.pct >= 30)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, CRIT_ROWS);

    document.getElementById("ov-crit-count").textContent = rows.length ? `${rows.length}` : "";
    const body = document.getElementById("ov-criticals");

    if (rows.length === 0) {
      body.innerHTML = `<div class="row-btn">${t("ov_crit_none")}</div>`;
      return;
    }

    body.innerHTML = rows.map(({ s, pct: p }) => {
      const id = s.solar_system_id;
      const enemy = factionOf(enemyFactionOf(s.occupier_faction_id));
      const st = FwData.statusTag(p);
      const delta = FwData.delta24h(id, p, s.occupier_faction_id);
      let deltaTxt = "", deltaColor = "var(--dim)";
      if (delta === "flip") { deltaTxt = t("delta_flip"); deltaColor = enemy.color; }
      else if (typeof delta === "number" && delta > 0) { deltaTxt = `▲ ${delta.toFixed(1)}%`; deltaColor = enemy.color; }
      else if (typeof delta === "number" && delta < 0) { deltaTxt = `▼ ${Math.abs(delta).toFixed(1)}%`; }

      return `
        <a class="row-btn" href="/map/">
          <span class="row-accent" style="background:${st.color}"></span>
          <span class="row-main">
            <span class="row-name">${esc(FwData.sysName(id))}</span>
            <span class="row-meta">${esc(FwData.sysRegion(id))} · ${esc(st.label)}</span>
          </span>
          <span class="row-num">
            <b style="color:${st.color}">${p.toFixed(1)}%</b>
            <span style="color:${deltaColor}">${deltaTxt}</span>
          </span>
          <span class="bar" style="flex:0 0 62px"><span style="width:${Math.min(100, p).toFixed(1)}%;background:${st.color}"></span></span>
        </a>`;
    }).join("");
  }

  /* ---------- recent flips ---------- */

  function agoLabel(seconds) {
    const h = Math.floor(seconds / 3600);
    return h >= 24 ? `${Math.floor(h / 24)}${t("ago_d")}` : `${h}${t("ago_h")}`;
  }

  function renderFlips() {
    const cutoff = Date.now() / 1000 - FLIP_WINDOW_H * 3600;
    const recent = FwData.flips()
      .filter(f => f.t >= cutoff)
      .sort((a, b) => b.t - a.t)
      .slice(0, FLIP_ROWS);

    const body = document.getElementById("ov-flips");
    if (recent.length === 0) {
      body.innerHTML = `<div class="flip-row">${t("ov_flips_none")}</div>`;
      return;
    }

    body.innerHTML = recent.map(f => {
      const from = factionOf(f.from);
      const to = factionOf(f.to);
      return `
        <div class="flip-row">
          <span class="flip-ago">${agoLabel(Date.now() / 1000 - f.t)}</span>
          <span class="flip-sys">${esc(FwData.sysName(f.id))}</span>
          <span class="flip-move">
            <span class="flip-from" style="color:${from.color}">${esc(from.short)}</span>
            <span class="flip-arrow">→</span>
            <span style="color:${to.color}">${esc(to.short)}</span>
          </span>
        </div>`;
    }).join("");
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
      const pirate = pirateOf(c.pirate);
      const entries = Object.values(c.systems || {});
      /* Corruption and suppression run 0-5 per system; the headline number is
         how far the whole campaign has pushed each, averaged over its systems. */
      const avg = idx => entries.length
        ? entries.reduce((sum, v) => sum + (v[idx] || 0), 0) / entries.length / 5 * 100
        : 0;
      const bars = [
        { k: t("ins_corruption"), v: avg(0) },
        { k: t("ins_suppression"), v: avg(2) }
      ];
      const started = c.started ? fmtDate(new Date(c.started), { day: "2-digit", month: "2-digit" }) : "";

      return `
        <div class="ins-row">
          <div class="ins-head">
            <span class="ins-name">${esc(pirate.name)}</span>
            <span class="ins-since">${esc(started)}</span>
          </div>
          <div class="ins-origin">${t("ins_origin")} ${esc(c.origin?.name ?? "?")} · ${entries.length} ${t("ins_affected")}</div>
          <div class="ins-bars">
            ${bars.map(b => `
              <div>
                <div class="ins-bar-k"><span>${esc(b.k)}</span><b>${b.v.toFixed(0)}%</b></div>
                <div class="bar bar-4"><span style="width:${b.v.toFixed(1)}%;background:var(--pir)"></span></div>
              </div>`).join("")}
          </div>
        </div>`;
    }).join("");
  }

  function render() {
    if (!FwData.systems().length) return;
    App.renderFrontStrip(FwData.frontStripRows());
    renderWarzones();
    renderCriticals();
    renderFlips();
    renderInsurgencies();
  }

  return { load, render, skeleton };
})();
