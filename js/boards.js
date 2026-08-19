/* Leaderboards view. Depends on config.js, i18n.js, esi.js. */
"use strict";

const BoardsView = (() => {
  let charsData = null;  // raw ESI /fw/leaderboards/characters
  let corpsData = null;  // raw ESI /fw/leaderboards/corporations
  const charFaction = new Map(); // character_id -> faction_id|null
  const corpFaction = new Map(); // corporation_id -> faction_id|null
  let lbCat = "charKills";  // charKills | charVp | corpKills | corpVp
  let lbPeriod = "w";       // y | w | t

  const PERIOD_KEY = { y: "yesterday", w: "last_week", t: "active_total" };

  const CAT_DEFS = {
    charKills: { list: () => charsData?.kills, idKey: "character_id", facMap: charFaction, kills: true },
    charVp:    { list: () => charsData?.victory_points, idKey: "character_id", facMap: charFaction, kills: false },
    corpKills: { list: () => corpsData?.kills, idKey: "corporation_id", facMap: corpFaction, kills: true },
    corpVp:    { list: () => corpsData?.victory_points, idKey: "corporation_id", facMap: corpFaction, kills: false }
  };

  /* faction_id comes back directly from the batch affiliation endpoint —
     no need for a second corp lookup per character. */
  async function resolveCharFactions(ids) {
    const wanted = ids.filter(id => !charFaction.has(id));
    for (let i = 0; i < wanted.length; i += 1000) {
      const chunk = wanted.slice(i, i + 1000);
      if (chunk.length === 0) continue;
      const res = await ESI.post("/characters/affiliation", chunk);
      for (const e of res) charFaction.set(e.character_id, e.faction_id ?? null);
    }
  }

  /* No batch endpoint for corporation public info, so resolve individually
     with a small worker pool — the corp board only ever has a handful of
     unique corporations across all periods. */
  async function resolveCorpFactions(ids) {
    const queue = ids.filter(id => !corpFaction.has(id));
    const workers = Array.from({ length: CONFIG.MARKET_CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        try {
          const info = await ESI.get(`/corporations/${id}`);
          corpFaction.set(id, info.faction_id ?? null);
        } catch {
          corpFaction.set(id, null);
        }
      }
    });
    await Promise.all(workers);
  }

  /* Pirate insurgency factions (Guristas/Angel Cartel) also rack up FW kills
     and turn up on the character leaderboard alongside the 4 empire militias
     — not in the design's sample data, but real ESI returns it, so it needs
     a fallback beyond the 4-key FACTIONS map instead of crashing on it. */
  function militiaFaction(facId) {
    if (!facId) return null;
    if (FACTIONS[facId]) return { label: FACTIONS[facId].militiaName, color: factionOf(facId).color };
    if (PIRATES[facId]) return { label: PIRATES[facId].name, color: "var(--pir)" };
    return { label: factionOf(facId).name, color: "var(--dim)" };
  }

  function collectIds(list, idKey) {
    const ids = new Set();
    for (const period of Object.values(list || {})) {
      for (const e of period || []) ids.add(e[idKey]);
    }
    return [...ids];
  }

  async function load() {
    [charsData, corpsData] = await Promise.all([
      ESI.get("/fw/leaderboards/characters"),
      ESI.get("/fw/leaderboards/corporations")
    ]);
    const charIds = [...new Set([...collectIds(charsData.kills, "character_id"), ...collectIds(charsData.victory_points, "character_id")])];
    const corpIds = [...new Set([...collectIds(corpsData.kills, "corporation_id"), ...collectIds(corpsData.victory_points, "corporation_id")])];
    await Promise.all([
      ESI.names([...charIds, ...corpIds]),
      resolveCharFactions(charIds),
      resolveCorpFactions(corpIds)
    ]);
  }

  function currentRows() {
    const list = CAT_DEFS[lbCat].list();
    const entries = (list && list[PERIOD_KEY[lbPeriod]]) || [];
    return entries.slice().sort((a, b) => b.amount - a.amount).slice(0, CONFIG.LB_ROWS);
  }

  const PERIODS = [
    { key: "y", label: "lb_period_yesterday" },
    { key: "w", label: "lb_period_week" },
    { key: "t", label: "lb_period_total" }
  ];

  function renderPeriodChips() {
    const container = document.getElementById("lb-period-chips");
    container.innerHTML = PERIODS.map(p => `
      <button class="chip chip-lg${lbPeriod === p.key ? " active" : ""}" data-period="${p.key}">${t(p.label)}</button>
    `).join("");
    container.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        lbPeriod = btn.dataset.period;
        render();
      });
    });
  }

  const CATS = [
    { key: "charKills", label: "lb_cat_char_kills" },
    { key: "charVp", label: "lb_cat_char_vp" },
    { key: "corpKills", label: "lb_cat_corp_kills" },
    { key: "corpVp", label: "lb_cat_corp_vp" }
  ];

  function renderCatChips() {
    const container = document.getElementById("lb-cat-chips");
    container.innerHTML = CATS.map(c => `
      <button class="chip chip-lg${lbCat === c.key ? " active" : ""}" data-cat="${c.key}">${t(c.label)}</button>
    `).join("");
    container.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        lbCat = btn.dataset.cat;
        render();
      });
    });
  }

  function render() {
    renderPeriodChips();
    renderCatChips();

    const body = document.getElementById("lb-body");
    const rows = currentRows();
    if (rows.length === 0) {
      body.innerHTML = `<div class="lb-row">${t("boards_none")}</div>`;
      return;
    }

    const def = CAT_DEFS[lbCat];
    const maxV = rows[0].amount || 1;
    body.innerHTML = rows.map((e, i) => {
      const id = e[def.idKey];
      const mf = militiaFaction(def.facMap.get(id));
      const facLabel = mf ? mf.label : "—";
      const facColor = mf ? mf.color : "var(--dim)";
      const rankCls = i === 0 ? " g1" : (i < 3 ? " g2" : "");
      const pct = Math.max(0, Math.round(e.amount / maxV * 100));
      return `
        <div class="lb-row${i === 0 ? " top" : ""}">
          <span class="lb-rank${rankCls}">${String(i + 1).padStart(2, "0")}</span>
          <span class="lb-who">
            <span class="lb-name">${esc(ESI.name(id))}</span>
            <span class="lb-militia" style="color:${facColor}">${esc(facLabel)}</span>
          </span>
          <span class="lb-val">
            <span class="bar bar-6"><span style="width:${pct}%;background:${facColor}"></span></span>
            <span class="num">${fmtNum(e.amount)}</span>
          </span>
        </div>
      `;
    }).join("");
  }

  return { load, render };
})();
