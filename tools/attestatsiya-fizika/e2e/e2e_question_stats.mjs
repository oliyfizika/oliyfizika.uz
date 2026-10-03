// ==========================================================================
// Attestatsiya → Fizika: E2E — admin «Savollar statistikasi» (real urinishlardan, versiyaga ajratilgan).
// Holat (seed): Day 1 v2 published (v1 + v2 urinishlari, baholanmaganlar), Day 2 published (urinishsiz), Day 3 draft.
// Kutilgan foizlar test ichida urinish javoblari va kalitdan MUSTAQIL hisoblanadi (qiymatlar repo'da yozilmaydi).
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8794 &
//   E2E_PORT=8794 node tools/attestatsiya-fizika/e2e/e2e_question_stats.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-question-stats.json; exit 1 — biror tekshiruv FAIL.
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
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8794}/`;
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
const AC = "attestationPhysicsAttempts";
const [D1, D2, D3, D4, D5, D6] = [1, 2, 3, 4, 5, 6].map((n) => `att-fizika-day-0${n}`);
const T0 = new Date("2026-10-06T06:00:00Z");
const H = 3600000;
const OPTS = ["A", "B", "C", "D"];

// ---------------------------------------------------------------- seed
const docs = { "attestationPhysicsSettings/config": { ...opData("attestationPhysicsSettings/config"), figureBackend: "firestore" } };
for (const id of [D1, D2, D3, D4, D5, D6]) {
  docs[`${TC}/${id}`] = opData(`${TC}/${id}`);
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${id}/${c}/v1`] = opData(`${TC}/${id}/${c}/v1`);
}
// v2: kanonik kalit bilan bir xil savollar, lekin v1 dan ATAYLAB farqli kalit (izolyatsiyani tekshirish uchun)
const k1 = docs[`${TC}/${D1}/keys/v1`];
const k2 = { ...structuredClone(k1), version: 2 };
for (const q of Object.keys(k2.answers)) k2.answers[q] = OPTS[(OPTS.indexOf(k1.answers[q]) + 1) % 4];
docs[`${TC}/${D1}/keys/v2`] = k2;
for (const c of ["versions", "solutions"]) docs[`${TC}/${D1}/${c}/v2`] = { ...opData(`${TC}/${D1}/${c}/v1`), version: 2 };
Object.assign(docs[`${TC}/${D1}`], { status: "published", published: true, publishedAt: ts(new Date(T0 - 5 * H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0.getTime() + 13 * H)), currentVersion: 2 });
Object.assign(docs[`${TC}/${D2}`], { status: "published", published: true, publishedAt: ts(new Date(T0 - H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0.getTime() + 13 * H)) });

