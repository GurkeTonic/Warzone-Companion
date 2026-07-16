/* Shared SVG line chart, used by the History and LP store views.
   Depends on i18n.js (fmtNum, t, esc). */
"use strict";

const Charts = (() => {
  /* Ops Room style: minimal — 3 fixed gridlines, no axis ticks, legend with
     bold current value above the chart, min/max floating top/bottom right.
     x by real time proportion (not point index) so gaps in irregular
     real-world snapshots don't distort the line. Returns the *inner*
     content only — wrap in a .ops-card for the border/background. */
  function opsLineChart(title, series, rangeLabel) {
    const legend = series.map(s => {
      const last = s.points.length ? s.points[s.points.length - 1][1] : null;
      return `<span style="color:${s.color}">■ ${esc(s.label)} <b>${last === null ? "—" : fmtNum(last)}</b></span>`;
    }).join("");
    const titleHtml = `<div class="ops-section-title" style="margin-bottom:10px">${esc(title)}</div>`;

    const allPts = series.flatMap(s => s.points);
    if (allPts.length === 0) {
      return `${titleHtml}<div class="ops-hist-legend">${legend}</div><div class="ops-hist-empty">${t("hist_empty")}</div>`;
    }

    const ts = allPts.map(p => p[0]);
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    const span = Math.max(1, tMax - tMin);
    const vs = allPts.map(p => p[1]);
    const vMin = Math.min(...vs), vMax = Math.max(...vs);

    const paths = series.map(s => {
      if (s.points.length === 0) return "";
      const d = s.points.map((p, i) => {
        const xPct = ((p[0] - tMin) / span) * 100;
        const yPct = 38 - ((p[1] - vMin) / (vMax - vMin || 1)) * 36;
        return `${i === 0 ? "M" : "L"} ${xPct.toFixed(2)} ${yPct.toFixed(2)}`;
      }).join(" ");
      return `<path d="${d}" style="fill:none;stroke:${s.color};stroke-width:1.5px;vector-effect:non-scaling-stroke"></path>`;
    }).join("");

    return `
      ${titleHtml}
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
      <div class="ops-hist-footer"><span>−${esc(rangeLabel)}</span><span>${t("hist_now")}</span></div>
    `;
  }

  return { opsLineChart };
})();
