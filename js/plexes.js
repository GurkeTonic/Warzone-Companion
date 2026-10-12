/* Complexes view: which ships each kind of Factional Warfare complex lets
   in. Everything comes from the SDE through js/data/staticdata.js
   (SDATA.plexes, built by tools/build_static_data.py from
   dungeons.allowedShipsList and typeLists) — nothing is fetched.

   Each kind is a row; each variant the client names (NVY, ADV, AF) a line
   with a five-step ladder from frigate to battleship, filled up to the
   largest hull the variant admits, CCP's own sentence, and the hull
   classes and excluded ships behind a disclosure.
   Depends on i18n.js and SDATA. */
"use strict";

const PlexesView = (() => {
  const SIZES = 5;   // frigate, destroyer, cruiser, battlecruiser, battleship

  async function load() {
    /* Static data only. */
  }

  const L = obj => (obj && (obj[LANG] || obj.en)) || "";

  function ladder(max) {
    return `<span class="plex-ladder" aria-hidden="true">${
      Array.from({ length: SIZES }, (_, i) => `<i${i < max ? ' class="on"' : ""}></i>`).join("")
    }</span>`;
  }

  function cell(c) {
    const classes = c.groups.map(g => `${esc(L(g))} <span class="num">${fmtNum(g.n)}</span>`).join(", ");
    const excluded = c.excluded.length
      ? `<p class="plex-out"><span>${esc(t("plex_excluded"))}</span> ${c.excluded.map(x => esc(L(x))).join(", ")}</p>`
      : "";
    return `
      <li class="plex-variant">
        <span class="plex-codes">${c.codes[LANG].map(esc).join(", ")}</span>
        <span class="plex-size">${ladder(c.max)}<span>${esc(t("plex_upto_" + c.max))}</span></span>
        <span class="plex-desc">${esc(c.desc[LANG])}</span>
        <details class="plex-more">
          <summary>${fmtNum(c.ships)} ${esc(t(c.ships === 1 ? "plex_ship" : "plex_ships"))}</summary>
          <p>${classes}</p>
          ${excluded}
        </details>
      </li>`;
  }

  function render() {
    document.getElementById("plexes").innerHTML = (SDATA.plexes || []).map(row => `
      <section class="plex-row">
        <h2>${esc(L(row.title))}</h2>
        <ul>${row.cells.map(cell).join("")}</ul>
      </section>`).join("");
  }

  return { load, render };
})();
