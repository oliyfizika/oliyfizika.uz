// ==========================================================================
// Attestatsiya → Fizika: end-to-end test (Playwright + lokal rules-enforced mock Firebase).
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8765 &
//   node tools/attestatsiya-fizika/e2e/e2e.mjs
// Natija: _private/attestatsiya-fizika/e2e/ (report.json + skrinshotlar)
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PW = process.env.PLAYWRIGHT || "/opt/npm-tools/node_modules/playwright/index.mjs";
const { chromium } = await import(PW);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PRIV = path.join(ROOT, "_private/attestatsiya-fizika");
const OUT = path.join(PRIV, "e2e");
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8765}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const keyOf = (tid) => bundle.ops.find((o) => o.path === `attestationPhysicsDailyTests/${tid}/keys/v1`).data;
const snapOf = (tid) => bundle.ops.find((o) => o.path === `attestationPhysicsDailyTests/${tid}/versions/v1`).data;

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const apiAs = (uid, op, payload) => post("__mock/api", { op, uid, ...payload });

const T0 = new Date("2026-10-05T04:00:00Z"); // 09:00 Toshkent
await post("__mock/reset", {});
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
await post("__mock/seed", { docs: {
  "users/admin1": { fullName: "Admin Bir", firstName: "Admin", email: "admin1@example.com", role: "admin", xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) },
  "users/user1": { fullName: "Ali Valiyev", firstName: "Ali", email: "user1@example.com", xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) },
  "users/user2": { fullName: "Vali Aliyev", firstName: "Vali", email: "user2@example.com", xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) },
} });

const browser = await chromium.launch();
async function makeCtx({ uid, viewport = { width: 1366, height: 900 }, dark = false, time = T0 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", headers: { "Access-Control-Allow-Origin": "*" }, body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  const users = { admin1: "admin1@example.com", user1: "user1@example.com", user2: "user2@example.com" };
  await ctx.addInitScript(([u, e, d]) => {
    if (u) localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: e, displayName: u }));
    localStorage.setItem("oliyfizika:theme", JSON.stringify(d ? "dark" : "light"));
  }, [uid, users[uid], dark]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(time);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) page.errors.push(m.text()); });
  page.apiLog = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/__mock/api")) {
      try { const j = JSON.parse(r.postData()); page.apiLog.push({ t: Date.now(), op: j.op, path: j.path || j.col || "" }); } catch { /* */ }
    }
  });
  return { ctx, page };
}
const setClock = async (page, d) => { await post("__mock/clock", { iso: d.toISOString() }); if (page) await page.clock.setSystemTime(d); };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const settle = (page, ms = 900) => page.waitForTimeout(ms);

await setClock(null, T0);