const users = ["admin1"];
const scorable = (k) => k.questionIds.filter((q) => q in k.answers);
// deterministik, lekin savollar bo'yicha har xil natija
function answersFor(k, u, salt) {
  const out = {};
  scorable(k).forEach((q, i) => {
    const r = (u * 7 + i * 3 + salt) % 10;
    if (r < 2) return;                                   // javobsiz
    out[q] = r < 2 + ((i % 6) + 2) ? k.answers[q] : OPTS[(OPTS.indexOf(k.answers[q]) + 1 + (u % 3)) % 4];
  });
  return out;
}
function graded(uid, k, answers) {
  const correctIds = Object.keys(k.answers).filter((q) => answers[q] === k.answers[q]);
  const wrongIds = Object.keys(k.answers).filter((q) => q in answers && answers[q] !== k.answers[q]);
  return { userId: uid, testId: D1, dayNumber: 1, testVersion: k.version, attemptNumber: 1, kind: "official", status: "graded",
    questionCount: 32, startedAt: ts(new Date(T0 - 4 * H)), completedAt: ts(new Date(T0 - 3 * H)), timeSpentSeconds: 1200, answers,
    scorableQuestions: k.scorableCount, correctAnswers: correctIds.length, wrongAnswers: wrongIds.length,
    unanswered: k.scorableCount - correctIds.length - wrongIds.length, scorePercent: Math.round((100 * correctIds.length) / k.scorableCount),
    correctIds, wrongIds };
}
const expectStats = (k, list) => scorable(k).map((q) => {
  const c = list.filter((a) => a.answers[q] === k.answers[q]).length;
  const w = list.filter((a) => q in a.answers && a.answers[q] !== k.answers[q]).length;
  const n = list.length;
  return { q, c, w, u: n - c - w, cp: Math.round((100 * c) / n), wp: Math.round((100 * w) / n), up: Math.round((100 * (n - c - w)) / n) };
});
const v2List = [];
for (let u = 1; u <= 10; u++) { const uid = `v2u${u}`; users.push(uid); v2List.push(graded(uid, k2, answersFor(k2, u, 0))); docs[`${AC}/${uid}__${D1}`] = v2List.at(-1); }
const v1List = [];
for (let u = 1; u <= 3; u++) { const uid = `v1u${u}`; users.push(uid); v1List.push(graded(uid, k1, answersFor(k1, u, 5))); docs[`${AC}/${uid}__${D1}`] = v1List.at(-1); }
// hisobga olinmasligi kerak: jarayonda va topshirilgan-baholanmagan (v2)
for (const [uid, status] of [["ip1", "in_progress"], ["sb1", "submitted"]]) {
  users.push(uid);
  docs[`${AC}/${uid}__${D1}`] = { userId: uid, testId: D1, dayNumber: 1, testVersion: 2, attemptNumber: 1, kind: "official", status,
    questionCount: 32, startedAt: ts(new Date(T0 - 2 * H)), answers: Object.fromEntries(scorable(k2).map((q) => [q, k2.answers[q]])) };
}
// D4 archived — QA formula ssenariysi (10 urinish): 1-savol 8/2/0, 2-savol 4/3/3, qolganlari javobsiz
const k4 = docs[`${TC}/${D4}/keys/v1`];
Object.assign(docs[`${TC}/${D4}`], { status: "archived", published: true, publishedAt: ts(new Date(T0 - 72 * H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0 - 50 * H)), archivedAt: ts(new Date(T0 - 2 * H)) });
// D5 arxivdan chiqarilgan (draft, publishedAt bor); D6 published, lekin currentVersion 2 uchun keys/v2 yo'q (K holati)
Object.assign(docs[`${TC}/${D5}`], { status: "draft", published: false, publishedAt: ts(new Date(T0 - 48 * H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0 - 30 * H)), archivedAt: ts(new Date(T0 - 20 * H)) });
Object.assign(docs[`${TC}/${D6}`], { status: "published", published: true, publishedAt: ts(new Date(T0 - H)), publishedBy: "admin1",
  solutionAvailableAt: ts(new Date(T0.getTime() + 13 * H)), currentVersion: 2 });
const [qa1, qa2] = scorable(k4);
const pos4 = Object.fromEntries(k4.questionIds.map((q, i) => [q, i + 1]));
const wrongOf = (q) => OPTS[(OPTS.indexOf(k4.answers[q]) + 1) % 4];
for (let i = 0; i < 10; i++) {
  const uid = `d4u${i}`;
  users.push(uid);
  const ans = { [qa1]: i < 8 ? k4.answers[qa1] : wrongOf(qa1) };
  if (i < 4) ans[qa2] = k4.answers[qa2]; else if (i < 7) ans[qa2] = wrongOf(qa2);
  docs[`${AC}/${uid}__${D4}`] = { ...graded(uid, k4, ans), testId: D4, dayNumber: 4 };
}
users.push("user1");
for (const u of users) docs[`users/${u}`] = { fullName: u, firstName: u, email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0), ...(u === "admin1" ? { role: "admin" } : {}) };
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });
const before = await dump("attestationPhysics");

