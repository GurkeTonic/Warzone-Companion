/* History view: warzone time series from data/history.json (rolling file
   maintained by the scheduled mirror workflow). Renders the shared line
   chart plus a system-flip log.
   Depends on config.js, i18n.js, charts.js. */
"use strict";

const HistoryView = (() => {
  let data = null;       // { factions: [{t, f}], systems: [{t, s}], flips: [] }
  let rangeDays = 7;

  const FACTION_IDS = [500001, 500004, 500003, 500002]; // cal, gal, ama, min — display order

  const RANGES = [
    { days: 2, key: "hist_range_2" },
    { days: 7, key: "hist_range_7" },
    { days: 30, key: "hist_range_30" },
    { days: 90, key: "hist_range_90" }
  ];

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

  /* metric: 0 = systems held, 1 = pilots */
  function allFactionSeries(entries, metric) {
    return FACTION_IDS.map(facId => {
      const fac = factionOf(facId);
      return {
        label: fac.short,
        color: fac.color,
        points: entries
          .map(e => [e.t, e.f?.[String(facId)]?.[metric]])
          .filter(p => Number.isFinite(p[1]))
      };
    });
  }

  function rangeLabel() {
    const r = RANGES.find(r => r.days === rangeDays);
    return r ? t(r.key) : rangeDays + "d";
  }

  function renderCharts() {
    const entries = data ? inRange(data.factions) : [];
    document.getElementById("hist-charts").innerHTML =
      `<section class="panel panel-pad">${Charts.lineChart(t("hist_sys_chart"), allFactionSeries(entries, 0), rangeLabel())}</section>` +
      `<section class="panel panel-pad">${Charts.lineChart(t("hist_pil_chart"), allFactionSeries(entries, 1), rangeLabel())}</section>`;
  }

  function renderFlips() {
    const body = document.getElementById("flips-body");
    const cutoff = Date.now() / 1000 - rangeDays * 86400;
    const flips = (data?.flips || [])
      .filter(f => f.t >= cutoff)
      .sort((a, b) => b.t - a.t)
      .slice(0, 100);

    if (flips.length === 0) {
      body.innerHTML = `<div class="log-row">${t("flips_none")}</div>`;
      return;
    }

    body.innerHTML = flips.map(f => {
      const from = factionOf(f.from);
      const to = factionOf(f.to);
      const when = fmtDateTime(new Date(f.t * 1000),
        { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, true);
      const name = SDATA.fw[f.id]?.n ?? SDATA.names[f.id] ?? String(f.id);
      const region = SDATA.fw[f.id]?.r ?? "?";
      return `
        <div class="log-row">
          <span class="log-date">${when}</span>
          <span class="log-sys">${esc(name)} <span style="color:var(--dim);font:400 9.5px var(--fm)">${esc(region)}</span></span>
          <span class="log-move">
            <span class="from" style="color:${from.color}">${esc(from.name)}</span>
            <span style="color:var(--dim)">→</span>
            <span style="color:${to.color}">${esc(to.name)}</span>
          </span>
        </div>
      `;
    }).join("");
  }

  /* Range chips live in the shared page head, which App clears on every tab
     switch — so they are re-emitted from render(), not cached. */
  function renderRangeChips() {
    const container = document.getElementById("page-chips");
    container.innerHTML = RANGES.map(r => `
      <button class="chip${rangeDays === r.days ? " active" : ""}" data-days="${r.days}">${t(r.key)}</button>
    `).join("");
    container.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        rangeDays = Number(btn.dataset.days);
        render();
      });
    });
  }

  function render() {
    renderRangeChips();
    renderCharts();
    renderFlips();
  }

  return { load, render };
})();