// ======================================================== 1. ADMIN: import + rasmlar + publish Day 1
{
  const { ctx, page } = await makeCtx({ uid: "admin1" });
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.setInputFiles("[data-bundle]", path.join(PRIV, "firestore-import.json"));
  await page.waitForFunction(() => !document.querySelector("[data-import]").disabled);
  ok("admin: import fayli tekshirildi (1027/865/32)", /1027 savol \(865 auto\), 32 kunlik test/.test(await page.textContent("[data-bundle-info]")));
  await page.click("[data-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-bundle-info]").textContent), null, { timeout: 180000 });
  await settle(page, 1200);
  const rows = await page.$$eval("[data-body] tr", (trs) => trs.length);
  ok("admin: 32 ta Day jadvalda (draft)", rows === 32 && (await page.textContent('[data-stat="draft"]')).trim() === "32");
  await page.setInputFiles("[data-figs]", path.join(PRIV, "storage"));
  await page.waitForFunction(() => !document.querySelector("[data-upload]").disabled);
  await page.click("[data-upload]");
  await page.waitForFunction(() => /^415\/415/.test(document.querySelector("[data-figs-info]").textContent), null, { timeout: 180000 });
  const figInfo = await page.textContent("[data-figs-info]");
  ok("admin: 415 rasm Storage'ga yuklandi (408 savol + 7 yechim)", /yuklandi 415 · mavjud 0 · xato 0/.test(figInfo), figInfo);
  await shot(page, "admin-01-draft");
  // Ikkinchi import — mavjud testlar qayta yozilmaydi
  // Publish Day 1
  await page.click('[data-publish="att-fizika-day-01"]');
  const modalTitle = await page.textContent(".of-admin-confirm .of-modal__title");
  ok("admin: tasdiq oynasi «Day 1 testini foydalanuvchilarga e’lon qilishni xohlaysizmi?»", /Day 1 testini foydalanuvchilarga e’lon qilishni xohlaysizmi\?/.test(modalTitle));
  await shot(page, "admin-02-publish-modal");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => document.querySelector('[data-stat="published"]').textContent.trim() === "1");
  const dump = await post("__mock/dump", { prefix: "attestationPhysicsDailyTests/att-fizika-day-01" });
  const d1 = dump.docs["attestationPhysicsDailyTests/att-fizika-day-01"];
  const solAt = new Date(d1.solutionAvailableAt.__ts[0] * 1000);
  const pubDelta = d1.publishedAt.__ts[0] - T0.getTime() / 1000;
  ok("publish: status=published, publishedAt=server vaqti", d1.status === "published" && d1.published === true && pubDelta >= 0 && pubDelta < 1800, `publishedAt − T0 = ${Math.round(pubDelta)} s (import davomiyligi)`);
  ok("publish: solutionAvailableAt = ertasi 00:00 Toshkent", solAt.toISOString() === "2026-10-05T19:00:00.000Z", solAt.toISOString());
  ok("publish: notification payload tayyor", d1.notification?.title === "Bugungi attestatsiya testi tayyor!");
  ok("admin sahifasi: konsol xatolari yo'q", !page.errors.length, page.errors.join(" | "));
  await ctx.close();
}

