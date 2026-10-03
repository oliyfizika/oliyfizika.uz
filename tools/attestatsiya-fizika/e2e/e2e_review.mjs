// ==========================================================================
// Attestatsiya → Fizika: E2E — Day 1 canonical versiya (migratsiya) + natijani ko'rib chiqish (A–O).
// Production holati: baseline bundle import → Firestore rasmlari → manba «firestore» → Day 1 v1 publish →
// user1 v1 ni topshiradi (+ eski sxemadagi 2 urinish) → admin migration.json ni qo'llaydi → user2 Day 1 v2.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8792 &
//   E2E_PORT=8792 node tools/attestatsiya-fizika/e2e/e2e_review.mjs
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/npm-tools/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PRIV = path.join(ROOT, "_private/attestatsiya-fizika");
const BASE = path.join(PRIV, "_staging/production-baseline");
const OUT = path.join(PRIV, "e2e");
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8792}/`;
const SDK = path.join(HERE, "sdk");
const readJ = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const base = readJ(path.join(BASE, "firestore-import.json"));
const canon = readJ(path.join(PRIV, "firestore-import.json"));
const migration = readJ(path.join(PRIV, "migration/migration.json"));
const D1 = "att-fizika-day-01";
const dataOf = (bundle, p) => bundle.ops.find((o) => o.path === p).data;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const J = (x) => JSON.stringify(x);
const T0 = new Date("2026-10-03T04:00:00Z");    // 3-oktabr, 09:00 Toshkent

await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
const users = ["admin1", "user1", "user2", "user3", "user4"];
await post("__mock/seed", { docs: Object.fromEntries(users.map((u) => [`users/${u}`, {
  fullName: u, firstName: u, email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0), ...(u === "admin1" ? { role: "admin" } : {}) }])) });

const browser = await chromium.launch();
async function ctxFor(uid, { viewport = { width: 1366, height: 900 }, time = T0 } = {}) {
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
  page.apiLog = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); page.apiLog.push({ op: j.op, path: j.path || j.col || "" }); } catch { /* */ } }
  });
  return { ctx, page };
}

async function takeTest(page, plan) {
  await page.goto(B + `attestatsiya/fizika-test.html?day=1`);
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const reviewMarksDuringTest = [];
  for (let i = 0; i < plan.length; i++) {
    if (plan[i]) await page.click(`.att-opt[data-key="${plan[i]}"]`);
    reviewMarksDuringTest.push(await page.$$eval(".att-q [data-review], .att-q [data-mine]", (x) => x.length));
    if (i < plan.length - 1) await page.click("[data-next]");
  }
  const keyReqBefore = page.apiLog.filter((r) => /\/keys\//.test(r.path)).length;
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-review .att-rev");
  return { keyReqBefore, marks: reviewMarksDuringTest.reduce((a, b) => a + b, 0) };
}

async function renderAllCards(page) {
  const cards = await page.$$(".att-rev");
  for (const c of cards) { await c.scrollIntoViewIfNeeded(); }
  await page.waitForTimeout(1200);
  for (const f of await page.$$(".att-rev .att-fig")) { await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------- 1. Production holati (baseline)
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.setInputFiles("[data-bundle]", path.join(BASE, "firestore-import.json"));
  await page.waitForFunction(() => !document.querySelector("[data-import]").disabled);
  await page.click("[data-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-bundle-info]").textContent), null, { timeout: 300000 });
  await page.setInputFiles("[data-figdocs]", path.join(BASE, "firestore-figures.json"));
  await page.waitForFunction(() => !document.querySelector("[data-figdocs-import]").disabled);
  await page.click("[data-figdocs-import]");
  await page.waitForFunction(() => /Yozildi 415 /.test(document.querySelector("[data-figdocs-info]").textContent), null, { timeout: 300000 });
  await page.click("[data-backend]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /firestore → «storage»/.test(document.querySelector("[data-backend]").textContent));
  await page.click(`[data-publish="${D1}"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => document.querySelector('[data-stat="published"]').textContent.trim() === "1");
  ok("baseline: production holati (import, 415 rasm, firestore manba, Day 1 v1 published)", true);
  await ctx.close();
}

