/* History view: warzone time series from data/history.json (rolling file
   maintained by the scheduled mirror workflow). Renders SVG line charts.
   Depends on config.js, i18n.js, charts.js. */
"use strict";

const HistoryView = (() => {
  let data = null;       // { factions: [{t, f}], systems: [{t, s}] }
  let rangeDays = 7;
  let controlsBound = false;

  async function load() {
    const res = await fetch("/data/history.json", { cache: "no-cache" });
    if (!res.ok) {
      data = null;
      return;
    }
    data = await res.json();
  }

  function inRange(entries) {
    const cutoff = Date.now() / 1000 - rangeDays * 86400;
    return (entries || []).filter(e => e.t >= cutoff);
  }

  function factionSeries(entries, warzone, metric) {
    return [warzone.a, warzone.b].map(facId => {
      const fac = factionOf(facId);
      return {
        label: fac.name,
        color: fac.color,
        points: entries
          .map(e => [e.t, e.f?.[String(facId)]?.[metric]])
          .filter(p => Number.isFinite(p[1]))
      };
    });
  }

  function renderFlips() {
    const body = document.getElementById("flips-body");
    const cutoff = Date.now() / 1000 - rangeDays * 86400;
    const flips = (data?.flips || [])
      .filter(f => f.t >= cutoff)
      .sort((a, b) => b.t - a.t)
      .slice(0, 100);

    if (flips.length === 0) {
      body.innerHTML = `<tr><td colspan="4" class="status-pill">${t("flips_none")}</td></tr>`;
      return;
    }

    const loc = LANG === "de" ? "de-DE" : "en-US";
    body.innerHTML = flips.map(f => {
      const from = factionOf(f.from);
      const to = factionOf(f.to);
      const when = new Date(f.t * 1000).toLocaleString(loc, {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
      const name = SDATA.fw[f.id]?.n ?? SDATA.names[f.id] ?? String(f.id);
      const region = SDATA.fw[f.id]?.r ?? "?";
      return `
        <tr>
          <td class="mono">${when}</td>
          <td>
            <a href="${zkillUrl(f.id)}" target="_blank" rel="noopener" class="sys-link" title="zKillboard">${esc(name)}</a>
            <a href="${dotlanUrl(name)}" target="_blank" rel="noopener" class="ext-link" title="Dotlan">D</a>
            <span class="sub">${esc(region)}</span>
          </td>
          <td><span class="fac-tag" style="color:${from.color};border-color:${from.color}">${from.name}</span></td>
          <td><span class="fac-tag" style="color:${to.color};border-color:${to.color}">${to.name}</span></td>
        </tr>
      `;
    }).join("");
  }

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    document.querySelectorAll("#hist-range button").forEach(btn => {
      btn.addEventListener("click", () => {
        rangeDays = Number(btn.dataset.days);
        render();
      });
    });
  }

  function render() {
    bindControls();
    document.querySelectorAll("#hist-range button").forEach(btn => {
      btn.classList.toggle("active-mode", Number(btn.dataset.days) === rangeDays);
    });

    renderFlips();

    const container = document.getElementById("hist-charts");
    const entries = data ? inRange(data.factions) : [];

    if (entries.length === 0) {
      container.innerHTML = `<div class="notice">${t("hist_empty")}</div>`;
      return;
    }

    const cards = [];
    for (const wz of WARZONES) {
      const facA = factionOf(wz.a);
      const facB = factionOf(wz.b);
      cards.push(`
        <div class="chart-card">
          <div class="map-head">
            <span style="color:${facA.color}">${facA.name}</span> vs
            <span style="color:${facB.color}">${facB.name}</span> — ${t("hist_systems")}
          </div>
          ${Charts.lineChart(factionSeries(entries, wz, 0))}
        </div>
      `);
    }
    for (const wz of WARZONES) {
      const facA = factionOf(wz.a);
      const facB = factionOf(wz.b);
      cards.push(`
        <div class="chart-card">
          <div class="map-head">
            <span style="color:${facA.color}">${facA.name}</span> vs
            <span style="color:${facB.color}">${facB.name}</span> — ${t("hist_pilots")}
          </div>
          ${Charts.lineChart(factionSeries(entries, wz, 1))}
        </div>
      `);
    }

    container.innerHTML = cards.join("");
  }

  return { load, render };
})();
