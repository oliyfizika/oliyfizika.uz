// ==========================================================================
// Attestatsiya → Fizika: E2E — admin «Arxivdan chiqarish» (archived → draft).
// Holat (seed, production'ga o'xshash): Day 1 v2 archived + graded urinishlar (v1 va v2), Day 2 published, Day 3 draft.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8793 &
//   E2E_PORT=8793 node tools/attestatsiya-fizika/e2e/e2e_unarchive.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-unarchive.json; exit 1 — biror tekshiruv FAIL.
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
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8793}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const opData = (p) => structuredClone(bundle.ops.find((o) => o.path === p).data);
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const J = (x) => JSON.stringify(x);
const TC = "attestationPhysicsDailyTests";
const [D1, D2, D3] = ["att-fizika-day-01", "att-fizika-day-02", "att-fizika-day-03"];
const T0 = new Date("2026-10-06T06:00:00Z");
const H = 3600000;

// ---------------------------------------------------------------- seed
const docs = { "attestationPhysicsSettings/config": { ...opData("attestationPhysicsSettings/config"), figureBackend: "firestore" } };
for (const u of ["admin1", "user1", "user2", "user3"]) {
  docs[`users/${u}`] = { fullName: u, firstName: u, email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0), ...(u === "admin1" ? { role: "admin" } : {}) };
}
for (const id of [D1, D2, D3]) {
  docs[`${TC}/${id}`] = opData(`${TC}/${id}`);
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${id}/${c}/v1`] = opData(`${TC}/${id}/${c}/v1`);
}
for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${D1}/${c}/v2`] = { ...opData(`${TC}/${D1}/${c}/v1`), version: 2 };
Object.assign(docs[`${TC}/${D1}`], { status: "archived", published: true, publishedAt: ts(new Date(T0 - 72 * H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0 - 50 * H)), archivedAt: ts(new Date(T0 - 2 * H)), currentVersion: 2 });
Object.assign(docs[`${TC}/${D2}`], { status: "published", published: true, publishedAt: ts(new Date(T0 - H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0 + 13 * H)) });
const qIds = docs[`${TC}/${D1}`].questionIds;
const att = (uid, v, c, w) => ({ userId: uid, testId: D1, dayNumber: 1, testVersion: v, attemptNumber: 1, kind: "official", status: "graded",
  questionCount: 32, startedAt: ts(new Date(T0 - 70 * H)), completedAt: ts(new Date(T0 - 69 * H)), timeSpentSeconds: 1500,
  answers: Object.fromEntries(qIds.slice(0, c + w).map((q, i) => [q, i < c ? "A" : "B"])), scorableQuestions: v === 1 ? 23 : 31,
  correctAnswers: c, wrongAnswers: w, unanswered: 32 - c - w, scorePercent: Math.round((100 * c) / (v === 1 ? 23 : 31)),
  correctIds: qIds.slice(0, c), wrongIds: qIds.slice(c, c + w) });
docs[`attestationPhysicsAttempts/user1__${D1}`] = att("user1", 1, 9, 6);
docs[`attestationPhysicsAttempts/user2__${D1}`] = att("user2", 2, 14, 10);
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });
const before = await dump("attestationPhysics");

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
const rowActions = (page, id) => page.evaluate((id) => {
  const tr = [...document.querySelectorAll("[data-body] tr")].find((r) => r.querySelector(`[data-publish="${id}"],[data-archive="${id}"],[data-unarchive="${id}"],[data-attempts="${id}"]`));
  return tr ? [...tr.querySelectorAll("[data-publish],[data-archive],[data-unarchive]")].map((b) => Object.keys(b.dataset)[0]) : null;
}, id);
const diffKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => J(a[k]) !== J(b[k])).sort();

// ---------------------------------------------------------------- 1. non-admin (Rules)
for (const uid of ["user1", null]) {
  const r = await apiAs(uid, "commit", { writes: [{ type: "update", path: `${TC}/${D1}`, data: { status: "draft", published: false } }] });
  ok(`non-admin (${uid || "mehmon"}) unarchive — Rules rad etadi`, r.ok === false, r.code || "");
}

