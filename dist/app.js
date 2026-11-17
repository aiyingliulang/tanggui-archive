"use strict";

const { seasons, cases, people, guests, careers, hero, spinoffs, guide } = window.TangArchive;
const { filterCases, collectGuests, formatEpisodes, groupEpisodes } = window.ArchiveUtils;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

const seasonIndex = new Map(seasons.map(item => [item.id, item]));
const caseIndex = new Map(cases.map(item => [item.id, item]));
const guestIndex = new Map(guests.map(item => [item.name, item]));
const mainPersonSet = new Set(people.map(item => item.name));
const storageKey = "tanggui-saved-v1";

const dialog = $("#record-dialog");
const search = $("#case-search");
const searchClear = $("#case-search-clear");
const guestSearch = $("#guest-search");
const guestSearchClear = $("#guest-search-clear");
const state = { season: "all", query: "", savedOnly: false, saved: loadSaved() };

let restoreFocus;
let activeScreen;
let currentCaseId = null;
let guestView = "alpha";
let guestQuery = "";
const screens = $$("[data-screen]");

function loadSaved() {
  try {
    const ids = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(ids) ? ids.filter(id => caseIndex.has(id)) : []);
  } catch {
    return new Set();
  }
}

function imageTag(image, className, alt, loading = "lazy") {
  if (!image) return "";
  const dims = className === "person-image" || className === "team-avatar"
    ? ' width="260" height="346"'
    : "";
  return `<img class="${className}" src="${escape(image.file)}" alt="${escape(alt)}" loading="${loading}" decoding="async"${dims}>`;
}

function sourceLink([label, url]) {
  return `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(label)} ↗</a>`;
}

function visualTag(item, detail = false) {
  const kind = item.image.kind === "still" ? "原剧画面" : "线索插图";
  const caption = detail
    ? `<div class="visual-caption-text"><strong>${escape(item.image.label)}</strong><span>${escape(item.image.note)}</span></div>`
    : `<span>${escape(item.image.label)}</span>`;
  return `<figure class="case-visual ${item.image.kind}">
    ${imageTag(item.image, "case-image", item.image.label, detail ? "eager" : "lazy")}
    <figcaption><small>${kind}</small>${caption}</figcaption>
  </figure>`;
}

function caseLinks(ids) {
  return ids.map(id => {
    const item = caseIndex.get(id);
    return item ? `<a class="chip" href="#case/${id}">${escape(item.title)}</a>` : "";
  }).join("");
}

function bookmark(item, showLabel = false) {
  const active = state.saved.has(item.id);
  const labelText = active ? "已藏" : "藏卷";
  return `<button class="bookmark${showLabel ? " bookmark-labeled" : ""}" type="button" data-save="${item.id}" aria-label="${active ? "取消收藏" : "收藏"}${escape(item.title)}" aria-pressed="${active}" title="${active ? "取消收藏" : "收藏案卷"}"><span aria-hidden="true">${active ? "★" : "☆"}</span>${showLabel ? `<em>${labelText}</em>` : ""}</button>`;
}

function syncSavedIndicators() {
  const count = state.saved.size;
  $("#saved-toggle").setAttribute("aria-pressed", String(state.savedOnly));
  $("#saved-toggle").textContent = `${state.savedOnly ? "★" : "☆"} 已收藏 ${count}`;
  const mastCount = $("#masthead-saved-count");
  if (mastCount) mastCount.textContent = String(count);
  const mastBtn = $("#masthead-saved");
  if (mastBtn) mastBtn.dataset.hasSaved = count > 0 ? "true" : "false";
}

function renderActivePills() {
  const pills = [];
  if (state.season !== "all") {
    const s = seasonIndex.get(state.season);
    if (s) pills.push(`<button type="button" class="filter-pill" data-clear-season>卷册：${escape(s.short)} <span aria-hidden="true">×</span></button>`);
  }
  if (state.query.trim()) {
    pills.push(`<button type="button" class="filter-pill" data-clear-query>检索：${escape(state.query.trim())} <span aria-hidden="true">×</span></button>`);
  }
  if (state.savedOnly) {
    pills.push(`<button type="button" class="filter-pill" data-clear-saved>仅看已收藏 <span aria-hidden="true">×</span></button>`);
  }
  const box = $("#active-filter-pills");
  if (box) box.innerHTML = pills.join("");
  if (searchClear) searchClear.hidden = !state.query.length;
}

