/* Shared SVG line chart, used by the History and LP store views.
   Depends on i18n.js (fmtNum, fmtTime, fmtDate, LANG). */
"use strict";

const Charts = (() => {
  const W = 560;
  const H = 220;
  const PAD_L = 44;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 26;

  function fmtTick(epoch, spanSeconds) {
    const d = new Date(epoch * 1000);
    if (spanSeconds <= 2 * 86400) {
      return fmtTime(d, { hour: "2-digit", minute: "2-digit" });
    }
    return fmtDate(d, { day: "2-digit", month: "2-digit" });
  }

  /* series: [{ label, color, points: [[t, value], ...] }] */
  function lineChart(series) {
    const all = series.flatMap(s => s.points);
    if (all.length === 0) return "";
    const ts = all.map(p => p[0]);
    const vs = all.map(p => p[1]);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    const span = Math.max(1, tMax - tMin);
    let vMin = Math.min(...vs);
    let vMax = Math.max(...vs);
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const vPad = (vMax - vMin) * 0.1;
    vMin = Math.max(0, vMin - vPad);
    vMax = vMax + vPad;

    const x = t => PAD_L + ((t - tMin) / span) * (W - PAD_L - PAD_R);
    const y = v => H - PAD_B - ((v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);

    const gridLines = [];
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = vMin + ((vMax - vMin) / yTicks) * i;
      const yy = y(v).toFixed(1);
      gridLines.push(
        `<line x1="${PAD_L}" y1="${yy}" x2="${W - PAD_R}" y2="${yy}" class="grid"/>` +
        `<text x="${PAD_L - 6}" y="${yy}" class="ytick">${fmtNum(Math.round(v))}</text>`
      );
    }
    const xTicks = 4;
    const xLabels = [];
    for (let i = 0; i <= xTicks; i++) {
      const t = tMin + (span / xTicks) * i;
      xLabels.push(
        `<text x="${x(t).toFixed(1)}" y="${H - 8}" class="xtick">${fmtTick(t, span)}</text>`
      );
    }

    const paths = series.map(s => {
      if (s.points.length === 0) return "";
      const d = s.points
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`)
        .join("");
      const dots = s.points.length < 20
        ? s.points.map(p =>
            `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="2.5" fill="${s.color}"/>`
          ).join("")
        : "";
      return `<path d="${d}" stroke="${s.color}" class="line"/>${dots}`;
    }).join("");

    const legend = series.map(s =>
      `<span><span class="dot" style="background:${s.color}"></span>${s.label}</span>`
    ).join("");

    return `
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
        ${gridLines.join("")}
        ${xLabels.join("")}
        ${paths}
      </svg>
      <div class="chart-legend">${legend}</div>
    `;
  }

  return { lineChart };
})();
