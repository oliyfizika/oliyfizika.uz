// ==========================================================================
// Milliy sertifikat: admin orqali mock import (Firestore, yopiq) — E2E.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8797 &
//   E2E_PORT=8797 node tools/milliy-sertifikat/e2e_ms_import.mjs
// Oqim: build_mock_import.py → admin import → katalogda yopiq → sessiya → yechish (kalitsiz) → yakunlash → natija + kalit + yechimlar.
// ==========================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SDK = path.join(ROOT, "tools/attestatsiya-fizika/e2e/sdk");
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "ms-import-"));
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8797}/`;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const tsMs = (v) => (v?.__ts ? v.__ts[0] * 1000 : new Date(v).getTime());

// 1) import fayli (Mock №6 manbasi → Mock №16)
const SRC = path.join(ROOT, "milliy-sertifikat/mock-testlar/data/mock-test-6.json");
const BUNDLE = path.join(OUT, "ms-mock-import-16.json");
const log = execFileSync("python3", [path.join(ROOT, "tools/milliy-sertifikat/build_mock_import.py"), SRC, "--number", "16",
  "--solutions", path.join(ROOT, "milliy-sertifikat/mock-testlar/data/solutions/mock-test-6.json"), "--out", BUNDLE], { encoding: "utf8" });
ok("build_mock_import.py: fayl yaratildi", fs.existsSync(BUNDLE), log.trim());
const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
const TID = "mock-test-16";

const T0 = new Date("2026-12-01T05:00:00Z"); // 10:00 Toshkent
const docs = {
  "users/admin1": { fullName: "Admin Bir", role: "admin", email: "admin1@example.com" },
  "users/uid1": { fullName: "Sarvar Amirov", firstName: "Sarvar", lastName: "Amirov", email: "uid1@example.com" },
};
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, when = T0) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript((u) => { if (u) localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u })); }, uid);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(when);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  return { ctx, page };
}

// 2) admin import
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/milliy-sertifikat-sessiyalar.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])", { timeout: 20000 });
  await page.waitForSelector("[data-imported]");
  await page.setInputFiles("[data-bundle]", BUNDLE);
  await page.waitForFunction(() => /Tekshirildi/.test(document.querySelector("[data-bundle-info]").textContent), null, { timeout: 10000 });
  ok("Admin: fayl tekshirildi", /Mock №16 — 45 savol/.test(await page.textContent("[data-bundle-info]")), await page.textContent("[data-bundle-info]"));
  await page.click("[data-import]");
  await page.click(".of-modal__actions .of-btn >> nth=0");
  await page.waitForFunction(() => /import qilindi/.test(document.querySelector("[data-bundle-info]").textContent), null, { timeout: 30000 });
  const d = await dump(`msMockTests/${TID}`);
  const qd = d[`msMockTests/${TID}/content/questions`];
  ok("Firestore: meta, savollar, kalit, yechimlar, rasmlar", !!d[`msMockTests/${TID}`] && !!qd && !!d[`msMockTests/${TID}/content/key`] && !!d[`msMockTests/${TID}/content/solutions`]
     && Object.keys(d).filter((k) => k.includes("/figures/")).length > 0, `${Object.keys(d).length} hujjat`);
  ok("Savollar hujjatida javob YO‘Q", !JSON.stringify(qd).includes('"answer"'));
  ok("Meta: yopiq (reviewOpen false, oyna yo‘q)", d[`msMockTests/${TID}`].reviewOpen === false && !d[`msMockTests/${TID}`].openFrom);
  ok("Admin: tanlov ro‘yxatida Mock №16 (import)", /Mock №16 .*\(import\)/.test(await page.textContent("#msTest")));
  ok("Erkin mashq ro‘yxatida import qilingan mock yo‘q", !(await page.$('[data-practice] input[value="mock-test-16"]')));
  ok("Admin sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// 3) foydalanuvchi: yopiq
{
  const { ctx, page } = await ctxFor("uid1");
  await page.goto(B + "milliy-sertifikat/mock-testlar/");
  await page.waitForSelector("[data-mock-list]:not([aria-busy])", { timeout: 20000 });
  const c16 = await page.evaluate(() => [...document.querySelectorAll("[data-mock-list] article")].find((a) => a.textContent.includes("№16"))?.innerText || "");
  ok("Katalog: Mock №16 — yopiq, 45 savol", /Yopiq/.test(c16) && /45/.test(c16), c16.replace(/\s+/g, " ").slice(0, 100));
  await page.goto(B + `milliy-sertifikat/mock-testlar/test.html?id=${TID}`);
  await page.waitForSelector("#messageScreen:not([hidden])", { timeout: 15000 });
  ok("Test sahifasi: yopiq xabari", /hozircha yopiq/.test(await page.textContent("#messageScreen")));
  const peek = await post("__mock/api", { op: "get", uid: "uid1", path: `msMockTests/${TID}/content/questions` });
  ok("Foydalanuvchi savollarni to‘g‘ridan-to‘g‘ri o‘qiy olmaydi", peek.ok === false, peek.code || "");
  ok("JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// 4) admin sessiya ochadi (Toshkent 09:30 — 18:00, 120 daqiqa)
let SID = null;
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/milliy-sertifikat-sessiyalar.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])", { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll("#msTest option")].some((o) => o.value === "mock-test-16"));
  await page.selectOption("#msTest", TID);
  await page.fill("#msOpen", "2026-12-01T09:30");
  await page.fill("#msClose", "2026-12-01T18:00");
  await page.fill("#msDur", "120");
  await page.click("[data-new-form] button[type=submit]");
  await page.click(".of-modal__actions .of-btn >> nth=0");
  await page.waitForSelector("[data-row]", { timeout: 10000 });
  const sess = Object.entries(await dump("msMockSessions/")).find(([, s]) => s.testId === TID);
  SID = sess?.[0].split("/")[1];
  const meta = (await dump(`msMockTests/${TID}`))[`msMockTests/${TID}`];
  ok("Sessiya ochildi va test oynasi yozildi", !!SID && tsMs(meta.openFrom) === new Date("2026-12-01T04:30:00Z").getTime()
     && tsMs(meta.openUntil) === new Date("2026-12-01T13:00:00Z").getTime() + 130 * 60000, `${SID}`);
  await ctx.close();
}

// sintetik ishtirokchilar
const answersFor = (n) => {
  const out = {};
  let k = 0;
  src.questions.forEach((q, i) => {
    if (q.type === "mcq") { out[String(i)] = k++ < n ? q.answer : (q.answer === "A" ? "B" : "A"); return; }
    const p = {};
    q.parts.forEach((x) => { p[x.key] = k++ < n ? String(x.answer) : "99999"; });
    out[String(i)] = p;
  });
  return out;
};
const seed = {};
[8, 15, 22, 30, 37, 44].forEach((n, j) => {
  const uid = `p${j + 1}`;
  seed[`users/${uid}`] = { fullName: `Ishtirokchi ${j + 1}`, email: `${uid}@example.com` };
  seed[`msMockAttempts/${SID}__${uid}`] = { uid, name: `Ishtirokchi ${j + 1}`, sessionId: SID, testId: TID, status: "submitted", startedAt: ts(T0), answers: answersFor(n) };
});
await post("__mock/seed", { docs: seed });

// 5) foydalanuvchi sessiyada yechadi
{
  const { ctx, page } = await ctxFor("uid1");
  await page.goto(B + "milliy-sertifikat/mock-testlar/");
  await page.waitForSelector("[data-mock-list]:not([aria-busy])", { timeout: 20000 });
  ok("Katalog: Mock №16 ochiq va birinchi", /№16/.test(await page.textContent("[data-mock-list] li:first-child")) && /Ochiq/.test(await page.textContent("[data-mock-list] li:first-child")));
  await page.click("[data-mock-list] li:first-child a");
  await page.waitForSelector("#startScreen:not([hidden])", { timeout: 15000 });
  await page.click("#startScreen .btn-primary");
  await page.waitForSelector("#examScreen:not([hidden])");
  // rasmli savolni topib, rasm data URL dan yuklanganini tekshirish
  const imgIdx = src.questions.findIndex((q) => q.image);
  await page.click(`#navgrid .navbtn:nth-child(${imgIdx + 1})`);
  const img = await page.$eval("#qContent .diagram-wrap img", (i) => ({ src: i.src.slice(0, 22), w: i.naturalWidth })).catch(() => null);
  ok("Rasm Firestore’dan (data URL) chiqdi", img && img.src.startsWith("data:image/") && img.w > 0, JSON.stringify(img));
  const key = await page.evaluate(() => JSON.stringify(window.__test || null));
  void key;
  // 40 band to'g'ri
  const target = answersFor(40);
  for (const [i, v] of Object.entries(target)) {
    if (typeof v !== "string") continue;
    await page.click(`#navgrid .navbtn:nth-child(${Number(i) + 1})`);
    await page.click(`#qContent .option:nth-child(${"ABCDEF".indexOf(v) + 1})`);
  }
  await page.click("#finishBtn");
  await page.click(".confirm-modal .btn-danger");
  await page.waitForSelector("#resultScreen:not([hidden])");
  ok("Topshirildi: natija ko‘rsatilmadi", /Javoblaringiz qabul qilindi/.test(await page.textContent("#resultScreen")));
  const a = (await dump(`msMockAttempts/${SID}__uid1`))[`msMockAttempts/${SID}__uid1`];
  ok("Server: submitted, 35 javob", a.status === "submitted" && Object.keys(a.answers).length === 35, `${a.status} ${Object.keys(a.answers).length}`);
  ok("Yechish paytida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// 6) oyna tugagach: savollar yopiq, natija kutilmoqda
const T1 = new Date("2026-12-01T16:00:00Z");
await post("__mock/clock", { iso: T1.toISOString() });
{
  const { ctx, page } = await ctxFor("uid1", T1);
  await page.goto(B + `milliy-sertifikat/mock-testlar/test.html?id=${TID}&session=${SID}`);
  await page.waitForSelector("#resultScreen:not([hidden])", { timeout: 15000 });
  ok("Oynadan keyin (savollar yopiq): «natija kutilmoqda»", /Javoblaringiz qabul qilindi/.test(await page.textContent("#resultScreen")));
  ok("JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// 7) admin yakunlaydi
{
  const { ctx, page } = await ctxFor("admin1", T1);
  await page.goto(B + "admin/milliy-sertifikat-sessiyalar.html");
  await page.waitForSelector(`[data-finalize="${SID}"]`, { timeout: 20000 });
  await page.click(`[data-finalize="${SID}"]`);
  await page.click(".of-modal__actions .of-btn >> nth=0");
  await page.waitForSelector(`[data-detail="${SID}"]:not([hidden]) table`, { timeout: 20000 });
  const meta = (await dump(`msMockTests/${TID}`))[`msMockTests/${TID}`];
  const r = (await dump(`msMockAttempts/${SID}__uid1`))[`msMockAttempts/${SID}__uid1`].result;
  ok("Yakunlandi: uid1 natijasi (kalit Firestore’dan)", r && r.raw === 35 && Number.isFinite(r.score), `${r?.raw}/${r?.maxRaw} → ${r?.score} ${r?.level}`);
  ok("Natija e’lon qilingach javoblar ochildi (reviewOpen)", meta.reviewOpen === true);
  ok("Admin sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// 8) foydalanuvchi natijasi: to'g'ri javoblar va yechimlar
{
  const { ctx, page } = await ctxFor("uid1", T1);
  await page.goto(B + `milliy-sertifikat/mock-testlar/test.html?id=${TID}&session=${SID}`);
  await page.waitForSelector("#resultScreen .rasch-hero", { timeout: 15000 });
  await page.waitForSelector(".review-solution", { timeout: 15000 }).catch(() => {});
  const t = await page.textContent("#resultScreen");
  ok("Natija: Rasch ball + to‘g‘ri javoblar", /Rasch modeli bo‘yicha natija/.test(t) && /To‘g‘ri javob/.test(t));
  ok("Yozma yechimlar Firestore’dan", (await page.$$(".review-solution")).length > 30, String((await page.$$(".review-solution")).length));
  ok("JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await page.screenshot({ path: path.join(OUT, "import-natija.png") });
  await ctx.close();
}

await browser.close();
const fails = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - fails}/${checks.length} PASS — ${OUT}`);
process.exit(fails ? 1 : 0);
