/* Soft navigation between tabs. Every page already ships the full app and
   every panel (see index.html) — switching tabs never needs a real
   navigation, just App.runTab() plus a history entry and updated
   title/canonical/description/alternates. Falls back to a real link for
   anything it doesn't own: external links, modified clicks, JS disabled,
   and the EN/DE link — a page in the other language is loaded for real,
   since the language is part of the URL (tools/build_pages.py).
   Depends on routes.js, i18n.js, app.js (must load after them). */
"use strict";

const Router = (() => {
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const descriptionEl = document.querySelector('meta[name="description"]');
  const langEl = document.getElementById("lang-toggle");

  function routeFor(pathname) {
    const route = ROUTES[pathname];
    return route && route.lang === LANG ? route : ROUTES[localPath("/")];
  }

  /* hreflang links follow the page, so they stay right after a soft
     navigation (crawlers get them from the static HTML anyway). */
  function setAlternates(route) {
    const own = route.canonical, other = new URL(route.alt, own).href;
    const urls = LANG === "en" ? { en: own, de: other } : { en: other, de: own };
    urls["x-default"] = urls.en;
    for (const [hl, href] of Object.entries(urls)) {
      const el = document.querySelector(`link[rel="alternate"][hreflang="${hl}"]`);
      if (el) el.href = href;
    }
  }

  function applyRoute(route) {
    document.title = route.title;
    canonicalEl.href = route.canonical;
    descriptionEl.content = route.description;
    langEl.href = route.alt;
    setAlternates(route);
    document.body.dataset.tab = route.tab;
    App.runTab(route.tab); // also updates nav .active state (showPanel)
  }

  function onNavClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a");
    if (!a) return;

    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    const route = ROUTES[url.pathname];
    if (!route || route.lang !== LANG) return;

    e.preventDefault();
    if (url.pathname === location.pathname) return;
    history.pushState({ path: url.pathname }, "", url.pathname);
    applyRoute(route);
  }

  function onPopState() {
    applyRoute(routeFor(location.pathname));
  }

  function init() {
    /* Bound on the document rather than one nav: the rail, the bottom nav
       and the header logo all link to routes, and views render in-content
       links too. onNavClick already ignores anything not in ROUTES. */
    document.addEventListener("click", onNavClick);
    window.addEventListener("popstate", onPopState);
    history.replaceState({ path: location.pathname }, "", location.pathname);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Router.init);
