/* Soft navigation between tabs. Every page already ships the full app and
   every panel (see index.html) — switching tabs never needs a real
   navigation, just App.runTab() plus a history entry and updated
   title/canonical/description. Falls back to a real link for anything it
   doesn't own: external links, modified clicks, JS disabled.
   Depends on routes.js, app.js (must load after both). */
"use strict";

const Router = (() => {
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const descriptionEl = document.querySelector('meta[name="description"]');

  function routeFor(pathname) {
    return ROUTES[pathname] || ROUTES["/"];
  }

  function applyRoute(route) {
    document.title = route.title;
    canonicalEl.href = route.canonical;
    descriptionEl.content = route.description;
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
    if (!route) return;

    e.preventDefault();
    if (url.pathname === location.pathname) return;
    history.pushState({ path: url.pathname }, "", url.pathname);
    applyRoute(route);
  }

  function onPopState() {
    applyRoute(routeFor(location.pathname));
  }

  function init() {
    document.querySelector("nav").addEventListener("click", onNavClick);
    window.addEventListener("popstate", onPopState);
    history.replaceState({ path: location.pathname }, "", location.pathname);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Router.init);
