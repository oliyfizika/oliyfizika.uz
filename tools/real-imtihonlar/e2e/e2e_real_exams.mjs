// ==========================================================================
// Real imtihonlar — E2E (PHASE 4, faqat lokal). Production'ga ulanmaydi.
//   python3 tools/real-imtihonlar/export_app_data.py
//   python3 tools/real-imtihonlar/rules/build_proposed_rules.py
//   python3 tools/real-imtihonlar/e2e/run_mock.py --port 8796 &
//   E2E_PORT=8796 node tools/real-imtihonlar/e2e/e2e_real_exams.mjs
// Firebase SDK -> tools/attestatsiya-fizika/e2e/sdk (mock), har bir Firestore/Storage so'rovi TAKLIF
// qilingan Rules bilan tekshiriladi. Natija: _private/real-imtihonlar/e2e/report.json + screenshots/.
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const SDK = path.join(ROOT, "tools/attestatsiya-fizika/e2e/sdk");
const OUT = path.join(ROOT, "_private/real-imtihonlar/e2e");
const SHOTS = path.join(OUT, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8796}/`;
const RX = "milliy-sertifikat/real-imtihonlar/";
const CONFIG_URL = /assets\/js\/milliy-sertifikat\/real-exams\/config\.js/;
const CONFIG_SRC = fs.readFileSync(path.join(ROOT, "assets/js/milliy-sertifikat/real-exams/config.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "_private/real-imtihonlar/app-data/catalog.json"), "utf8"));

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail: String(detail) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail !== "" ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });

await post("__mock/reset", {});
const USERS = {
  B: { fullName: "User B", email: "b@example.com", xp: 0, level: 1, createdAt: { __ts: [1790000000, 0] }, mockTestsAccess: false },
  C: { fullName: "User C", email: "c@example.com", xp: 0, level: 1, createdAt: { __ts: [1790000000, 0] }, mockTestsAccess: true },
  D: { fullName: "Admin D", email: "d@example.com", xp: 0, level: 1, createdAt: { __ts: [1790000000, 0] }, mockTestsAccess: true, role: "admin" },
  E: { fullName: "Admin E", email: "e@example.com", xp: 0, level: 1, createdAt: { __ts: [1790000000, 0] }, mockTestsAccess: false, role: "admin" },
};
await post("__mock/seed", { docs: Object.fromEntries(Object.entries(USERS).map(([u, d]) => [`users/${u}`, d])) });

const browser = await chromium.launch();
/** mode: "local" (standart config) | "firestore" (config: firestore+enabled) | "disabled" (config: production standarti) */
async function ctxFor(uid, { viewport = { width: 1366, height: 900 }, theme = "light", mode = "local" } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  if (mode !== "local") {
    const src = CONFIG_SRC
      .replace(/export const DATA_SOURCE = .*;/, 'export const DATA_SOURCE = "firestore";')
      .replace(/export const FIRESTORE_ENABLED = .*;/, `export const FIRESTORE_ENABLED = ${mode === "firestore"};`);
    await ctx.route(CONFIG_URL, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: src }));
  }
  await ctx.addInitScript(([u, t]) => {
    if (u) localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u }));
    else localStorage.removeItem("mock-auth");
    localStorage.setItem("oliyfizika:theme", JSON.stringify(t));
  }, [uid, theme]);
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) page.errs.push(m.text()); });
  page.apiLog = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); page.apiLog.push(`${j.op}:${j.path || j.col || ""}`); } catch { /* */ } }
    if (u.includes("/_private/real-imtihonlar/app-data/")) page.apiLog.push(`local:${u.split("/app-data/")[1]}`);
  });
  return { ctx, page };
}
const access = (page) => page.evaluate(() => document.documentElement.dataset.rxAccess || "");
async function open(page, url) {
  await page.goto(B + url);
  await page.waitForFunction(() => document.documentElement.dataset.rxAccess, null, { timeout: 15000 });
  await page.waitForTimeout(300);
}

// ------------------------------------------------------------------ 1. Access matrix (+ direct URL)
const PAGES = [`${RX}`, `${RX}imtihon.html?id=REAL-2026-01-18`, `${RX}yechimlar.html?id=REAL-2026-01-18&q=7`];
const matrix = [
  ["A", null, "—", "login"], ["B", "B", "false", "access"], ["C", "C", "true", "allowed"], ["D", "D", "true (admin)", "allowed"],
];
for (const [label, uid, flag, expected] of matrix) {
  const { ctx, page } = await ctxFor(uid);
  for (const u of PAGES) {
    await open(page, u);
    const got = await access(page);
    const contentLoaded = page.apiLog.some((x) => x.startsWith("local:exams/") || x.startsWith("local:catalog"));
    ok(`access ${label} (mockTestsAccess ${flag}) ${u.replace(RX, "") || "index"}`, got === expected && (expected === "allowed" || !contentLoaded),
      `${got}${expected !== "allowed" ? `, kontent so‘rovi: ${contentLoaded ? "BOR" : "yo‘q"}` : ""}`);
    page.apiLog.length = 0;
  }
  if (expected === "login") ok("A: Kirish tugmasi ko‘rinadi", await page.locator("[data-gate] [data-login]").count() === 1);
  if (expected !== "allowed") ok(`${label}: himoyalangan kontent yashirin`, await page.locator("[data-protected]").evaluate((n) => n.hidden));
  ok(`${label}: JS xatosiz`, page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}
{ // E: admin, lekin mockTestsAccess=false — mavjud frontend modeli (faqat mockTestsAccess) bo'yicha
  const { ctx, page } = await ctxFor("E");
  await open(page, `${RX}`);
  ok("E (admin, mockTestsAccess=false): frontend rad etadi (DENIED)", await access(page) === "access");
  for (const u of PAGES.slice(1)) { await open(page, u); ok(`E direct URL ${u.replace(RX, "")}: DENIED`, await access(page) === "access" && !page.apiLog.some((x) => x.startsWith("local:exams/"))); }
  await ctx.close();
}

// ------------------------------------------------------------------ 2. Ro'yxat (data-driven)
{
  const { ctx, page } = await ctxFor("C");
  await open(page, RX);
  await page.waitForSelector(".rx-card");
  const titles = await page.$$eval(".rx-card__title", (n) => n.map((x) => x.textContent.trim()));
  ok("ro‘yxat: 12 ta kartochka (katalogdan)", titles.length === catalog.exams.length && titles.length === 12, titles.length);
  ok("30.09.2026 — Variant A / Variant B (smena yo‘q)", titles.includes("30.09.2026 — Variant A") && titles.includes("30.09.2026 — Variant B")
    && !titles.some((t) => t.startsWith("30.09.2026") && /smena/.test(t)));
  ok("smena metadata'dan: 29.09.2026 — 1-smena / 2-smena", titles.includes("29.09.2026 — 1-smena") && titles.includes("29.09.2026 — 2-smena"));
  ok("smena yo‘q imtihon faqat sana bilan (taxmin yo‘q)", titles.includes("18.01.2026") && titles.includes("30.11.2025"));
  ok("savollar soni: 537", (await page.textContent("[data-count]")).includes("537"));
  const links = await page.$$eval(".rx-card a", (a) => a.map((x) => x.getAttribute("href")));
  ok("har kartochkada PDF va Yechimlar havolasi", links.filter((h) => h.startsWith("imtihon.html?id=")).length === 12 && links.filter((h) => h.startsWith("yechimlar.html?id=")).length === 12);
  ok("ro‘yxat: JS xatosiz", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------ 3. Yechimlar ko'ruvchisi
{
  const { ctx, page } = await ctxFor("C");
  // 29.09 2-smena: ORG #31, #32
  await open(page, `${RX}yechimlar.html?id=REAL-2026-09-29-2`);
  await page.waitForSelector(".rx-q");
  const nums = await page.$$eval("[data-grid] .rx-num", (b) => b.map((x) => Number(x.textContent)));
  ok("ORG: navigatsiyada 43 ta savol, #31/#32 yo‘q", nums.length === 43 && !nums.includes(31) && !nums.includes(32), nums.length);
  ok("navigatsiya: birinchi savol #1, «birinchi/oldingi» o‘chiq", (await page.textContent("#rxQTitle")) === "1-savol" && await page.isDisabled("[data-first]") && await page.isDisabled("[data-prev]"));
  await page.click("[data-next]"); ok("keyingi -> #2", (await page.textContent("#rxQTitle")) === "2-savol");
  await page.click("[data-last]"); ok("oxirgi -> #45, «keyingi/oxirgi» o‘chiq", (await page.textContent("#rxQTitle")) === "45-savol" && await page.isDisabled("[data-next]"));
  await page.click("[data-prev]"); ok("oldingi -> #44", (await page.textContent("#rxQTitle")) === "44-savol");
  await page.click("[data-first]"); ok("birinchi -> #1", (await page.textContent("#rxQTitle")) === "1-savol");
  await page.fill("[data-jump] input", "30"); await page.click("[data-jump] button");
  ok("raqam bo‘yicha -> #30", (await page.textContent("#rxQTitle")) === "30-savol");
  await page.click("[data-next]"); ok("#30 dan keyingi #33 (ORG o‘tkazib yuboriladi)", (await page.textContent("#rxQTitle")) === "33-savol");
  await page.fill("[data-jump] input", "31"); await page.click("[data-jump] button");
  ok("ORG raqamiga o‘tish rad etiladi", (await page.textContent("[data-jump-msg]")).includes("yo‘q") && (await page.textContent("#rxQTitle")) === "33-savol");
  ok("URL ?q= holati", new URL(page.url()).searchParams.get("q") === "33");
  await page.keyboard.press("ArrowLeft"); ok("klaviatura ← -> #30", (await page.textContent("#rxQTitle")) === "30-savol");
  await page.check("[data-show-org]");
  const nums2 = await page.$$eval("[data-grid] .rx-num", (b) => b.map((x) => Number(x.textContent)));
  ok("ORG ko‘rsatish belgilansa: 45 ta (ballga kirmaydi)", nums2.length === 45);
  await page.click('[data-grid] .rx-num[data-status="EXCLUDED_ORG"]');
  ok("ORG savolda «Ballga kirmaydi» va EXCLUDED holati", (await page.textContent(".rx-qhead")).includes("Ballga kirmaydi") && (await page.textContent(".rx-qhead")).includes("ORG savoli"));
  await page.uncheck("[data-show-org]");

  // NEEDS_MANUAL_REVIEW: 18.01 #43 (butun savol), 13.05-2 #36 (a qismi), 22.02 #39
  for (const [id, n, partial] of [["REAL-2026-01-18", 43, false], ["REAL-2025-05-13-2", 36, true], ["REAL-2025-02-22", 39, false]]) {
    await open(page, `${RX}yechimlar.html?id=${id}&q=${n}`);
    await page.waitForSelector(".rx-answer");
    const head = await page.textContent(".rx-qhead");
    const ans = await page.textContent(".rx-answer");
    ok(`REVIEW ${id} #${n}: holat ko‘rinadi`, head.includes("Qo‘shimcha tekshiruv talab etiladi"));
    ok(`REVIEW ${id} #${n}: yakuniy javob yaratilmagan`, partial ? ans.includes("a) qo‘shimcha tekshiruv") : ans.includes("Yakuniy javob berilmagan"), ans.slice(0, 120));
  }
  const tail = await page.textContent(".rx-answer");
  ok("22.02 #39: «likely intended» faqat tasdiqlanmagan taxmin sifatida", tail.includes("Tasdiqlanmagan taxmin (yakuniy javob emas)"));
  // NO_CORRECT_OPTION
  for (const [id, n] of [["REAL-2024-12-01", 14], ["REAL-2026-04-06-2", 3], ["REAL-2026-04-06-2", 18]]) {
    await open(page, `${RX}yechimlar.html?id=${id}&q=${n}`);
    await page.waitForSelector(".rx-answer");
    ok(`NO_CORRECT_OPTION ${id} #${n}: tushuntirish va variant belgilanmagan`,
      (await page.textContent(".rx-qhead")).includes("to‘g‘ri variant yo‘q") && (await page.textContent("[data-sol]")).includes("birortasi ham to‘g‘ri emas")
      && await page.locator(".rx-opt--correct").count() === 0);
  }
  // FINAL + KEY-CORRECTED + label misprint
  await open(page, `${RX}yechimlar.html?id=REAL-2026-09-30-A&q=11`); await page.waitForSelector(".rx-answer");
  ok("KEY-CORRECTED: belgi va audit izohi", (await page.textContent(".rx-qhead")).includes("Manba kaliti tuzatilgan") && (await page.textContent(".rx-answer")).includes("manba kaliti D → B"));
  ok("FINAL: to‘g‘ri variant belgilangan (B)", await page.getAttribute(".rx-opt--correct", "data-key") === "B");
  await open(page, `${RX}yechimlar.html?id=REAL-2026-04-06-1&q=17`); await page.waitForSelector(".rx-opt");
  ok("variant harfi xato bosilgan: «PDF da «B)» deb bosilgan» izohi", (await page.textContent('.rx-opt[data-key="C"]')).includes("PDF da «B)» deb bosilgan"));
  // Formula + figure + table
  await open(page, `${RX}yechimlar.html?id=REAL-2026-01-18&q=3`); await page.waitForSelector(".rx-fig img");
  await page.waitForFunction(() => [...document.querySelectorAll(".rx-fig img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).catch(() => {});
  ok("figure yuklandi (lokal crop, figureId mos)", await page.$eval(".rx-fig", (f) => f.dataset.figureId === "REAL-2026-01-18-q03-f1" && f.querySelector("img").naturalWidth > 0));
  ok("KaTeX: \\vec strelkasi ko‘rinadi (svg kengligi > 0)", await page.$$eval('.rx-opt[data-key="B"] .katex svg', (s) => s.length > 0 && s.every((x) => x.getBoundingClientRect().width > 0)));
  ok("KaTeX render: xom $…$ qolmagan", !(await page.textContent(".rx-q")).includes("$"));
  await open(page, `${RX}yechimlar.html?id=REAL-2024-12-01&q=12`); await page.waitForSelector(".rx-table");
  ok("jadval: 4×2 katak", await page.$$eval(".rx-table tr", (r) => r.length === 4 && r.every((x) => x.children.length === 2)));
  await open(page, `${RX}yechimlar.html?id=REAL-2026-09-29-1&q=33`); await page.waitForSelector(".rx-q__group");
  ok("33–35: umumiy shart + 6 variant", await page.locator(".rx-opt").count() === 6);
  ok("yechimlar: JS xatosiz", page.errs.length === 0, page.errs.join(" | "));

  // Formulalarning hammasi: 12 imtihon × barcha savollar — render xatosi yo'q
  let katexErr = 0, rawDollar = 0, figs = 0, figsOk = 0, count = 0;
  for (const e of catalog.exams) {
    await open(page, `${RX}yechimlar.html?id=${e.examId}&org=1`); await page.waitForSelector(".rx-q");
    const total = await page.locator("[data-grid] .rx-num").count();
    for (let i = 0; i < total; i++) {
      if (i) await page.click("[data-next]");
      const r = await page.evaluate(() => ({
        err: document.querySelectorAll(".rx-q .katex-error, [data-sol] .katex-error").length,
        raw: /\$[^$]+\$/.test(document.querySelector(".rx-q").textContent) ? 1 : 0,
        figs: document.querySelectorAll(".rx-fig").length,
      }));
      katexErr += r.err; rawDollar += r.raw; figs += r.figs; count++;
    }
  }
  ok("barcha 540 savol ochildi (ORG ko‘rsatish rejimida)", count === 540, count);
  ok("KaTeX xatolari: 0 (savol + yechim)", katexErr === 0, katexErr);
  ok("savol matnida xom $…$ qolmagan", rawDollar === 0, rawDollar);
  ok("figure elementlari: 105", figs === 105, figs);
  await ctx.close();
}

// ------------------------------------------------------------------ 4. PDF ko'ruvchi (Blob URL)
{
  const { ctx, page } = await ctxFor("C");
  await open(page, `${RX}imtihon.html?id=REAL-2026-09-30-B`);
  await page.waitForSelector(".rx-pdf__frame");
  const src = await page.getAttribute(".rx-pdf__frame", "src");
  ok("PDF: blob: Object URL (ommaviy URL emas)", src.startsWith("blob:"), src.slice(0, 30));
  ok("PDF: lokal fixture ogohlantirishi", (await page.textContent(".rx-pdf")).includes("test fixture"));
  const type = await page.evaluate(async (u) => (await (await fetch(u)).blob()).type, src);
  ok("PDF blob turi application/pdf", type === "application/pdf", type);
  const prov = await page.textContent(".rx-prov");
  ok("Variant B: officialSource=false va SECONDARY SOURCE ogohlantirishi", prov.includes("rasmiy manba ekanligi tasdiqlanmagan") && prov.includes("Shartlar qayta bayon qilingan"));
  ok("Variant B: umumiy shart KaTeX bilan", await page.locator("[data-general] .katex").count() >= 1);
  ok("hech qanday haqiqiy PDF so‘ralmagan", !page.apiLog.some((x) => /\.pdf/.test(x) && !/local-fixture/.test(x)));
  await open(page, `${RX}imtihon.html?id=REAL-2025-05-13-1`);
  ok("13.05.2025: muqova sanasi ogohlantirishi", (await page.textContent(".rx-prov")).includes("22.02.2025"));
  await open(page, `${RX}imtihon.html?id=REAL-2025-11-30`);
  ok("30.11.2025: «Fevral 2025» fayl nomi ogohlantirishi", (await page.textContent(".rx-prov")).includes("Fevral 2025"));
  ok("PDF sahifa: JS xatosiz", page.errs.length === 0, page.errs.join(" | "));
  await open(page, `${RX}imtihon.html?id=../../etc`);
  ok("noto‘g‘ri id: xavfsiz «topilmadi» holati", (await page.textContent("[data-protected]")).includes("topilmadi"));
  ok("noto‘g‘ri id: hech qanday fayl so‘ralmadi", !page.apiLog.some((x) => /etc/.test(x)));
  await ctx.close();
}

// ------------------------------------------------------------------ 5. Firestore adapter + TAKLIF qilingan Rules (mock)
{
  const { ctx, page } = await ctxFor("C", { mode: "firestore" });
  await open(page, `${RX}yechimlar.html?id=REAL-2026-01-18&q=3`);
  await page.waitForSelector(".rx-fig img");
  await page.waitForFunction(() => document.querySelector(".rx-fig img")?.src.startsWith("blob:"), null, { timeout: 10000 }).catch(() => {});
  ok("firestore adapter (C): savol+yechim Rules orqali o‘qildi", page.apiLog.includes("get:realExams/REAL-2026-01-18/content/questions") && page.apiLog.includes("get:realExams/REAL-2026-01-18/private/solutions"));
  ok("firestore adapter: figure Storage getBlob -> blob: URL", (await page.getAttribute(".rx-fig img", "src")).startsWith("blob:"));
  ok("firestore adapter: lokal app-data ishlatilmadi", !page.apiLog.some((x) => x.startsWith("local:")));
  await open(page, RX); await page.waitForSelector(".rx-card");
  ok("firestore adapter: ro‘yxatda faqat published (12; e’lon qilinmagan test yo‘q)", await page.locator(".rx-card").count() === 12);
  await open(page, `${RX}imtihon.html?id=REAL-2026-09-30-A`); await page.waitForSelector(".rx-pdf__frame");
  ok("firestore adapter: PDF Storage getBlob -> blob:", (await page.getAttribute(".rx-pdf__frame", "src")).startsWith("blob:"));
  ok("firestore rejimi: JS xatosiz", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}
{ // Rules darajasida (frontend'siz, to'g'ridan-to'g'ri so'rovlar)
  const P = "realExams/REAL-2026-01-18";
  const r = {};
  for (const u of [null, "B", "C", "D", "E"]) {
    r[u || "A"] = {
      meta: (await apiAs(u, "get", { path: P })).ok,
      q: (await apiAs(u, "get", { path: `${P}/content/questions` })).ok,
      s: (await apiAs(u, "get", { path: `${P}/private/solutions` })).ok,
      pdf: (await apiAs(u, "st_get", { path: "real-exams/REAL-2026-01-18.pdf" })).ok,
      fig: (await apiAs(u, "st_get", { path: "real-exams/REAL-2026-01-18/figures/REAL-2026-01-18-q03-f1.png" })).ok,
      unpub: (await apiAs(u, "get", { path: "realExams/REAL-TEST-UNPUBLISHED/content/questions" })).ok,
      unpubPdf: (await apiAs(u, "st_get", { path: "real-exams/REAL-TEST-UNPUBLISHED.pdf" })).ok,
      write: (await apiAs(u, "commit", { writes: [{ type: "set", path: `${P}`, data: { published: true } }] })).ok,
    };
  }
  const all = (o) => Object.entries(o).filter(([k]) => !["unpub", "unpubPdf", "write"].includes(k)).every(([, v]) => v);
  const none = (o) => Object.values(o).every((v) => !v);
  ok("Rules: A (mehmon) — hamma narsa rad", none(r.A), JSON.stringify(r.A));
  ok("Rules: B (mockTestsAccess=false) — hamma narsa rad", none(r.B), JSON.stringify(r.B));
  ok("Rules: C — published o‘qish ruxsat, unpublished/yozish rad", all(r.C) && !r.C.unpub && !r.C.unpubPdf && !r.C.write, JSON.stringify(r.C));
  ok("Rules: D (admin, mockTestsAccess=true) — C bilan bir xil: published o‘qish, unpublished/yozish rad", all(r.D) && !r.D.unpub && !r.D.unpubPdf && !r.D.write, JSON.stringify(r.D));
  ok("Rules: E (admin, mockTestsAccess=false) — hamma narsa rad (admin istisnosi yo‘q)", none(r.E), JSON.stringify(r.E));
  const list = await apiAs("B", "query", { col: "realExams", filters: [["published", "==", true]] });
  ok("Rules: B list rad", !list.ok);
}
{ // Production standarti: FIRESTORE_ENABLED=false -> "tez orada", Firestore realExams so'rovi yo'q
  const { ctx, page } = await ctxFor("C", { mode: "disabled" });
  await open(page, `${RX}yechimlar.html?id=REAL-2026-01-18`);
  await page.waitForSelector(".rx-state");
  ok("production standarti: «tez orada» holati", (await page.textContent(".rx-state")).includes("tez orada"));
  ok("production standarti: realExams/Storage so‘rovi yo‘q", !page.apiLog.some((x) => /realExams|real-exams/.test(x)) && !page.apiLog.some((x) => x.startsWith("local:")), page.apiLog.join(","));
  await ctx.close();
}

// ------------------------------------------------------------------ 6. Responsive + tema
const VIEWS = [["390", { width: 390, height: 844 }], ["768", { width: 768, height: 1024 }], ["1366", { width: 1366, height: 900 }]];
for (const theme of ["light", "dark"]) {
  for (const [vw, viewport] of VIEWS) {
    const { ctx, page } = await ctxFor("C", { viewport, theme });
    for (const [name, url, sel] of [["list", RX, ".rx-card"], ["exam", `${RX}imtihon.html?id=REAL-2026-09-30-B`, ".rx-pdf__frame"],
      ["solution", `${RX}yechimlar.html?id=REAL-2026-01-18&q=43`, ".rx-answer"], ["solution-fig", `${RX}yechimlar.html?id=REAL-2025-02-22&q=33`, ".rx-fig img"]]) {
      await open(page, url); await page.waitForSelector(sel); await page.waitForTimeout(400);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, theme: document.documentElement.dataset.theme }));
      ok(`${theme} ${vw}px ${name}: gorizontal scroll yo‘q`, m.sw <= m.iw && m.theme === theme, `${m.sw}/${m.iw} ${m.theme}`);
      await page.screenshot({ path: path.join(SHOTS, `${theme}-${vw}-${name}.png`), fullPage: name !== "solution-fig" });
    }
    ok(`${theme} ${vw}px: JS xatosiz`, page.errs.length === 0, page.errs.join(" | "));
    await ctx.close();
  }
}

