"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const dist = path.resolve(__dirname, "..", "dist");
const box = { window: {} };
for (const file of ["data.js", "archive-utils.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(dist, file), "utf8"), box);
}
const { seasons, cases, people, careers, hero, spinoffs, guide } = box.window.TangArchive;
const { groupEpisodes, filterCases, formatEpisodes, collectGuests } = box.window.ArchiveUtils;
const ids = new Set(cases.map(item => item.id));
const seasonIds = new Set(seasons.map(season => season.id));
assert.equal(ids.size, 26);
assert.equal(cases.length, 26);
assert.equal(new Set(cases.map(item => item.title)).size, 26);
assert.deepEqual(Array.from(seasons, season => season.episodes), [36, 40, 40, 21]);

const expected = {
  s1: "长安红茶 甘棠驿怪谈 石桥图 黄梅杀 众生堂 鼍神 人面花 参天楼",
  s2: "降魔变 仵作之死 风雪摩家店 千重渡 通天犀 云鼎醉 上仙坊的来信 供养人",
  s3: "康国的金桃 成佛寺的哭声 白泽的踪迹 诺皋记 旗亭画壁 去天尺五 借龄者 盛世马球",
  s4: "解忧店 眚宫歌"
};
function assertLink(value) {
  assert.equal(new URL(value).protocol, "https:");
}
function assertImage(image) {
  assertLink(image.source);
  const bytes = fs.readFileSync(path.join(dist, image.file));
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
}
for (const season of seasons) {
  const subset = cases.filter(item => item.season === season.id);
  assert.equal(subset.map(item => item.title).join(" "), expected[season.id]);
  assert.equal(groupEpisodes(subset, season.episodes).filter(ep => ep.caseIds.length).length, season.episodes);
  assert.equal(season.episodeLinks.length, season.episodes);
  for (const url of season.episodeLinks) assertLink(url);
  assertLink(season.official);
}
for (const item of cases) {
  assert(seasonIds.has(item.season));
  assert(item.hook && item.summary && item.outcome && item.place);
  assert(item.clues.length >= 2 && item.people.length >= 3);
  assert.equal(item.people.length, new Set(item.people).size);
  assert.equal(item.episodes.length, new Set(item.episodes).size);
  assert(item.episodes.every(ep => Number.isInteger(ep) && ep > 0 && ep <= seasons.find(s => s.id === item.season).episodes));
  assertLink(item.reference);
  assert.equal(item.image.kind, "illustration");
  assert(item.image.label && item.image.note);
  assertLink(item.image.source);
  assert.match(fs.readFileSync(path.join(dist, item.image.file), "utf8"), /^<svg /);
  if (item.still) {
    assertImage(item.still);
    assert(item.episodes.includes(item.still.episode));
    assert(item.still.label && item.still.note);
  }
}
assert.equal(new Set(cases.map(item => item.image.file)).size, 26);
assert.equal(cases.filter(item => item.still).length, 5);
assert.equal(people.find(item => item.id === "xue").image.file, "assets/xue-changan.webp");
assert.deepEqual(Array.from(spinoffs, item => item.title), ["大唐来的苏无名", "唐诡奇谭之长安县尉", "唐诡奇谭之九重楼"]);
for (const item of spinoffs) {
  assert(item.caseName && item.threads.length >= 2);
  assert(item.related.every(([id]) => ids.has(id)));
  for (const [, url] of item.links) assertLink(url);
}
for (const group of guide) for (const [, url] of group.links) assertLink(url);
for (const item of people) {
  assertImage(item.image);
  assert(cases.some(record => record.people.includes(item.name)));
}
for (const person of careers) {
  assert(people.some(item => item.name === person.name));
  for (const entry of person.entries) {
    assertLink(entry.source);
    assert(entry.rank?.label && entry.rank.note);
    if (entry.rank.source) assertLink(entry.rank.source[1]);
    assert(entry.cases.every(id => ids.has(id)));
  }
}
assertImage(hero);
assert.equal(formatEpisodes(cases[1].episodes), "第 7–9 集、第 13–14 集");
assert.equal(filterCases(cases, { season: "s3", query: "紫蛇 孟不疑" })[0]?.title, "诺皋记");
assert.equal(filterCases(cases, { season: "s4", query: "太子弘" }).length, 0);
assert.equal(filterCases(cases, { season: "s4", query: "马球杖" })[0]?.title, "眚宫歌");
assert.equal(filterCases(cases, { savedOnly: true, saved: ["s1-1"] })[0]?.title, "长安红茶");
assert.equal(collectGuests(cases, people).filter(x => x.name === "苏无名").length, 0);
console.log("26 named arcs, 137 episodes, 6 cast portraits, 26 clue plates, 5 verified stills, 3 spinoffs, ranks and search checks passed.");
