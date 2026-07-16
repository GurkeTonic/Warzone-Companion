/* History view: warzone time series from data/history.json (rolling file
   maintained by the scheduled mirror workflow). Renders SVG line charts and
   a system-flip log, in the Ops Room style (own chart renderer, duplicating
   Charts.opsLineChart's drawing logic rather than reusing it — see charts.js).
   Depends on config.js, i18n.js. */
"use strict";

const HistoryView = (() => {
  let data = null;       // { factions: [{t, f}], systems: [{t, s}] }
  let rangeDays = 7;

  const FACTION_IDS = [500001, 500004, 500003, 500002]; // cal, gal, ama, min — display order

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
      const fac = opsFactionOf(facId);
      return {
        label: fac.key.toUpperCase(),
        color: fac.color,
        points: entries
          .map(e => [e.t, e.f?.[String(facId)]?.[metric]])
          .filter(p => Number.isFinite(p[1]))
      };
    });
  }

  /* x by actual time proportion (real snapshots aren't perfectly evenly
     spaced); y follows the design's own mapping — 38 minus the value's
     0-36 position within [min,max], 1 unit of padding top and bottom. */
  function pathOf(points, tMin, span, vMin, vMax) {
    return points.map((p, i) => {
      const xPct = span > 0 ? ((p[0] - tMin) / span) * 100 : 0;
      const yPct = 38 - ((p[1] - vMin) / (vMax - vMin || 1)) * 36;
      return `${i === 0 ? "M" : "L"} ${xPct.toFixed(2)} ${yPct.toFixed(2)}`;
    }).join(" ");
  }

  function chartCard(title, series) {
    const allPts = series.flatMap(s => s.points);
    const legend = series.map(s => {
      const last = s.points.length ? s.points[s.points.length - 1][1] : null;
      return `<span style="color:${s.color}">■ ${s.label} <b>${last === null ? "—" : fmtNum(last)}</b></span>`;
    }).join("");

    if (allPts.length === 0) {
      return `
        <div class="ops-card">
          <div class="ops-section-title" style="margin-bottom:10px">${title}</div>
          <div class="ops-hist-legend">${legend}</div>
          <div class="ops-hist-empty">${t("hist_empty")}</div>
        </div>
      `;
    }

    const ts = allPts.map(p => p[0]);
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    const span = Math.max(1, tMax - tMin);
    const vs = allPts.map(p => p[1]);
    const vMin = Math.min(...vs), vMax = Math.max(...vs);

    const paths = series.map(s => s.points.length
      ? `<path d="${pathOf(s.points, tMin, span, vMin, vMax)}" style="fill:none;stroke:${s.color};stroke-width:1.5px;vector-effect:non-scaling-stroke"></path>`
      : ""
    ).join("");

    const rangeLabels = { 2: t("hist_range_2"), 7: t("hist_range_7"), 30: t("hist_range_30"), 90: t("hist_range_90") };

    return `
      <div class="ops-card">
        <div class="ops-section-title" style="margin-bottom:10px">${title}</div>
        <div class="ops-hist-legend">${legend}</div>
        <div class="ops-hist-chart-wrap">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <line x1="0" y1="10" x2="100" y2="10" style="stroke:var(--ops-line2);stroke-width:1px;vector-effect:non-scaling-stroke"></line>
            <line x1="0" y1="20" x2="100" y2="20" style="stroke:var(--ops-line2);stroke-width:1px;vector-effect:non-scaling-stroke"></line>
            <line x1="0" y1="30" x2="100" y2="30" style="stroke:var(--ops-line2);stroke-width:1px;vector-effect:non-scaling-stroke"></line>
            ${paths}
          </svg>
          <span class="ops-hist-minmax max">${fmtNum(Math.round(vMax))}</span>
          <span class="ops-hist-minmax min">${fmtNum(Math.round(vMin))}</span>
        </div>
        <div class="ops-hist-footer"><span>−${rangeLabels[rangeDays] || rangeDays + "d"}</span><span>${t("hist_now")}</span></div>
      </div>
    `;
  }

  function renderCharts() {
    const container = document.getElementById("hist-charts");
    const entries = data ? inRange(data.factions) : [];
    container.innerHTML =
      chartCard(t("hist_sys_chart"), allFactionSeries(entries, 0)) +
      chartCard(t("hist_pil_chart"), allFactionSeries(entries, 1));
  }

  function renderFlips() {
    const body = document.getElementById("flips-body");
    const cutoff = Date.now() / 1000 - rangeDays * 86400;
    const flips = (data?.flips || [])
      .filter(f => f.t >= cutoff)
      .sort((a, b) => b.t - a.t)
      .slice(0, 100);

    if (flips.length === 0) {
      body.innerHTML = `<div class="ops-row" style="cursor:default">${t("flips_none")}</div>`;
      return;
    }

    body.innerHTML = flips.map(f => {
      const from = opsFactionOf(f.from);
      const to = opsFactionOf(f.to);
      const when = fmtDateTime(new Date(f.t * 1000),
        { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, true);
      const name = SDATA.fw[f.id]?.n ?? SDATA.names[f.id] ?? String(f.id);
      const region = SDATA.fw[f.id]?.r ?? "?";
      return `
        <div class="ops-row" style="cursor:default">
          <span class="fc-time">${when}</span>
          <span class="fc-system">${esc(name)} <span style="color:var(--ops-dim);font-size:9.5px">${esc(region)}</span></span>
          <span class="fc-from" style="color:${from.color}">${esc(from.name)}</span>
          <span class="fc-to" style="color:${to.color}">${esc(to.name)}</span>
        </div>
      `;
    }).join("");
  }

  const RANGES = [
    { days: 2, key: "hist_range_2" },
    { days: 7, key: "hist_range_7" },
    { days: 30, key: "hist_range_30" },
    { days: 90, key: "hist_range_90" }
  ];

  function renderRangeChips() {
    const container = document.getElementById("hist-range-chips");
    container.innerHTML = RANGES.map(r => `
      <button class="ops-chip${rangeDays === r.days ? " active" : ""}" data-days="${r.days}">${t(r.key)}</button>
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
