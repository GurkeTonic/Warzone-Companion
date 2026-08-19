/* Campaigns view. Static identity (titles, texts, targets, rewards) comes
   from the SDE via js/data/staticdata.js (SDATA.campaigns); live progress
   and participation come from data/campaigns.json, mirrored every 30
   minutes from the public ESI /military-campaigns routes (compat date
   2026-08-04) by the same GitHub Action as the warzone snapshot — see
   tools/mirror_warzone.py. Both sides are joined by campaign/objective
   UUID. When the live file is missing or stale-empty (mirror not deployed
   yet, fetch failed), the view degrades to the static rendering that
   shipped before the route existed. */
"use strict";

const CampaignsView = (() => {
  let live = null; // payload of data/campaigns.json, or null

  async function load() {
    live = null;
    try {
      const res = await fetch("/data/campaigns.json", { cache: "no-cache" });
      if (res.ok) live = await res.json();
    } catch {
      /* live progress is an enhancement — static render still works */
    }
  }

  function locText(obj) {
    return obj?.[LANG] || obj?.en || "";
  }

  function careerLabel(career) {
    if (!career) return "";
    return career.replace(/-/g, " ");
  }

  function pctOf(progress, target) {
    if (typeof progress !== "number" || !target) return null;
    return Math.max(0, Math.min(100, progress / target * 100));
  }

  function bar(pct, color, cls = "bar bar-7") {
    return `<div class="${cls}"><span style="width:${pct.toFixed(1)}%;background:${color}"></span></div>`;
  }

  function render() {
    const container = document.getElementById("campaigns");
    const camps = SDATA.campaigns || [];
    if (camps.length === 0) {
      container.innerHTML = `<div class="panel panel-pad">${t("cmp_none")}</div>`;
      return;
    }

    const liveCamps = {};
    const liveObjs = {};
    for (const c of live?.campaigns || []) {
      liveCamps[c.id] = c;
      for (const o of c.objectives || []) liveObjs[o.id] = o;
    }

    container.innerHTML = camps.map(c => {
      const fac = factionOf(c.faction);
      const wz = warzoneOf(c.faction);
      const wzLabel = wz ? `${factionOf(wz.a).short} — ${factionOf(wz.b).short}` : "";
      const sideLabel = (fac.name || "").toUpperCase();
      const lc = liveCamps[c.id];

      /* Anything that is not "Active" (finished, expired, future states) is
         shown verbatim in the neutral style — the SDE carries no i18n for
         state names and inventing translations would guess at CCP's enum. */
      const active = !lc || lc.state === "Active";
      const statusLabel = active ? t("cmp_status_active") : lc.state;
      const statusColor = active ? "var(--gal)" : "var(--dim)";

      const cPct = lc ? pctOf(lc.progress, c.target) : null;
      const progressBlock = cPct === null ? (
        c.target ? `<div class="cmp-obj"><div class="detail-bar-k"><span>${t("cmp_target")}</span><span>${fmtNum(c.target)} ${t("cmp_stages")}</span></div></div>` : ""
      ) : `
        <div class="cmp-obj">
          <div class="detail-bar-k">
            <span>${t("cmp_progress")}</span>
            <span style="color:${fac.color}">${fmtNum(lc.progress)} / ${fmtNum(c.target)} · ${Math.round(cPct)}%</span>
          </div>
          ${bar(cPct, fac.color)}
        </div>
      `;

      const objectives = c.objectives || [];
      const totalLp = objectives.reduce((sum, o) => sum + (o.lp || 0), 0);
      const totalIsk = objectives.reduce((sum, o) => sum + (o.isk || 0), 0);

      const objItems = objectives.map(o => {
        const rewards = [
          o.lp ? `${fmtNum(o.lp)} LP` : null,
          o.isk ? fmtIsk(o.isk) + " ISK" : null
        ].filter(Boolean).join(" + ");
        const lo = liveObjs[o.id];
        const oPct = lo ? pctOf(lo.progress, o.target) : null;
        const p = lo?.participants;
        return `
          <li style="margin-top:12px;list-style:none">
            <div class="row-name">${esc(locText(o.title) || locText(o.subtitle))}</div>
            <div class="row-meta">${esc(careerLabel(o.career))}${locText(o.title) && locText(o.subtitle) ? " · " + esc(locText(o.subtitle)) : ""}</div>
            ${oPct !== null ? `
              <div style="margin-top:6px">
                <div class="detail-bar-k"><span>${fmtNum(lo.progress)} / ${fmtNum(o.target)}</span><span>${Math.round(oPct)}%</span></div>
                ${bar(oPct, fac.color, "bar bar-4")}
              </div>
            ` : ""}
            ${p ? `<div class="row-meta" style="margin-top:5px">${fmtNum(p.total)} ${t("cmp_participants")} · ${fmtNum(p.contributors)} ${t("cmp_contributors")}</div>` : ""}
            ${rewards ? `<div class="row-meta" style="margin-top:3px;color:var(--ama)">${esc(rewards)} ${t("cmp_reward_each")}</div>` : ""}
          </li>
        `;
      }).join("");

      return `
        <section class="panel cmp-card${active ? "" : " done"}" style="border-top-color:${fac.color}">
          <div class="cmp-top">
            <span class="tag" style="color:${statusColor}">${esc(statusLabel)}</span>
            <span class="cmp-side" style="color:${fac.color}">${esc(sideLabel)}${wzLabel ? " · " + esc(wzLabel) : ""}</span>
          </div>
          <h2>${esc(locText(c.title))}</h2>
          ${locText(c.subtitle) ? `<p class="cmp-text">${esc(locText(c.subtitle))}</p>` : ""}
          ${progressBlock}
          ${objItems ? `
            <details class="cmp-obj">
              <summary style="cursor:pointer;font:500 9.5px var(--fm);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)">${t("cmp_objectives")} (${objectives.length})</summary>
              <ul style="margin:0;padding:0">${objItems}</ul>
            </details>
          ` : ""}
          ${(totalLp || totalIsk) ? `
            <div class="cmp-foot">
              <span class="lbl">${t("cmp_reward")}</span>
              <span class="val">${[totalLp ? fmtNum(totalLp) + " LP" : null, totalIsk ? fmtIsk(totalIsk) + " ISK" : null].filter(Boolean).join(" + ")}</span>
            </div>
          ` : ""}
        </section>
      `;
    }).join("");

    if (live?.fetched) App.setUpdated(live.fetched.slice(0, 16).replace("T", " ") + " UTC");
  }

  return { load, render };
})();
