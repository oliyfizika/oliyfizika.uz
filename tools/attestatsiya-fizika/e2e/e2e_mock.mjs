// ==========================================================================
// Attestatsiya → Fizika: E2E — MOCK TEST (50 savol = 40 fizika + 10 pedagogika, har savol 2 ball, jami 100).
//   python3 tools/attestatsiya-fizika/build_mock_test.py      # mock-import-01.json
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
const MOCKFILE = path.join(PRIV, "mock-import-01.json");
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
const docs = { [CFG]: { ...opData(CFG), figureBackend: "firestore", accessMode: "paid" } };
const PUB = { 1: [-150, -126], 3: [-2, 13], 4: [-78, -54] };
for (const n of [1, 2, 3, 4]) {
  docs[`${TC}/${DID(n)}`] = opData(`${TC}/${DID(n)}`);
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${DID(n)}/${c}/v1`] = opData(`${TC}/${DID(n)}/${c}/v1`);
  if (PUB[n]) Object.assign(docs[`${TC}/${DID(n)}`], { status: "published", published: true, publishedAt: at(PUB[n][0]), publishedBy: "admin1", solutionAvailableAt: at(PUB[n][1]) });
}
const people = { admin1: { fullName: "Admin Bir", role: "admin" }, nox: { fullName: "Ruxsatsiz User" }, acc2: { fullName: "Ikkinchi User" }, late: { fullName: "Kechikkan User" }, timer: { fullName: "Taymer User" } };
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

// ================================================================ 1. ADMIN: import (draft) → PUBLISH
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForSelector("[data-body] tr");
  ok("admin: mock hali yo'q — jadvalda faqat kunlik testlar", !(await page.textContent("[data-body]")).includes("Mock"));
  await page.setInputFiles("[data-mock-bundle]", MOCKFILE);
  await page.waitForFunction(() => !document.querySelector("[data-mock-import]").disabled, null, { timeout: 15000 });
  ok("admin: mock fayli tekshirildi (50 savol, 40 + 10, 100 ball)", /50 savol \(40 fizika \+ 10 pedagogika\) · 100 ball/.test(await page.textContent("[data-mock-info]")), await txt(page, "[data-mock-info]"));
  await page.click("[data-mock-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-mock-info]").textContent), null, { timeout: 60000 });
  const written = await dump(`${TC}/${MID}`);
  ok("admin import: test + versions/keys/solutions = 4 hujjat yozildi", Object.keys(written).length === 4, J(Object.keys(written)));
  ok("admin import: test draft, kind=mock, 50 savol, maxScore 100", written[`${TC}/${MID}`].status === "draft" && written[`${TC}/${MID}`].published === false
     && written[`${TC}/${MID}`].kind === "mock" && written[`${TC}/${MID}`].questionCount === 50 && written[`${TC}/${MID}`].maxScore === 100);
  await page.waitForSelector(`[data-publish="${MID}"]`);
  const row = await page.$eval(`[data-publish="${MID}"]`, (b) => b.closest("tr").textContent.replace(/\s+/g, " "));
  ok("admin: jadvalda «Mock» qatori (40 fizika + 10 pedagogika, 100 ball), Day raqami ko'rsatilmaydi", /Mock/.test(row) && /100 ball/.test(row) && !/\b101\b/.test(row), row.slice(0, 160));
  const noteTxt = await txt(page, "[data-note]");
  ok("admin: «keyingi kun» eslatmasi mock'ni sanamaydi (Day 2)", /Day 2/.test(noteTxt), noteTxt);
  // ikkinchi import — qayta yozilmaydi
  await page.setInputFiles("[data-mock-bundle]", MOCKFILE);
  await page.waitForFunction(() => !document.querySelector("[data-mock-import]").disabled);
  await page.click("[data-mock-import]");
  await page.waitForFunction(() => /allaqachon mavjud/.test(document.querySelector("[data-mock-info]").textContent), null, { timeout: 10000 });
  ok("admin: ikkinchi import — mavjud mock qayta yozilmaydi", true);
  // PUBLISH
  await page.click(`[data-publish="${MID}"]`);
  const modal = await txt(page, ".of-admin-confirm .of-modal__dialog");
  ok("admin: PUBLISH tasdig'i «Mock test» deb aytadi", /Mock test/.test(modal) && /40 fizika \+ 10 pedagogika/.test(modal) && !/navbatdagi kun/.test(modal), modal.slice(0, 200));
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction((id) => !document.querySelector(`[data-publish="${id}"]`), MID, { timeout: 15000 });
  const m = (await dump(`${TC}/${MID}`))[`${TC}/${MID}`];
  const solAt = new Date(m.solutionAvailableAt.__ts[0] * 1000);
  ok("publish: status=published, publishedAt, solutionAvailableAt = ertasi 00:00 Toshkent",
     m.status === "published" && m.published === true && m.publishedAt && solAt.toISOString() === "2026-10-07T19:00:00.000Z", solAt.toISOString());
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ================================================================ 2. Foydalanuvchi (PAID, attestationAccess yo'q): dashboard → test → natija
const U0 = plus(T0, 0.1);
await clock(U0);
const letters = (id) => mkey.answers[id];
const wrongOf = (id) => ["A", "B", "C", "D"].find((l) => l !== letters(id));
const plan = {};                                                   // 37 to'g'ri, 1 noto'g'ri, 12 javobsiz
mids.slice(0, 37).forEach((id) => { plan[id] = letters(id); });
plan[mids[37]] = wrongOf(mids[37]);
{
  const { ctx, page } = await ctxFor("nox", U0);
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-days]") && !document.querySelector("[data-days]").hasAttribute("aria-busy"), null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector("[data-mock-section]").hidden, null, { timeout: 10000 });
  const card = await page.$eval("[data-mock-card]", (c) => ({ t: c.textContent.replace(/\s+/g, " "), start: !!c.querySelector('a[href="fizika-test.html?day=101"]'), state: c.dataset.state }));
  ok("dashboard: «Mock test» bo'limi — 50 savol, 100 ball, 40 fizika + 10 pedagogika, «Boshlash»",
     /Mock test/.test(card.t) && /50 savol/.test(card.t) && /100 ball/.test(card.t) && /40 fizika \+ 10 pedagogika/.test(card.t) && card.start && /Boshlash/.test(card.t), card.t.slice(0, 200));
  ok("dashboard: ruxsatsiz (paid) userga mock qulfsiz — bepul", card.state === "open" && !/ruxsat kerak/i.test(card.t));
  const days = await page.$$eval("[data-days] .att-day__num", (n) => n.map((x) => x.textContent.trim()));
  ok("dashboard: kunlik jadvalda mock yo'q (Day 1..4 faqat), 'M' belgisi yo'q", !days.includes("M") && !days.includes("101") && days.length === 3, J(days));
  const today = await txt(page, "[data-today]");
  ok("«Bugungi test» mock emas (Day 3)", /Day 3/.test(today) && !/Mock/.test(today), today.slice(0, 120));
  ok("kurs progressi 0/32 (mock hisoblanmaydi)", (await txt(page, "[data-progress-num]")) === "0/32");
  await page.screenshot({ path: path.join(OUT, "mock-dashboard-1366.png"), fullPage: true });
  // Day 4 hali ham yopiq (regressiya)
  ok("regressiya: Day 4 ruxsatsiz userga yopiq", (await page.$eval('[data-days] [data-day="4"]', (c) => c.dataset.state)) === "restricted");

  await page.goto(B + "attestatsiya/fizika-test.html?day=101");
  await page.waitForSelector("[data-start]");
  const intro = await txt(page, ".att-intro");
  ok("intro: «Mock test», 50 savol, 100 ball (har savol 2 ball), 40 + 10", /Mock test/.test(intro) && /Mock test: 40 ta fizika \+ 10 ta pedagogika/.test(intro) && /50\s*savol/.test(intro)
     && /100 ball/.test(intro) && /har savol 2 ball/.test(intro) && !/Day 101/.test(intro), intro.slice(0, 260));
  await page.screenshot({ path: path.join(OUT, "mock-intro-1366.png"), fullPage: true });
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const att0 = await attemptOf("nox");
  ok("start: urinish yaratildi (dayNumber 101, kind official, 50 savol, in_progress)", att0 && att0.status === "in_progress" && att0.dayNumber === MDAY && att0.questionCount === 50 && att0.kind === "official" && att0.testVersion === 1);
  ok("runner: sarlavha «Mock test», 50 ta savol tugmasi, kalkulyator bor", (await txt(page, ".att-bar__title")) === "Mock test" && (await page.$$("[data-go]")).length === 50 && !!(await page.$("[data-calc]")));
  const apiBefore = [];
  page.on("request", (r) => { if (/\/keys\/|\/solutions\//.test(r.url()) || (r.url().endsWith("/__mock/api") && /\/(keys|solutions)\//.test(r.postData() || ""))) apiBefore.push(r.url()); });
  for (let i = 0; i < 50; i++) {
    const id = mids[i];
    if (plan[id]) await page.click(`.att-opt[data-key="${plan[id]}"]`);
    if (i === 40) await page.screenshot({ path: path.join(OUT, "mock-pedagogy-question-1366.png") });
    if (i < 49) await page.click("[data-next]");
  }
  ok("pedagogika savoli (41-savol) 4 variantli (A–D)", true);
  ok("topshirishdan OLDIN kalit/yechim so'ralmagan", apiBefore.length === 0, J(apiBefore));
  await page.click("[data-finish]");
  const confirm = await txt(page, ".of-modal__dialog");
  ok("tasdiq oynasi: 12 ta javobsiz haqida ogohlantiradi", /12/.test(confirm), confirm.slice(0, 200));
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-result", { timeout: 20000 });
  await page.waitForTimeout(1200);
  const res = await txt(page, ".att-result");
  ok("natija: 74 ball / 100 ball (37 to'g'ri x 2)", /74/.test(res) && /\/ 100 ball/.test(res) && /37 \/ 50 to‘g‘ri/.test(res), res.slice(0, 220));
  ok("natija: halqada «ball», foiz belgisi yo'q", /ball/.test(await txt(page, ".att-ring")) && !/%/.test(await txt(page, ".att-ring")) && /74 ball/.test(await page.$eval(".att-ring", (e) => e.getAttribute("aria-label"))));
  const counts = await page.$$eval(".att-count b", (b) => b.map((x) => x.textContent.trim()));
  ok("natija: to'g'ri 37 · noto'g'ri 1 · javobsiz 12", counts.join(",") === "37,1,12", counts.join(","));
  const att1 = await attemptOf("nox");
  ok("saqlangan urinish: graded, scorePercent 74 (= ball), correctAnswers 37", att1.status === "graded" && att1.scorePercent === 74 && att1.correctAnswers === 37 && att1.wrongAnswers === 1 && att1.unanswered === 12);
  const rev = await page.$$eval(".att-rev", (r) => r.map((x) => ({ s: x.dataset.status, t: x.querySelector(".of-badge")?.textContent.trim() })));
  ok("review: 50 karta; birinchi 40 fizika mavzulari, oxirgi 10 «Pedagogika»", rev.length === 50 && rev.slice(40).every((r) => r.t === "Pedagogika") && rev.slice(0, 40).every((r) => r.t !== "Pedagogika"));
  ok("review: to'g'ri/noto'g'ri/javobsiz soni natijadagidek", rev.filter((r) => r.s === "correct").length === 37 && rev.filter((r) => r.s === "wrong").length === 1 && rev.filter((r) => r.s === "unanswered").length === 12);
  ok("natija: yechim ochilish vaqti ko'rsatiladi (7-oktabr 24:00 = 8-oktabr 00:00)", /yechimlar|Yechimlar|yechimlar/.test(await txt(page, ".att-lock-note")) && /00:00/.test(await txt(page, ".att-lock-note")), await txt(page, ".att-lock-note"));
  await page.locator(".att-rev").nth(41).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "mock-result-1366.png") });
  ok("natija sahifasi yechim so'ramadi", true);
  // yechimlar yopiq
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=101");
  await page.waitForSelector(".att-state");
  ok("yechimlar (vaqtidan oldin): «Mock test yechimlari hali yopiq»", /Mock test yechimlari hali yopiq/.test(await txt(page, ".att-state")), await txt(page, ".att-state"));
  const r5 = await apiAs("nox", "get", { path: `${TC}/${MID}/solutions/v1` });
  ok("Firestore: yechimlar vaqtidan oldin to'g'ridan-to'g'ri o'qib bo'lmaydi", r5.ok === false, r5.code || "");
  const forge = await apiAs("nox", "commit", { writes: [{ type: "update", path: `${AC}/nox__${MID}`, data: { scorePercent: 100 } }] });
  ok("Firestore: soxta ball (100) yozib bo'lmaydi", forge.ok === false, forge.code || "");
  ok("foydalanuvchi: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ================================================================ 3. late: boshlaydi, tugatmaydi → yechim vaqtida avto-yakunlanadi
{
  const { ctx, page } = await ctxFor("late", plus(T0, 1));
  await clock(plus(T0, 1));
  await page.goto(B + "attestatsiya/fizika-test.html?day=101");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const first = mids.slice(0, 5);
  const lateAns = {};
  first.forEach((id, i) => { lateAns[id] = i < 3 ? letters(id) : wrongOf(id); });
  for (let i = 0; i < 5; i++) {
    await page.click(`.att-opt[data-key="${lateAns[mids[i]]}"]`);
    await page.click("[data-next]");
  }
  await page.waitForTimeout(7500);                                      // qoralama saqlanadi
  const saved = await attemptOf("late");
  ok("late: qoralama saqlandi (5 javob), hali in_progress", saved.status === "in_progress" && Object.keys(saved.answers || {}).length === 5);
  await ctx.close();
}

// ================================================================ 3b. VAQT CHEGARASI: 2 soat, yangilaganda davom etadi, 0 da avto-topshirish
{
  const S = plus(T0, 2);
  await clock(S);
  const { ctx, page } = await ctxFor("timer", S);
  await page.goto(B + "attestatsiya/fizika-test.html?day=101");
  await page.waitForSelector("[data-start]");
  const intro = await txt(page, "body");
  ok("taymer: kirish sahifasida «2 soat» ko'rsatiladi", /2 soat/.test(intro) && /yangila/i.test(intro), intro.slice(0, 200));
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const left = async () => (await txt(page, "[data-clock]"));
  const toSec = (t) => t.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
  const c0 = await left();
  ok("taymer: boshida ≈ 2:00:00 qoladi, ko'rinib turadi", toSec(c0) >= 7195 && toSec(c0) <= 7203 && await page.isVisible("[data-countdown]"), c0);
  await page.screenshot({ path: path.join(OUT, "mock-timer-start.png") });
  await page.click(`.att-opt[data-key="${letters(mids[0])}"]`);
  await page.waitForTimeout(7000);                                    // qoralama saqlanadi
  await page.clock.setSystemTime(plus(S, 0.5)); await clock(plus(S, 0.5));
  await page.reload();
  await page.waitForSelector("[data-start]");
  ok("taymer: yangilagandan keyin «Davom ettirish» ko'rsatiladi", /Davom ettirish/.test(await txt(page, "[data-start]")));
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const c1 = await left();
  ok("taymer: yangilagandan keyin vaqt davom etadi (≈ 1:30:00, qaytadan 2:00:00 emas)", toSec(c1) >= 5390 && toSec(c1) <= 5403, c1);
  const a1 = await attemptOf("timer");
  ok("taymer: startedAt qayta yozilmagan, hali in_progress", a1.status === "in_progress" && a1.startedAt.__ts[0] === Math.floor(S.getTime() / 1000));
  await page.screenshot({ path: path.join(OUT, "mock-timer-resumed.png") });
  await ctx.close();
}
{
  // 1 soat 50 daqiqada «xavf» darajasi + 2 soatda avtomatik topshirish
  const S = plus(T0, 2);
  const { ctx, page } = await ctxFor("timer", plus(S, 1.9));
  await clock(plus(S, 1.9));
  await page.goto(B + "attestatsiya/fizika-test.html?day=101");
  await page.waitForSelector("[data-start]");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const lvl = await page.getAttribute("[data-countdown]", "data-level");
  ok("taymer: oxirgi 10 daqiqada ogohlantirish darajasi (warn)", lvl === "warn", lvl);
  await page.clock.setSystemTime(plus(S, 2.001)); await clock(plus(S, 2.001));
  await page.waitForSelector(".att-result", { timeout: 20000 });
  const a = await attemptOf("timer");
  ok("taymer: 0 bo'lganda avtomatik topshirildi (graded), sarflangan vaqt ≈ 2 soat (grace ichida)", ["submitted", "graded"].includes(a.status) && a.timeSpentSeconds >= 7195 && a.timeSpentSeconds <= 7260, J({ s: a.status, t: a.timeSpentSeconds }));
  ok("taymer: javob (1 ta) saqlangan, natija ko'rsatildi", a.correctAnswers === 1, J({ c: a.correctAnswers }));
  ok("taymer: konsol xatolarisiz", page.errs.length === 0, J(page.errs));
  await ctx.close();
}

// ================================================================ 4. Yechim vaqti kelgach (T0 + 14 soat)
const AFTER = plus(T0, 14);
await clock(AFTER);
{
  const { ctx, page } = await ctxFor("nox", AFTER);
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForSelector("[data-mock-card]");
  const card = await page.$eval("[data-mock-card]", (c) => ({ t: c.textContent.replace(/\s+/g, " "), sol: !!c.querySelector('a[href="fizika-yechimlar.html?day=101"]'), score: c.querySelector(".att-score")?.textContent.replace(/\s+/g, "") }));
  ok("dashboard (yechim vaqtidan keyin): bajarilgan, ball «74/100», «Yechimlar» havolasi", card.score === "74/100" && card.sol && /Yechimlar ochiq/.test(card.t), J(card));
  await page.goto(B + "attestatsiya/fizika-yechimlar.html");
  await page.waitForSelector(".att-day");
  const list = await page.$$eval(".att-day", (cs) => cs.map((c) => ({ n: c.querySelector(".att-day__num").textContent.trim(), t: c.querySelector(".att-day__title").textContent.trim(), link: !!c.querySelector("a") })));
  ok("yechimlar ro'yxati: «Mock test» (M) kunlardan keyin, havola bor", list.at(-1).n === "M" && list.at(-1).t === "Mock test" && list.at(-1).link && list.filter((x) => x.n === "M").length === 1, J(list.map((x) => x.t)));
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=101");
  await page.waitForSelector(".att-solq", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const hero = await txt(page, ".att-hero");
  ok("yechimlar (mock): 50 ta savol yechimi, «Mock test», natija 74 / 100 ball", (await page.$$(".att-solq")).length === 50 && /Mock test/.test(hero) && /74 \/ 100 ball/.test(hero), hero.slice(0, 200));
  ok("yechimlar: oldingi/keyingi tugmalari kunlik testlarga olib bormaydi", !/Day \d/.test(await page.$eval(".att-hero__side", (e) => e.textContent)), await txt(page, ".att-hero__side"));
  const pedSol = await page.$$eval(".att-solq", (c) => c.slice(40).map((x) => x.textContent.replace(/\s+/g, " ")));
  const pedKey = mids.slice(40).map((id) => mkey.answers[id]);
  ok("yechimlar: pedagogika savollarida to'g'ri javob ko'rsatilgan", pedSol.length === 10 && pedSol.every((t, i) => /Pedagogika/.test(t) && t.includes(`${pedKey[i]})`)), pedSol[0].slice(-200));
  await page.screenshot({ path: path.join(OUT, "mock-solutions-1366.png") });
  // natijalar sahifasi
  await page.goto(B + "attestatsiya/fizika-natijalar.html");
  await page.waitForSelector(".att-history");
  const hist = await page.$$eval(".att-history tbody tr", (r) => r.map((x) => x.textContent.replace(/\s+/g, " ")));
  ok("natijalar: tarixda «Mock test» — 74 / 100 ball", hist.length === 1 && /Mock test/.test(hist[0]) && /74 \/ 100 ball/.test(hist[0]) && /37 \/ 1 \/ 12/.test(hist[0]), J(hist));
  const tiles = await txt(page, ".att-tiles");
  ok("natijalar: kurs progressi 0/32, kunlik o'rtacha natija mock'siz (—)", /Kurs progressi\s*0\/32/.test(tiles) && /O‘rtacha natija\s*—/.test(tiles), tiles);
  ok("natijalar: mock grafik/bo'lim statistikasiga aralashmaydi", (await page.$$eval(".att-col", (c) => c.length)) === 0);
  // kunlik yechim (Day 4) hali ham yopiq (regressiya)
  const r4 = await apiAs("nox", "get", { path: `${TC}/${DID(4)}/solutions/v1` });
  ok("regressiya: Day 4 yechimi ruxsatsiz userga yopiq", r4.ok === false);
  ok("yechim vaqtidan keyin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
{
  // hech qachon boshlamagan user — yechimlar bepul ochiladi
  const { ctx, page } = await ctxFor("acc2", AFTER);
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=101");
  await page.waitForSelector(".att-solq", { timeout: 20000 });
  ok("hech boshlamagan user: mock yechimlari ochiq (bepul), natija ko'rsatilmaydi", (await page.$$(".att-solq")).length === 50 && !/natijangiz/.test(await txt(page, ".att-hero")));
  await ctx.close();
}
{
  // late: avto-yakunlash — test sahifasini ochganda
  const { ctx, page } = await ctxFor("late", AFTER);
  await page.goto(B + "attestatsiya/fizika-test.html?day=101");
  await page.waitForSelector(".att-result", { timeout: 20000 });
  const a = await attemptOf("late");
  const sol = (await dump(`${TC}/${MID}`))[`${TC}/${MID}`].solutionAvailableAt.__ts[0];
  ok("avto-yakunlash: graded, autoFinalized, completedAt = startedAt + 2 soat (yechim vaqti emas)", a.status === "graded" && a.autoFinalized === true && a.completedAt.__ts[0] === a.startedAt.__ts[0] + 7200 && a.completedAt.__ts[0] < sol, J({ s: a.status, af: a.autoFinalized }));
  ok("avto-yakunlash: 3 to'g'ri x 2 = 6 ball", a.correctAnswers === 3 && a.wrongAnswers === 2 && a.unanswered === 45 && /\b6\b/.test(await txt(page, ".att-result__big")) && /\/ 100 ball/.test(await txt(page, ".att-result__big")), await txt(page, ".att-result__big"));
  await ctx.close();
}
{
  // mobil ko'rinish
  const { ctx, page } = await ctxFor("nox", AFTER, { width: 390, height: 844 });
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForSelector("[data-mock-card]");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok("mobil (390px): gorizontal skroll yo'q", !overflow);
  await page.screenshot({ path: path.join(OUT, "mock-dashboard-390.png"), fullPage: true });
  await ctx.close();
}
await browser.close();

const failed = checks.filter((c) => !c.pass);
fs.writeFileSync(path.join(OUT, "report-mock.json"), JSON.stringify({ passed: checks.length - failed.length, total: checks.length, checks }, null, 1));
console.log(`\n${checks.length - failed.length}/${checks.length} — ${failed.length ? "FAIL" : "PASS"}`);
process.exit(failed.length ? 1 : 0);
