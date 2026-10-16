// ==========================================================================
// Attestatsiya → Fizika: E2E — PULLIK MOCK-02 (rasmli)
// (asos: e2e_mock.mjs) (50 savol = 40 fizika + 10 pedagogika, har savol 2 ball, jami 100).
//   python3 tools/attestatsiya-fizika/build_mock_test.py      # mock-import-02.json
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8811 &
//   E2E_PORT=8811 node tools/attestatsiya-fizika/e2e/e2e_mock.mjs
// Oqim: admin import (draft) → PUBLISH → foydalanuvchi (PAID rejim, attestationAccess YO'Q) boshlaydi → ishlaydi →
// topshiradi → ball → yechimlar yopiq → yechim vaqti kelgach ochiladi → avto-yakunlash → kunlik oqim buzilmagan.
// Natija: _private/attestatsiya-fizika/e2e/report-mock.json
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/npm-tools/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PRIV = path.join(ROOT, "_private/attestatsiya-fizika");
const OUT = path.join(PRIV, "e2e");
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8811}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const MOCKFILE = path.join(PRIV, "mock-import-02.json");
const mock = JSON.parse(fs.readFileSync(MOCKFILE, "utf8"));
const opData = (p) => structuredClone(bundle.ops.find((o) => o.path === p).data);
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const J = (x) => JSON.stringify(x);
const TC = "attestationPhysicsDailyTests";
const AC = "attestationPhysicsAttempts";
const CFG = "attestationPhysicsSettings/config";
const DID = (n) => `att-fizika-day-${String(n).padStart(2, "0")}`;
const MID = mock.testId;
const MDAY = mock.dayNumber;
const T0 = new Date("2026-10-07T06:00:00Z");            // 11:00 Toshkent
const H = 3600000;
const at = (h) => ts(new Date(T0.getTime() + h * H));
const mkey = mock.ops[2].data;                            // javob kaliti (faqat test uchun)
const mids = mkey.questionIds;

