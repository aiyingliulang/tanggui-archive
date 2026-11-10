"use strict";

const { seasons, cases, people, careers, hero } = window.TangArchive;
const { filterCases, collectGuests, formatEpisodes, groupEpisodes } = window.ArchiveUtils;
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const seasonIndex = new Map(seasons.map(item => [item.id, item]));
const caseIndex = new Map(cases.map(item => [item.id, item]));
const storageKey = "tanggui-saved-v1";
const dialog = $("#record-dialog");
const search = $("#case-search");
const state = { season: "all", query: "", savedOnly: false, saved: loadSaved() };
let restoreFocus;

function loadSaved() {
  try {
    const ids = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(ids) ? ids.filter(id => caseIndex.has(id)) : []);
  } catch {
    return new Set();
  }
}

function imageTag(image, className, alt, loading = "lazy") {
  return image ? `<img class="${className}" src="${escape(image.file)}" alt="${escape(alt)}" loading="${loading}" decoding="async">` : "";
}

function caseLinks(ids) {
  return ids.map(id => {
    const item = caseIndex.get(id);
    return `<a class="chip" href="#case/${id}">${escape(item.title)}</a>`;
  }).join("");
}

function bookmark(item) {
  const active = state.saved.has(item.id);
  return `<button class="bookmark" type="button" data-save="${item.id}" aria-label="${active ? "取消收藏" : "收藏"}${escape(item.title)}" aria-pressed="${active}" title="${active ? "取消收藏" : "收藏"}">${active ? "★" : "☆"}</button>`;
}

function renderCases() {
  const filtered = filterCases(cases, state);
  $("#result-count").textContent = `显示 ${filtered.length} / ${cases.length} 案`;
  $("#saved-toggle").setAttribute("aria-pressed", state.savedOnly);
  $("#saved-toggle").textContent = `☆ 已收藏 ${state.saved.size}`;
  for (const button of document.querySelectorAll("[data-season]")) {
    button.setAttribute("aria-pressed", button.dataset.season === state.season);
  }
  $("#case-grid").innerHTML = filtered.length ? filtered.map(item => {
    const season = seasonIndex.get(item.season);
    return `<article class="case-card" data-volume="${season.id}">
      <a href="#case/${item.id}" class="case-cover" aria-label="查阅${escape(item.title)}">
        ${imageTag(item.image, "case-image", item.image ? `${season.title}剧照` : "")}
        <span class="case-number">${season.mark}卷 <b>${String(item.order).padStart(2, "0")}</b></span>
      </a>
      <div class="case-body">
        <div class="case-meta">${escape(season.short)} <span class="tag">${escape(item.place)}</span></div>
        <h3><a href="#case/${item.id}">${escape(item.title)}</a></h3>
        <p>${escape(item.hook)}</p>
        <div class="case-foot"><span>${formatEpisodes(item.episodes)}</span>${bookmark(item)}</div>
      </div>
    </article>`;
  }).join("") : `<div class="empty"><h3>${state.savedOnly ? "这里还没有匹配的收藏" : "未找到匹配的案卷"}</h3><button type="button" data-reset>查看全部案件</button></div>`;
}

function renderPeople() {
  $("#people-grid").innerHTML = people.map(person => {
    const ids = cases.filter(item => item.people.includes(person.name)).map(item => item.id);
    return `<article class="person-card">
      ${imageTag(person.image, "person-image", `${person.actor}饰${person.name}`)}
      <div class="person-content"><span class="person-role">${escape(person.role)}</span>
      <h3 class="person-name">${escape(person.name)}</h3><small>${escape(person.actor)} 饰</small>
      <p>${escape(person.bio)}</p><a class="portrait-credit" href="${escape(person.image.source)}" target="_blank" rel="noreferrer">角色图来源 ↗</a>
      <button class="person-find" data-person="${escape(person.name)}" type="button">查关联案卷 · ${ids.length} 案 <span aria-hidden="true">↗</span></button></div>
    </article>`;
  }).join("");
  const guests = collectGuests(cases, people);
  $("#guest-count").textContent = `${guests.length} 人`;
  $("#guest-people").innerHTML = guests.map(person => `<article><h3>${escape(person.name)}</h3><div class="chips">${caseLinks(person.caseIds)}</div></article>`).join("");
}

function renderCareers() {
  $("#career-grid").innerHTML = careers.map(person => `<article class="career-card">
    <h3>${escape(person.name)}</h3>
    <ol class="career-timeline">${person.entries.map((entry, index) => `<li><details ${index === 0 ? "open" : ""}>
      <summary><span class="era">${escape(seasonIndex.get(entry.season).short)}</span><span>${escape(entry.title)} <small>第 ${entry.episode} 集</small></span></summary>
      <p>${escape(entry.note)}</p>
      <div class="chips">${caseLinks(entry.cases)}${entry.source ? `<a href="${escape(entry.source)}" target="_blank" rel="noreferrer">查看任职出处 ↗</a>` : ""}</div>
    </details></li>`).join("")}</ol>
  </article>`).join("");
}

