/* FAQ view: explains data sources, mechanics, and how to read each tab.
   Static content from i18n. Depends on i18n.js. */
"use strict";

const FaqView = (() => {
  const TOPICS = [
    "data", "map", "roles", "adv", "insurgency", "delta", "lp", "home",
    "campaigns", "feed"
  ];

  async function load() {
    /* Static content only. */
  }

  function render() {
    const container = document.getElementById("faq");
    container.innerHTML = TOPICS.map(key => `
      <details class="faq-item">
        <summary>${t("faq_q_" + key)}</summary>
        <p>${t("faq_a_" + key)}</p>
      </details>
    `).join("");
  }

  return { load, render };
})();
