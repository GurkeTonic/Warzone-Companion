/* Freelance jobs view. Depends on config.js, i18n.js, esi.js. */
"use strict";

const JobsView = (() => {
  let jobs = [];
  let cursorAfter = null;
  let exhausted = false;
  let stateFilter = "Active";
  const detailCache = new Map();

  async function fetchPage() {
    const params = { limit: CONFIG.JOBS_PAGE_LIMIT };
    if (cursorAfter) params.after = cursorAfter;
    const res = await ESI.get("/freelance-jobs", params);
    const page = res.freelance_jobs || [];
    jobs = jobs.concat(page);
    cursorAfter = res.cursor?.after || null;
    if (!cursorAfter || page.length === 0) exhausted = true;
  }

  async function load() {
    if (jobs.length === 0 && !exhausted) await fetchPage();
  }

  async function loadMore() {
    if (exhausted) return;
    try {
      await fetchPage();
    } catch (err) {
      App.reportError(err);
      return;
    }
    render();
  }

  async function toggleDetail(row, jobId) {
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains("job-detail")) {
      existing.remove();
      return;
    }
    document.querySelectorAll(".job-detail").forEach(el => el.remove());

    let d = detailCache.get(jobId);
    if (!d) {
      try {
        d = await ESI.get(`/freelance-jobs/${jobId}`);
        detailCache.set(jobId, d);
      } catch (err) {
        d = { error: err.message };
      }
    }

    const tr = document.createElement("tr");
    tr.className = "job-detail";
    /* Creator entries are {id, name} objects; names come embedded in the response. */
    const creator = d.details?.creator;
    const creatorName = creator?.corporation?.name || creator?.character?.name;
    const expires = d.details?.expires
      ? new Date(d.details.expires).toLocaleString(LANG === "de" ? "de-DE" : "en-US")
      : "—";
    tr.innerHTML = `
      <td colspan="4">
        ${d.error ? `<span class="status-pill hot">${d.error}</span>` : `
        <div class="detail-grid">
          <div><span class="dlabel">${t("job_career")}</span> ${d.details?.career ?? "—"}</div>
          <div><span class="dlabel">${t("job_expires")}</span> ${expires}</div>
          <div><span class="dlabel">${t("job_creator")}</span> ${creatorName ?? "—"}</div>
          <div><span class="dlabel">${t("job_reward_contrib")}</span> ${fmtIsk(d.contribution?.reward_per_contribution)} ISK</div>
        </div>
        <p class="job-desc">${d.details?.description || t("job_desc_missing")}</p>
        `}
      </td>
    `;
    row.after(tr);
  }

  function render() {
    const sel = document.getElementById("jobs-state");
    if (sel.options.length === 0) {
      for (const s of ["Active", "Completed", "Expired", "Closed", "__all"]) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s === "__all" ? t("jobs_state_all") : s;
        sel.appendChild(opt);
      }
      sel.value = stateFilter;
      sel.addEventListener("change", () => {
        stateFilter = sel.value;
        render();
      });
    }

    const body = document.getElementById("jobs-body");
    body.innerHTML = "";

    const visible = jobs.filter(j => stateFilter === "__all" || j.state === stateFilter);
    if (visible.length === 0) {
      body.innerHTML = `<tr><td colspan="4" class="status-pill">${t("jobs_none")}</td></tr>`;
    }

    for (const j of visible) {
      const cur = j.progress?.current ?? 0;
      const des = j.progress?.desired ?? 0;
      const pct = des > 0 ? Math.min(100, (cur / des) * 100) : 0;
      const tr = document.createElement("tr");
      tr.className = "job-row";
      tr.innerHTML = `
        <td>${j.name || j.id}</td>
        <td>
          <div class="vp-bar"><div class="fill" style="width:${pct.toFixed(1)}%;background:var(--caldari)"></div></div>
          <span class="mono sub">${fmtNum(cur)} / ${fmtNum(des)}</span>
        </td>
        <td class="mono">${fmtIsk(j.reward?.remaining)} ISK</td>
        <td><span class="status-pill${j.state === "Active" ? "" : " dim"}">${j.state}</span></td>
      `;
      tr.addEventListener("click", () => toggleDetail(tr, j.id));
      body.appendChild(tr);
    }

    document.getElementById("jobs-more").classList.toggle("hidden", exhausted);
  }

  return { load, render, loadMore };
})();
