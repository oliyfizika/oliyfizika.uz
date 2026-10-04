// ==========================================================================
// Attestatsiya → Fizika: E2E — yakunlanmagan rasmiy urinishni yechim ochilish vaqtida avtomatik yakunlash (lazy).
// Mock server soati = server vaqti (request.time). Day 1: v2 (v1 dan farqli kalit), yechim S = T0 + 1 soat.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8799 &
//   E2E_PORT=8799 node tools/attestatsiya-fizika/e2e/e2e_auto_finalize.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-auto-finalize.json; exit 1 — biror tekshiruv FAIL.
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
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8799}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const opData = (p) => structuredClone(bundle.ops.find((o) => o.path === p).data);
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });
const commit = (uid, writes) => apiAs(uid, "commit", { writes });
const clock = (d) => post("__mock/clock", { iso: d.toISOString() });
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const sec = (t) => (t?.__ts ? t.__ts[0] : null);
const tsMs = (t) => (t?.__ts ? t.__ts[0] * 1000 + Math.floor(t.__ts[1] / 1e6) : null);
const J = (x) => JSON.stringify(x);
const TC = "attestationPhysicsDailyTests";
const AC = "attestationPhysicsAttempts";
const D1 = "att-fizika-day-01";
const OPTS = ["A", "B", "C", "D"];
const T0 = new Date("2026-10-04T18:00:00Z");           // 23:00 Toshkent
const S = new Date(T0.getTime() + 3600000);            // 2026-10-05 00:00 Toshkent
const plus = (d, s) => new Date(d.getTime() + s * 1000);