function renderSources() {
  $("#source-list").innerHTML = seasons.map(season => {
    const records = cases.filter(item => item.season === season.id);
    const episodes = groupEpisodes(records, season.episodes);
    const covered = episodes.filter(ep => ep.caseIds.length).length;
    return `<details class="source-card">
      <summary><span class="volume-mark">${season.mark}</span><span><strong>${escape(season.title)}</strong><small>${season.year} · ${records.length} 案 · ${covered}/${season.episodes} 集已编目</small></span></summary>
      <p>${escape(season.summary)}</p>
      <div class="source-links"><a href="${escape(season.official)}" target="_blank" rel="noreferrer">爱奇艺剧集页 ↗</a><a href="${escape(season.reference)}" target="_blank" rel="noreferrer">分集参考 ↗</a></div>
      <ol class="episode-grid">${episodes.map(ep => `<li><a class="episode-link" href="${escape(season.episodeLinks[ep.number - 1])}" target="_blank" rel="noreferrer">第 ${ep.number} 集 ↗</a><div class="chips">${caseLinks(ep.caseIds)}</div></li>`).join("")}</ol>
    </details>`;
  }).join("") + `<p class="scope-note">主档收录杨旭文与杨志刚共同主演的三部长剧及《唐诡奇谭》。《长安县尉》《九重楼》等其他主演组合的衍生短剧另列作品。《蜀道》开拍后待播出再编目。案卷使用原创梗概，剧照来源见各档案，剧集及剧照权益归相关权利人。</p>`;
}

function renderCase(item) {
  const season = seasonIndex.get(item.season);
  const previous = cases[cases.indexOf(item) - 1];
  const next = cases[cases.indexOf(item) + 1];
  $("#record-content").innerHTML = `
    ${imageTag(item.image, "dialog-image", `${season.title}剧照`, "eager")}
    <div class="dialog-body"><div class="dialog-title">
      <div><p class="eyebrow">${escape(season.short)} · 第 ${item.order} 案 · ${formatEpisodes(item.episodes)}</p>
      <h2 id="record-title">${escape(item.title)}</h2></div>${bookmark(item)}
    </div>
    <div class="case-place">${escape(item.place)}</div>
    <p class="case-intro">${escape(item.hook)}</p>
    <h3>案情梗概</h3><p>${escape(item.summary)}</p>
    <h3>查案线索</h3><ul class="clues">${item.clues.map(clue => `<li>${escape(clue)}</li>`).join("")}</ul>
    <h3>案中人物</h3><div class="chips">${item.people.map(name => `<button type="button" data-person="${escape(name)}" class="chip">${escape(name)} ↗</button>`).join("")}</div>
    <details class="spoiler"><summary>展开案件真相 · 含剧透</summary><p>${escape(item.outcome)}</p></details>
    <div class="source-links"><a href="${escape(item.reference || season.reference)}" target="_blank" rel="noreferrer">分集出处 ↗</a>${item.image ? `<a href="${escape(item.image.source)}" target="_blank" rel="noreferrer">剧照出处 ↗</a>` : ""}<a href="${escape(season.official)}" target="_blank" rel="noreferrer">观看剧集 ↗</a></div>
    <nav class="case-nav" aria-label="前后案卷">
      ${previous ? `<a href="#case/${previous.id}">← ${escape(previous.title)}</a>` : "<span></span>"}
      ${next ? `<a href="#case/${next.id}">${escape(next.title)} →</a>` : "<span></span>"}
    </nav></div>`;
  dialog.scrollTop = 0;
}

function syncHash() {
  const item = caseIndex.get(location.hash.slice(6));
  if (location.hash.startsWith("#case/") && item) {
    renderCase(item);
    if (!dialog.open) {
      restoreFocus = document.activeElement;
      dialog.showModal();
    } else {
      $(".close-dialog").focus();
    }
  } else if (dialog.open) {
    dialog.close();
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
  location.hash = "cases";
  if (dialog.open) dialog.close();
  search.focus();
}

function toggleSave(button) {
  const id = button.dataset.save;
  if (state.saved.has(id)) state.saved.delete(id);
  else state.saved.add(id);
  try { localStorage.setItem(storageKey, JSON.stringify([...state.saved])); } catch {}
  renderCases();
  if (dialog.contains(button)) {
    button.outerHTML = bookmark(caseIndex.get(id));
    dialog.querySelector("[data-save]").focus();
  } else {
    const target = document.querySelector(`[data-save="${id}"]`) || $("#saved-toggle");
    target.focus({ preventScroll: true });
  }
}

$("#hero-ledger").innerHTML = [
  [seasons.length, "部已播作品"], [cases.length, "宗单元诡案"], [seasons.reduce((total, s) => total + s.episodes, 0), "集分集索引"]
].map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`).join("");
if (hero) {
  $(".hero").style.setProperty("--hero-image", `url("${hero.file}")`);
  $("#hero-credit").innerHTML = `<a href="${escape(hero.source)}" target="_blank" rel="noreferrer">${escape(hero.label)} ↗</a>`;
}
$("#season-filters").innerHTML = [{ id: "all", short: "全部" }, ...seasons].map(s =>
  `<button data-season="${s.id}" aria-pressed="false" type="button">${escape(s.short)}</button>`
).join("");
renderCases();
renderPeople();
renderCareers();
renderSources();
syncHash();

search.addEventListener("input", () => { state.query = search.value; renderCases(); });
$(".search-toggle").addEventListener("click", () => {
  location.hash = "cases";
  search.focus();
});
$("#saved-toggle").addEventListener("click", () => {
  state.savedOnly = !state.savedOnly;
  renderCases();
});
$(".close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (!location.hash.startsWith("#case/")) return;
  history.replaceState(null, "", "#cases");
  if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  else $("#cases").scrollIntoView();
});
window.addEventListener("hashchange", syncHash);

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const { season, person, save, reset } = button.dataset;
  if (season) { state.season = season; renderCases(); }
  if (person) findPerson(person);
  if (save) toggleSave(button);
  if (reset !== undefined) { clearFilters(); renderCases(); search.focus(); }
});
