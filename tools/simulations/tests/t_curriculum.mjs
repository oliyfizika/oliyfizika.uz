// Darslik mundarijasi (curriculum.json) yaxlitligini tekshirish: node tools/simulations/tests/t_curriculum.mjs
// Presetlarning brauzerda ishlashi alohida: tools/simulations/tests/t_curriculum_presets.mjs (Playwright).
import fs from "fs";

const root = new URL("../../../", import.meta.url);
const cur = JSON.parse(fs.readFileSync(new URL("simulations/data/curriculum.json", root), "utf8"));
const man = JSON.parse(fs.readFileSync(new URL("simulations/data/manifest.json", root), "utf8"));
const ids = new Set(man.simulations.map((s) => s.id));

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };

const EXPECT = { 7: 62, 8: 60, 9: 59, 10: 59, 11: 45 };
const TYPES = new Set(["sim", "lab", "masala", "matn"]);
let labs = 0, bad = [];
for (const g of cur.sinflar) {
  const all = g.boblar.flatMap((b) => b.mavzular);
  ok(all.length === EXPECT[g.sinf], `${g.sinf}-sinf: ${all.length} ta mavzu (kutilgan ${EXPECT[g.sinf]})`);
  ok(all.every((m, i) => m.raqam === i + 1), `${g.sinf}-sinf: raqamlar 1…${all.length} uzluksiz`);
  for (const m of all) {
    if (!TYPES.has(m.tur)) bad.push(`${g.sinf}§${m.raqam}: tur «${m.tur}»`);
    if (m.sim && !ids.has(m.sim)) bad.push(`${g.sinf}§${m.raqam}: sim «${m.sim}» manifestda yo‘q`);
    if (m.lab && !ids.has(m.lab)) bad.push(`${g.sinf}§${m.raqam}: lab «${m.lab}» manifestda yo‘q`);
    if (m.preset && !m.sim) bad.push(`${g.sinf}§${m.raqam}: preset bor, sim yo‘q`);
    if (m.tur === "lab") { labs++; if (!("lab" in m)) bad.push(`${g.sinf}§${m.raqam}: lab maydoni yo‘q`); }
    if (m.tur === "lab" && !/^Laboratoriya ishi\./.test(m.nom)) bad.push(`${g.sinf}§${m.raqam}: lab nomi`);
    if (m.tur !== "lab" && /^Laboratoriya ishi\./.test(m.nom)) bad.push(`${g.sinf}§${m.raqam}: lab turi emas`);
    if (/['`]/.test(m.nom)) bad.push(`${g.sinf}§${m.raqam}: noto‘g‘ri tutuq belgisi`);
  }
}
ok(labs === 22, `darslikdagi laboratoriya ishlari: ${labs} ta (kutilgan 22)`);
ok(!bad.length, "sim id, tur va nomlar to‘g‘ri" + (bad.length ? "\n  " + bad.join("\n  ") : ""));
const taxminiy = cur.sinflar.flatMap((g) => g.boblar.flatMap((b) => b.mavzular.filter((m) => m.taxminiy).map((m) => `${g.sinf}§${m.raqam}`)));
ok(taxminiy.join(",") === "8§5,9§11,9§50", `OCR da o‘qilmagan mavzular belgilangan: ${taxminiy.join(", ")}`);

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
