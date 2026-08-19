/* Shared SVG line chart, used by the History and LP store views.
   Depends on i18n.js (fmtNum, t, esc). */
"use strict";

const Charts = (() => {
  /* Minimal by design: four gridlines, no axis ticks, a legend carrying the
     bold current value above the chart, and a faint area under each line so
     overlapping series stay separable. x is placed by real time proportion
     (not point index) so gaps in irregular real-world snapshots don't
     distort the line. Returns the *inner* content only — wrap in a .panel
     for the border and background. */
  function lineChart(title, series, rangeLabel) {
    const legend = series.map(s => {
      const last = s.points.length ? s.points[s.points.length - 1][1] : null;
      return `<span><i style="background:${s.color}"></i>${esc(s.label)} <b style="color:${s.color}">${last === null ? "—" : fmtNum(last)}</b></span>`;
    }).join("");
    const head = `<h2>${esc(title)}</h2>`;

    const allPts = series.flatMap(s => s.points);
    if (allPts.length === 0) {
      return `${head}<div class="chart-legend">${legend}</div>
        <p style="font:400 11px var(--fm);color:var(--dim);padding:24px 0">${t("hist_empty")}</p>`;
    }

    const ts = allPts.map(p => p[0]);
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    const span = Math.max(1, tMax - tMin);
    const vs = allPts.map(p => p[1]);
    const vMin = Math.min(...vs), vMax = Math.max(...vs);

    /* Viewport is 600x200 user units, stretched by preserveAspectRatio=none;
       strokes keep their pixel width via vector-effect. */
    const W = 600, H = 200, TOP = 12, BOT = 188;
    const xAt = tv => ((tv - tMin) / span) * W;
    const yAt = v => BOT - ((v - vMin) / (vMax - vMin || 1)) * (BOT - TOP);

    const grid = [0, 1, 2, 3].map(i => {
      const y = (TOP + (BOT - TOP) * i / 3).toFixed(1);
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--line2)" stroke-width="1"></line>`;
    }).join("");

    /* The area fill separates two series nicely, but four of them stacked
       just muddies the panel — past a pair, the lines carry it alone. */
    const withArea = series.filter(s => s.points.length).length <= 2;

    const paths = series.map(s => {
      if (s.points.length === 0) return "";
      const pts = s.points.map(p => `${xAt(p[0]).toFixed(1)},${yAt(p[1]).toFixed(1)}`).join(" ");
      const first = xAt(s.points[0][0]).toFixed(1);
      const last = xAt(s.points[s.points.length - 1][0]).toFixed(1);
      const area = withArea
        ? `<polygon points="${first},${H} ${pts} ${last},${H}" fill="${s.color}" opacity=".08"></polygon>`
        : "";
      return `<g>${area}<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" vector-effect="non-scaling-stroke"></polyline></g>`;
    }).join("");

    return `
      ${head}
      <div class="chart-legend">${legend}</div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${paths}</svg>
      <div class="chart-axis">
        <span>−${esc(rangeLabel)}</span>
        <span>${fmtNum(Math.round(vMin))} … ${fmtNum(Math.round(vMax))}</span>
        <span>${t("hist_now")}</span>
      </div>
    `;
  }

  return { lineChart };
})();