const browser = await chromium.launch();
async function ctxFor(uid, { viewport = { width: 1366, height: 900 }, theme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript(([u, th]) => {
    localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u }));
    localStorage.setItem("oliyfizika:theme", JSON.stringify(th));
  }, [uid, theme]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(T0);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) page.errs.push(m.text()); });
  page.apiLog = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); page.apiLog.push({ op: j.op, path: j.path || j.col || "", filters: j.filters || null, writes: j.writes?.length || 0 }); } catch { /* */ } }
  });
  return { ctx, page };
}
const readRows = (page) => page.$$eval("[data-qstats-rows] .att-qstat", (rs) => rs.map((r) => ({
  n: Number(r.dataset.q), pct: r.dataset.pct == null ? null : Number(r.dataset.pct),
  text: r.querySelector(".att-qstat__value b")?.textContent.trim() || r.querySelector(".att-qstat__value").textContent.trim(),
  w: r.querySelector(".of-progress")?.style.getPropertyValue("--value") ?? null, off: r.classList.contains("att-qstat--off") })));
const readRank = (page, kind) => page.$$eval(`[data-qstats-list="${kind}"] .att-qstat`, (rs) => rs.map((r) => ({
  n: Number(r.dataset.q), pct: Number(r.dataset.pct), name: r.querySelector(".att-qstat__name").textContent.trim(),
  text: r.querySelector(".att-qstat__value b").textContent.trim() })));
async function openStats(page, id) {
  await page.click(`[data-qstats="${id}"]`);
  await page.waitForFunction(() => {
    const b = document.querySelector("[data-qstats-body]");
    return b && !b.hasAttribute("aria-busy") && !/Yuklanmoqda/.test(b.textContent);
  }, null, { timeout: 15000 });
}

