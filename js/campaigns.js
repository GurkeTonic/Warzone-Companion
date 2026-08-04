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

  function bar(pct, color) {
    return `
      <div class="ops-cmp-bar"><div class="ops-cmp-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
    `;
  }

  function render() {
    const container = document.getElementById("campaigns");
    const camps = SDATA.campaigns || [];
    if (camps.length === 0) {
      container.innerHTML = `<div class="ops-cmp-card" style="border-top-color:var(--ops-line)">${t("cmp_none")}</div>`;
      return;
    }

    const liveCamps = {};
    const liveObjs = {};
    for (const c of live?.campaigns || []) {
      liveCamps[c.id] = c;
      for (const o of c.objectives || []) liveObjs[o.id] = o;
    }

    container.innerHTML = camps.map(c => {
      const fac = opsFactionOf(c.faction);
      const wz = warzoneOf(c.faction);
      const wzLabel = wz ? `${factionOf(wz.a).key.toUpperCase()} — ${factionOf(wz.b).key.toUpperCase()}` : "";
      const sideLabel = (factionOf(c.faction).name || "").toUpperCase();
      const lc = liveCamps[c.id];

      /* Anything that is not "Active" (finished, expired, future states) is
         shown verbatim in the neutral style — the SDE carries no i18n for
         state names and inventing translations would guess at CCP's enum. */
      const active = !lc || lc.state === "Active";
      const statusLabel = active ? t("cmp_status_active") : lc.state;
      const statusStyle = active
        ? "background:color-mix(in srgb, var(--ops-gal) 12%, transparent);color:var(--ops-gal);border-color:color-mix(in srgb, var(--ops-gal) 35%, transparent);animation:ops-pulse 2s infinite"
        : "background:color-mix(in srgb, var(--ops-dim) 12%, transparent);color:var(--ops-dim);border-color:var(--ops-line)";

      const cPct = lc ? pctOf(lc.progress, c.target) : null;
      const progressBlock = cPct === null ? (
        c.target ? `<div class="ops-cmp-goal">${t("cmp_target")}: ${fmtNum(c.target)} ${t("cmp_stages")}</div>` : ""
      ) : `
        <div class="ops-cmp-progress">
          <div class="ops-cmp-progress-label">
            <span>${t("cmp_progress")}</span>
            <span>${fmtNum(lc.progress)} / ${fmtNum(c.target)} ${t("cmp_stages")} · ${Math.round(cPct)}%</span>
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
          <li class="ops-cmp-obj-item">
            <span class="ops-cmp-obj-career">${esc(careerLabel(o.career))}</span>${esc(locText(o.title) || locText(o.subtitle))}
            ${locText(o.title) && locText(o.subtitle) ? `<span class="ops-cmp-obj-sub">${esc(locText(o.subtitle))}</span>` : ""}
            ${oPct !== null ? `
              <span class="ops-cmp-obj-progress">
                ${bar(oPct, fac.color)}
                <span class="n">${fmtNum(lo.progress)} / ${fmtNum(o.target)} · ${Math.round(oPct)}%</span>
              </span>
            ` : ""}
            ${p ? `<span class="ops-cmp-obj-part">${fmtNum(p.total)} ${t("cmp_participants")} · ${fmtNum(p.contributors)} ${t("cmp_contributors")}</span>` : ""}
            ${rewards ? `<span class="ops-cmp-obj-reward">${esc(rewards)} ${t("cmp_reward_each")}</span>` : ""}
          </li>
        `;
      }).join("");

      return `
        <div class="ops-cmp-card" style="border-top-color:${fac.color}">
          <div class="ops-cmp-head">
            <span class="ops-cmp-status" style="${statusStyle}">${esc(statusLabel)}</span>
          </div>
          <div class="ops-cmp-title">${esc(locText(c.title))}</div>
          <div class="ops-cmp-side" style="color:${fac.color}">${esc(sideLabel)} · ${esc(wzLabel)}</div>
          ${locText(c.subtitle) ? `<div class="ops-cmp-subtitle">${esc(locText(c.subtitle))}</div>` : ""}
          ${progressBlock}
          ${objItems ? `
            <details class="ops-cmp-objectives">
              <summary>${t("cmp_objectives")} (${objectives.length})</summary>
              <ul class="ops-cmp-obj-list">${objItems}</ul>
            </details>
          ` : ""}
          ${(totalLp || totalIsk) ? `
            <div class="ops-cmp-footer">
              <span class="l">${t("cmp_reward")}</span>
              <span class="v">${[totalLp ? fmtNum(totalLp) + " LP" : null, totalIsk ? fmtIsk(totalIsk) + " ISK" : null].filter(Boolean).join(" + ")}</span>
            </div>
          ` : ""}
        </div>
      `;
    }).join("") + (live?.fetched ? `
      <div class="ops-cmp-updated">${t("cmp_updated")}: ${esc(live.fetched.slice(0, 16).replace("T", " "))} UTC</div>
    ` : "");
  }

  return { load, render };
})();