// ---------------------------------------------------------------- seed
const docs = { "attestationPhysicsSettings/config": { ...opData("attestationPhysicsSettings/config"), figureBackend: "firestore" } };
docs[`${TC}/${D1}`] = opData(`${TC}/${D1}`);
for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${D1}/${c}/v1`] = opData(`${TC}/${D1}/${c}/v1`);
const k1 = docs[`${TC}/${D1}/keys/v1`];
const k2 = { ...structuredClone(k1), version: 2 };
for (const q of Object.keys(k2.answers)) k2.answers[q] = OPTS[(OPTS.indexOf(k1.answers[q]) + 1) % 4];
docs[`${TC}/${D1}/keys/v2`] = k2;
for (const c of ["versions", "solutions"]) docs[`${TC}/${D1}/${c}/v2`] = { ...opData(`${TC}/${D1}/${c}/v1`), version: 2 };
Object.assign(docs[`${TC}/${D1}`], { status: "published", published: true, publishedAt: ts(new Date(T0.getTime() - 5 * 3600000)), publishedBy: "admin1",
  solutionAvailableAt: ts(S), currentVersion: 2 });
const users = ["admin1", "uB", "uC", "uD", "uE", "uF", "uG", "uH", "uR", "user1"];
for (const u of users) docs[`users/${u}`] = { fullName: `User ${u}`, email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0), ...(u === "admin1" ? { role: "admin" } : {}) };
const sc = (k) => k.questionIds.filter((q) => q in k.answers);
const ansF = Object.fromEntries(sc(k1).slice(0, 6).map((q, i) => [q, i < 4 ? k1.answers[q] : k2.answers[q]]));   // v1: 4 to'g'ri, 2 xato
docs[`${AC}/uF__${D1}`] = { userId: "uF", testId: D1, dayNumber: 1, testVersion: 1, attemptNumber: 1, kind: "official", status: "in_progress",
  startedAt: ts(new Date(T0.getTime() - 4 * 3600000)), questionCount: 32, answers: ansF };
docs[`${AC}/uG__${D1}`] = { userId: "uG", testId: D1, dayNumber: 1, attemptNumber: 1, kind: "official", status: "in_progress",
  startedAt: ts(new Date(T0.getTime() - 4 * 3600000)), questionCount: 32, answers: {} };            // testVersion yo'q
await post("__mock/reset", {});
await clock(T0);
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, time, viewport = { width: 1366, height: 900 }) {
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
const start = (uid, at) => commit(uid, [{ type: "set", path: `${AC}/${uid}__${D1}`, data: { userId: uid, testId: D1, dayNumber: 1, testVersion: 2, attemptNumber: 1,
  kind: "official", status: "in_progress", startedAt: { __server: true }, questionCount: 32 } }]);
const att = async (uid) => (await dump(`${AC}/${uid}__${D1}`))[`${AC}/${uid}__${D1}`];
const expectGrade = (k, answers) => {
  const s = sc(k);
  const c = s.filter((q) => answers[q] === k.answers[q]).length;
  const w = s.filter((q) => q in answers && answers[q] !== k.answers[q]).length;
  return { c, w, u: s.length - c - w, pct: Math.round((100 * c) / s.length) };
};

// ---------------------------------------------------------------- 1. foydalanuvchilar testni boshlaydi (S dan oldin)
await clock(plus(T0, 60));
// uB: UI orqali boshlaydi, 1 savolga javob beradi, yakunlamaydi (brauzer yopiladi)
let ansB = null;
{
  const { ctx, page } = await ctxFor("uB", plus(T0, 60));
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  await page.click('.att-opt[data-key="B"]');
  await page.waitForTimeout(7500);                                    // qoralama saqlanadi (6 s)
  ansB = (await att("uB")).answers;
  ok("B: uB boshladi, 1 javob saqlandi, yakunlamadi (in_progress)", (await att("uB")).status === "in_progress" && Object.keys(ansB || {}).length === 1, J(ansB));
  await ctx.close();
}
// uE: qo'lda yakunlaydi (S dan oldin) — mavjud yo'l
{
  const { ctx, page } = await ctxFor("uE", plus(T0, 120));
  await clock(plus(T0, 120));
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  await page.click('.att-opt[data-key="A"]');
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-review .att-rev");
  const e = await att("uE");
  ok("A: qo‘lda yakunlash — graded, autoFinalized yo‘q, completedAt = bosilgan vaqt", e.status === "graded" && !("autoFinalized" in e) && sec(e.completedAt) < Math.floor(S / 1000));
  await ctx.close();
}
await clock(plus(T0, 180));
ok("uC/uD/uH: start (server vaqti)", (await start("uC")).ok && (await start("uD")).ok && (await start("uH")).ok);
const ansD = Object.fromEntries(sc(k2).map((q) => [q, k2.answers[q]]));
ok("D: uD barcha javoblarni saqladi", (await commit("uD", [{ type: "update", path: `${AC}/uD__${D1}`, data: { answers: ansD, savedAt: { __server: true } } }])).ok);

// ---------------------------------------------------------------- 2. S dan oldin — hali in_progress
await clock(plus(S, -60));
{
  const { ctx, page } = await ctxFor("uB", plus(S, -60));
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.waitForSelector("[data-start]");
  ok("E: S dan oldin qaytdi — hali in_progress, «Davom ettirish»", (await att("uB")).status === "in_progress" && /Davom ettirish/.test(await page.textContent("[data-start]")));
  await ctx.close();
}
const early = await commit("uB", [{ type: "update", path: `${AC}/uB__${D1}`, data: { status: "submitted", completedAt: ts(S), answers: ansB, autoFinalized: true } }]);
ok("server vaqti: S dan oldin avtomatik yakunlash — Rules rad etadi (klient soati ahamiyatsiz)", early.ok === false);

// ---------------------------------------------------------------- 3. poyga: qo'lda submit S − 1 s, keyin avtomatik S da
await clock(plus(S, -1));
const man = await commit("uH", [{ type: "update", path: `${AC}/uH__${D1}`, data: { status: "submitted", completedAt: { __server: true }, answers: {} } }]);
await clock(S);
const auto = await commit("admin1", [{ type: "update", path: `${AC}/uH__${D1}`, data: { status: "submitted", completedAt: ts(S), answers: {}, autoFinalized: true } }]);
ok("H: poyga — qo‘lda submit (S − 1 s) o‘tdi, avtomatik (S) rad — bitta yakun", man.ok === true && auto.ok === false && !("autoFinalized" in (await att("uH"))));

// ---------------------------------------------------------------- 4. uR: test sahifasi ochiq, S o'tgach «Testni yakunlash» bosadi
await clock(plus(S, -1800));
let ansR = null;
{
  const { ctx, page } = await ctxFor("uR", plus(S, -1800));
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  await page.click('.att-opt[data-key="C"]');
  await page.click("[data-next]");
  await page.click('.att-opt[data-key="D"]');
  await page.waitForTimeout(7500);
  ansR = (await att("uR")).answers;
  await clock(plus(S, 60));                                           // server vaqti S dan o'tdi
  await page.click('.att-opt[data-key="A"]');                         // saqlanmagan o'zgarish (S dan keyin — qabul qilinmaydi)
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-review .att-rev", { timeout: 20000 });
  const toastR = await page.textContent(".of-toast-region").catch(() => "");
  const r = await att("uR");
  ok("H2: yakunlash S dan keyin bosildi — qo‘lda submit rad, avtomatik yakunlandi (oxirgi saqlangan javoblar)",
     r.status === "graded" && r.autoFinalized === true && J(r.answers) === J(ansR) && Object.keys(ansR).length === 2, J(r.answers));
  ok("H2: foydalanuvchiga natija va xabar ko‘rsatildi", /avtomatik yakunlandi/.test(toastR) && (await page.$$(".att-rev")).length === 32, toastR.trim());
  ok("H2: konsol xatolari yo‘q (kutilgan permission-denied dan tashqari)", !page.errs.filter((e) => !/permission|ruxsat|submit\/grade/i.test(e)).length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 5. uB ertalab qaytadi (S + 8 soat)
const late = plus(S, 8 * 3600);
await clock(late);
{
  const { ctx, page } = await ctxFor("uB", late);
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-today]")?.getAttribute("aria-busy") !== "true", null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const b = await att("uB");
  const eb = expectGrade(k2, b.answers || {});
  ok("F/B: qaytganda (dashboard) — graded, autoFinalized", b.status === "graded" && b.autoFinalized === true);
  ok("B: javoblar o‘zgarmagan, 1 javob baholandi, qolgani javobsiz", J(b.answers) === J(ansB) && b.correctAnswers === eb.c && b.wrongAnswers === eb.w && b.unanswered === eb.u, J([b.correctAnswers, b.wrongAnswers, b.unanswered]));
  ok("solutionAvailableAt: completedAt = S (2026-10-05 00:00 Toshkent)", sec(b.completedAt) === Math.floor(S / 1000) && new Date(S).toISOString() === "2026-10-04T19:00:00.000Z");
  ok("vaqt: S bilan cheklangan (startedAt → S, Rules formulasi), 8 soat qo‘shilmagan",
     b.timeSpentSeconds === Math.floor((tsMs(b.completedAt) - tsMs(b.startedAt)) / 1000) && b.timeSpentSeconds < 3600, String(b.timeSpentSeconds));
  ok("o‘zgarmagan maydonlar: userId, testId, dayNumber, testVersion, attemptNumber, kind", b.userId === "uB" && b.testId === D1 && b.dayNumber === 1 && b.testVersion === 2 && b.attemptNumber === 1 && b.kind === "official");
  // natija sahifasi + Result Review
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.waitForSelector(".att-review .att-rev");
  const cards = await page.$$eval(".att-rev", (cs) => cs.map((c) => c.dataset.status));
  ok("Result Review: 32 karta, 1 javob + qolgani javobsiz/ballga kirmaydi",
     cards.length === 32 && cards.filter((s) => s === "unanswered").length === eb.u && cards.filter((s) => s === "correct").length === eb.c && cards.filter((s) => s === "wrong").length === eb.w, J({ u: cards.filter((s) => s === "unanswered").length }));
  ok("Result Review: «Sizning javobingiz» belgisi — faqat javob berilgan savolda", (await page.$$(".att-rev [data-mine]")).length === Object.keys(ansB).length,
     String((await page.$$(".att-rev [data-mine]")).length));
  // yechimlar sahifasi (ochiq)
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=1");
  await page.waitForSelector(".att-solq", { timeout: 15000 });
  ok("Solution unlock: S dan keyin yechimlar ochiq", (await page.$$(".att-solq")).length > 0);
  ok("uB: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
const solEarly = await apiAs("uC", "get", { path: `${TC}/${D1}/solutions/v2` });
ok("Solution unlock va avtomatik yakun bir xil chegara (S): S dan keyin yechim ochiq", solEarly.ok === true);

// ---------------------------------------------------------------- 6. xavfsizlik
const forge = await commit("uD", [{ type: "update", path: `${AC}/uD__${D1}`, data: { status: "graded", scorePercent: 100, correctAnswers: 31 } }]);
ok("Security: user o‘zini graded + natija yoza olmaydi", forge.ok === false);
const other = await commit("user1", [{ type: "update", path: `${AC}/uD__${D1}`, data: { status: "submitted", completedAt: ts(S), answers: ansD, autoFinalized: true } }]);
ok("Security: boshqa user birovning urinishini yakunlay olmaydi", other.ok === false);
const stretch = await commit("uD", [{ type: "update", path: `${AC}/uD__${D1}`, data: { status: "submitted", completedAt: { __server: true }, answers: ansD, autoFinalized: true } }]);
ok("Security: completedAt = hozir (vaqtni cho‘zish) — rad", stretch.ok === false);

// ---------------------------------------------------------------- 7. admin sahifasi — qaytmagan foydalanuvchilar (uC, uD, uF)
{
  const before = await dump(AC);
  const { ctx, page } = await ctxFor("admin1", late);
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForFunction(() => /avtomatik yakunlandi/.test(document.querySelector(".of-toast-region")?.textContent || ""), null, { timeout: 20000 });
  const toastTxt = await page.textContent(".of-toast-region");
  ok("admin: 3 ta urinish avtomatik yakunlandi (uC, uD, uF), 1 ta topshirilgan (uH) baholandi",
     /3 ta yakunlanmagan urinish/.test(toastTxt) && /1 ta topshirilgan urinish baholandi/.test(toastTxt), toastTxt.trim());
  const h = await att("uH");
  ok("H: uH — qo‘lda topshirilgan urinish baholandi, avtomatik belgisiz, completedAt S − 1 s", h.status === "graded" && !("autoFinalized" in h) && sec(h.completedAt) === Math.floor(S / 1000) - 1);
  const c = await att("uC"), d = await att("uD"), f = await att("uF"), g = await att("uG");
  ok("C: hech javob yo‘q — graded, hammasi javobsiz, 0 %", c.status === "graded" && c.unanswered === sc(k2).length && c.scorePercent === 0 && J(c.answers) === "{}");
  ok("D: barcha javob (yakunlanmagan) — graded 100 %", d.status === "graded" && d.scorePercent === 100 && d.correctAnswers === sc(k2).length);
  const ef = expectGrade(k1, ansF);
  ok("I: v1 urinish — v1 kaliti bilan (4 to‘g‘ri / 2 xato)", f.status === "graded" && f.correctAnswers === ef.c && f.wrongAnswers === ef.w && ef.c === 4 && ef.w === 2, J([f.correctAnswers, f.wrongAnswers]));
  ok("J: v2 urinish — v2 kaliti bilan (uD v2 javoblari v1 bo‘yicha 0 % bo‘lardi)", expectGrade(k1, ansD).pct === 0 && d.scorePercent === 100);
  ok("K: testVersion yo‘q urinish — taxmin qilinmadi (in_progress qoldi)", g.status === "in_progress" && !("autoFinalized" in g));
  ok("admin: hech qanday attempt yangi yaratilmadi", Object.keys(await dump(AC)).length === Object.keys(before).length);
  // admin «Urinishlar» — tabiiy ko'rinadi
  await page.click(`[data-action="view-attempts"][data-test-id="${D1}"]`);
  await page.waitForFunction((id) => { const b = document.querySelector(`[data-att-body="${id}"]`); return b && !b.hasAttribute("aria-busy") && !/Yuklanmoqda/.test(b.textContent); }, D1);
  const rows = await page.$$eval(`[data-att-rows="${D1}"] tbody tr`, (rs) => rs.map((r) => ({ name: r.querySelector(".att-attempts__name a").textContent.trim(), st: r.lastElementChild.textContent.trim() })));
  ok("M: Admin «Urinishlar» v2 — avtomatik graded ko‘rinadi (F.I.Sh., «Baholangan (avtomatik)»)",
     ["User uB", "User uC", "User uD", "User uR"].every((n) => rows.find((r) => r.name === n)?.st === "Baholangan (avtomatik)") && rows.find((r) => r.name === "User uE")?.st === "Baholangan"
     && rows.find((r) => r.name === "User uH")?.st === "Baholangan", J(rows));
  // Savollar statistikasi — tabiiy kiradi
  await page.click(`[data-qstats="${D1}"]`);
  await page.waitForFunction(() => /^\d+$/.test(document.querySelector("[data-qstats-n]")?.textContent.trim() || ""), null, { timeout: 15000 });
  const graded2 = Object.values(await dump(AC)).filter((a) => a.testVersion === 2 && a.status === "graded").length;
  ok("N: Savollar statistikasi — avtomatik graded urinishlar kiradi", Number(await page.textContent("[data-qstats-n]")) === graded2 && graded2 === 6, `${graded2}`);
  ok("admin: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 8. idempotentlik: qayta ochish
{
  const snap = await dump(AC);
  const { ctx, page } = await ctxFor("admin1", plus(late, 600));
  await clock(plus(late, 600));
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForTimeout(2500);
  ok("G: qayta ochilganda — hech narsa o‘zgarmadi (graded → graded yo‘q)", J(await dump(AC)) === J(snap) && !/avtomatik yakunlandi/.test(await page.textContent("body")));
  const again = await commit("admin1", [{ type: "update", path: `${AC}/uC__${D1}`, data: { status: "submitted", completedAt: ts(S), answers: {}, autoFinalized: true } }]);
  ok("G: graded urinishni qayta yakunlash — rad", again.ok === false);
  await ctx.close();
  const { ctx: c2, page: p2 } = await ctxFor("uB", plus(late, 700));
  await p2.goto(B + "attestatsiya/fizika-natijalar.html");
  await p2.waitForTimeout(2500);
  ok("G: user natijalar sahifasi — qayta yakunlanmaydi, natija o‘zgarmaydi", J(await dump(AC)) === J(snap) && !p2.errs.length, p2.errs.join(" | "));
  await c2.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-auto-finalize.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