// ---------------------------------------------------------------- seed: faqat kunlik testlar (mock admin UI orqali import qilinadi)
const docs = { [CFG]: { ...opData(CFG), figureBackend: "firestore", accessMode: "open" } };
const PUB = { 1: [-150, -126], 3: [-2, 13], 4: [-78, -54] };
for (const n of [1, 2, 3, 4]) {
  docs[`${TC}/${DID(n)}`] = opData(`${TC}/${DID(n)}`);
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${DID(n)}/${c}/v1`] = opData(`${TC}/${DID(n)}/${c}/v1`);
  if (PUB[n]) Object.assign(docs[`${TC}/${DID(n)}`], { status: "published", published: true, publishedAt: at(PUB[n][0]), publishedBy: "admin1", solutionAvailableAt: at(PUB[n][1]) });
}
const people = { pay: { fullName: "Pullik User", attestationAccess: true }, admin1: { fullName: "Admin Bir", role: "admin" }, nox: { fullName: "Ruxsatsiz User" }, acc2: { fullName: "Ikkinchi User" }, late: { fullName: "Kechikkan User" }, timer: { fullName: "Taymer User" } };
for (const [u, p] of Object.entries(people)) docs[`users/${u}`] = { email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: at(-200), ...p };
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, time = T0, viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript(([u]) => localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u })), [uid]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(time);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) page.errs.push(m.text()); });
  return { ctx, page };
}
const clock = (d) => post("__mock/clock", { iso: d.toISOString() });
const plus = (d, h) => new Date(d.getTime() + h * H);
const attemptOf = async (uid) => (await dump(`${AC}/${uid}__${MID}`))[`${AC}/${uid}__${MID}`];
const txt = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, " ").trim();


const MFIG = mock.ops.filter((o) => /\/(figures|solutionFigures)\//.test(o.path)).length;
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForSelector("[data-body] tr");
  await page.setInputFiles("[data-mock-bundle]", MOCKFILE);
  await page.waitForFunction(() => !document.querySelector("[data-mock-import]").disabled, null, { timeout: 15000 });
  const info = await txt(page, "[data-mock-info]");
  ok("admin: fayl tekshirildi (pullik, rasmlar)", /pullik/i.test(info) && /rasm/i.test(info), info);
  await page.click("[data-mock-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-mock-info]").textContent), null, { timeout: 120000 });
  const written = await dump(`${TC}/${MID}`);
  const figs = Object.keys(written).filter((k) => /\/(figures|solutionFigures)\//.test(k));
  ok("import: 4 asosiy hujjat + rasm hujjatlari", Object.keys(written).length === 4 + MFIG && figs.length === MFIG && MFIG > 0, `${Object.keys(written).length} / figs ${figs.length}`);
  const t = written[`${TC}/${MID}`];
  ok("import: draft, mock, 50 savol, paidOnly=true", t.status === "draft" && t.kind === "mock" && t.questionCount === 50 && t.paidOnly === true);
  // qayta import — hech narsa yozmaydi
  await page.setInputFiles("[data-mock-bundle]", MOCKFILE);
  await page.waitForFunction(() => !document.querySelector("[data-mock-import]").disabled);
  await page.click("[data-mock-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /allaqachon|Tayyor/.test(document.querySelector("[data-mock-info]").textContent), null, { timeout: 30000 });
  ok("import: qayta ishga tushirish xavfsiz", Object.keys(await dump(`${TC}/${MID}`)).length === 4 + MFIG);
  await page.click(`[data-publish="${MID}"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction((id) => !document.querySelector(`[data-publish="${id}"]`), MID, { timeout: 15000 });
  ok("publish: published", (await dump(`${TC}/${MID}`))[`${TC}/${MID}`].status === "published");
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
await clock(plus(T0, 0.1));
// ruxsatsiz user (accessMode=open ham ochmaydi)
{
  const { ctx, page } = await ctxFor("nox", plus(T0, 0.1));
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-days]") && !document.querySelector("[data-days]").hasAttribute("aria-busy"), null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector("[data-mock-section]").hidden, null, { timeout: 10000 });
  const c = await page.$eval("[data-mock-card]", (e) => ({ t: e.textContent.replace(/\s+/g, " "), s: e.dataset.state, r: e.hasAttribute("data-mock-restricted"), start: !!e.querySelector('a[href="fizika-test.html?day=102"]') }));
  ok("ruxsatsiz: mock kartasi qulflangan, 'Boshlash' yo'q", c.r && !c.start && /pullik/i.test(c.t), c.t.slice(0, 200));
  await page.goto(B + "attestatsiya/fizika-test.html?day=102");
  await page.waitForTimeout(2500);
  ok("ruxsatsiz: test sahifasida start tugmasi yo'q", !(await page.$("[data-start]")));
  const r = await apiAs("nox", "get", { path: `${TC}/${MID}/versions/v1` });
  ok("ruxsatsiz: versions/v1 o'qib bo'lmaydi (Rules)", r && r.ok === false || r?.error || r?.denied, J(r).slice(0, 120));
  await page.screenshot({ path: path.join(OUT, "mock02-locked.png"), fullPage: true });
  await ctx.close();
}
// pullik user
{
  const { ctx, page } = await ctxFor("pay", plus(T0, 0.1));
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => !document.querySelector("[data-mock-section]").hidden, null, { timeout: 20000 });
  const st = await page.$eval("[data-mock-card]", (e) => ({ s: e.dataset.state, start: !!e.querySelector('a[href="fizika-test.html?day=102"]') }));
  ok("pullik user: mock kartasi ochiq, 'Boshlash' bor", st.start && st.s === "open", J(st));
  await page.goto(B + "attestatsiya/fizika-test.html?day=102");
  await page.waitForSelector("[data-start]");
  const intro = await txt(page, ".att-intro");
  ok("intro: 50 savol, 100 ball, kasbiy/pedagogik tarkibi", /50\s*savol/.test(intro) && /100 ball/.test(intro), intro.slice(0, 260));
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const imgs = [];
  let figQ = 0;
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(120);
    await page.$$eval(".att-q img", (a) => a.forEach((x) => x.scrollIntoView({ block: "center" })));
    await page.waitForFunction(() => [...document.querySelectorAll(".att-q img")].every((x) => x.complete && x.src.startsWith("blob:")), null, { timeout: 8000 }).catch(() => {});
    const n = await page.$$eval(".att-q img", (a) => a.filter((x) => x.complete && x.naturalWidth > 20).length);
    const all = await page.$$eval(".att-q img", (a) => a.length);
    if (all) { figQ++; if (n !== all) imgs.push([i + 1, await page.$$eval(".att-q img", (a) => a.map((x) => `${x.src.slice(0, 90)}|${x.complete}|${x.naturalWidth}`))]); }
    if (i === 4) await page.screenshot({ path: path.join(OUT, "mock02-q5-figure.png") });
    if (i < 49) await page.click("[data-next]");
  }
  ok("rasmli savollar bor va hammasi yuklangan (Firestore'dan)", figQ >= 10 && !imgs.length, `rasmli=${figQ} yuklanmagan=${J(imgs)}`);
  // barcha javoblarni to'g'ri belgilash
  for (let i = 49; i >= 0; i--) {
    await page.click(`[data-go="${i}"]`);
    await page.waitForSelector(`.att-opt[data-key="${mkey.answers[mids[i]]}"]`);
    await page.click(`.att-opt[data-key="${mkey.answers[mids[i]]}"]`);
    if (!(await page.$(`.att-opt[data-key="${mkey.answers[mids[i]]}"][aria-checked="true"], .att-opt.is-selected[data-key="${mkey.answers[mids[i]]}"], .att-opt[data-key="${mkey.answers[mids[i]]}"].is-active`))) console.log("NOSEL", i + 1);
  }
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-result", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const res = await txt(page, ".att-result");
  ok("natija: 100 / 100 ball", /100/.test(res) && /50 \/ 50/.test(res), res.slice(0, 200));
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=102");
  await page.waitForSelector(".att-solq", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const sq = await page.$$eval(".att-solq", (q) => q.length);
  const nimg = await page.$$eval(".att-solq img", (a) => a.length);
  for (let i = 0; i < nimg; i++) { await page.locator(".att-solq img").nth(i).scrollIntoViewIfNeeded(); await page.waitForTimeout(80); }
  await page.waitForFunction(() => [...document.querySelectorAll(".att-solq img")].every((x) => x.complete && x.naturalWidth > 20), null, { timeout: 15000 }).catch(() => {});
  const bad = await page.$$eval(".att-solq img", (a) => a.filter((x) => !(x.complete && x.naturalWidth > 20)).length);
  console.log("BADIMG", J(await page.$$eval(".att-solq img", (a) => a.filter((x) => !(x.complete && x.naturalWidth > 20)).slice(0, 3).map((x) => `${x.src.slice(0, 120)}|${x.complete}|${x.naturalWidth}`))));
  ok("yechimlar: 50 ta, rasmlar yuklangan", sq === 50 && bad === 0, `sq=${sq} bad=${bad}`);
  ok("pullik user: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | ").slice(0, 300));
  await ctx.close();
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
fs.writeFileSync(path.join(OUT, "report-mock-paid.json"), J({ checks, failed: failed.length }, null, 1));
console.log(failed.length ? `FAIL ${failed.length}/${checks.length}` : `ALL PASS ${checks.length}/${checks.length}`);
process.exit(failed.length ? 1 : 0);
