/* LP store view. Depends on config.js, i18n.js, esi.js. */
"use strict";

const LpStoreView = (() => {
  let priceMap = null;          // type_id -> ESI average price
  const jitaMap = new Map();    // type_id -> { buy, sell } from Jita 4-4
  const offerCache = new Map(); // corporation_id -> raw offers
  let currentCorp = null;
  let jitaMode = false;
  let jitaLoading = false;
  let lpHistory = null;         // [{t, m: {factionId: [best, median]}}]
  let sortKey = "ratio";        // n | q | lp | isk | mkt | depth | ratio
  let sortDir = "desc";

  const TREND_DAYS = 30;

  /* Optional trend data from the snapshot archive; chart stays empty
     when the file is missing (e.g. fresh local checkout). */
  async function loadTrend() {
    try {
      const res = await fetch("/data/history.json", { cache: "no-cache" });
      if (!res.ok) return;
      const history = await res.json();
      if (Array.isArray(history.lp)) lpHistory = history.lp;
    } catch { /* chart stays empty */ }
  }

  function renderTrend() {
    const container = document.getElementById("lp-trend");
    if (!lpHistory) {
      container.innerHTML = "";
      return;
    }
    const cutoff = Date.now() / 1000 - TREND_DAYS * 86400;
    const entries = lpHistory.filter(e => e.t >= cutoff);
    const series = Object.keys(FACTIONS).map(facId => {
      const fac = opsFactionOf(Number(facId));
      return {
        label: fac.key.toUpperCase(),
        color: fac.color,
        points: entries
          .map(e => [e.t, e.m?.[facId]?.[1]])
          .filter(p => Number.isFinite(p[1]))
      };
    }).filter(s => s.points.length > 0);
    if (series.length === 0) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `<div class="ops-card">${Charts.opsLineChart(t("hist_lp"), series, TREND_DAYS + "d")}</div>`;
  }

  async function loadPrices() {
    if (priceMap) return;
    const prices = await ESI.get("/markets/prices");
    priceMap = new Map();
    for (const p of prices) {
      priceMap.set(p.type_id, p.average_price ?? p.adjusted_price ?? 0);
    }
  }

  function avgPrice(typeId) {
    return priceMap.get(typeId) ?? 0;
  }

  /* Revenue side: Jita buy max (instant sell). Cost side: Jita sell min (instant buy). */
  function jitaBuy(typeId) {
    const j = jitaMap.get(typeId);
    return j && j.buy > 0 ? j.buy : avgPrice(typeId);
  }

  function jitaSell(typeId) {
    const j = jitaMap.get(typeId);
    return j && j.sell > 0 ? j.sell : avgPrice(typeId);
  }

  async function fetchJitaOrders(typeId) {
    if (jitaMap.has(typeId)) return;
    const orders = await ESI.get(`/markets/${CONFIG.JITA_REGION}/orders`, {
      type_id: typeId,
      order_type: "all"
    });
    const buys = [];
    let sell = 0;
    for (const o of orders) {
      if (o.location_id !== CONFIG.JITA_STATION) continue;
      if (o.is_buy_order) {
        buys.push(o);
      } else {
        if (sell === 0 || o.price < sell) sell = o.price;
      }
    }
    const buy = buys.reduce((max, o) => Math.max(max, o.price), 0);
    /* Executable depth: units sellable into buy orders within 5% of best. */
    const buyDepth = buys
      .filter(o => o.price >= buy * 0.95)
      .reduce((sum, o) => sum + (o.volume_remain || 0), 0);
    jitaMap.set(typeId, { buy, sell, buyDepth });
  }

  async function fetchJitaBatch(typeIds) {
    const queue = [...new Set(typeIds)].filter(id => !jitaMap.has(id));
    let aborted = null;
    const workers = Array.from({ length: CONFIG.MARKET_CONCURRENCY }, async () => {
      while (queue.length > 0 && !aborted) {
        const id = queue.shift();
        try {
          await fetchJitaOrders(id);
        } catch (err) {
          if (err.rateLimited) {
            // Stop all workers: silently falling back to average prices
            // would misrepresent the refined ranking.
            aborted = err;
            break;
          }
          jitaMap.set(id, { buy: 0, sell: 0, error: err.message });
        }
      }
    });
    await Promise.all(workers);
    if (aborted) throw aborted;
  }

  function evaluate(offers, useJita) {
    const productPrice = useJita ? jitaBuy : avgPrice;
    const materialPrice = useJita ? jitaSell : avgPrice;
    return offers
      .filter(o => o.lp_cost > 0)
      .map(o => {
        const value = productPrice(o.type_id) * o.quantity;
        const reqCost = (o.required_items || [])
          .reduce((sum, r) => sum + materialPrice(r.type_id) * r.quantity, 0);
        const net = value - (o.isk_cost || 0) - reqCost;
        const depth = useJita ? (jitaMap.get(o.type_id)?.buyDepth ?? null) : null;
        return { ...o, value, reqCost, net, iskPerLp: net / o.lp_cost, depth };
      })
      .filter(r => r.value > 0);
  }

  const SORT_FIELD = { n: null, q: "quantity", lp: "lp_cost", isk: "isk_cost", mkt: "value", depth: "depth", ratio: "iskPerLp" };

  function currentRows() {
    let offers = offerCache.get(currentCorp) || [];
    /* In Jita mode only the shortlist was repriced; ranking items that
       still carry average prices against it would skew the list. */
    if (jitaMode) offers = offers.filter(o => jitaMap.has(o.type_id));
    let rows = evaluate(offers, jitaMode);
    /* mkt/depth/ratio need Jita data to mean anything — before that's
       loaded, fall back to ranking by ISK/LP so the list isn't arbitrary. */
    const field = (!jitaMode && ["mkt", "depth"].includes(sortKey)) ? "iskPerLp" : SORT_FIELD[sortKey];
    rows = rows.slice().sort((a, b) => {
      const av = field === null ? ESI.name(a.type_id) : (a[field] ?? -Infinity);
      const bv = field === null ? ESI.name(b.type_id) : (b[field] ?? -Infinity);
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows.slice(0, jitaMode ? CONFIG.LP_JITA_ROWS : CONFIG.LP_ROWS);
  }

  async function load() {
    await Promise.all([loadPrices(), loadTrend()]);
    if (!currentCorp) currentCorp = FACTIONS[500001].militiaCorp;
    if (!offerCache.has(currentCorp)) {
      const offers = await ESI.get(`/loyalty/stores/${currentCorp}/offers`);
      offerCache.set(currentCorp, offers);
    }
    /* Names must be resolved for the FULL evaluated set, not just
       currentRows()'s top slice — sorting by item name needs those same
       names, so picking "top N" first would be circular (unresolved names
       sort as raw IDs, so the "top N by name" wouldn't even be the right
       rows once real names are in). */
    const allEvaluated = evaluate(offerCache.get(currentCorp) || [], jitaMode);
    const typeIds = allEvaluated.flatMap(r => [
      r.type_id,
      ...(r.required_items || []).map(x => x.type_id)
    ]);
    await ESI.names(typeIds);
  }

  /* Refine the current top rows with live Jita 4-4 order-book prices. */
  async function refineWithJita() {
    if (jitaLoading) return;
    jitaLoading = true;
    render();
    try {
      // Rank by average prices first, then price that shortlist via Jita.
      const shortlist = evaluate(offerCache.get(currentCorp) || [], false)
        .sort((a, b) => b.iskPerLp - a.iskPerLp)
        .slice(0, CONFIG.LP_JITA_ROWS);
      const typeIds = shortlist.flatMap(r => [
        r.type_id,
        ...(r.required_items || []).map(x => x.type_id)
      ]);
      await fetchJitaBatch(typeIds);
      jitaMode = true;
      const rows = currentRows();
      await ESI.names(rows.flatMap(r => [
        r.type_id,
        ...(r.required_items || []).map(x => x.type_id)
      ]));
    } catch (err) {
      App.reportError(err);
    } finally {
      jitaLoading = false;
      render();
    }
  }

  function renderCorpChips() {
    const container = document.getElementById("lp-corp-chips");
    container.innerHTML = Object.values(FACTIONS).map(fac => {
      const active = currentCorp === fac.militiaCorp;
      return `<button class="ops-chip${active ? " active" : ""}" data-corp="${fac.militiaCorp}" style="${active ? `border-color:color-mix(in srgb, ${fac.color} 55%, transparent);background:color-mix(in srgb, ${fac.color} 10%, transparent);color:${fac.color}` : ""}">${esc(fac.militiaName)}</button>`;
    }).join("");
    container.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const corp = Number(btn.dataset.corp);
        if (corp === currentCorp) return;
        currentCorp = corp;
        jitaMode = false;
        App.runTab("lp", true);
      });
    });
  }

  function renderJitaButton() {
    const btn = document.getElementById("lp-jita");
    btn.textContent = jitaLoading ? t("lp_jita_loading") : (jitaMode ? "↻ " + t("lp_jita_reload") : "▼ " + t("lp_jita_btn"));
    btn.disabled = jitaLoading;
    btn.classList.toggle("active", jitaMode);
    if (!btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", refineWithJita);
    }
    document.getElementById("lp-mode").textContent =
      jitaMode ? t("lp_mode_jita") : t("lp_mode_avg");
  }

  const LP_COLS = [
    { key: "n", label: t("th_item"), cls: "lc-n" },
    { key: "q", label: t("th_qty"), cls: "lc-q" },
    { key: "lp", label: t("th_lp"), cls: "lc-lp" },
    { key: "isk", label: t("th_isk_cost"), cls: "lc-isk" },
    { key: null, label: t("th_req"), cls: "lc-req" },
    { key: "mkt", label: t("th_value"), cls: "lc-mkt" },
    { key: "depth", label: t("th_depth"), cls: "lc-depth" },
    { key: "ratio", label: t("th_isk_per_lp"), cls: "lc-ratio" }
  ];

  function renderTableHead() {
    const head = document.getElementById("lp-table-head");
    head.innerHTML = LP_COLS.map(c => {
      if (c.key === null) return `<span class="${c.cls}">${esc(c.label)}</span>`;
      const active = c.key === sortKey;
      const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
      return `<button class="${c.cls}${active ? " active" : ""}" data-key="${c.key}">${esc(c.label)} ${arrow}</button>`;
    }).join("");
    head.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        sortDir = key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : (key === "n" ? "asc" : "desc");
        sortKey = key;
        render();
      });
    });
  }

  function render() {
    renderCorpChips();
    renderJitaButton();
    renderTableHead();
    renderTrend();

    const body = document.getElementById("lp-body");
    const rows = currentRows();
    if (rows.length === 0) {
      body.innerHTML = `<div class="ops-row" style="cursor:default">${t("lp_none")}</div>`;
      return;
    }

    const bestRatio = Math.max(...rows.map(r => r.iskPerLp), 1);
    body.innerHTML = rows.map(r => {
      const req = (r.required_items || [])
        .map(x => `${fmtNum(x.quantity)}× ${esc(ESI.name(x.type_id))}`)
        .join(", ") || t("req_none");
      const thin = r.depth !== null && r.depth < r.quantity;
      const depthText = r.depth === null ? "—" : fmtNum(r.depth);
      const ratio = Math.round(r.iskPerLp);
      const ratioColor = !jitaMode ? "var(--ops-dim)" : (ratio >= 1500 ? "var(--ops-gal)" : (ratio >= 1000 ? "var(--ops-ama)" : "var(--ops-dim2)"));
      const ratioPct = jitaMode ? Math.max(0, Math.round(r.iskPerLp / bestRatio * 100)) : 0;
      const isBest = jitaMode && rows[0] === r;
      return `
        <div class="ops-row" style="cursor:default${isBest ? ";background:color-mix(in srgb, var(--ops-gal) 5%, transparent)" : ""}">
          <span class="lc-n">${esc(ESI.name(r.type_id))}</span>
          <span class="lc-q">×${fmtNum(r.quantity)}</span>
          <span class="lc-lp">${fmtNum(r.lp_cost)} LP</span>
          <span class="lc-isk">${fmtIsk(r.isk_cost)}</span>
          <span class="lc-req">${req}</span>
          <span class="lc-mkt" style="color:${jitaMode ? "var(--ops-body)" : "var(--ops-dim)"}">${jitaMode ? fmtIsk(r.value) : "—"}</span>
          <span class="lc-depth${thin ? " ops-lp-depth-thin" : ""}" title="${thin ? t("lp_thin") : ""}">${depthText}</span>
          <span class="lc-ratio">
            <span class="ops-lp-ratio-val" style="color:${ratioColor}">${jitaMode ? fmtNum(ratio) : "—"}</span>
            <span class="ops-lp-ratio-track"><span class="ops-lp-ratio-fill" style="width:${ratioPct}%;background:${ratioColor}"></span></span>
          </span>
        </div>
      `;
    }).join("");
  }

  return { load, render, refineWithJita };
})();
