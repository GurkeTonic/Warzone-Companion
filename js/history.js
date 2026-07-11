/* History view: warzone time series from data/history.json (rolling file
   maintained by the scheduled mirror workflow). Renders SVG line charts.
   Depends on config.js, i18n.js. */
"use strict";

const HistoryView = (() => {
  let data = null;       // { factions: [{t, f}], systems: [{t, s}] }
  let rangeDays = 7;
  let controlsBound = false;

  const CHART_W = 560;
  const CHART_H = 220;
  const PAD_L = 44;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 26;

  async function load() {
    const res = await fetch("data/history.json", { cache: "no-cache" });
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

  function fmtTick(epoch, spanSeconds) {
    const d = new Date(epoch * 1000);
    const loc = LANG === "de" ? "de-DE" : "en-US";
    if (spanSeconds <= 2 * 86400) {
      return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit" });
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

    const x = t => PAD_L + ((t - tMin) / span) * (CHART_W - PAD_L - PAD_R);
    const y = v => CHART_H - PAD_B - ((v - vMin) / (vMax - vMin)) * (CHART_H - PAD_T - PAD_B);

    const gridLines = [];
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = vMin + ((vMax - vMin) / yTicks) * i;
      const yy = y(v).toFixed(1);
      gridLines.push(
        `<line x1="${PAD_L}" y1="${yy}" x2="${CHART_W - PAD_R}" y2="${yy}" class="grid"/>` +
        `<text x="${PAD_L - 6}" y="${yy}" class="ytick">${fmtNum(Math.round(v))}</text>`
      );
    }
    const xTicks = 4;
    const xLabels = [];
    for (let i = 0; i <= xTicks; i++) {
      const t = tMin + (span / xTicks) * i;
      xLabels.push(
        `<text x="${x(t).toFixed(1)}" y="${CHART_H - 8}" class="xtick">${fmtTick(t, span)}</text>`
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
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" class="chart" role="img">
        ${gridLines.join("")}
        ${xLabels.join("")}
        ${paths}
      </svg>
      <div class="chart-legend">${legend}</div>
    `;
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
          <td>${esc(name)}<span class="sub">${esc(region)}</span></td>
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
          ${lineChart(factionSeries(entries, wz, 0))}
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
          ${lineChart(factionSeries(entries, wz, 1))}
        </div>
      `);
    }
    container.innerHTML = cards.join("");
  }

  return { load, render };
})();
