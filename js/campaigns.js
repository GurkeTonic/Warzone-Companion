/* Campaigns view. Depends on config.js, i18n.js. */
"use strict";

const CampaignsView = (() => {
  async function load() {
    /* Static data only — no ESI route exists for campaign progress. */
  }

  function render() {
    const container = document.getElementById("campaigns");
    container.innerHTML = "";
    for (const c of CAMPAIGNS) {
      const fac = factionOf(c.faction);
      const card = document.createElement("div");
      card.className = "cmp-card";
      card.style.borderLeftColor = fac.color;
      card.innerHTML = `
        <div class="empire" style="color:${fac.color}">${fac.name}</div>
        <h3>${c.name ?? t("unknown_name")}</h3>
        <p>${c.desc[LANG]}</p>
        <div class="goal">${c.goal[LANG]}</div>
      `;
      container.appendChild(card);
    }
  }

  return { load, render };
})();
