/* Application bootstrap. Loaded last. */
"use strict";

const App = (() => {
  const TABS = {
    warzones:  { view: WarzonesView,  panel: "panel-warzones" },
    lp:        { view: LpStoreView,   panel: "panel-lp" },
    jobs:      { view: JobsView,      panel: "panel-jobs" },
    boards:    { view: BoardsView,    panel: "panel-boards" },
    campaigns: { view: CampaignsView, panel: "panel-campaigns" }
  };

  let activeTab = "warzones";
  const loaded = new Set();
  let autoTimer = null;

  const $ = (id) => document.getElementById(id);

  function showPanel(tabId) {
    for (const [id, tab] of Object.entries(TABS)) {
      $(tab.panel).classList.toggle("hidden", id !== tabId);
      $("tab-" + id).classList.toggle("active", id === tabId);
    }
  }

  function setStatus(state, message = "") {
    $("loading").classList.toggle("hidden", state !== "loading");
    $("error").classList.toggle("hidden", state !== "error");
    if (state === "error") $("error").textContent = message;
  }

  /* Central error sink so async view actions never die silently in the console. */
  function reportError(err) {
    const hint = err && err.rateLimited ? t("err_rate_limit") : t("err_hint");
    setStatus("error", t("err_prefix") + (err?.message ?? err) + " — " + hint);
  }

  async function runTab(tabId, force = false) {
    activeTab = tabId;
    showPanel(tabId);
    const tab = TABS[tabId];

    if (loaded.has(tabId) && !force) {
      tab.view.render();
      return;
    }

    setStatus("loading");
    try {
      await tab.view.load();
      loaded.add(tabId);
      tab.view.render();
      $("timestamp").textContent =
        t("ts_label") + " " + new Date().toLocaleTimeString(LANG === "de" ? "de-DE" : "en-US");
      setStatus("idle");
    } catch (err) {
      reportError(err);
    }
  }

  function rerenderAll() {
    applyI18n();
    for (const tabId of loaded) TABS[tabId].view.render();
  }

  function setAutoRefresh(on) {
    localStorage.setItem("tow_auto_refresh", on ? "1" : "0");
    $("auto-refresh").classList.toggle("active-mode", on);
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = on
      ? setInterval(() => {
          loaded.delete(activeTab);
          runTab(activeTab, true);
        }, CONFIG.AUTO_REFRESH_MS)
      : null;
  }

  function init() {
    for (const tabId of Object.keys(TABS)) {
      $("tab-" + tabId).addEventListener("click", () => runTab(tabId));
    }
    $("refresh").addEventListener("click", () => {
      loaded.delete(activeTab);
      runTab(activeTab, true);
    });
    $("auto-refresh").addEventListener("click", () => {
      setAutoRefresh(!autoTimer);
    });
    setAutoRefresh(localStorage.getItem("tow_auto_refresh") === "1");
    $("lang-de").addEventListener("click", () => { LANG = "de"; rerenderAll(); });
    $("lang-en").addEventListener("click", () => { LANG = "en"; rerenderAll(); });
    $("jobs-more").addEventListener("click", () => JobsView.loadMore());

    applyI18n();
    runTab("warzones");
  }

  return { init, runTab, reportError };
})();

document.addEventListener("DOMContentLoaded", App.init);