// ======================================================== 2. XAVFSIZLIK (DevTools/soxta klient sifatida to'g'ridan-to'g'ri so'rovlar)
const D1 = "att-fizika-day-01", D2 = "att-fizika-day-02";
const q1 = snapOf(D1).questionIds[0], q2 = snapOf(D2).questionIds[0];
const sec = [];
const deny = async (name, p) => { const r = await p; sec.push({ name, result: r.ok ? "ALLOWED" : r.code }); ok(`security: ${name} — rad`, !r.ok, r.ok ? "RUXSAT BERILDI!" : r.code); };
const allow = async (name, p) => { const r = await p; sec.push({ name, result: r.ok ? "ALLOWED" : r.code }); ok(`security: ${name} — ruxsat`, r.ok, r.ok ? "" : r.code); };
await deny("1. mehmon → published test", apiAs(null, "get", { path: `attestationPhysicsDailyTests/${D1}` }));
await deny("2. mehmon → draft test", apiAs(null, "get", { path: `attestationPhysicsDailyTests/${D2}` }));
await deny("mehmon → savol", apiAs(null, "get", { path: `attestationPhysicsQuestions/${q1}` }));
await deny("mehmon → yechim", apiAs(null, "get", { path: `attestationPhysicsDailyTests/${D1}/solutions/v1` }));
await deny("3. user → draft test", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D2}` }));
await deny("3b. user → draft snapshot", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D2}/versions/v1` }));
await deny("3c. user → filtrsiz testlar ro'yxati", apiAs("user1", "query", { col: "attestationPhysicsDailyTests", filters: [] }));
await allow("4. user → published test", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D1}` }));
await deny("7. user → javob kaliti (urinishsiz)", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D1}/keys/v1` }));
await deny("7b. user → private javob (bank)", apiAs("user1", "get", { path: `attestationPhysicsQuestions/${q1}/private/answer` }));
await deny("8. user → yechim (solutionAvailableAt dan oldin)", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D1}/solutions/v1` }));
await deny("12. oddiy user → publish", apiAs("user1", "commit", { writes: [{ type: "update", path: `attestationPhysicsDailyTests/${D2}`, data: { status: "published", published: true, publishedAt: { __server: 1 }, publishedBy: "user1", solutionAvailableAt: ts(new Date(T0.getTime() + 86400000)) } }] }));
await deny("13. oddiy user → archive", apiAs("user1", "commit", { writes: [{ type: "update", path: `attestationPhysicsDailyTests/${D1}`, data: { status: "archived", archivedAt: { __server: 1 } } }] }));
const figD1 = fs.readdirSync(path.join(PRIV, "storage/attestation-physics/questions", D1))[0];
const figD2 = fs.readdirSync(path.join(PRIV, "storage/attestation-physics/questions", D2))[0];
await deny("14. draft (Day 2) rasmi — Storage", apiAs("user1", "st_get", { path: `attestation-physics/questions/${D2}/${figD2}` }));
await allow("15. published (Day 1) rasmi — Storage", apiAs("user1", "st_get", { path: `attestation-physics/questions/${D1}/${figD1}` }));
await deny("15b. mehmon → published rasm", apiAs(null, "st_get", { path: `attestation-physics/questions/${D1}/${figD1}` }));

// ======================================================== 3. USER: landing → dashboard → test → submit → darhol natija
const key1 = keyOf(D1);
const snap1 = snapOf(D1);
const plan = {};
let iAuto = 0;
snap1.questions.forEach((q) => {
  if (q.evaluationType === "open") return;
  if (q.evaluationType === "unreliable") { plan[q.id] = "A"; return; }
  const k = key1.answers[q.id];
  const m = iAuto++ % 10;
  if (m < 7) plan[q.id] = k;                                                     // to'g'ri
  else if (m < 9) plan[q.id] = ["A", "B", "C", "D"].find((x) => x !== k);       // noto'g'ri
});
const expC = Object.entries(key1.answers).filter(([q, a]) => plan[q] === a).length;
const expW = Object.entries(key1.answers).filter(([q, a]) => q in plan && plan[q] !== a).length;
const expU = key1.scorableCount - expC - expW;

{
  const { ctx, page } = await makeCtx({ uid: "user1", time: new Date(T0.getTime() + 10 * 60000) });
  await setClock(page, new Date(T0.getTime() + 10 * 60000));
  await page.goto(B + "index.html");
  await settle(page);
  ok("bosh sahifa: Attestatsiya kartasi yangi landingga olib boradi", await page.$('a[href$="attestatsiya/index.html"]') !== null);
  await page.goto(B + "attestatsiya/index.html");
  await settle(page);
  ok("landing: Fizika va Pedagogika kartalari", (await page.$('a[href="fizikaattestatsiya.html"]')) && (await page.$('a[href="pedagogika-testlari/index.html"]')));
  await shot(page, "user-01-landing-desktop");
  await page.click('a[href="fizikaattestatsiya.html"]');
  await page.waitForSelector('[data-today][data-state="open"]');
  await settle(page);
  const todayTxt = await page.textContent("[data-today]");
  ok("dashboard: Bugungi test = Day 1", /Day 1/.test(todayTxt) && /32 savol/.test(todayTxt), todayTxt.replace(/\s+/g, " ").slice(0, 160));
  const locked = await page.$$eval(".att-locked li", (x) => x.length);
  ok("dashboard: draft kunlar mazmunsiz (31 ta qulf)", locked === 31);
  ok("dashboard: draft kun mavzulari ko'rinmaydi", !(await page.textContent("[data-days]")).includes("Day 2 ·"));
  await shot(page, "user-02-dashboard-desktop");
  await page.click('[data-today] a[href="fizika-test.html?day=1"]');
  await page.waitForSelector("[data-start]");
  await shot(page, "user-03-test-intro");
  const beforeStart = page.apiLog.length;
  await page.click("[data-start]");
  await page.waitForSelector("[data-q] .att-q__num");
  const att0 = (await post("__mock/dump", { prefix: "attestationPhysicsAttempts/" })).docs[`attestationPhysicsAttempts/user1__${D1}`];
  ok("start: urinish yaratildi (testId, dayNumber, startedAt, in_progress, versiya)", att0 && att0.testId === D1 && att0.dayNumber === 1 && att0.status === "in_progress" && att0.startedAt && att0.testVersion === 1 && !("timeLimitSeconds" in att0));
  await page.waitForTimeout(1500);
  const katexCount = await page.$$eval(".katex", (x) => x.length);
  // Savollarni UI orqali ishlash
  const n = snap1.questions.length;
  for (let i = 0; i < n; i++) {
    const q = snap1.questions[i];
    const want = plan[q.id];
    if (want) await page.click(`.att-opt[data-key="${want}"]`);
    if (i === 3) await shot(page, "user-04-test-question-desktop");
    if (i < n - 1) await page.click("[data-next]");
  }
  // sekundomer: 47 daqiqa 27 soniya o'tdi
  const tEnd = new Date(att0.startedAt.__ts[0] * 1000 + (47 * 60 + 27) * 1000);
  await setClock(page, tEnd);
  await page.waitForTimeout(1300);
  const clock = await page.textContent("[data-clock]");
  ok("sekundomer: o'tgan vaqtni ko'rsatadi (countdown emas)", /^47:2[78]$/.test(clock.trim()), clock);
  ok("vaqt chegarasi yo'q: 47 daqiqadan keyin ham test ochiq", (await page.$("[data-finish]")) !== null);
  const grid = await page.$$eval("[data-go]", (bs) => bs.map((b) => b.dataset.answered));
  ok("navigator: javob berilgan/javobsiz farqlanadi", grid.filter((x) => x === "true").length === Object.keys(plan).length);
  await shot(page, "user-05-test-navigator");
  const keyReqBefore = page.apiLog.filter((r) => /\/keys\/|\/solutions\//.test(r.path)).length;
  ok("submit'dan OLDIN brauzer kalit/yechim so'ramagan", keyReqBefore === 0);
  await page.click("[data-finish]");
  const confirmText = await page.textContent(".of-modal__dialog");
  ok("tasdiq oynasi: «Testni yakunlashni xohlaysizmi? …natija darhol ko‘rsatiladi»", /Testni yakunlashni xohlaysizmi\?/.test(confirmText) && /natija darhol ko‘rsatiladi/.test(confirmText));
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-result");
  await settle(page, 1200);
  const res = await page.textContent(".att-result");
  ok("darhol natija: to'g'ri/scorable", res.includes(`${expC} / ${key1.scorableCount}`), `kutilgan ${expC}/${key1.scorableCount}`);
  ok("darhol natija: To‘g‘ri / Noto‘g‘ri / Javobsiz", res.replace(/\s+/g, " ").includes(`To‘g‘ri${expC}`) || (await page.$$eval(".att-count b", (b) => b.map((x) => x.textContent.trim()))).join(",") === `${expC},${expW},${expU}`);
  // real vaqt ham oqadi (setClock → submit orasidagi bir necha soniya), shuning uchun 27–35 s oralig'i
  ok("darhol natija: sarflangan vaqt ≈ 47 daqiqa 27 soniya (stopwatch + server vaqti)", /47 daqiqa (2[7-9]|3[0-5]) soniya/.test(res), (res.match(/47 daqiqa \d+ soniya/) || [""])[0]);
  const rev = await page.$$eval(".att-rev", (r) => r.map((x) => x.dataset.status));
  ok("savol bo'yicha: ✓/✕/○/baholanmaydi holatlari", rev.length === n && rev.filter((s) => s === "correct").length === expC && rev.filter((s) => s === "wrong").length === expW && rev.filter((s) => s === "unanswered").length === expU);
  const wrongRow = await page.$('.att-rev[data-status="wrong"] summary');
  ok("noto'g'ri savolda «Sizning javobingiz» va «To‘g‘ri javob»", wrongRow && /Sizning javobingiz: [A-E].*To‘g‘ri javob: [A-E]/.test((await wrongRow.textContent()).replace(/\s+/g, " ")));
  ok("to'liq yechim hali YOPIQ (eslatma)", /To‘liq yechimlar .* da \(Toshkent vaqti\)/.test(await page.textContent(".att-lock-note")));
  ok("natija sahifasi yechim so'ramadi", page.apiLog.filter((r) => /\/solutions\//.test(r.path)).length === 0);
  await page.click(".att-rev:nth-child(1) summary").catch(() => {});
  await page.click('.att-rev[data-status="wrong"] summary');
  await settle(page, 800);
  await shot(page, "user-06-result-desktop");
  const att1 = (await post("__mock/dump", { prefix: "attestationPhysicsAttempts/" })).docs[`attestationPhysicsAttempts/user1__${D1}`];
  ok("urinish saqlandi: graded, completedAt, timeSpentSeconds", att1.status === "graded" && att1.completedAt && att1.timeSpentSeconds >= 2847 && att1.timeSpentSeconds <= 2850 && att1.correctAnswers === expC, `timeSpent=${att1.timeSpentSeconds}`);
  ok("test sahifasida KaTeX render", katexCount > 0, `${katexCount} formula`);
  ok("user sahifalari: konsol xatolari yo'q", !page.errors.length, page.errors.join(" | "));

  // Hujum: soxta natija (o'z hujjatini qayta yozish)
  await deny("9. user → soxta scorePercent", apiAs("user1", "commit", { writes: [{ type: "update", path: `attestationPhysicsAttempts/user1__${D1}`, data: { scorePercent: 100 } }] }));
  await deny("10. user → soxta correctAnswers", apiAs("user1", "commit", { writes: [{ type: "update", path: `attestationPhysicsAttempts/user1__${D1}`, data: { correctAnswers: 32 } }] }));
  await deny("11. user → soxta timeSpentSeconds", apiAs("user1", "commit", { writes: [{ type: "update", path: `attestationPhysicsAttempts/user1__${D1}`, data: { timeSpentSeconds: 60 } }] }));
  await deny("user → isCorrect maydoni", apiAs("user1", "commit", { writes: [{ type: "update", path: `attestationPhysicsAttempts/user1__${D1}`, data: { isCorrect: true } }] }));
  await deny("5. user2 → user1 urinishi", apiAs("user2", "get", { path: `attestationPhysicsAttempts/user1__${D1}` }));
  await deny("6. user2 → user1 natijalari (so'rov)", apiAs("user2", "query", { col: "attestationPhysicsAttempts", filters: [["userId", "==", "user1"]] }));
  await allow("user1 → o'z urinishi", apiAs("user1", "get", { path: `attestationPhysicsAttempts/user1__${D1}` }));
  await allow("user1 → kalit (submit'dan keyin)", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D1}/keys/v1` }));
  await deny("user1 → yechim (submit'dan keyin ham, vaqtidan oldin)", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D1}/solutions/v1` }));

  // Yechimlar sahifasi — hali yopiq
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=1");
  await settle(page);
  ok("yechimlar sahifasi: Day 1 hali yopiq", /yechimlari hali yopiq/.test(await page.textContent("[data-view]")));
  await shot(page, "user-07-solution-locked");
  await ctx.close();
}

// ======================================================== 4. KEYINGI KUN 00:00 (Toshkent) — yechim ochiladi, admin Day 2 publish
const NEXT = new Date("2026-10-05T19:00:30Z");
await setClock(null, NEXT);
await allow("8b. user → yechim (solutionAvailableAt dan keyin)", apiAs("user1", "get", { path: `attestationPhysicsDailyTests/${D1}/solutions/v1` }));
{
  const { ctx, page } = await makeCtx({ uid: "admin1", time: new Date(NEXT.getTime() + 3 * 3600000) });
  await setClock(page, new Date(NEXT.getTime() + 3 * 3600000));
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector('[data-publish="att-fizika-day-02"]');
  await page.click('[data-publish="att-fizika-day-02"]');
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => document.querySelector('[data-stat="published"]').textContent.trim() === "2");
  ok("admin: Day 2 publish (ertasi kuni)", true);
  // Qayta import — mavjud testlar o'zgarmaydi
  await page.setInputFiles("[data-bundle]", path.join(PRIV, "firestore-import.json"));
  await page.waitForFunction(() => !document.querySelector("[data-import]").disabled);
  await page.click("[data-import]");
  const txt = await page.textContent(".of-admin-confirm .of-modal__text");
  await page.click(".of-admin-confirm .of-btn--ghost");
  ok("qayta import: mavjud 32 test o'tkazib yuboriladi", /O‘tkazib yuboriladi: (\d+)/.test(txt) && Number(txt.match(/O‘tkazib yuboriladi: (\d+)/)[1]) >= 32 * 4, txt);
  await shot(page, "admin-03-day2-published");
  await ctx.close();
}
{
  const t = new Date(NEXT.getTime() + 4 * 3600000);
  const { ctx, page } = await makeCtx({ uid: "user1", time: t });
  await setClock(page, t);
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForSelector("[data-today]:not([aria-busy])");
  await settle(page);
  ok("ertasi kun: Bugungi test = Day 2", /Day 2/.test(await page.textContent("[data-today]")));
  const day1 = await page.textContent('.att-day[data-state="done"]');
  ok("Day 1 tarixda qoladi (natija + yechim ochiq)", /Day 1/.test(day1) && /Yechimlar ochiq/.test(day1));
  await shot(page, "user-08-dashboard-day2");
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=1");
  await page.waitForSelector(".att-solq");
  await page.waitForTimeout(2500);
  const solN = await page.$$eval(".att-solq", (x) => x.length);
  const kx = await page.$$eval(".att-sol .katex", (x) => x.length);
  ok("yechimlar ochiq: 32 savol, to'liq yechim + KaTeX", solN === 32 && kx > 20, `${solN} savol, ${kx} formula`);
  const lazyBefore = await page.$$eval(".att-fig[data-state]", (f) => f.filter((x) => x.dataset.state === "loading").length);
  const figCount = await page.$$eval(".att-fig", (f) => f.length);
  for (let i = 0; i < figCount; i++) {
    await page.locator(".att-fig").nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  const imgs = await page.$$eval(".att-fig[data-state]", (f) => f.map((x) => x.dataset.state));
  const decoded = await page.$$eval(".att-fig img", (im) => im.filter((x) => x.naturalWidth > 0).length);
  ok("rasmlar: ko'rinmaguncha yuklanmaydi (lazy)", lazyBefore > 0, `${lazyBefore}/${figCount} hali yuklanmagan edi`);
  ok("rasmlar Storage'dan (getBlob → Blob URL) yuklanadi", imgs.every((x) => x === "ready") && decoded === figCount, `${decoded}/${figCount} ready`);
  await page.locator(".att-fig").first().scrollIntoViewIfNeeded();
  await shot(page, "user-09-solutions-desktop");
  await page.goto(B + "attestatsiya/fizika-natijalar.html");
  await page.waitForSelector(".att-tiles");
  const statTxt = (await page.textContent(".att-tiles")).replace(/\s+/g, " ");
  ok("statistika: progress 1/32 va o'rtacha natija", /1\/32/.test(statTxt) && new RegExp(`${Math.round((expC * 100) / key1.scorableCount)}%`).test(statTxt), statTxt);
  ok("tarix: Day 1 qatori", /Day 1/.test(await page.textContent(".att-history")));
  ok("statistika: bo'lim va mavzu bo'yicha", (await page.$$eval("#pSec ~ .att-bars li", (x) => x.length)) >= 1 && (await page.$$eval("#pTopic ~ .att-bars li", (x) => x.length)) >= 1);
  await shot(page, "user-10-results-desktop");
  ok("user (ertasi kun) konsol xatolari yo'q", !page.errors.length, page.errors.join(" | "));
  await ctx.close();
}

// ======================================================== 5. Responsive + dark mode skrinshotlar
const VIEWS = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } };
const PAGES = [["landing", "attestatsiya/index.html"], ["dashboard", "attestatsiya/fizikaattestatsiya.html"], ["solutions", "attestatsiya/fizika-yechimlar.html?day=1"], ["results", "attestatsiya/fizika-natijalar.html"]];
const overflow = [];
for (const [vn, vp] of Object.entries(VIEWS)) {
  for (const dark of [false, true]) {
    const t = new Date(NEXT.getTime() + 5 * 3600000);
    const { ctx, page } = await makeCtx({ uid: "user1", viewport: vp, dark, time: t });
    await setClock(page, t);
    for (const [pn, url] of PAGES) {
      await page.goto(B + url);
      await page.waitForTimeout(2200);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) overflow.push(`${vn}/${dark ? "dark" : "light"}/${pn}: +${ov}px`);
      if (pn !== "solutions" || vn !== "desktop") await page.screenshot({ path: path.join(OUT, `rwd-${vn}-${dark ? "dark" : "light"}-${pn}.png`), fullPage: vn !== "desktop" ? false : true });
      else await page.screenshot({ path: path.join(OUT, `rwd-${vn}-${dark ? "dark" : "light"}-${pn}.png`) });
    }
    // Test sahifasi (user2: Day 2 ochiq)
    const ctx2 = await makeCtx({ uid: "user2", viewport: vp, dark, time: t });
    await ctx2.page.goto(B + "attestatsiya/fizika-test.html?day=2");
    await ctx2.page.waitForSelector("[data-start]");
    await ctx2.page.click("[data-start]");
    await ctx2.page.waitForSelector("[data-q] .att-q__num");
    await ctx2.page.waitForTimeout(1800);
    const ov2 = await ctx2.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov2 > 1) overflow.push(`${vn}/${dark ? "dark" : "light"}/test: +${ov2}px`);
    await ctx2.page.screenshot({ path: path.join(OUT, `rwd-${vn}-${dark ? "dark" : "light"}-test.png`) });
    await ctx2.ctx.close();
    await ctx.close();
  }
}
ok("responsive: gorizontal overflow yo'q (desktop/tablet/mobile × light/dark × 5 sahifa)", !overflow.length, overflow.join("; "));

// ======================================================== 6. Klaviatura (accessibility)
{
  const t = new Date(NEXT.getTime() + 6 * 3600000);
  const { ctx, page } = await makeCtx({ uid: "user2", time: t });
  await page.goto(B + "attestatsiya/fizika-test.html?day=2");
  await page.waitForSelector("[data-start]");
  await page.click("[data-start]");
  await page.waitForSelector("[data-q] .att-q__num");
  await page.focus('.att-opt[tabindex="0"]');
  await page.keyboard.press("ArrowDown");
  const checked = await page.$$eval('.att-opt[aria-checked="true"]', (x) => x.length);
  ok("klaviatura: radiogroup (strelkalar) bilan javob tanlash", checked === 1);
  const roles = await page.$$eval(".att-opt", (x) => x.every((b) => b.tagName === "BUTTON" && b.getAttribute("role") === "radio" && b.getAttribute("aria-label")));
  ok("semantika: variantlar button[role=radio] + aria-label", roles);
  ok("sekundomer: role=timer", (await page.$('[role="timer"]')) !== null);
  await ctx.close();
}

await browser.close();
const report = { status: checks.every((c) => c.pass) ? "PASS" : "FAIL", passed: checks.filter((c) => c.pass).length, total: checks.length, security: sec, checks, expected: { correct: expC, wrong: expW, unanswered: expU, scorable: key1.scorableCount } };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(`\n${report.passed}/${report.total} — ${report.status}`);
process.exit(report.status === "PASS" ? 0 : 1);