function renderCases() {
  const filtered = filterCases(cases, state);
  $("#result-count").textContent = `显示 ${filtered.length} / ${cases.length} 案`;
  syncSavedIndicators();
  renderActivePills();

  for (const button of $$("[data-season]")) {
    button.setAttribute("aria-pressed", String(button.dataset.season === state.season));
  }

  $("#case-grid").innerHTML = filtered.length ? filtered.map(item => {
    const season = seasonIndex.get(item.season);
    return `<article class="case-card" data-volume="${season.id}">
      <a href="#case/${item.id}" class="case-cover" aria-label="查阅${escape(item.title)}">
        ${visualTag(item)}
        <span class="case-number">${season.mark}卷 <b>${String(item.order).padStart(2, "0")}</b></span>
      </a>
      <div class="case-body">
        <div class="case-meta">
          <span class="meta-vol">${escape(season.short)} · ${season.year}</span>
          <span class="tag">${escape(item.place)}</span>
        </div>
        <h3><a href="#case/${item.id}">${escape(item.title)}</a></h3>
        <p>${escape(item.hook)}</p>
        <div class="case-stats">
          <span>${item.clues.length} 条勘验线索</span>
          <i aria-hidden="true">·</i>
          <span>${item.people.length} 位涉案人物</span>
        </div>
        <div class="case-foot">
          <span class="ep-range">${formatEpisodes(item.episodes)}</span>
          <div class="case-foot-actions">
            <a class="open-case-link" href="#case/${item.id}">查阅卷宗</a>
            ${bookmark(item)}
          </div>
        </div>
      </div>
    </article>`;
  }).join("") : `<div class="empty">
    <p class="eyebrow">查无此卷</p>
    <h3>${state.savedOnly ? "当前筛选条件下尚无已藏案卷" : "未找到匹配的案卷记录"}</h3>
    <p>可尝试更换案名、地名、人物姓名，或清空当前筛选条件。</p>
    <button type="button" data-reset>查看全部二十六宗案件</button>
  </div>`;
}

function guestProfile(name, caseId) {
  const person = guestIndex.get(name);
  if (!person) return "";
  const appearances = person.appearances.filter(entry => !caseId || entry.caseId === caseId);
  const sources = [...new Map(appearances.flatMap(entry => entry.sources).map(link => [link[1], link])).values()];
  return `<details class="guest-profile">
    <summary>${escape(name)} · 人物档案（含剧情）</summary>
    <div class="guest-profile-body">
      <p class="person-role">${escape(person.role)}</p>
      <p>${escape(person.bio)}</p>
      <div class="chips">${caseLinks(person.appearances.map(entry => entry.caseId))}</div>
      <p class="profile-sources">档案依据：${sources.map(sourceLink).join(" · ")}</p>
      <button class="chip" type="button" data-person="${escape(name)}">检索${escape(name)}的案卷 ↗</button>
    </div>
  </details>`;
}

function renderPeople() {
  $("#people-grid").innerHTML = people.map(person => {
    const ids = cases.filter(item => item.people.includes(person.name)).map(item => item.id);
    return `<article class="person-card">
      <div class="person-portrait">${imageTag(person.image, "person-image", `${person.actor}饰${person.name}`)}</div>
      <div class="person-content">
        <div class="person-header">
          <div>
            <span class="person-role">${escape(person.role)}</span>
            <h3 class="person-name">${escape(person.name)}</h3>
          </div>
          <small class="person-actor">${escape(person.actor)} 饰</small>
        </div>
        <p>${escape(person.bio)}</p>
        <div class="person-meta-links">
          <details class="person-sources"><summary>简介依据</summary><div class="person-sources-list">${person.sources.map(sourceLink).join(" · ")}</div></details>
          <a class="portrait-credit" href="${escape(person.image.source)}" target="_blank" rel="noreferrer">角色图来源 ↗</a>
        </div>
        <button class="person-find" data-person="${escape(person.name)}" type="button">查关联案卷 · ${ids.length} 案 <span aria-hidden="true">↗</span></button>
      </div>
    </article>`;
  }).join("");

  renderGuestLists();
}