// ---------------------------------------------------------------- 2. user1 Day 1 v1 ni topshiradi (vaqtinchalik test)
const v1 = dataOf(base, `attestationPhysicsDailyTests/${D1}/versions/v1`);
const k1 = dataOf(base, `attestationPhysicsDailyTests/${D1}/keys/v1`);
const plan1 = v1.questions.map((q, i) => (q.optionCount ? (k1.answers[q.id] && i % 2 === 0 ? k1.answers[q.id] : (i % 5 === 1 ? null : "A")) : null));
let u1Before;
{
  const t1 = new Date(T0.getTime() + 30 * 60000);
  await post("__mock/clock", { iso: t1.toISOString() });
  const { ctx, page } = await ctxFor("user1", { time: t1 });
  await takeTest(page, plan1);
  await ctx.close();
  u1Before = (await dump(`attestationPhysicsAttempts/user1__${D1}`))[`attestationPhysicsAttempts/user1__${D1}`];
  ok("user1: Day 1 v1 topshirildi (graded, testVersion 1)", u1Before.status === "graded" && u1Before.testVersion === 1, `${u1Before.correctAnswers}/${u1Before.scorableQuestions}`);
}
// Eski sxemadagi urinishlar (bevosita, Rules'siz — tarixiy ma'lumot simulyatsiyasi)
const someQ = v1.questions.filter((q) => k1.answers[q.id]).slice(0, 4).map((q) => q.id);
await post("__mock/seed", { docs: {
  [`attestationPhysicsAttempts/user3__${D1}`]: { userId: "user3", testId: D1, dayNumber: 1, testVersion: 1, attemptNumber: 1, kind: "official",
    status: "graded", questionCount: 32, startedAt: ts(T0), completedAt: ts(new Date(T0.getTime() + 1800000)), timeSpentSeconds: 1800,
    selectedAnswers: { [someQ[0]]: k1.answers[someQ[0]], [someQ[1]]: k1.answers[someQ[1]] === "A" ? "B" : "A" },
    scorableQuestions: 23, correctAnswers: 1, wrongAnswers: 1, unanswered: 21, scorePercent: 4, correctIds: [someQ[0]], wrongIds: [someQ[1]] },
  [`attestationPhysicsAttempts/user4__${D1}`]: { userId: "user4", testId: D1, dayNumber: 1, attemptNumber: 1, kind: "official",
    status: "graded", questionCount: 32, startedAt: ts(T0), completedAt: ts(new Date(T0.getTime() + 600000)), timeSpentSeconds: 600,
    answers: { [someQ[2]]: k1.answers[someQ[2]], [someQ[3]]: k1.answers[someQ[3]] === "A" ? "B" : "A" },
    scorableQuestions: 23, correctAnswers: 1, wrongAnswers: 1, unanswered: 21, scorePercent: 4, correctIds: [someQ[2]], wrongIds: [someQ[3]] },
} });

