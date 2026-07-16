/* Campaigns view. Renders Military Campaigns from the SDE-generated data.
   Depends on config.js, i18n.js, js/data/staticdata.js (SDATA).

   The design_handoff prototype's status chip / countdown / progress bar all
   assume live campaign progress; ESI has no route for that (see this site's
   own FAQ answer on the topic), so those are adapted rather than faked —
   see the CSS comment on .ops-cmp-grid for the reasoning per element. */
"use strict";

const CampaignsView = (() => {
  async function load() {
    /* Static SDE data only — no ESI route exists for campaign progress. */
  }

  function locText(obj) {
    return obj?.[LANG] || obj?.en || "";
  }

  function careerLabel(career) {
    if (!career) return "";
    return career.replace(/-/g, " ");
  }

  function render() {
    const container = document.getElementById("campaigns");
    const camps = SDATA.campaigns || [];
    if (camps.length === 0) {
      container.innerHTML = `<div class="ops-cmp-card" style="border-top-color:var(--ops-line)">${t("cmp_none")}</div>`;
      return;
    }

    container.innerHTML = camps.map(c => {
      const fac = opsFactionOf(c.faction);
      const wz = warzoneOf(c.faction);
      const wzLabel = wz ? `${factionOf(wz.a).key.toUpperCase()} — ${factionOf(wz.b).key.toUpperCase()}` : "";
      const sideLabel = (factionOf(c.faction).name || "").toUpperCase();

      const objectives = c.objectives || [];
      const totalLp = objectives.reduce((sum, o) => sum + (o.lp || 0), 0);
      const totalIsk = objectives.reduce((sum, o) => sum + (o.isk || 0), 0);

      const objItems = objectives.map(o => {
        const rewards = [
          o.lp ? `${fmtNum(o.lp)} LP` : null,
          o.isk ? fmtIsk(o.isk) + " ISK" : null
        ].filter(Boolean).join(" + ");
        return `
          <li class="ops-cmp-obj-item">
            <span class="ops-cmp-obj-career">${esc(careerLabel(o.career))}</span>${esc(locText(o.subtitle))}
            ${rewards ? `<span class="ops-cmp-obj-reward">${esc(rewards)} ${t("cmp_reward_each")}</span>` : ""}
          </li>
        `;
      }).join("");

      return `
        <div class="ops-cmp-card" style="border-top-color:${fac.color}">
          <div class="ops-cmp-head">
            <span class="ops-cmp-status" style="background:color-mix(in srgb, var(--ops-gal) 12%, transparent);color:var(--ops-gal);border-color:color-mix(in srgb, var(--ops-gal) 35%, transparent);animation:ops-pulse 2s infinite">${t("cmp_status_active")}</span>
          </div>
          <div class="ops-cmp-title">${esc(locText(c.title))}</div>
          <div class="ops-cmp-side" style="color:${fac.color}">${esc(sideLabel)} · ${esc(wzLabel)}</div>
          ${locText(c.subtitle) ? `<div class="ops-cmp-subtitle">${esc(locText(c.subtitle))}</div>` : ""}
          ${c.target ? `<div class="ops-cmp-goal">${t("cmp_target")}: ${fmtNum(c.target)} ${t("cmp_stages")}</div>` : ""}
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
    }).join("");
  }

  return { load, render };
})();