// ---------------------------------------------------------------- 2. admin UI
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForSelector(`[data-unarchive="${D1}"]`);
  ok("archived qator: faqat «Arxivdan chiqarish»", J(await rowActions(page, D1)) === J(["unarchive"]),
     J(await rowActions(page, D1)));
  ok("tugma matni «Arxivdan chiqarish»", (await page.textContent(`[data-unarchive="${D1}"]`)).trim() === "Arxivdan chiqarish");
  ok("published qator: mavjud Archive, unarchive yo‘q", J(await rowActions(page, D2)) === J(["archive"]), J(await rowActions(page, D2)));
  ok("draft qator: faqat PUBLISH", J(await rowActions(page, D3)) === J(["publish"]), J(await rowActions(page, D3)));

  // bekor qilish — hech narsa o'zgarmaydi
  await page.click(`[data-unarchive="${D1}"]`);
  await page.waitForSelector(".of-admin-confirm");
  const title = (await page.textContent(".of-admin-confirm .of-modal__title")).trim();
  ok("tasdiq oynasi matni", title === "Day 1 ni arxivdan chiqarib, draft holatiga qaytarishni xohlaysizmi?", title);
  await page.click(".of-admin-confirm .of-btn--ghost");
  await page.waitForTimeout(500);
  ok("bekor qilinganda — hech narsa yozilmadi", J(await dump("attestationPhysics")) === J(before));

  // tasdiqlash
  await page.click(`[data-unarchive="${D1}"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /arxivdan chiqarildi/.test(document.querySelector(".of-toast-region")?.textContent || ""), null, { timeout: 15000 });
  const toastTxt = (await page.textContent(".of-toast-region")).trim();
  ok("toast: «Day 1 arxivdan chiqarildi va draft holatiga qaytarildi.»", toastTxt.includes("Day 1 arxivdan chiqarildi va draft holatiga qaytarildi."), toastTxt);
  await page.waitForSelector(`[data-publish="${D1}"]`);
  const after = await dump("attestationPhysics");
  const m0 = before[`${TC}/${D1}`], m1 = after[`${TC}/${D1}`];
  ok("Day 1: archived → draft, published=false", m1.status === "draft" && m1.published === false);
  ok("Day 1 meta: faqat status va published o‘zgardi", J(diffKeys(m0, m1)) === J(["published", "status"]), J(diffKeys(m0, m1)));
  ok("Day 1: versiya v2 (bump yo‘q), questionIds o‘zgarmagan", m1.currentVersion === 2 && J(m1.questionIds) === J(m0.questionIds));
  ok("Day 1: publishedAt, solutionAvailableAt, planHash o‘zgarmagan",
     J([m1.publishedAt, m1.solutionAvailableAt, m1.planHash]) === J([m0.publishedAt, m0.solutionAvailableAt, m0.planHash]));
  const others = (d) => J(Object.fromEntries(Object.entries(d).filter(([p]) => p !== `${TC}/${D1}`)));
  ok("boshqa barcha hujjatlar attestationPhysics* hujjatlar (v1, v2, kalitlar, urinishlar, Day 2/3, sozlama) o‘zgarmagan", others(after) === others(before));
  ok("graded urinishlar (v1 va v2) o‘zgarmagan",
     ["user1", "user2"].every((u) => J(after[`attestationPhysicsAttempts/${u}__${D1}`]) === J(before[`attestationPhysicsAttempts/${u}__${D1}`])));
  ok("draft qatorida: PUBLISH (avtomatik publish yo‘q)", J(await rowActions(page, D1)) === J(["publish"]));
  const attNow = await dump("attestationPhysicsAttempts/");
  ok("urinishlar soni o‘zgarmagan (2 ta graded)", Object.keys(attNow).length === 2 && Object.values(attNow).every((a) => a.status === "graded"));

  // unarchive'dan keyin snapshot'lar o'zgarmas (Rules)
  const w = await apiAs("admin1", "commit", { writes: [{ type: "update", path: `${TC}/${D1}/versions/v2`, data: { note: "x" } }] });
  ok("unarchive'dan keyin versions/v2 ni tahrirlash — rad", w.ok === false, w.code || "");
  const w1 = await apiAs("admin1", "commit", { writes: [{ type: "update", path: `${TC}/${D1}/keys/v1`, data: { note: "x" } }] });
  ok("unarchive'dan keyin keys/v1 ni tahrirlash — rad", w1.ok === false, w1.code || "");

  // published → draft — UI orqali ham rad (poyga: sahifa eski «archived» holatni ko'rsatadi, serverda published)
  await post("__mock/seed", { docs: { [`${TC}/${D2}`]: { ...after[`${TC}/${D2}`], status: "archived" } } });
  await page.reload();
  await page.waitForSelector(`[data-unarchive="${D2}"]`);
  await post("__mock/seed", { docs: { [`${TC}/${D2}`]: after[`${TC}/${D2}`] } });   // serverda yana published
  const errsBefore = page.errs.length;
  await page.click(`[data-unarchive="${D2}"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /ruxsat yo‘q/.test(document.querySelector(".of-toast-region")?.textContent || ""), null, { timeout: 15000 });
  ok("published → draft — Rules rad etadi, aniq xato xabari", true, (await page.textContent(".of-toast-region")).trim().slice(-90));
  ok("published Day 2 o‘zgarmagan", J((await dump(`${TC}/${D2}`))[`${TC}/${D2}`]) === J(after[`${TC}/${D2}`]));
  page.errs.splice(errsBefore);                                                         // kutilgan permission-denied log
  const pd = await apiAs("admin1", "commit", { writes: [{ type: "update", path: `${TC}/${D2}`, data: { status: "draft", published: false } }] });
  ok("published → draft (to‘g‘ridan-to‘g‘ri so‘rov) — rad", pd.ok === false, pd.code || "");

  // qayta PUBLISH — mavjud logika
  await page.reload();
  await page.waitForSelector(`[data-publish="${D1}"]`);
  await page.click(`[data-publish="${D1}"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForSelector(`[data-archive="${D1}"]`);
  const re = await dump("attestationPhysics");
  const m2 = re[`${TC}/${D1}`];
  ok("draft → published (mavjud PUBLISH) ishlaydi", m2.status === "published" && m2.published === true);
  ok("qayta publish: versiya v2, savollar o‘zgarmagan", m2.currentVersion === 2 && J(m2.questionIds) === J(m0.questionIds));
  ok("qayta publish: urinishlar o‘zgarmagan",
     ["user1", "user2"].every((u) => J(re[`attestationPhysicsAttempts/${u}__${D1}`]) === J(before[`attestationPhysicsAttempts/${u}__${D1}`])));
  ok("qayta publish: v1/v2 snapshot va kalitlar o‘zgarmagan",
     ["versions", "keys", "solutions"].every((c) => ["v1", "v2"].every((v) => J(re[`${TC}/${D1}/${c}/${v}`]) === J(before[`${TC}/${D1}/${c}/${v}`]))));
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await page.screenshot({ path: path.join(OUT, "unarchive-admin.png") });
  await ctx.close();
}

// ---------------------------------------------------------------- 3. user sahifalari Day 1 draft paytida (xatosiz, ma'lumot o'zgarmaydi)
{
  // Day 1 ni yana draft holatiga keltiramiz (Rules orqali: archive → unarchive)
  const a = await apiAs("admin1", "commit", { writes: [{ type: "update", path: `${TC}/${D1}`, data: { status: "archived", archivedAt: { __server: true } } }] });
  const u = await apiAs("admin1", "commit", { writes: [{ type: "update", path: `${TC}/${D1}`, data: { status: "draft", published: false } }] });
  ok("Rules: archive → unarchive (admin) — ruxsat", a.ok !== false && u.ok !== false, `${a.code || ""} ${u.code || ""}`);
  const { ctx, page } = await ctxFor("user1");
  await page.goto(B + "attestatsiya/fizika-natijalar.html");
  await page.waitForTimeout(2500);
  ok("user1 natijalar sahifasi: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForTimeout(2500);
  ok("user1 dashboard: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  const g = await apiAs("user1", "get", { path: `${TC}/${D1}` });
  ok("user draft Day 1 ni o‘qiy olmaydi", g.ok === false, g.code || "");
  const fin = await dump("attestationPhysicsAttempts/");
  ok("user sahifalaridan keyin urinishlar o‘zgarmagan",
     ["user1", "user2"].every((x) => J(fin[`attestationPhysicsAttempts/${x}__${D1}`]) === J(before[`attestationPhysicsAttempts/${x}__${D1}`])));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-unarchive.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