// ---------------------------------------------------------------- F. security (Rules)
{
  const q = await apiAs("user1", "query", { col: AC, filters: [["testId", "==", D1], ["testVersion", "==", 2]], order: [], limit: null });
  ok("F: oddiy user test+versiya urinishlarini so‘ray olmaydi", q.ok === false, q.code || "");
  const q2 = await apiAs("v2u1", "query", { col: AC, filters: [["testId", "==", D1]], order: [], limit: null });
  ok("F: urinishi bor user ham boshqalarning urinishlarini so‘ray olmaydi", q2.ok === false, q2.code || "");
  const k = await apiAs("user1", "get", { path: `${TC}/${D1}/keys/v2` });
  ok("F: urinishsiz user kalitni o‘qiy olmaydi", k.ok === false, k.code || "");
  const a = await apiAs("admin1", "query", { col: AC, filters: [["testId", "==", D1], ["testVersion", "==", 2]], order: [], limit: null });
  ok("F: admin so‘rovi — ruxsat", a.ok === true && a.result.length === 12, `${a.result?.length}`);
}
{
  const { ctx, page } = await ctxFor("user1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForTimeout(2500);
  ok("F: oddiy user admin sahifasida statistika paneli/tugmasini ko‘rmaydi",
     (await page.$("[data-admin-root]:not([hidden])")) === null && (await page.$("[data-qstats]")) === null);
  await ctx.close();
}

// ---------------------------------------------------------------- admin
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForSelector(`[data-qstats="${D1}"]`);
  ok("tugma: published kunlarda «Savollar statistikasi» Urinishlar yonida",
     (await page.textContent(`[data-qstats="${D1}"]`)).trim() === "Savollar statistikasi" && !!(await page.$(`[data-attempts="${D1}"]`)) && !!(await page.$(`[data-qstats="${D2}"]`)));
  ok("tugma: hech qachon e’lon qilinmagan draft'da yo‘q", (await page.$(`[data-qstats="${D3}"]`)) === null);
  const actions = await page.$$eval("[data-publish],[data-archive],[data-unarchive]", (b) => b.length);
  ok("jadval amallari saqlangan (PUBLISH / Archive / Arxivdan chiqarish)", actions === 6 && !!(await page.$(`[data-archive="${D1}"]`))
     && !!(await page.$(`[data-publish="${D3}"]`)) && !!(await page.$(`[data-unarchive="${D4}"]`)) && !!(await page.$(`[data-publish="${D5}"]`)));

  // Day 1, joriy v2
  await openStats(page, D1);
  ok("sarlavha: DAY 1 — SAVOLLAR STATISTIKASI", (await page.textContent("[data-qstats-title]")).trim() === "DAY 1 — SAVOLLAR STATISTIKASI");
  ok("standart versiya — joriy v2", (await page.$eval("[data-qstats-version]", (s) => s.value)) === "2");
  ok("versiya tanlash ko‘rinadi: «Versiya [v2 (joriy) ▼]», variantlar v2, v1",
     await page.isVisible("[data-qstats-version]") && /Versiya/.test(await page.textContent(".att-qstat-version"))
     && J(await page.$$eval("[data-qstats-version] option", (o) => o.map((x) => x.textContent))) === J(["v2 (joriy)", "v1"]));
  const body = await page.textContent("[data-qstats-body]");
  ok("bo‘lim matnlari", /Savollar bo‘yicha to‘g‘ri javoblar/.test(body) && /Har bir savolni foydalanuvchilar nechta foiz holatda to‘g‘ri bajarganini ko‘rsatadi\./.test(body)
     && /Eng ko‘p xato qilingan savollar/.test(body) && /Javobsiz qoldirilgan savollar/.test(body));
  ok("maxraj usuli UI'da ko‘rsatilgan", /to‘g‘ri javoblar ÷ 10 ta hisobga olingan urinish × 100/.test(await page.textContent("[data-qstats-formula]")));
  ok("C: N = 10 (in_progress va submitted kirmadi)", (await page.textContent("[data-qstats-n]")).trim() === "10");
  ok("kun bo‘yicha jami urinishlar = 15 (kontekst)", (await page.textContent("[data-qstats-all]")).trim() === "15");
  const rows = await readRows(page);
  const exp2 = expectStats(k2, v2List);
  const posOf = Object.fromEntries(k2.questionIds.map((q, i) => [q, i + 1]));
  ok("E: barcha savollar (32) kanonik tartibda 1..32", rows.length === k2.questionIds.length && rows.every((r, i) => r.n === i + 1));
  const scoredRows = rows.filter((r) => !r.off);
  ok("C: har savol foizi real urinishlardan mustaqil hisob bilan mos",
     scoredRows.length === exp2.length && exp2.every((e) => { const r = rows[posOf[e.q] - 1]; return r.pct === e.cp && r.text === `${e.cp}%`; }),
     J(exp2.slice(0, 4).map((e) => e.cp)));
  ok("bar uzunligi = foiz (--value)", scoredRows.every((r) => Number(r.w) === r.pct));
  const unscored = k2.questionIds.filter((q) => !(q in k2.answers));
  ok("ballga kirmaydigan savol foizsiz «Ballga kirmaydi»", rows.filter((r) => r.off).length === unscored.length
     && unscored.every((q) => rows[posOf[q] - 1].off), unscored.map((q) => posOf[q]).join(","));
  const spread = new Set(scoredRows.map((r) => r.pct));
  ok("foizlar statik emas (turli qiymatlar, 0–100)", spread.size > 3 && scoredRows.every((r) => r.pct >= 0 && r.pct <= 100), [...spread].join(","));
  const wrong = await readRank(page, "wrong");
  const expWrong = exp2.filter((e) => e.w > 0).sort((a, b) => b.wp - a.wp || posOf[a.q] - posOf[b.q]).slice(0, 10);
  ok("xato reytingi: kamayish tartibi, raqam va foiz", J(wrong.map((x) => [x.n, x.pct])) === J(expWrong.map((e) => [posOf[e.q], e.wp]))
     && wrong.every((x) => x.name === `${x.n}-savol` && x.text === `${x.pct}%`), J(wrong.slice(0, 3)));
  const skip = await readRank(page, "skip");
  const expSkip = exp2.filter((e) => e.u > 0).sort((a, b) => b.up - a.up || posOf[a.q] - posOf[b.q]).slice(0, 10);
  ok("javobsiz reytingi: kamayish tartibi", J(skip.map((x) => [x.n, x.pct])) === J(expSkip.map((e) => [posOf[e.q], e.up])), J(skip.slice(0, 3)));
  ok("baholovchi terminlar yo‘q", !/eng yaxshi|eng yomon|reyting|winner|g‘olib/i.test(await page.textContent("[data-qstats-panel]")));
  await page.screenshot({ path: path.join(OUT, "qstats-desktop.png"), fullPage: true });

  // D. versiya izolyatsiyasi: v1
  page.apiLog.length = 0;
  await page.selectOption("[data-qstats-version]", "1");
  await page.waitForFunction(() => document.querySelector("[data-qstats-n]")?.textContent.trim() === "3", null, { timeout: 15000 });
  ok("versiya almashganda: 2 so‘rov (keys/v1 + v1 urinishlari), count takrorlanmaydi, write yo‘q",
     page.apiLog.length === 2 && page.apiLog.some((r) => r.path === `${TC}/${D1}/keys/v1`)
     && page.apiLog.some((r) => J(r.filters) === J([["testId", "==", D1], ["testVersion", "==", 1]])) && !page.apiLog.some((r) => r.op === "commit"),
     J(page.apiLog.map((r) => r.op + ":" + r.path)));
  ok("kun bo‘yicha jami (count) saqlanib qoldi", (await page.textContent("[data-qstats-all]")).trim() === "15");
  const rows1 = await readRows(page);
  const exp1 = expectStats(k1, v1List);
  ok("D: v1 statistikasi faqat 3 ta v1 urinishidan", exp1.every((e) => rows1[posOf[e.q] - 1].pct === e.cp));
  ok("D: v1 va v2 natijalari aralashmagan (farq bor)", J(rows1.map((r) => r.pct)) !== J(rows.map((r) => r.pct)));
  await page.selectOption("[data-qstats-version]", "2");
  await page.waitForFunction(() => document.querySelector("[data-qstats-n]")?.textContent.trim() === "10", null, { timeout: 15000 });
  ok("D: v2 ga qaytganda yana 10 ta v2 urinishi", J((await readRows(page)).map((r) => r.pct)) === J(rows.map((r) => r.pct)));

  // A. urinishsiz kun
  await openStats(page, D2);
  const zero = await page.textContent("[data-qstats-body]");
  ok("A: 0 urinish → «Statistika uchun hali yetarli urinish mavjud emas.»", /Statistika uchun hali yetarli urinish mavjud emas\./.test(zero));
  ok("A: 0 urinish → foizli qatorlar yo‘q (0 % ko‘rsatilmaydi)", (await page.$$("[data-qstats-body] .att-qstat")).length === 0 && !/\b0%/.test(zero));

  // ---------------- QA-2: arxivlangan / arxivdan chiqarilgan kunlar, aniq formula, bar kengligi, so'rovlar
  ok("tugma: archived kun (Day 4) — bor", !!(await page.$(`[data-qstats="${D4}"]`)));
  ok("tugma: arxivdan chiqarilgan draft (Day 5) — bor, Ko‘rish yo‘q", !!(await page.$(`[data-qstats="${D5}"]`)) && !(await page.$(`[data-attempts="${D5}"]`)));
  page.apiLog.length = 0;
  await openStats(page, D4);
  const log4 = page.apiLog.slice();
  ok("aynan tanlangan kun: DAY 4 — SAVOLLAR STATISTIKASI", (await page.textContent("[data-qstats-title]")).trim() === "DAY 4 — SAVOLLAR STATISTIKASI");
  ok("so‘rovlar: 3 ta (keys/v1 get + test·versiya query + count), savol bo‘yicha alohida so‘rov yo‘q",
     log4.length === 3 && log4.filter((r) => r.op === "get" && r.path === `${TC}/${D4}/keys/v1`).length === 1
     && log4.filter((r) => r.op === "query" && r.path === AC).length === 2, J(log4.map((r) => `${r.op}:${r.path}${r.filters ? J(r.filters) : ""}`)));
  ok("so‘rov filtri: testId + testVersion (equality)", log4.some((r) => J(r.filters) === J([["testId", "==", D4], ["testVersion", "==", 1]])));
  ok("read-only: statistika ochilganda commit (write) so‘rovi yo‘q", !log4.some((r) => r.op === "commit" || r.writes));
  await page.waitForTimeout(1200);                                       // .of-progress transition (900 ms)
  const r4 = await page.$$eval("[data-qstats-rows] .att-qstat", (rs) => rs.map((r) => {
    const bar = r.querySelector(".of-progress");
    const fill = bar?.querySelector("span");
    return { n: Number(r.dataset.q), pct: r.dataset.pct == null ? null : Number(r.dataset.pct),
             ratio: bar ? (100 * fill.getBoundingClientRect().width) / bar.getBoundingClientRect().width : null,
             small: r.querySelector(".att-qstat__value small")?.textContent.trim() || "" };
  }));
  const at = (q) => r4.find((x) => x.n === pos4[q]);
  ok("formula: 1-savol 8/10 → 80 %", at(qa1).pct === 80 && at(qa1).small === "8/10", J(at(qa1)));
  ok("formula: 2-savol 4/10 → 40 %", at(qa2).pct === 40 && at(qa2).small === "4/10", J(at(qa2)));
  const w4 = await readRank(page, "wrong");
  ok("xato: 2-savol 30 %, 1-savol 20 % (kamayish tartibi)", J(w4.map((x) => [x.n, x.pct])) === J([[pos4[qa2], 30], [pos4[qa1], 20]]), J(w4));
  const s4 = await readRank(page, "skip");
  ok("javobsiz: 100 % li savollar pozitsiya bo‘yicha, 2-savol 30 %, 1-savol (0 %) yo‘q",
     s4.every((x, i) => i === 0 || s4[i - 1].pct > x.pct || (s4[i - 1].pct === x.pct && s4[i - 1].n < x.n))
     && !s4.some((x) => x.n === pos4[qa1]) && s4.length === 10, J(s4.slice(0, 3)));
  ok("bar kengligi = foiz (piksel o‘lchovi, ±1 %)", r4.filter((x) => x.pct != null).every((x) => Math.abs(x.ratio - x.pct) <= 1),
     J(r4.filter((x) => x.pct != null).slice(0, 3).map((x) => [x.pct, Math.round(x.ratio)])));
  ok("0 % → bo‘sh bar", r4.filter((x) => x.pct === 0).length > 0 && r4.filter((x) => x.pct === 0).every((x) => x.ratio < 0.5));
  // Day 1 → Day 2 tez almashtirish: aralashmaydi
  await page.click(`[data-qstats="${D1}"]`);
  await openStats(page, D2);
  await page.waitForTimeout(800);
  ok("Day 1 → Day 2 tez almashtirish: faqat Day 2 ko‘rinadi",
     (await page.textContent("[data-qstats-title]")).trim() === "DAY 2 — SAVOLLAR STATISTIKASI" && (await page.textContent("[data-qstats-n]")).trim() === "0"
     && (await page.$$("[data-qstats-rows] .att-qstat")).length === 0);
  // K: keys/v2 yo'q
  await openStats(page, D6);
  ok("K: keys/vN yo‘q → aniq xato, crash yo‘q", /Versiya kaliti topilmadi/.test(await page.textContent("[data-qstats-body]")));
  // Day 5 (arxivdan chiqarilgan) ochiladi
  await openStats(page, D5);
  ok("arxivdan chiqarilgan kun statistikasi ochiladi (0 urinish xabari)", /DAY 5/.test(await page.textContent("[data-qstats-title]"))
     && /yetarli urinish mavjud emas/.test(await page.textContent("[data-qstats-body]")));
  // klaviatura: Tab → «Savollar statistikasi», Enter → ochiladi; fokus ko'rinadi
  await page.focus(`[data-attempts="${D4}"]`);
  await page.keyboard.press("Tab");
  const foc = await page.evaluate(() => {
    const a = document.activeElement;
    const cs = getComputedStyle(a);
    return { q: a.dataset.qstats || null, fv: a.matches(":focus-visible"), ring: cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) };
  });
  ok("klaviatura: Tab tugmaga o‘tadi, fokus ko‘rinadi", foc.q === D4 && foc.fv && foc.ring, J(foc));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /DAY 4/.test(document.querySelector("[data-qstats-title]").textContent) && !document.querySelector("[data-qstats-body]").hasAttribute("aria-busy"));
  ok("klaviatura: Enter statistikani ochadi", true);
  ok("«Ko‘rish» tugmasi o‘zgarmagan (data-attempts), yangi tugma o‘z atributida",
     (await page.$$eval("[data-attempts]", (b) => b.filter((x) => x.tagName === "BUTTON").every((x) => x.textContent.trim() === "Ko‘rish")))
     && (await page.$$eval("[data-qstats]", (b) => b.every((x) => !x.hasAttribute("data-attempts")))));

  ok("ma’lumot o‘zgarmadi (faqat o‘qish)", J(await dump("attestationPhysics")) === J(before));
  ok("admin: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- mobil + dark
const VPS = [390, 768, 1366].map((w) => ({ width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 }));
for (const [vp, theme] of VPS.flatMap((v) => [[v, "light"], [v, "dark"]])) {
  const { ctx, page } = await ctxFor("admin1", { viewport: vp, theme });
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector(`[data-qstats="${D1}"]`);
  await openStats(page, D1);
  const geo = await page.evaluate(() => {
    // faqat yangi panel o'lchanadi (sahifadagi boshqa elementlar bu modulga tegishli emas)
    const W = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll("[data-qstats-panel], [data-qstats-panel] *, .att-row-actions, .att-row-actions *")]
      .filter((e) => e.getBoundingClientRect().right > W + 1).length;
    const bad = [...document.querySelectorAll("[data-qstats-body] .att-qstat")].filter((r) => {
      const [l, b, v] = [r.children[0], r.children[1], r.children[2]].map((x) => x.getBoundingClientRect());
      return !(l.right <= b.left + 1 && b.right <= v.left + 1 && Math.abs(l.top - v.top) < 20 && b.width > 20);
    }).length;
    // kontrast (WCAG): matn rangi ↔ panel foni
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3); } return [255, 255, 255]; };
    const cr = (sel) => { const el = document.querySelector(sel); if (!el) return null; const a = lum(rgb(getComputedStyle(el).color)), b = lum(bgOf(el)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
    const contrast = { pct: cr("[data-qstats-rows] .att-qstat__value b"), label: cr("[data-qstats-rows] .att-qstat__label"),
                       small: cr("[data-qstats-rows] .att-qstat__value small"), h3: cr("[data-qstats-body] h3"), name: cr(".att-qrank .att-qstat__name") };
    const cut = [...document.querySelectorAll("[data-qstats-panel] h2, [data-qstats-panel] h3, .att-qstat__label, .att-qstat__name, .att-qstat__value b")]
      .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().width < 4).length;
    return { over, bad, cut, contrast, theme: document.documentElement.dataset.theme };
  });
  const c = geo.contrast;
  ok(`${vp.width}px ${theme}: matn kesilmaydi (sarlavha, raqam, foiz)`, geo.cut === 0, J(geo.cut));
  ok(`${vp.width}px ${theme}: kontrast — foiz/raqam/sarlavha ≥ 4.5, izoh ≥ 4.5`,
     c.pct >= 4.5 && c.label >= 4.5 && c.h3 >= 4.5 && c.name >= 4.5 && c.small >= 4.5, J(c));
  ok(`${vp.width}px ${theme}: savol | bar | % bir qatorda, panel/tugmalarda gorizontal overflow yo‘q`, geo.over <= 0 && geo.bad === 0 && geo.theme === theme, J(geo));
  await page.locator("[data-qstats-panel]").screenshot({ path: path.join(OUT, `qstats-${vp.width}-${theme}.png`) });
  ok(`${vp.width}px ${theme}: konsol xatolari yo‘q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-question-stats.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