// ---------------------------------------------------------------- 3. Admin: migration.json (preflight + qo'llash)
const tMig = new Date(T0.getTime() + 2 * 3600000);
await post("__mock/clock", { iso: tMig.toISOString() });
const before = await dump("attestationPhysics");
{
  const { ctx, page } = await ctxFor("admin1", { time: tMig });
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-body] tr");
  await page.setInputFiles("[data-mig]", path.join(PRIV, "migration/migration.json"));
  await page.waitForFunction(() => !document.querySelector("[data-mig-apply]").disabled, null, { timeout: 30000 });
  const pre = (await page.textContent("[data-mig-info]")).replace(/\s+/g, " ");
  const nAtt = Number(await page.textContent(`[data-mig-test="${D1}"] [data-mig-attempts]`));
  ok("preflight: Day 1 urinishlari hisoblandi (3 ta: user1 + 2 eski) va ko‘rsatildi", nAtt === 3 && /versiya 1 → 2/.test(pre), pre.slice(0, 160));
  await page.click("[data-mig-apply]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-mig-info]").textContent), null, { timeout: 600000 });
  ok("migratsiya qo‘llandi", true, await page.textContent("[data-mig-info]"));
  // Ruxsat etilmagan fayl (urinishga yozish) — preflight rad etadi
  const evil = { ...migration, ops: [{ op: "update", path: `attestationPhysicsAttempts/user1__${D1}`, data: { scorePercent: 100 } }] };
  fs.writeFileSync(path.join(OUT, "evil-migration.json"), J(evil));
  await page.setInputFiles("[data-mig]", path.join(OUT, "evil-migration.json"));
  await page.waitForFunction(() => /yaroqsiz/.test(document.querySelector("[data-mig-info]").textContent));
  ok("preflight: urinish/sozlama yo‘llari taqiqlangan", await page.$eval("[data-mig-apply]", (b) => b.disabled));
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
const after = await dump("attestationPhysics");
const meta = after[`attestationPhysicsDailyTests/${D1}`];
ok("Day 1: currentVersion 2, published, publishedAt saqlangan", meta.currentVersion === 2 && meta.status === "published" && J(meta.publishedAt) === J(before[`attestationPhysicsDailyTests/${D1}`].publishedAt));
const v1paths = Object.keys(before).filter((p) => p.startsWith(`attestationPhysicsDailyTests/${D1}/`));
ok("Day 1 v1 hujjatlari o‘zgarmadi", v1paths.every((p) => J(before[p]) === J(after[p])), `${v1paths.length} hujjat`);
ok("urinishlar o‘zgarmadi (o‘chirilmadi)", ["user1", "user3", "user4"].every((u) => J(before[`attestationPhysicsAttempts/${u}__${D1}`]) === J(after[`attestationPhysicsAttempts/${u}__${D1}`])));
const cv1 = dataOf(canon, `attestationPhysicsDailyTests/${D1}/versions/v1`);
const ck1 = dataOf(canon, `attestationPhysicsDailyTests/${D1}/keys/v1`);
const sv2 = after[`attestationPhysicsDailyTests/${D1}/versions/v2`];
ok("N: Day 1 v2 = canonical LaTeX bundle (savollar, variantlar, rasm havolalari)", J(sv2.questions) === J(cv1.questions) && J(sv2.questionIds) === J(cv1.questionIds));
ok("N: Day 1 v2 kaliti = canonical (31 scorable)", J(after[`attestationPhysicsDailyTests/${D1}/keys/v2`].answers) === J(ck1.answers) && ck1.scorableCount === 31);
const privs = Object.entries(after).filter(([p]) => /^attestationPhysicsQuestions\/[^/]+\/private\/answer$/.test(p)).map(([, d]) => d);
ok("O: 100 ta TEKSHIRISH_KERAK — kalitsiz, ballga kirmaydi", privs.filter((d) => d.keyStatus === "TEKSHIRISH_KERAK").length === 100
  && privs.filter((d) => d.keyStatus === "TEKSHIRISH_KERAK").every((d) => d.correctAnswer === null && d.evaluationType !== "auto"), `${privs.length} private`);

