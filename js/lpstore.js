/* LP store view. Depends on config.js, i18n.js, esi.js. */
"use strict";

const LpStoreView = (() => {
  let priceMap = null;          // type_id -> ESI average price
  const jitaMap = new Map();    // type_id -> { buy, sell } from Jita 4-4
  const offerCache = new Map(); // corporation_id -> raw offers
  let currentCorp = null;
  let jitaMode = false;
  let jitaLoading = false;

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
    let buy = 0;
    let sell = 0;
    for (const o of orders) {
      if (o.location_id !== CONFIG.JITA_STATION) continue;
      if (o.is_buy_order) {
        if (o.price > buy) buy = o.price;
      } else {
        if (sell === 0 || o.price < sell) sell = o.price;
      }
    }
    jitaMap.set(typeId, { buy, sell });
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
        return { ...o, value, reqCost, net, iskPerLp: net / o.lp_cost };
      })
      .filter(r => r.value > 0)
      .sort((a, b) => b.iskPerLp - a.iskPerLp);
  }

  function currentRows() {
    const offers = offerCache.get(currentCorp) || [];
    const rows = evaluate(offers, jitaMode);
    return rows.slice(0, jitaMode ? CONFIG.LP_JITA_ROWS : CONFIG.LP_ROWS);
  }

  async function load() {
    await loadPrices();
    if (!currentCorp) currentCorp = FACTIONS[500001].militiaCorp;
    if (!offerCache.has(currentCorp)) {
      const offers = await ESI.get(`/loyalty/stores/${currentCorp}/offers`);
      offerCache.set(currentCorp, offers);
    }
    const rows = currentRows();
    const typeIds = rows.flatMap(r => [
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

  function renderToolbar() {
    const sel = document.getElementById("lp-corp");
    if (sel.options.length === 0) {
      for (const fac of Object.values(FACTIONS)) {
        const opt = document.createElement("option");
        opt.value = fac.militiaCorp;
        opt.textContent = `${fac.militiaName} (${fac.name})`;
        sel.appendChild(opt);
      }
      sel.value = currentCorp;
      sel.addEventListener("change", () => {
        currentCorp = Number(sel.value);
        jitaMode = false;
        App.runTab("lp", true);
      });
    }

    const btn = document.getElementById("lp-jita");
    btn.textContent = jitaLoading ? t("lp_jita_loading") : t("lp_jita_btn");
    btn.disabled = jitaLoading;
    btn.classList.toggle("active-mode", jitaMode);
    if (!btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", refineWithJita);
    }

    document.getElementById("lp-mode").textContent =
      jitaMode ? t("lp_mode_jita") : t("lp_mode_avg");
  }

  function render() {
    renderToolbar();
    const body = document.getElementById("lp-body");
    body.innerHTML = "";

    const rows = currentRows();
    if (rows.length === 0) {
      body.innerHTML = `<tr><td colspan="7" class="status-pill">${t("lp_none")}</td></tr>`;
      return;
    }

    for (const r of rows) {
      const req = (r.required_items || [])
        .map(x => `${fmtNum(x.quantity)}× ${ESI.name(x.type_id)}`)
        .join(", ") || t("req_none");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ESI.name(r.type_id)}</td>
        <td class="mono">${fmtNum(r.quantity)}</td>
        <td class="mono">${fmtNum(r.lp_cost)}</td>
        <td class="mono">${fmtIsk(r.isk_cost)}</td>
        <td class="req">${req}</td>
        <td class="mono">${fmtIsk(r.value)}</td>
        <td class="mono strong">${fmtNum(Math.round(r.iskPerLp))}</td>
      `;
      body.appendChild(tr);
    }
  }

  return { load, render, refineWithJita };
})();
