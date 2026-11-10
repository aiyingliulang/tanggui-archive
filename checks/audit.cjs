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
const { seasons, cases, people, careers, hero } = box.window.TangArchive;
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
  assertImage(item.image);
}
for (const item of people) {
  assertImage(item.image);
  assert(cases.some(record => record.people.includes(item.name)));
}
for (const person of careers) {
  assert(people.some(item => item.name === person.name));
  for (const entry of person.entries) {
    assertLink(entry.source);
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
console.log("26 named arcs, 137 episodes, 6 cast portraits, 26 case stills and cover and search checks passed.");