function renderGuestLists() {
  const indexedGuests = collectGuests(cases, people);
  const q = guestQuery.trim().normalize("NFKC").toLowerCase();
  $("#guest-count").textContent = `${indexedGuests.length} 个条目`;
  if (guestSearchClear) guestSearchClear.hidden = !guestQuery.length;

  const matchedGuests = q
    ? indexedGuests.filter(person => {
        const caseNames = person.caseIds.map(id => caseIndex.get(id)?.title || "").join(" ");
        return `${person.name} ${caseNames}`.normalize("NFKC").toLowerCase().includes(q);
      })
    : indexedGuests;

  const statusEl = $("#guest-filter-status");
  if (statusEl) {
    statusEl.textContent = q ? `匹配 ${matchedGuests.length} / ${indexedGuests.length} 位单元人物` : `共收录 ${indexedGuests.length} 位单元人物，展开单条可阅身份与经历`;
  }

  $("#guest-people").innerHTML = matchedGuests.length
    ? matchedGuests.map(person => `<article class="guest-alpha-card">
        <div class="guest-alpha-head">
          <h3>${escape(person.name)}</h3>
          <div class="chips">${caseLinks(person.caseIds)}</div>
        </div>
        ${guestProfile(person.name)}
      </article>`).join("")
    : `<div class="empty guest-empty"><p>未找到匹配「${escape(guestQuery.trim())}」的单元人物。</p><button type="button" data-clear-guest>显示全部单元人物</button></div>`;

  const matchedSet = new Set(matchedGuests.map(item => item.name));
  const sectionsHtml = seasons.map(season => {
    const records = cases.filter(item => item.season === season.id);
    const caseBlocks = records.map(item => {
      const names = [...new Set(item.people)].filter(name => !mainPersonSet.has(name) && (!q || matchedSet.has(name)));
      if (!names.length) return "";
      return `<article class="guest-case">
        <div class="guest-case-head">
          <span class="guest-case-order">${season.mark} · ${String(item.order).padStart(2, "0")}</span>
          <a class="guest-case-title" href="#case/${item.id}">${escape(item.title)}</a>
        </div>
        <div class="chips">${names.map(name => `<button class="chip" type="button" data-person="${escape(name)}">${escape(name)}</button>`).join("")}</div>
        <div class="guest-case-profiles">${names.map(name => guestProfile(name, item.id)).join("")}</div>
      </article>`;
    }).filter(Boolean).join("");
    return caseBlocks ? `<section class="guest-season"><h3>${escape(season.title)}</h3>${caseBlocks}</section>` : "";
  }).filter(Boolean).join("");

  $("#guest-by-case").innerHTML = sectionsHtml || `<div class="empty guest-empty"><p>未找到匹配「${escape(guestQuery.trim())}」的案卷人物。</p><button type="button" data-clear-guest>显示全部单元人物</button></div>`;
}