// ---------------------------------------------------------------- 4. user2: Day 1 v2 (A–L)
const plan2 = cv1.questions.map((q, i) => {
  const k = ck1.answers[q.id];
  if (!q.optionCount) return null;
  if (i % 3 === 0 && k) return k;                                   // to'g'ri
  if (i % 3 === 1) return k === "A" ? "B" : "A";                     // noto'g'ri
  return null;                                                       // javobsiz
});
const expect2 = cv1.questions.map((q, i) => {
  if (q.evaluationType !== "auto") return "unscored";
  if (!plan2[i]) return "unanswered";
  return plan2[i] === ck1.answers[q.id] ? "correct" : "wrong";
});
const tU2 = new Date(T0.getTime() + 3 * 3600000);
await post("__mock/clock", { iso: tU2.toISOString() });
{
  const { ctx, page } = await ctxFor("user2", { time: tU2 });
  const r = await takeTest(page, plan2);
  ok("A/E: test davomida kalit so‘ralmadi va DOM'da to‘g‘ri javob belgisi yo‘q", r.keyReqBefore === 0 && r.marks === 0, `keys=${r.keyReqBefore}, belgilar=${r.marks}`);
  ok("B: natija sahifasi ochildi (ball, to‘g‘ri/noto‘g‘ri/javobsiz, vaqt)", await page.$(".att-result") && /Sarflangan vaqt/.test(await page.textContent(".att-result")));
  const att2 = (await dump(`attestationPhysicsAttempts/user2__${D1}`))[`attestationPhysicsAttempts/user2__${D1}`];
  ok("user2 urinishi v2 da", att2.testVersion === 2 && att2.status === "graded", `${att2.correctAnswers}/${att2.scorableQuestions}`);
  ok("review sarlavhasi «Javoblarni ko‘rib chiqish»", /Javoblarni ko‘rib chiqish/.test(await page.textContent("#attRevTitle")));
  await renderAllCards(page);
  const cards = await page.$$eval(".att-rev", (cs) => cs.map((c) => ({ qid: c.dataset.qid, st: c.dataset.status,
    head: c.querySelector(".att-rev__head").textContent.replace(/\s+/g, " "), foot: c.querySelector(".att-rev__foot").textContent.replace(/\s+/g, " "),
    opts: c.querySelectorAll(".att-opt").length, mine: c.querySelector('.att-opt[data-mine="1"] .att-opt__key')?.textContent || null,
    correct: c.querySelector('.att-opt[data-review="correct"] .att-opt__key')?.textContent || null })));
  ok("C: barcha 32 savol review'da (variantlari bilan)", cards.length === 32 && cards.every((c, i) => c.qid === cv1.questions[i].id && c.opts === cv1.questions[i].optionCount));
  const stOk = cards.every((c, i) => c.st === expect2[i]);
  ok("F: holatlar to‘g‘ri (to‘g‘ri/noto‘g‘ri/javobsiz/ballga kirmaydi)", stOk,
     JSON.stringify(["correct", "wrong", "unanswered", "unscored"].map((s) => [s, expect2.filter((x) => x === s).length])));
  const txtOk = cards.every((c, i) => {
    const q = cv1.questions[i], k = ck1.answers[q.id];
    const label = { correct: "To‘g‘ri", wrong: "Noto‘g‘ri", unanswered: "Siz javob bermadingiz", unscored: "Ballga kirmaydi" }[expect2[i]];
    return c.head.includes(label)
      && (plan2[i] ? c.foot.includes(`Sizning javobingiz: ${plan2[i]}`) && c.mine === plan2[i] : c.foot.includes("Siz javob bermadingiz") || !q.optionCount)
      && (k ? c.foot.includes(`To‘g‘ri javob: ${k}`) && c.correct === k : /ballga kirmaydi/.test(c.foot));
  });
  ok("D/E: «Sizning javobingiz», «To‘g‘ri javob», «Siz javob bermadingiz» matnlari va variant belgilari", txtOk);
  const rec = cards.find((c) => c.qid === "AF-1-005");
  ok("tiklangan savol AF-1-005 review'da 4 variant bilan, ballga kiradi", rec && rec.opts === 4 && rec.st !== "unscored");
  ok("G: to‘liq yechim qulf («… da ochiladi»), yechim so‘ralmadi",
     cards.every((c) => /To‘liq yechim · .* da ochiladi/.test(c.foot)) && page.apiLog.filter((r) => /\/solutions\//.test(r.path)).length === 0);
  const figs = await page.$$eval(".att-rev .att-fig", (fs) => fs.map((f) => ({ s: f.dataset.state, w: f.querySelector("img").naturalWidth })));
  ok("I: review'dagi rasmlar (Firestore manba) yuklandi", figs.length >= 16 && figs.every((f) => f.s === "ready" && f.w > 0), `${figs.filter((f) => f.s === "ready").length}/${figs.length}`);
  const kx = await page.$$eval(".att-rev .katex", (x) => x.length);
  ok("J: review'da formulalar (KaTeX)", kx > 30, `${kx} formula`);
  await page.click('[data-filter="wrong"]');
  const vis = await page.$$eval(".att-review > li", (ls) => ls.filter((l) => !l.hidden).length);
  ok("saralash: «Noto‘g‘ri» — faqat noto‘g‘ri savollar", vis === expect2.filter((x) => x === "wrong").length, `${vis}`);
  await page.click('[data-filter="all"]');
  await page.locator('.att-rev[data-status="wrong"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "review-desktop.png") });
  // L: bitta rasmiy urinish
  await page.reload();
  await page.waitForSelector(".att-review .att-rev");
  ok("L: qayta ochilganda — natija (qayta topshirish yo‘q)", !(await page.$("[data-start]")));
  const again = await apiAs("user2", "commit", { writes: [{ type: "create", path: `attestationPhysicsAttempts/user2__${D1}`, data: { userId: "user2" } }] });
  ok("L: ikkinchi rasmiy urinish — Rules rad etadi", again.ok === false, again.code || "");
  ok("user2: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
// K: mobil
{
  const { ctx, page } = await ctxFor("user2", { viewport: { width: 390, height: 844 }, time: tU2 });
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.waitForSelector(".att-review .att-rev");
  await renderAllCards(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok("K: mobil (390 px) — gorizontal overflow yo‘q", over <= 1, `${over}px`);
  await page.locator('.att-rev[data-status="wrong"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "review-mobile.png") });
  await ctx.close();
}

// ---------------------------------------------------------------- 5. M: eski natijalar
{
  const { ctx, page } = await ctxFor("user1", { time: tU2 });
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.waitForSelector(".att-review .att-rev");
  const res = (await page.textContent(".att-result")).replace(/\s+/g, " ");
  const c5 = await page.$eval('.att-rev[data-qid="AF-1-005"]', (c) => c.dataset.status + "|" + c.querySelector(".att-rev__foot").textContent.replace(/\s+/g, " "));
  ok("M: user1 (v1) natijasi o‘zgarmagan — v1 snapshot bilan ko‘rsatiladi", res.includes(`${u1Before.correctAnswers} / ${u1Before.scorableQuestions}`) && /^unscored\|.*Variantsiz savol/.test(c5), c5.slice(0, 60));
  ok("M: user1 konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
for (const [u, label] of [["user3", "selectedAnswers sxemasi"], ["user4", "testVersion yo‘q sxema"]]) {
  const { ctx, page } = await ctxFor(u, { time: tU2 });
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.waitForSelector(".att-review .att-rev", { timeout: 20000 }).catch(() => {});
  const res = (await page.textContent(".att-result").catch(() => "")).replace(/\s+/g, " ");
  const st = await page.$$eval(".att-rev", (cs) => cs.map((c) => c.dataset.status));
  ok(`M: eski natija (${label}) — ko‘rsatiladi, ball o‘zgarmagan`, /1 \/ 23/.test(res) && st.filter((s) => s === "correct").length === 1 && st.filter((s) => s === "wrong").length === 1,
     `${st.length} karta`);
  ok(`M: ${u} konsol xatolari yo'q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 6. H: yechim keyingi 00:00 (Toshkent) dan keyin
{
  const solAt = new Date(meta.solutionAvailableAt.__ts[0] * 1000);
  ok("yechim vaqti = qayta e’londan keyingi 00:00 Toshkent (3-okt → 4-okt 00:00)", solAt.toISOString() === "2026-10-03T19:00:00.000Z", solAt.toISOString());
  const tNext = new Date(solAt.getTime() + 60000);
  await post("__mock/clock", { iso: tNext.toISOString() });
  const { ctx, page } = await ctxFor("user2", { time: tNext });
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.waitForSelector(".att-review .att-rev");
  const href = await page.getAttribute('.att-rev[data-qid="AF-1-005"] a.att-rev__sol', "href");
  ok("H: 00:00 dan keyin har savolda «To‘liq yechim» havolasi", href && /fizika-yechimlar\.html\?day=1#sol-AF-1-005/.test(href), href || "");
  await page.goto(B + "attestatsiya/" + href);
  await page.waitForSelector("#sol-AF-1-005");
  ok("H: yechim sahifasi ochildi va savolga yo‘naltirildi (v2 yechim, 4 variant)",
     await page.$eval("#sol-AF-1-005", (c) => c.querySelectorAll(".att-opt").length === 4 && c.querySelector(".att-sol").textContent.trim().length > 40));
  ok("user2 (ertasi kun): konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-review.json"), J({ at: new Date().toISOString(), passed, total: checks.length, checks }));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
