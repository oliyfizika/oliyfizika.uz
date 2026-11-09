// ==========================================================================
// Attestatsiya → Fizika: E2E — PULLIK MOCK-09 / MOCK-10 («2026 bahor», 3- va 4-testlar + 15 pedagogika)
//   python3 tools/attestatsiya-fizika/build_mock_test_bahor.py --test 3   # (4 -> mock-10)
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8811 &
//   E2E_PORT=8811 MOCK=09 node tools/attestatsiya-fizika/e2e/e2e_mock_bahor.mjs     # MOCK=10 ham
// Oqim: admin import (draft, PULLIK) → PUBLISH → ruxsatsiz foydalanuvchi: kartasi qulflangan, savollar o'qilmaydi →
// attestationAccess bor foydalanuvchi: boshlaydi (2 soat) → rasmlar → hammasi to'g'ri → 100/100 → yechimlar ochiladi.
// Ikkinchi ruxsatli foydalanuvchi: yechimlar o'z urinishi yakunlanmaguncha yopiq.
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT ? await import(process.env.PLAYWRIGHT) : require("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PRIV = path.join(ROOT, "_private/attestatsiya-fizika");
const OUT = path.join(PRIV, "e2e");
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8811}/`;
const SDK = path.join(HERE, "sdk");
const NUM = process.env.MOCK || "09";
const MOCKFILE = path.join(PRIV, `mock-import-${NUM}.json`);
const mock = JSON.parse(fs.readFileSync(MOCKFILE, "utf8"));
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });
const J = (x) => JSON.stringify(x);
const TC = "attestationPhysicsDailyTests";
const CFG = "attestationPhysicsSettings/config";
const MID = mock.testId;
const MDAY = mock.dayNumber;
const T0 = new Date("2026-11-08T06:00:00Z");
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const mkey = mock.ops[2].data;
const mids = mkey.questionIds;
const N = mids.length;

const docs = {
  [CFG]: { accessMode: "paid", timezone: "Asia/Tashkent", utcOffsetMinutes: 300, totalDays: 32, defaultTimeLimitSeconds: 3600, submitGraceSeconds: 120,
           solutionRelease: "nextCourseDayMidnight", officialAttemptsPerTest: 1, schemaVersion: 1, planHash: "00035719f689704f", figureBackend: "firestore" },
};
const people = { admin1: { fullName: "Admin Bir", role: "admin" }, nox: { fullName: "Ruxsatsiz User" },
                 free1: { fullName: "Pullik User", attestationAccess: true }, free2: { fullName: "Ikkinchi User", attestationAccess: true } };
for (const [u, p] of Object.entries(people)) docs[`users/${u}`] = { email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(new Date(T0 - 864e5)), ...p };
// mavjud mock-07 (soxta): import qilinayotgan mockdagi 1-pedagogika savolining nusxasi — import ogohlantirishi shuni topishi kerak
const pedQ = mock.ops[1].data.questions.find((q) => q.id.startsWith("PED-"));
const M7 = "att-fizika-mock-07";
docs[`${TC}/${M7}`] = { ...mock.ops[0].data, id: M7, dayNumber: 107, mockNumber: 7, questionIds: ["X-1"], questionCount: 1, status: "published", published: true, paidOnly: true };
docs[`${TC}/${M7}/versions/v1`] = { testId: M7, version: 1, dayNumber: 107, questionIds: ["X-1"], questions: [{ ...pedQ, id: "X-1" }] };
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript(([u]) => localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u })), [uid]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(T0);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) page.errs.push(m.text()); });
  return { ctx, page };
}
const txt = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, " ").trim();
const MFIG = mock.ops.length - 4;
const SHOTS = (process.env.SHOTS || "").split(",").filter(Boolean).map(Number);

{ // admin: import + publish
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForTimeout(1500);
  await page.setInputFiles("[data-mock-bundle]", MOCKFILE);
  await page.waitForFunction(() => !document.querySelector("[data-mock-import]").disabled, null, { timeout: 15000 });
  const info = await txt(page, "[data-mock-info]");
  ok("admin: fayl tekshirildi — pullik", /pullik/i.test(info) && !/bepul/i.test(info), info);
  await page.waitForFunction(() => /Diqqat/.test(document.querySelector("[data-mock-info]").textContent), null, { timeout: 10000 }).catch(() => {});
  ok("admin: mavjud mock bilan takror ogohlantiriladi", /Diqqat: 1 ta savol.*Mock test 7: X-1/.test(await txt(page, "[data-mock-info]")), await txt(page, "[data-mock-info]"));
  await page.click("[data-mock-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-mock-info]").textContent), null, { timeout: 120000 });
  const written = await dump(`${TC}/${MID}`);
  const FIGS = mock.counts.figures;
  ok(`import: 4 asosiy hujjat + ${FIGS} rasm`, Object.keys(written).length === 4 + MFIG && MFIG === FIGS && FIGS > 0, `${Object.keys(written).length}`);
  const t = written[`${TC}/${MID}`];
  ok("import: draft, mock, 50 savol, paidOnly=true, 2 soat", t.status === "draft" && t.kind === "mock" && t.questionCount === 50 && t.paidOnly === true && t.timeLimitSeconds === 7200);
  await page.click(`[data-publish="${MID}"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction((id) => !document.querySelector(`[data-publish="${id}"]`), MID, { timeout: 15000 });
  ok("publish: published", (await dump(`${TC}/${MID}`))[`${TC}/${MID}`].status === "published");
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
{ // nox: attestationAccess YO'Q — qulflangan
  const { ctx, page } = await ctxFor("nox");
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-mock-section]") && !document.querySelector("[data-mock-section]").hidden, null, { timeout: 20000 });
  const c = await page.$eval("[data-mock-card]", (e, d) => ({ t: e.textContent.replace(/\s+/g, " "), r: e.hasAttribute("data-mock-restricted"), start: !!e.querySelector(`a[href="fizika-test.html?day=${d}"]`) }), MDAY);
  ok("ruxsatsiz: mock kartasi qulflangan, 'Boshlash' yo'q", c.r && !c.start && /pullik/i.test(c.t), c.t.slice(0, 200));
  await page.goto(B + `attestatsiya/fizika-test.html?day=${MDAY}`);
  await page.waitForTimeout(2500);
  ok("ruxsatsiz: test sahifasida start tugmasi yo'q", !(await page.$("[data-start]")));
  const r = await apiAs("nox", "get", { path: `${TC}/${MID}/versions/v1` });
  ok("ruxsatsiz: versions/v1 o'qib bo'lmaydi (Rules)", r && r.ok === false || r?.error || r?.denied, J(r).slice(0, 120));
  await ctx.close();
}
{ // free1: attestationAccess bor — ochiq
  const { ctx, page } = await ctxFor("free1");
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-mock-section]") && !document.querySelector("[data-mock-section]").hidden, null, { timeout: 20000 });
  const c = await page.$eval("[data-mock-card]", (e, d) => ({ t: e.textContent.replace(/\s+/g, " "), r: e.hasAttribute("data-mock-restricted"), start: !!e.querySelector(`a[href="fizika-test.html?day=${d}"]`) }), MDAY);
  ok("ruxsatli user: mock kartasi ochiq, 'Boshlash' bor", c.start && !c.r, c.t.slice(0, 200));
  await page.screenshot({ path: path.join(OUT, `mock${NUM}-dashboard.png`), fullPage: true });
  await page.goto(B + `attestatsiya/fizika-test.html?day=${MDAY}`);
  await page.waitForSelector("[data-start]");
  const intro = await txt(page, ".att-intro");
  ok("intro: 50 savol, 100 ball", /50\s*savol/.test(intro) && /100 ball/.test(intro), intro.slice(0, 260));
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  ok("2 soatlik hisoblagich ko'rinadi", /Qolgan vaqt|1:59|2:00/.test(await txt(page, "body")));
  let figQ = 0; const bad = [];
  for (let i = 0; i < N; i++) {
    await page.waitForTimeout(100);
    await page.$$eval(".att-q img", (a) => a.forEach((x) => x.scrollIntoView({ block: "center" })));
    await page.waitForFunction(() => [...document.querySelectorAll(".att-q img")].every((x) => x.complete && x.naturalWidth > 20), null, { timeout: 8000 }).catch(() => {});
    const all = await page.$$eval(".att-q img", (a) => a.length);
    const n = await page.$$eval(".att-q img", (a) => a.filter((x) => x.complete && x.naturalWidth > 20).length);
    if (all) { figQ++; if (n !== all) bad.push(i + 1); }
    const katexErr = await page.$$eval(".att-q .katex-error", (a) => a.length);
    if (katexErr) bad.push(`katex${i + 1}`);
    if (SHOTS.includes(i + 1)) await page.screenshot({ path: path.join(OUT, `mock${NUM}-q${i + 1}.png`) });
    if (i < N - 1) await page.click("[data-next]");
  }
  ok(`${mock.counts.figures} rasmli savol, hammasi yuklangan, KaTeX xatosiz`, figQ === mock.counts.figures && !bad.length, `rasmli=${figQ} muammo=${J(bad)}`);
  for (let i = N - 1; i >= 0; i--) {
    await page.click(`[data-go="${i}"]`);
    await page.waitForSelector(`.att-opt[data-key="${mkey.answers[mids[i]]}"]`);
    await page.click(`.att-opt[data-key="${mkey.answers[mids[i]]}"]`);
  }
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-result", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const res = await txt(page, ".att-result");
  ok("natija: 100 / 100 ball", /100/.test(res) && /50 \/ 50/.test(res), res.slice(0, 200));
  await page.goto(B + `attestatsiya/fizika-yechimlar.html?day=${MDAY}`);
  await page.waitForSelector(".att-solq", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const sq = await page.$$eval(".att-solq", (q) => q.length);
  const kerr = await page.$$eval(".att-solq .katex-error", (a) => a.length);
  const notes = await page.$$eval(".att-box--source_error", (a) => a.length);
  const NOTES = mock.ops[3].data.items.filter((i) => i.solution.some((b) => b.t === "status")).length;
  ok(`yechimlar: 50 ta, KaTeX xatosiz, ${NOTES} ta «Manba xatosi» izohi`, sq === 50 && !kerr && notes === NOTES && NOTES > 0, `sq=${sq} kerr=${kerr} notes=${notes}`);
  for (const k of SHOTS) { await page.locator(".att-solq").nth(k - 1).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(OUT, `mock${NUM}-sol${k}.png`) }); }
  await page.locator(".att-solq").nth(10).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `mock${NUM}-solutions.png`) });
  ok("ruxsatli user: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | ").slice(0, 300));
  await ctx.close();
}
{ // free2: hali yakunlamagan — kalit va yechim yopiq
  const r1 = await apiAs("free2", "get", { path: `${TC}/${MID}/versions/v1` });
  ok("free2: savollar (versions/v1) o'qiladi", r1 && !r1.error && r1.ok !== false, J(r1).slice(0, 100));
  const r2 = await apiAs("free2", "get", { path: `${TC}/${MID}/solutions/v1` });
  ok("free2: yechimlar urinishsiz yopiq (Rules)", r2?.error || r2?.ok === false || r2?.denied, J(r2).slice(0, 100));
  const r3 = await apiAs("free2", "get", { path: `${TC}/${MID}/keys/v1` });
  ok("free2: kalit urinishsiz yopiq (Rules)", r3?.error || r3?.ok === false || r3?.denied, J(r3).slice(0, 100));
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
fs.writeFileSync(path.join(OUT, `report-mock-${NUM}.json`), J({ checks, failed: failed.length }, null, 1));
console.log(failed.length ? `FAIL ${failed.length}/${checks.length}` : `ALL PASS ${checks.length}/${checks.length}`);
process.exit(failed.length ? 1 : 0);
