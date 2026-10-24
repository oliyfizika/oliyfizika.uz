// curriculum.json dagi har bir ?preset= havolasi brauzerda ishlashini tekshirish (Playwright).
// Ishga tushirish: repo ildizida `python3 -m http.server 8000`, so'ng `node tools/simulations/tests/t_curriculum_presets.mjs`.
// Tekshiruv: sahifa xatosiz yuklanadi va kerakli preset tugmasi tanlangan (aria-pressed="true") bo'ladi;
// tugmasida holat saqlanmaydigan sahifalarda — preset o'rnatadigan qiymat (CHECK).
import fs from "fs";
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright"); // global o'rnatilgan

const BASE = process.env.BASE || "http://localhost:8000/simulations/";
const root = new URL("../../../", import.meta.url);
const cur = JSON.parse(fs.readFileSync(new URL("simulations/data/curriculum.json", root), "utf8"));
const man = JSON.parse(fs.readFileSync(new URL("simulations/data/manifest.json", root), "utf8"));
const href = new Map(man.simulations.map((s) => [s.id, s.href]));

const links = new Map();
for (const g of cur.sinflar) for (const b of g.boblar) for (const m of b.mavzular) {
  if (!m.sim) continue;
  const url = href.get(m.sim) + (m.preset ? `?preset=${m.preset}` : "");
  if (!links.has(url)) links.set(url, { sim: m.sim, preset: m.preset, where: [] });
  links.get(url).where.push(`${g.sinf}§${m.raqam}`);
}

const browser = await chromium.launch();
let fail = 0;
for (const [url, info] of links) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Tashqi resurslar (Firebase, shriftlar, CDN) test muhitida yuklanmaydi — ular hisobga olinmaydi
  await page.route((u) => !u.href.startsWith(BASE.replace(/simulations\/$/, "")), (r) => r.abort());
  const external = /Failed to load resource|Firebase|gstatic|googleapis|jsdelivr|cdnjs/;
  page.on("console", (m) => { if (m.type() === "error" && !external.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForTimeout(400);
  let state = "—";
  if (info.preset) {
    state = await page.evaluate((id) => {
      const b = document.querySelector(`[data-preset="${id}"]`);
      if (!b) return "tugma yo‘q";
      return b.getAttribute("aria-pressed") ?? "holatsiz";
    }, info.preset);
  }
  const good = !errors.length && (!info.preset || state === "true");
  if (!good) fail++;
  console.log(`${good ? "✓" : "✗"} ${url}  [${state}]  ${info.where.join(", ")}${errors.length ? "\n    " + errors.join("\n    ") : ""}`);
  await page.close();
}
await browser.close();
console.log(fail ? `\n${fail} ta havola xato` : `\n${links.size} ta havola ishlaydi`);
process.exit(fail ? 1 : 0);
