/* Leaderboards view. Depends on config.js, i18n.js, esi.js. */
"use strict";

const BoardsView = (() => {
  let chars = null;
  let corps = null;

  async function load() {
    if (chars && corps) return;
    [chars, corps] = await Promise.all([
      ESI.get("/fw/leaderboards/characters"),
      ESI.get("/fw/leaderboards/corporations")
    ]);
    const ids = [];
    for (const list of [
      chars.kills?.yesterday, chars.victory_points?.yesterday,
      corps.kills?.yesterday, corps.victory_points?.yesterday
    ]) {
      for (const e of list || []) {
        ids.push(e.character_id ?? e.corporation_id);
      }
    }
    await ESI.names(ids.filter(Boolean));
  }

  function board(title, entries, idKey) {
    const rows = (entries || []).slice(0, 10).map((e, i) => `
      <tr>
        <td class="mono rank">${i + 1}</td>
        <td>${ESI.name(e[idKey])}</td>
        <td class="mono">${fmtNum(e.amount)}</td>
      </tr>
    `).join("");
    return `
      <div class="board">
        <div class="board-title">${title}</div>
        <table class="board-table">
          <tbody>${rows || `<tr><td class="status-pill">${t("boards_none")}</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  function render() {
    if (!chars || !corps) return;
    const container = document.getElementById("boards");
    container.innerHTML =
      board(`${t("boards_chars")} — ${t("boards_kills")}`, chars.kills?.yesterday, "character_id") +
      board(`${t("boards_chars")} — ${t("boards_vp")}`, chars.victory_points?.yesterday, "character_id") +
      board(`${t("boards_corps")} — ${t("boards_kills")}`, corps.kills?.yesterday, "corporation_id") +
      board(`${t("boards_corps")} — ${t("boards_vp")}`, corps.victory_points?.yesterday, "corporation_id");
  }

  return { load, render };
})();
