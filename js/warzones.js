/* Warzones view. Depends on config.js, i18n.js, esi.js. */
"use strict";

const WarzonesView = (() => {
  let data = null;

  async function load() {
    const [systems, stats] = await Promise.all([
      ESI.get("/fw/systems"),
      ESI.get("/fw/stats")
    ]);
    await ESI.names(systems.map(s => s.solar_system_id));
    data = { systems, stats };
  }

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
        return `<div class="seg${flag}" style="background:${fac.color}" title="${ESI.name(s.solar_system_id)}"></div>`;
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
        <div class="front-legend">
          <span><span class="dot" style="background:${facA.color}"></span>${facA.name}</span>
          <span><span class="dot" style="background:${facB.color}"></span>${facB.name}</span>
        </div>
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

  function renderContested() {
    const body = document.getElementById("contested-body");
    body.innerHTML = "";

    const contested = data.systems
      .filter(s => s.contested !== "uncontested")
      .map(s => ({
        ...s,
        pct: s.victory_points_threshold > 0
          ? (s.victory_points / s.victory_points_threshold) * 100
          : 0
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, CONFIG.CONTESTED_ROWS);

    if (contested.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="status-pill">${t("contested_none")}</td></tr>`;
      return;
    }

    for (const s of contested) {
      const fac = factionOf(s.occupier_faction_id);
      const wz = warzoneOf(s.occupier_faction_id);
      const wzLabel = wz
        ? `${factionOf(wz.a).name.split(" ")[0]}–${factionOf(wz.b).name.split(" ")[0]}`
        : "—";
      const hot = s.contested === "vulnerable" ? " hot" : "";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${ESI.name(s.solar_system_id)}</td>
        <td class="mono">${wzLabel}</td>
        <td><span class="fac-tag" style="color:${fac.color};border-color:${fac.color}">${fac.name}</span></td>
        <td><span class="status-pill${hot}">${t("status_" + s.contested)}</span></td>
        <td>
          <div class="vp-bar">
            <div class="fill" style="width:${Math.min(100, s.pct).toFixed(1)}%;background:${fac.color}"></div>
          </div>
        </td>
        <td class="mono">${s.pct.toFixed(1)}%</td>
      `;
      body.appendChild(row);
    }
  }

  function render() {
    if (!data) return;
    renderCards();
    renderContested();
  }

  return { load, render };
})();