// ------------------------------------------------------------------ 7. Regressiya: mavjud sahifalar (kod o'zgarmagan) yuklanadi
{
  const { ctx, page } = await ctxFor("C");
  for (const [u, sel] of [["milliy-sertifikat/milliy-sertifikat.html", "#mockTestsLink"], ["milliy-sertifikat/mock-tests.html", "#accessStatus"],
    ["milliy-sertifikat/mock-testlar/index.html", "body"], ["milliy-sertifikat/mock-testlar/test.html?id=mock-test-1", "body"]]) {
    page.errs.length = 0;
    await page.goto(B + u); await page.waitForSelector(sel, { state: "attached" }); await page.waitForTimeout(1500);
    ok(`regressiya: ${u} xatosiz yuklandi`, page.errs.length === 0, page.errs.join(" | "));
  }
  // Milliy sertifikat landing: yangi kartochka + mavjud kartochkalar
  for (const uid of [null, "B", "C", "E"]) {
    const { ctx: c2, page: p2 } = await ctxFor(uid);
    await p2.goto(B + "milliy-sertifikat/milliy-sertifikat.html"); await p2.waitForTimeout(1500);
    const card = p2.locator("[data-real-exams-card]");
    const href = await card.locator("a").getAttribute("href");
    const cards = await p2.locator(".of-ms-actions > .of-ms-card").count();
    const solveHref = await p2.getAttribute(".of-ms-card--solve a", "href");
    const videoLink = await p2.locator("#mockTestsLink").evaluate((n) => ({ href: n.getAttribute("href"), hidden: n.hidden }));
    const msg = await p2.locator("#mockTestsAccessMessage").count() ? await p2.textContent("#mockTestsAccessMessage") : "(ruxsat bor — xabar olib tashlangan)";
    const tg = await p2.locator("#telegramAccessLink").evaluate((n) => n.hidden);
    ok(`landing (${uid || "mehmon"}): Real imtihonlar kartochkasi ko‘rinadi, href=real-imtihonlar/`, await card.isVisible() && href === "real-imtihonlar/" && cards === 3);
    ok(`landing (${uid || "mehmon"}): Mock test kartochkasi o‘zgarmagan`, solveHref === "mock-testlar/");
    const expectAccess = uid === "C";
    ok(`landing (${uid || "mehmon"}): Video yechimlar ruxsat xatti-harakati avvalgidek`, videoLink.href === "mock-tests.html" && (expectAccess ? tg === true && !msg.includes("faqat") : tg === false), `${msg.trim().slice(0, 60)} · telegram ${tg ? "yashirin" : "ko‘rinadi"}`);
    ok(`landing (${uid || "mehmon"}): JS xatosiz`, p2.errs.length === 0, p2.errs.join(" | "));
    if (uid === "C") {
      await card.locator("a").click(); await p2.waitForFunction(() => document.documentElement.dataset.rxAccess, null, { timeout: 15000 });
      ok("landing -> kartochka bosildi -> Real imtihonlar ro‘yxati (C: allowed)", p2.url().endsWith("/milliy-sertifikat/real-imtihonlar/") && await access(p2) === "allowed");
    }
    if (uid === "E") {
      await card.locator("a").click(); await p2.waitForFunction(() => document.documentElement.dataset.rxAccess, null, { timeout: 15000 });
      ok("landing -> kartochka -> E (admin, flag=false): DENIED", await access(p2) === "access");
    }
    if (uid === null) {
      await card.locator("a").click(); await p2.waitForFunction(() => document.documentElement.dataset.rxAccess, null, { timeout: 15000 });
      ok("landing -> kartochka -> mehmon: login talab qilinadi", await access(p2) === "login");
    }
    await c2.close();
  }
  // Attestatsiya: taklif qilingan Rules bilan (8797) va hozirgi repo Rules bilan (REPO_PORT) xatti-harakat bir xil
  if (process.env.REPO_PORT) {
    const RB = `http://127.0.0.1:${process.env.REPO_PORT}/`;
    await fetch(RB + "__mock/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docs: Object.fromEntries(Object.entries(USERS).map(([u, d]) => [`users/${u}`, d])) }) });
    const run = async (base) => { page.errs.length = 0; await page.goto(base + "attestatsiya/fizika-yechimlar.html"); await page.waitForTimeout(2500);
      return { errs: page.errs.map((e) => e.split("\n")[0]).sort(), text: (await page.textContent("main, body")).replace(/\s+/g, " ").slice(0, 400) }; };
    const a = await run(B), b = await run(RB);
    ok("regressiya: Attestatsiya yechimlar — taklif Rules = repo Rules (xatti-harakat bir xil)", JSON.stringify(a) === JSON.stringify(b), `${a.errs.length} xato (ikkalasida ham)`);
  }
  await page.goto(B + "milliy-sertifikat/mock-testlar/index.html"); await page.waitForTimeout(2000);
  ok("regressiya: Mock test katalogi 15 ta test kartochkasi", await page.locator("[data-mock-list] > li").count() === 15, await page.locator("[data-mock-list] > li").count());
  await page.goto(B + "milliy-sertifikat/mock-testlar/test.html?id=mock-test-1"); await page.waitForTimeout(2500);
  const ts = await page.evaluate(() => ({ start: !document.querySelector("#startScreen")?.hidden, msg: !document.querySelector("#messageScreen")?.hidden, loading: !document.querySelector("#loadingScreen")?.hidden, title: document.querySelector("#brandTitle")?.textContent.trim() }));
  ok("regressiya: Mock test sahifasi (test-1) boshlash ekrani ochildi", ts.start && !ts.loading, JSON.stringify(ts));
  await page.goto(B + "milliy-sertifikat/mock-tests.html"); await page.waitForTimeout(1500);
  ok("regressiya: Video yechimlar (C, mockTestsAccess=true) ro‘yxati ochildi", !(await page.locator("#protectedContent").evaluate((n) => n.hidden)) && await page.locator("#mockTestsList li").count() === 10);
  await ctx.close();
}

await browser.close();
const failed = checks.filter((c) => !c.pass);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ when: new Date().toISOString(), total: checks.length, failed: failed.length, checks }, null, 1));
console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
process.exit(failed.length ? 1 : 0);
