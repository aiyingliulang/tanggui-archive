const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const research = name => JSON.parse(fs.readFileSync(path.join(root, "research", name + ".json"), "utf8"));

const seasons = [
  {id:"s1", mark:"壹", short:"初卷", title:"唐朝诡事录", year:2022, episodes:36, count:8,
   official:"https://www.iqiyi.com/a_bqy7raz0ap.html", reference:"https://www.tvmao.com/drama/ZGpmYW8h/episode",
   summary:"长安县尉苏无名与金吾卫中郎将卢凌风因长安红茶案相识。二人离京南行，在驿站、州县和乡野查办各式奇案，最后重返长安。"},
  {id:"s2", mark:"贰", short:"西行", title:"唐朝诡事录之西行", year:2024, episodes:40, count:8,
   official:"https://m.iqiyi.com/a_209ze3nm7dp.html", reference:"https://www.tvmao.com/kanju/I2BiY2lt/episode",
   summary:"成佛寺壁画牵出长安命案。卢凌风获任云鼎县尉，探案小队从关中走向西域，经过仵作命案、雪夜客店与云鼎夜市，最终抵达敦煌。"},
  {id:"s3", mark:"叁", short:"长安", title:"唐朝诡事录之长安", year:2025, episodes:40, count:8,
   official:"https://www.iqiyi.com/v_16ne2x4z6zc.html", reference:"https://www.tvmao.com/kanju/JltpZ2hr/episode",
   summary:"六人护送康国金桃返回长安，开设流动公堂、走入坊市。民间疑案与宫廷角力逐渐交错，最后在长安的盛世马球赛交汇。"},
  {id:"s4", mark:"外", short:"奇谭", title:"唐诡奇谭", year:2025, episodes:21, count:2,
   official:"https://www.iqiyi.com/a_ap9lexnfx1.html", reference:"https://www.tvmao.com/kanju/ailhZF9m/episode",
   summary:"两位主演与探案小队回归。以红袍血书和宫廷旧画为线索，分别追查解忧店与眚宫歌两案。"}
];
const people = [
  { id:"lu", name:"卢凌风", actor:"杨旭文", role:"领衔 · 探案小队", bio:"出身范阳卢氏，以武艺见长。金吾卫任上与苏无名结识，后来一路从地方州县查回长安。" },
  { id:"su", name:"苏无名", actor:"杨志刚", role:"领衔 · 探案小队", bio:"狄仁杰的弟子。擅验尸、推勘与察人，总能从旁人略过的小物件上找到关键破绽。" },
  { id:"pei", name:"裴喜君", actor:"郜思雯", role:"探案小队 · 画像", bio:"裴坚之女。擅长摹写容貌和辨认画迹，让一段不完整的描述也能成为查案的依据。" },
  { id:"fei", name:"费鸡师", actor:"陈创", role:"探案小队 · 医药", bio:"药王孙思邈的弟子。喜食鸡，熟悉药物与毒理，常替众人验药、解毒或诊治伤病。" },
  { id:"chu", name:"褚樱桃", actor:"孙雪宁", role:"探案小队 · 追踪", bio:"与苏无名在众生堂案相识。身手敏捷，擅查访与潜入，常为小队探明险情。" },
  { id:"xue", name:"薛环", actor:"石悦安鑫", role:"探案小队 · 随行", bio:"原随侍裴喜君，后来拜卢凌风为师，随队查访、护卫，也逐渐能够独当一面。" }
];
const assets = research("assets");
const { spinoffs, guide, ranks, seasonSources, caseVisuals, portraits, covers } = require("../content/revision.json");
const careers = research("careers");
for (const person of careers) {
  for (const entry of person.entries) entry.rank = ranks[entry.title];
}
const cases = [];
for (const season of seasons) {
  const rows = research(season.id + "-cases");
  const episodes = research(season.id + "-episodes");
  season.episodeLinks = episodes.map(ep => ep.url);
  season.extraSource = seasonSources[season.id];
  rows.forEach(({from,to,extra=[],...record}, index) => {
    const id = season.id + "-" + (index + 1);
    cases.push({
      ...record, id, season: season.id, order: index+1,
      people: record.people.map(name => ["公主","长公主"].includes(name) ? "太平公主" : name),
      episodes: [...Array.from({length:to-from+1}, (_,n) => from+n), ...extra],
      reference: episodes.find(ep => ep.n === from)?.url || season.reference,
      image: covers[id],
      still: caseVisuals[id].still
    });
  });
}
for (const person of people) person.image = portraits[person.id] || assets[person.id];
const file = path.join(root, "dist", "data.js");
fs.writeFileSync(file, "window.TangArchive = " + JSON.stringify({ seasons, cases, people, careers, spinoffs, guide, hero: assets.hero }, null, 2) + ";\n");
console.log("Compiled " + cases.length + " cases");