function setGuestView(view) {
  guestView = view;
  $("#guest-people").hidden = view !== "alpha";
  $("#guest-by-case").hidden = view !== "cases";
  for (const button of $$("[data-guest-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.guestView === view));
  }
}

function renderCareers() {
  $("#career-grid").innerHTML = careers.map(person => {
    const profile = people.find(p => p.name === person.name);
    return `<article class="career-card">
      <header class="career-card-head">
        <div>
          <span class="eyebrow">吏部告身 · 任职履历</span>
          <h3>${escape(person.name)}</h3>
        </div>
        ${profile ? `<span class="career-actor">${escape(profile.actor)} 饰 · 共 ${person.entries.length} 任</span>` : ""}
      </header>
      <ol class="career-timeline">${person.entries.map((entry, index) => `<li>
        <details ${index === 0 ? "open" : ""}>
          <summary>
            <span class="era">${escape(seasonIndex.get(entry.season).short)}</span>
            <span class="career-title-text">${escape(entry.title)} <small>第 ${entry.episode} 集</small></span>
            <strong class="rank-label">${escape(entry.rank.label)}</strong>
          </summary>
          <div class="career-detail-body">
            <p>${escape(entry.note)}</p>
            <p class="rank-note">${escape(entry.rank.note)} ${entry.rank.source ? sourceLink(entry.rank.source) : ""}</p>
            <div class="chips">${caseLinks(entry.cases)}${entry.source ? `<a class="career-ref-link" href="${escape(entry.source)}" target="_blank" rel="noreferrer">查看任职出处 ↗</a>` : ""}</div>
          </div>
        </details>
      </li>`).join("")}</ol>
    </article>`;
  }).join("");
}

function renderSpinoffs() {
  $("#spinoff-list").innerHTML = spinoffs.map(item => `<article class="spinoff-card" id="spin-${item.id}">
    <div class="spinoff-label"><span class="seal" aria-hidden="true">外<br>传</span><span>${item.year} · ${escape(item.tag)}</span></div>
    <h3>${escape(item.title)}</h3>
    <p class="spinoff-cast">${escape(item.cast)}</p>
    <h4>${escape(item.caseName)}</h4>
    <p>${escape(item.summary)}</p>
    <ul class="spinoff-clues">${item.threads.map(line => `<li>${escape(line)}</li>`).join("")}</ul>
    <div class="source-links">${item.links.map(sourceLink).join("")}</div>
    <div class="chips">${item.related.map(([id, label]) => `<a class="chip" href="#case/${id}">${escape(label)} · ${escape(caseIndex.get(id).title)} ↗</a>`).join("")}</div>
  </article>`).join("");
}

function renderHome() {
  $("#home-volumes").innerHTML = seasons.map(season => {
    const subset = cases.filter(item => item.season === season.id);
    const first = subset[0]?.title || "";
    const last = subset[subset.length - 1]?.title || "";
    return `<button type="button" class="volume-scroll-card" data-open-season="${season.id}">
      <div class="volume-card-top">
        <span class="volume-seal" aria-hidden="true">${escape(season.mark)}</span>
        <div class="volume-meta">
          <span class="volume-year">${season.year} 首播</span>
          <strong>${season.count} 案 · ${season.episodes} 集</strong>
        </div>
      </div>
      <h3>${escape(season.title)}</h3>
      <p>${escape(season.summary)}</p>
      <div class="volume-card-foot">
        <span>${escape(first)} → ${escape(last)}</span>
        <em aria-hidden="true">入卷 ↗</em>
      </div>
    </button>`;
  }).join("");

  const entries = [
    ["cases", "案卷库 · 26 宗", "正传与《唐诡奇谭》", "查阅 26 宗单元诡案，按卷册、人物或物证线索交叉检索。"],
    ["people", `人物册 · ${people.length + guests.length} 档`, "小队与单元来客", "六位常驻角色完整海报履历，附 162 份防剧透折叠来客档案。"],
    ["career", "官职簿 · 唐六典", "两位主角的仕途", "对照苏无名、卢凌风历次迁转任命与唐代官品阶次。"],
    ["spinoffs", "别卷录 · 3 部", "三部衍生短剧", "翻看民国唐府、悲田院与九重楼三条外传案线及正传呼应。"]
  ];
  $("#home-entries").innerHTML = entries.map(([id, label, title, note]) =>
    `<a class="home-entry" href="#${id}">
      <span class="eyebrow">${label}</span>
      <h3>${title}</h3>
      <p>${note}</p>
      <span class="home-arrow" aria-hidden="true">↗</span>
    </a>`
  ).join("");

  $("#home-team").innerHTML = people.map(person => {
    const count = cases.filter(item => item.people.includes(person.name)).length;
    return `<article class="team-mini-card">
      <div class="team-mini-media">${imageTag(person.image, "team-avatar", `${person.actor}饰${person.name}`)}</div>
      <div class="team-mini-body">
        <span class="team-mini-role">${escape(person.role)}</span>
        <h3>${escape(person.name)}</h3>
        <small>${escape(person.actor)} 饰</small>
        <button type="button" class="chip" data-person="${escape(person.name)}">涉 ${count} 案 ↗</button>
      </div>
    </article>`;
  }).join("");
}

function renderSources() {
  $("#source-guide").innerHTML = guide.map(group =>
    `<article>
      <h3>${escape(group.title)}</h3>
      <p>${escape(group.note)}</p>
      <div class="source-links">${group.links.map(sourceLink).join("")}</div>
    </article>`
  ).join("");

  $("#source-list").innerHTML = seasons.map(season => {
    const records = cases.filter(item => item.season === season.id);
    const episodes = groupEpisodes(records, season.episodes);
    const covered = episodes.filter(ep => ep.caseIds.length).length;
    return `<details class="source-card">
      <summary>
        <span class="volume-mark">${season.mark}</span>
        <span><strong>${escape(season.title)}</strong><small>${season.year} · ${records.length} 案 · ${covered}/${season.episodes} 集已编目</small></span>
      </summary>
      <div class="source-card-body">
        <p>${escape(season.summary)}</p>
        <div class="source-links">
          <a href="${escape(season.official)}" target="_blank" rel="noreferrer">爱奇艺剧集页 ↗</a>
          <a href="${escape(season.reference)}" target="_blank" rel="noreferrer">分集参考 ↗</a>
          ${sourceLink(season.extraSource)}
        </div>
        <ol class="episode-grid">${episodes.map(ep => `<li>
          <a class="episode-link" href="${escape(season.episodeLinks[ep.number - 1])}" target="_blank" rel="noreferrer">第 ${ep.number} 集 ↗</a>
          <div class="chips">${caseLinks(ep.caseIds)}</div>
        </li>`).join("")}</ol>
      </div>
    </details>`;
  }).join("") + `<p class="scope-note">主档收录杨旭文与杨志刚共同主演的三部长剧及《唐诡奇谭》。三部衍生短剧见<a href="#spinoffs">外传</a>。《蜀道》开拍后待播出再编目。案卷使用原创梗概，剧照来源见各档案，剧集及剧照权益归相关权利人。</p>`;
}

function renderCase(item) {
  currentCaseId = item.id;
  const season = seasonIndex.get(item.season);
  const idx = cases.indexOf(item);
  const previous = cases[idx - 1];
  const next = cases[idx + 1];
  const mainCast = item.people.filter(name => mainPersonSet.has(name));
  const unitCast = item.people.filter(name => !mainPersonSet.has(name));

  const eyebrowEl = $("#dialog-eyebrow");
  if (eyebrowEl) {
    eyebrowEl.textContent = `${season.title} · 第 ${String(item.order).padStart(2, "0")} 案`;
  }

  $("#record-content").innerHTML = `
    <div class="dossier-cover-block">
      ${visualTag(item, true)}
      <div class="source-links cover-source">
        <span>第 ${item.image.episode} 集实景剧照</span>
        ${sourceLink(["核对封面画面出处", item.image.source])}
      </div>
    </div>
    <div class="dialog-body">
      <div class="dialog-title">
        <div>
          <p class="eyebrow">${escape(season.short)} · 第 ${item.order} 案 · ${formatEpisodes(item.episodes)}</p>
          <h2 id="record-title">${escape(item.title)}</h2>
        </div>
        ${bookmark(item, true)}
      </div>

      <div class="dossier-columns">
        <div class="dossier-main">
          <div class="case-lead-plaque">
            <div class="case-place"><span>案发地域</span><strong>${escape(item.place)}</strong></div>
            <p class="case-intro">${escape(item.hook)}</p>
          </div>

          <section class="dossier-block">
            <h3>案情梗概</h3>
            <p>${escape(item.summary)}</p>
          </section>

          ${item.still && item.still.source !== item.image.source ? `<aside class="case-still">
            <div class="case-still-head">
              <h3>案中画面 · 第 ${item.still.episode} 集</h3>
              ${sourceLink(["原剧画面出处", item.still.source])}
            </div>
            ${visualTag({ image: item.still }, true)}
          </aside>` : ""}

          <section class="dossier-block">
            <h3>查案线索</h3>
            <ol class="clues">${item.clues.map((clue, i) => `<li><span class="clue-num">${String(i + 1).padStart(2, "0")}</span><span>${escape(clue)}</span></li>`).join("")}</ol>
          </section>

          <details class="spoiler">
            <summary>
              <span class="spoiler-seal" aria-hidden="true">密</span>
              <span>展开案件真相 · 含关键剧透</span>
            </summary>
            <p>${escape(item.outcome)}</p>
          </details>
        </div>

        <aside class="dossier-side" aria-label="涉案人物与来源">
          <section class="side-panel">
            <h3>探案同行 · ${mainCast.length} 人</h3>
            <div class="chips">${mainCast.map(name => `<button type="button" data-person="${escape(name)}" class="chip chip-main">${escape(name)} ↗</button>`).join("")}</div>
          </section>

          ${unitCast.length ? `<section class="side-panel">
            <h3>本案人物 · ${unitCast.length} 人</h3>
            <div class="chips">${unitCast.map(name => `<button type="button" data-person="${escape(name)}" class="chip">${escape(name)} ↗</button>`).join("")}</div>
            <details class="case-guest-drawer">
              <summary>本案人物小传（含剧情）</summary>
              <div class="case-guest-drawer-list">
                ${unitCast.map(name => guestProfile(name, item.id)).join("")}
              </div>
            </details>
          </section>` : ""}

          <section class="side-panel">
            <h3>考据与片源</h3>
            <div class="source-links side-source-links">
              <a href="${escape(item.reference || season.reference)}" target="_blank" rel="noreferrer">案情分集依据 ↗</a>
              ${sourceLink(season.extraSource)}
              <a href="${escape(season.official)}" target="_blank" rel="noreferrer">前往正版平台观看 ↗</a>
            </div>
          </section>
        </aside>
      </div>

      <nav class="case-nav" aria-label="前后案卷">
        ${previous ? `<a class="case-nav-link prev" href="#case/${previous.id}"><small>← 上一宗</small><strong>${escape(previous.title)}</strong></a>` : "<span></span>"}
        ${next ? `<a class="case-nav-link next" href="#case/${next.id}"><small>下一宗 →</small><strong>${escape(next.title)}</strong></a>` : "<span></span>"}
      </nav>
    </div>`;
  dialog.scrollTop = 0;
}

function showScreen(id) {
  if (id === activeScreen) return;
  activeScreen = id;
  for (const section of screens) section.hidden = section.id !== id;
  $("#route-shell").hidden = id === "top";
  const target = document.getElementById(id);
  const heading = target?.querySelector("h2");
  document.title = id === "top" || !heading ? "唐诡宇宙 · 大唐诡案档案馆" : heading.textContent + " · 唐诡宇宙";
  for (const link of $$("[data-route]")) {
    if (link.dataset.route === id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

function syncHash() {
  if (location.hash === "#archive-main") {
    $("#archive-main")?.focus({ preventScroll: true });
    return;
  }
  const item = caseIndex.get(location.hash.slice(6));
  if (location.hash.startsWith("#case/") && item) {
    showScreen(activeScreen || "cases");
    renderCase(item);
    if (!dialog.open) {
      restoreFocus = document.activeElement;
      dialog.showModal();
      $(".close-dialog")?.focus({ preventScroll: true });
    } else {
      $(".close-dialog")?.focus({ preventScroll: true });
    }
  } else {
    if (dialog.open) dialog.close();
    currentCaseId = null;
    const id = location.hash.slice(1);
    showScreen(screens.some(section => section.id === id) ? id : "top");
  }
}

function clearFilters() {
  state.season = "all";
  state.query = "";
  state.savedOnly = false;
  search.value = "";
}

function findPerson(name) {
  clearFilters();
  state.query = name;
  search.value = name;
  renderCases();
  openSearch(false);
}

function openRandomCase() {
  const pool = filterCases(cases, state);
  const source = pool.length > 1 ? pool : cases;
  const candidates = currentCaseId ? source.filter(item => item.id !== currentCaseId) : source;
  const pick = candidates[Math.floor(Math.random() * candidates.length)] || cases[0];
  location.hash = `case/${pick.id}`;
}

function toggleSave(button) {
  const id = button.dataset.save;
  if (state.saved.has(id)) state.saved.delete(id);
  else state.saved.add(id);
  try { localStorage.setItem(storageKey, JSON.stringify([...state.saved])); } catch {}
  renderCases();
  if (dialog.contains(button)) {
    const showLabel = button.classList.contains("bookmark-labeled");
    button.outerHTML = bookmark(caseIndex.get(id), showLabel);
    dialog.querySelector("[data-save]")?.focus({ preventScroll: true });
  } else {
    const target = document.querySelector(`.case-grid [data-save="${id}"]`) || $("#saved-toggle");
    target?.focus({ preventScroll: true });
  }
}

$("#hero-ledger").innerHTML = [
  [seasons.length, "部主档作品"],
  [cases.length, "宗单元诡案"],
  [guests.length, "份来客档案"],
  [seasons.reduce((total, s) => total + s.episodes, 0), "集分集索引"]
].map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join("");

if (hero) {
  $(".hero").style.setProperty("--hero-image", `url("${hero.file}")`);
  $("#hero-credit").innerHTML = `<a href="${escape(hero.source)}" target="_blank" rel="noreferrer">${escape(hero.label)} ↗</a>`;
}

$("#season-filters").innerHTML = [
  { id: "all", short: "全部", count: cases.length },
  ...seasons
].map(s => `<button data-season="${s.id}" aria-pressed="false" type="button"><span>${escape(s.short)}</span><small>${s.count}</small></button>`).join("");

renderHome();
renderCases();
renderPeople();
setGuestView(guestView);
renderCareers();
renderSpinoffs();
renderSources();
syncHash();

$(".skip-link")?.addEventListener("click", event => {
  event.preventDefault();
  const mainEl = $("#archive-main");
  mainEl?.focus({ preventScroll: true });
  mainEl?.scrollIntoView({ block: "start" });
});

search.addEventListener("input", () => {
  state.query = search.value;
  renderCases();
});

searchClear?.addEventListener("click", () => {
  state.query = "";
  search.value = "";
  renderCases();
  search.focus();
});

guestSearch?.addEventListener("input", () => {
  guestQuery = guestSearch.value;
  renderGuestLists();
});

guestSearchClear?.addEventListener("click", () => {
  guestQuery = "";
  guestSearch.value = "";
  renderGuestLists();
  guestSearch.focus();
});

function openSearch(focusInput = true) {
  if (dialog.open) dialog.close();
  location.hash = "cases";
  showScreen("cases");
  if (focusInput) search.focus();
}

$(".search-toggle").addEventListener("click", () => openSearch(true));

$("#masthead-saved")?.addEventListener("click", () => {
  if (dialog.open) dialog.close();
  state.season = "all";
  state.query = "";
  search.value = "";
  state.savedOnly = true;
  renderCases();
  location.hash = "cases";
  showScreen("cases");
});

$("#saved-toggle").addEventListener("click", () => {
  state.savedOnly = !state.savedOnly;
  renderCases();
});

$("#career-expand-toggle")?.addEventListener("click", event => {
  const btn = event.currentTarget;
  const expand = btn.dataset.expanded !== "true";
  btn.dataset.expanded = String(expand);
  btn.textContent = expand ? "收起其余仕途" : "展开全部仕途";
  $$("#career-grid details").forEach((el, idx) => {
    el.open = expand || idx === 0;
  });
});

$(".close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  currentCaseId = null;
  if (!location.hash.startsWith("#case/")) return;
  history.replaceState(null, "", "#" + activeScreen);
  if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  else document.getElementById(activeScreen)?.querySelector("h1, h2")?.focus({ preventScroll: true });
});

window.addEventListener("hashchange", syncHash);

const sponsorDialog = $("#sponsor-dialog");
$("#sponsor-button").addEventListener("click", () => sponsorDialog.showModal());
sponsorDialog.addEventListener("click", event => {
  if (event.target === sponsorDialog) sponsorDialog.close();
});

document.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;
  if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey && !dialog.open && !sponsorDialog.open) {
    event.preventDefault();
    if (activeScreen === "people" && guestSearch) {
      $("#guest-index").open = true;
      guestSearch.focus();
    } else {
      openSearch(true);
    }
    return;
  }
  if (dialog.open && currentCaseId && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const idx = cases.findIndex(item => item.id === currentCaseId);
    if (event.key === "ArrowLeft" && idx > 0) {
      event.preventDefault();
      location.hash = `case/${cases[idx - 1].id}`;
    } else if (event.key === "ArrowRight" && idx >= 0 && idx < cases.length - 1) {
      event.preventDefault();
      location.hash = `case/${cases[idx + 1].id}`;
    }
  }
});

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const {
    season,
    openSeason,
    person,
    save,
    reset,
    guestView: view,
    randomCase,
    clearSeason,
    clearQuery,
    clearSaved,
    clearGuest
  } = button.dataset;

  if (view) setGuestView(view);
  if (season) { state.season = season; renderCases(); }
  if (openSeason) {
    clearFilters();
    state.season = openSeason;
    renderCases();
    location.hash = "cases";
    showScreen("cases");
  }
  if (person) findPerson(person);
  if (save) toggleSave(button);
  if (randomCase !== undefined) openRandomCase();
  if (reset !== undefined) { clearFilters(); renderCases(); search.focus(); }
  if (clearSeason !== undefined) { state.season = "all"; renderCases(); }
  if (clearQuery !== undefined) { state.query = ""; search.value = ""; renderCases(); search.focus(); }
  if (clearSaved !== undefined) { state.savedOnly = false; renderCases(); }
  if (clearGuest !== undefined && guestSearch) { guestQuery = ""; guestSearch.value = ""; renderGuestLists(); guestSearch.focus(); }
});
