/* Campaigns view. Renders Military Campaigns from the SDE-generated data.
   Depends on config.js, i18n.js, js/data/staticdata.js (SDATA). */
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
    return career.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function render() {
    const container = document.getElementById("campaigns");
    container.innerHTML = "";
    for (const c of SDATA.campaigns) {
      const fac = factionOf(c.faction);
      const objectives = (c.objectives || []).map(o => {
        const rewards = [
          o.lp ? `${fmtNum(o.lp)} LP` : null,
          o.isk ? `${fmtIsk(o.isk)} ISK` : null
        ].filter(Boolean).join(" + ");
        return `
          <li>
            <span class="obj-career">${esc(careerLabel(o.career))}</span>
            ${esc(locText(o.subtitle))}
            ${rewards ? `<span class="obj-reward mono">${rewards} ${t("cmp_reward_each")}</span>` : ""}
          </li>
        `;
      }).join("");

      const card = document.createElement("div");
      card.className = "cmp-card";
      card.style.borderLeftColor = fac.color;
      card.innerHTML = `
        <div class="empire" style="color:${fac.color}">${fac.name}</div>
        <h3>${esc(locText(c.title))}</h3>
        <p>${esc(locText(c.subtitle))}</p>
        ${c.target ? `<div class="goal">${t("cmp_target")}: ${fmtNum(c.target)} ${t("cmp_stages")}</div>` : ""}
        ${objectives ? `
          <details class="cmp-objectives">
            <summary>${t("cmp_objectives")} (${c.objectives.length})</summary>
            <ul>${objectives}</ul>
          </details>
        ` : ""}
      `;
      container.appendChild(card);
    }
  }

  return { load, render };
})();
