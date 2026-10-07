// ==========================================================================
// Attestatsiya → Fizika: E2E — kun bo'yicha kirish (Day 1–3 bepul, e'lon qilingan Day 4+ — attestationAccess),
// tarix saqlanishi, admin ruxsat berish/olish va kirish rejimi (mavjud accessMode open|paid).
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8804 &
//   E2E_PORT=8804 node tools/attestatsiya-fizika/e2e/e2e_access.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-access.json
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
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8804}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const figBundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-figures.json"), "utf8"));
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
const T0 = new Date("2026-10-07T06:00:00Z");
const H = 3600000;
const at = (h) => ts(new Date(T0.getTime() + h * H));

// ---------------------------------------------------------------- seed (production'ga o'xshash)
const docs = { [CFG]: { ...opData(CFG), figureBackend: "firestore", accessMode: "paid" } };
const PUB = { 1: [-150, -126], 2: [-126, -102], 3: [-2, 13], 4: [-78, -54], 5: [-54, -30], 9: [-1, 13] };   // [publishedAt, solutionAvailableAt] soat
for (let n = 1; n <= 12; n++) {
  docs[`${TC}/${DID(n)}`] = opData(`${TC}/${DID(n)}`);
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${DID(n)}/${c}/v1`] = opData(`${TC}/${DID(n)}/${c}/v1`);
  if (PUB[n]) Object.assign(docs[`${TC}/${DID(n)}`], { status: "published", published: true, publishedAt: at(PUB[n][0]), publishedBy: "admin1", solutionAvailableAt: at(PUB[n][1]) });
}
for (const o of figBundle.ops) if (o.path.startsWith(`${TC}/${DID(4)}/`)) docs[o.path] = o.data;
const people = { admin1: { fullName: "Admin Bir", role: "admin" }, nox: { fullName: "Ruxsatsiz User" }, acc: { fullName: "Ruxsatli User", attestationAccess: true },
  hist: { fullName: "Tarixiy User" } };
for (const [u, p] of Object.entries(people)) docs[`users/${u}`] = { email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: at(-200), ...p };
// hist: open davrida Day 1, 2, 4, 5 ni topshirgan (ruxsati yo'q)
const keyOf = (n) => docs[`${TC}/${DID(n)}/keys/v1`];
function graded(uid, n, take, right) {
  const k = keyOf(n);
  const q = k.questionIds.filter((x) => x in k.answers).slice(0, take);
  const answers = Object.fromEntries(q.map((x, i) => [x, i < right ? k.answers[x] : (k.answers[x] === "A" ? "B" : "A")]));
  const c = right, w = take - right, s = k.scorableCount;
  return { userId: uid, testId: DID(n), dayNumber: n, testVersion: 1, attemptNumber: 1, kind: "official", status: "graded", questionCount: docs[`${TC}/${DID(n)}`].questionCount,
    startedAt: at(PUB[n][0] + 1), completedAt: at(PUB[n][0] + 1.5), timeSpentSeconds: 1800, answers, totalQuestions: docs[`${TC}/${DID(n)}`].questionCount,
    scorableQuestions: s, correctAnswers: c, wrongAnswers: w, unanswered: s - c - w, scorePercent: Math.round((100 * c) / s),
    correctIds: q.slice(0, right), wrongIds: q.slice(right), gradedAt: at(PUB[n][0] + 1.5) };
}
for (const [n, take, right] of [[1, 12, 8], [2, 10, 3], [4, 26, 24], [5, 30, 28]]) docs[`${AC}/hist__${DID(n)}`] = graded("hist", n, take, right);
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });
const histBefore = Object.fromEntries(Object.entries(await dump(`${AC}/hist__`)));

const browser = await chromium.launch();
async function ctxFor(uid, { viewport = { width: 1366, height: 900 }, theme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/t\.me/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "tg" }));
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
  page.writes = [];
  page.on("request", (r) => { if (r.url().endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); if (j.op === "commit") page.writes.push(...(j.writes || []).map((w) => w.path)); } catch { /* */ } } });
  return { ctx, page };
}
async function dash(page) {
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-days]") && !document.querySelector("[data-days]").hasAttribute("aria-busy"), null, { timeout: 20000 });
  return page.$$eval("[data-days] .att-day", (cs) => cs.map((c) => ({
    day: Number(c.querySelector(".att-day__num").textContent), state: c.dataset.state,
    lock: !!c.querySelector(".att-badge-lock"), note: c.querySelector(".att-access-note")?.textContent.trim() || "",
    start: !!c.querySelector('a[href^="fizika-test.html"]') && /Boshlash|Davom/.test(c.textContent),
    result: /Natija/.test(c.querySelector(".att-day__foot")?.textContent || ""), cta: c.querySelector("[data-access-cta]")?.href || null,
    score: c.querySelector(".att-score")?.textContent.trim() || null })));
}
const card = (cards, d) => cards.find((c) => c.day === d);
const lockedSection = (page) => page.$eval("[data-locked]", (el) => ({ hidden: el.hidden, days: [...el.querySelectorAll("li")].map((li) => li.textContent.trim()) }));

// ---------------------------------------------------------------- 1. ruxsatsiz user (paid rejim)
{
  const { ctx, page } = await ctxFor("nox");
  const cards = await dash(page);
  ok("1–3: Day 1, 2, 3 — to‘liq karta, qulfsiz", [1, 2, 3].every((d) => card(cards, d) && !card(cards, d).lock && card(cards, d).state !== "restricted"));
  ok("3: Day 3 (rasmiy muddat ochiq) — «Boshlash»", card(cards, 3).start);
  for (const d of [4, 5, 9]) {
    const c = card(cards, d);
    ok(`${d === 9 ? "6" : d}: Day ${d} — to‘liq karta + qulf, start yo‘q, «Kirish uchun ruxsat kerak»`, c && c.state === "restricted" && c.lock && !c.start && /Day 1–3 hamma uchun bepul/.test(c.note) && c.cta === "https://t.me/oliy_fizik", J(c));
  }
  const ls = await lockedSection(page);
  ok("8/9: e’lon qilinmagan kunlar (6–8, 10–32) mavjud bo‘limda, Day 9 u yerda emas", !ls.hidden && ls.days.includes("Day 6") && ls.days.includes("Day 10") && !ls.days.includes("Day 9") && !ls.days.includes("Day 4") && ls.days.length === 32 - 6, J(ls.days.slice(0, 5)));
  ok("10: yopiq karta e’lon qilinmagan kunga o‘xshamaydi (data-state=restricted, qulf belgisi)", card(cards, 4).state === "restricted" && !ls.days.includes("Day 4"));
  ok("bugungi test: Day 9 — yopiq holat, Telegram CTA", (await page.$eval("[data-today]", (e) => e.dataset.state)) === "restricted"
     && (await page.$eval("[data-today] .att-today__actions a", (a) => a.href)) === "https://t.me/oliy_fizik");
  await page.screenshot({ path: path.join(OUT, "access-nox-1366.png"), fullPage: true });
  // to'g'ridan-to'g'ri Day 4 test sahifasi
  page.writes.length = 0;
  await page.goto(B + "attestatsiya/fizika-test.html?day=4");
  await page.waitForSelector(".att-state");
  ok("Day 4 test sahifasi (to‘g‘ridan-to‘g‘ri) — aniq ruxsat xabari, start tugmasi yo‘q", /ruxsat kerak/i.test(await page.textContent(".att-state")) && !(await page.$("[data-start]")));
  ok("Day 4: urinish yaratilmadi, hech narsa yozilmadi", !(await dump(`${AC}/nox__`))[`${AC}/nox__${DID(4)}`] && !page.writes.some((p) => p.startsWith(AC)), J(page.writes));
  // yechimlar sahifasi
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=4");
  await page.waitForSelector(".att-state");
  ok("Day 4 yechimlari (vaqti o‘tgan) — ruxsatsiz: qulf xabari", /ruxsat kerak/i.test(await page.textContent(".att-state")));
  await page.goto(B + "attestatsiya/fizika-yechimlar.html");
  await page.waitForSelector(".att-day");
  const solList = await page.$$eval(".att-day", (cs) => cs.map((c) => ({ d: Number(c.querySelector(".att-day__num").textContent), st: c.dataset.state, link: !!c.querySelector("a") })));
  ok("yechimlar ro‘yxati: Day 1/2 ochiq, Day 4/5 qulf (havola yo‘q)", solList.find((x) => x.d === 1)?.link && solList.find((x) => x.d === 4)?.st === "restricted" && !solList.find((x) => x.d === 4)?.link, J(solList));
  // A–C: bepul kun — boshlash
  await page.goto(B + "attestatsiya/fizika-test.html?day=3");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  ok("C: ruxsatsiz user Day 3 ni boshlaydi (bepul kun)", (await dump(`${AC}/nox__${DID(3)}`))[`${AC}/nox__${DID(3)}`]?.status === "in_progress");
  ok("ruxsatsiz user: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
// K/L/M: to'g'ridan-to'g'ri Firestore
{
  const st = { userId: "nox", testId: DID(9), dayNumber: 9, testVersion: 1, attemptNumber: 1, kind: "official", status: "in_progress", startedAt: { __server: true }, questionCount: 32 };
  const r1 = await apiAs("nox", "commit", { writes: [{ type: "set", path: `${AC}/nox__${DID(9)}`, data: st }] });
  ok("L: ruxsatsiz user Day 9 urinishini to‘g‘ridan-to‘g‘ri yarata olmaydi", r1.ok === false, r1.code || "");
  const r2 = await apiAs("nox", "get", { path: `${TC}/${DID(9)}/versions/v1` });
  ok("K: ruxsatsiz user Day 9 savollarini to‘g‘ridan-to‘g‘ri o‘qiy olmaydi", r2.ok === false, r2.code || "");
  const r3 = await apiAs("nox", "commit", { writes: [{ type: "update", path: "users/nox", data: { attestationAccess: true } }] });
  ok("M: user o‘ziga ruxsat bera olmaydi", r3.ok === false, r3.code || "");
  const r4 = await apiAs("nox", "commit", { writes: [{ type: "update", path: CFG, data: { accessMode: "open" } }] });
  ok("M: user kirish rejimini o‘zgartira olmaydi", r4.ok === false, r4.code || "");
  const r5 = await apiAs("nox", "get", { path: `${TC}/${DID(4)}/solutions/v1` });
  ok("K: ruxsatsiz user Day 4 yechimini to‘g‘ridan-to‘g‘ri o‘qiy olmaydi", r5.ok === false);
}

// ---------------------------------------------------------------- 2. ruxsatli user
{
  const { ctx, page } = await ctxFor("acc");
  const cards = await dash(page);
  ok("11: ruxsatli user — Day 4/5/9 qulfsiz, Day 9 «Boshlash»", [4, 5, 9].every((d) => card(cards, d) && !card(cards, d).lock) && card(cards, 9).start, J(cards.filter((c) => c.day >= 4)));
  await page.goto(B + "attestatsiya/fizika-test.html?day=9");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  ok("7/G–I: ruxsatli user Day 9 ni boshlaydi (mavjud oqim)", (await dump(`${AC}/acc__${DID(9)}`))[`${AC}/acc__${DID(9)}`]?.status === "in_progress" && !!(await page.$("[data-calc]")));
  ok("ruxsatli user: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 3. tarix (ruxsatsiz, open davrida topshirgan)
{
  const { ctx, page } = await ctxFor("hist");
  const cards = await dash(page);
  ok("tarix: Day 1/2/4/5 — bajarilgan, ballar urinishdagi qiymat bilan bir xil",
     [1, 2, 4, 5].every((d) => card(cards, d)?.state === "done" && card(cards, d).score === `${histBefore[`${AC}/hist__${DID(d)}`].scorePercent}%` && card(cards, d).result),
     J([1, 2, 4, 5].map((d) => card(cards, d)?.score)));
  ok("tarix: Day 9 (urinish yo‘q) — qulf", card(cards, 9).state === "restricted");
  await page.goto(B + "attestatsiya/fizika-test.html?day=4");
  await page.waitForSelector(".att-review .att-rev", { timeout: 20000 });
  const st = await page.$$eval(".att-rev", (cs) => cs.map((c) => c.dataset.status));
  const h4 = histBefore[`${AC}/hist__${DID(4)}`];
  ok("tarix: Day 4 Result Review ishlaydi (32 karta, to‘g‘ri/noto‘g‘ri soni urinishdagidek)", st.length === docs[`${TC}/${DID(4)}`].questionCount
     && st.filter((x) => x === "correct").length === h4.correctAnswers && st.filter((x) => x === "wrong").length === h4.wrongAnswers, J({ c: st.filter((x) => x === "correct").length }));
  const figs = await page.$$eval(".att-rev .att-fig", (f) => f.length);
  if (figs) {
    for (const f of await page.$$(".att-rev .att-fig")) { await f.scrollIntoViewIfNeeded(); }
    await page.waitForTimeout(1500);
    ok("tarix: Day 4 review rasmlari yuklanadi", await page.$$eval(".att-rev .att-fig", (f) => f.every((x) => x.dataset.state === "ready")), String(figs));
  }
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=4");
  await page.waitForSelector(".att-solq", { timeout: 15000 });
  ok("tarix: Day 4 yechimlari (o‘z urinishi bor) ochiq", (await page.$$(".att-solq")).length > 0);
  await page.goto(B + "attestatsiya/fizika-natijalar.html");
  await page.waitForSelector(".att-history");
  const hist = await page.$$eval(".att-history tbody tr", (r) => r.map((x) => x.textContent.replace(/\s+/g, " ")));
  ok("tarix: natijalar sahifasi — 4 ta urinish, ballar saqlangan", hist.length === 4 && [1, 2, 4, 5].every((d) => hist.some((t) => t.includes(`Day ${d}`) && t.includes(`${histBefore[`${AC}/hist__${DID(d)}`].scorePercent}%`))), J(hist));
  ok("tarix: urinishlar baytma-bayt o‘zgarmagan", J(Object.fromEntries(Object.entries(await dump(`${AC}/hist__`)))) === J(histBefore));
  ok("tarix: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 4. admin: ruxsat berish/olish, rejim, statistika
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/access.html");
  await page.click('[data-tab="attestationAccess"]');
  await page.waitForFunction(() => document.querySelector("[data-access-list]")?.getAttribute("aria-busy") === "false");
  const list = await page.$$eval("[data-access-list] li b", (b) => b.map((x) => x.textContent.trim()));
  ok("admin Access: «Attestatsiya — Fizika» tab — ruxsatli userlar ro‘yxati", J(list) === J(["Ruxsatli User"]), J(list));
  await page.goto(B + "admin/user.html?id=nox");
  await page.waitForSelector('[data-access="attestationAccess"]:not([disabled])');
  await page.click('[data-access="attestationAccess"]');
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => document.querySelector('[data-access="attestationAccess"]').getAttribute("aria-checked") === "true");
  const u = (await dump("users/nox"))["users/nox"];
  ok("admin: user sahifasida ruxsat berildi (attestationAccess=true), boshqa maydonlar o‘zgarmadi", u.attestationAccess === true && u.fullAccess === false && !u.role);
  // rejim tugmasi
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-access-mode]:not([disabled])");
  ok("admin: kirish rejimi — paid ko‘rsatilgan", /paid/.test(await page.textContent("[data-access-mode-info]")) && (await page.textContent('[data-stat="access"]')).trim() === "paid");
  // tarixiy urinishlar admin statistikasida
  await page.click(`[data-action="view-attempts"][data-test-id="${DID(4)}"]`);
  await page.waitForFunction((id) => { const b = document.querySelector(`[data-att-body="${id}"]`); return b && !b.hasAttribute("aria-busy") && !/Yuklanmoqda/.test(b.textContent); }, DID(4));
  ok("admin Urinishlar: ruxsatsiz userning tarixiy Day 4 urinishi ko‘rinadi", /Tarixiy User/.test(await page.textContent(`[data-att-body="${DID(4)}"]`)));
  await page.click(`[data-qstats="${DID(4)}"]`);
  await page.waitForFunction(() => /^\d+$/.test(document.querySelector("[data-qstats-n]")?.textContent.trim() || ""));
  ok("admin Savollar statistikasi: tarixiy urinish kiradi (N = 1)", (await page.textContent("[data-qstats-n]")).trim() === "1");
  ok("admin: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await ctxFor("nox");
  const cards = await dash(page);
  ok("ruxsat berilgandan keyin: nox uchun Day 4/5/9 ochiq", [4, 5, 9].every((d) => !card(cards, d).lock));
  await ctx.close();
}
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/user.html?id=nox");
  await page.waitForSelector('[data-access="attestationAccess"][aria-checked="true"]:not([disabled])');
  await page.click('[data-access="attestationAccess"]');
  await page.click(".of-admin-confirm .of-btn--danger, .of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => document.querySelector('[data-access="attestationAccess"]').getAttribute("aria-checked") === "false");
  // open rejimga qaytarish va yana paid
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-access-mode]:not([disabled])");
  await page.click("[data-access-mode]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /open/.test(document.querySelector("[data-access-mode-info]").textContent));
  ok("admin: rejim paid → open", (await dump(CFG))[CFG].accessMode === "open");
  await ctx.close();
}
{
  const { ctx, page } = await ctxFor("nox");
  const cards = await dash(page);
  ok("open rejim: ruxsatsiz user uchun ham hammasi ochiq (avvalgi xatti-harakat)", [4, 5, 9].every((d) => !card(cards, d).lock) && card(cards, 9).start);
  await ctx.close();
}
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-access-mode]:not([disabled])");
  await page.click("[data-access-mode]");
  await page.click(".of-admin-confirm .of-btn--danger, .of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /paid/.test(document.querySelector("[data-access-mode-info]").textContent));
  ok("admin: rejim open → paid (tasdiq bilan)", (await dump(CFG))[CFG].accessMode === "paid");
  await ctx.close();
}
{
  const { ctx, page } = await ctxFor("nox");
  const cards = await dash(page);
  ok("ruxsat olib tashlangandan keyin: Day 4/5/9 yana qulf", [4, 5, 9].every((d) => card(cards, d).lock));
  await ctx.close();
}

// ---------------------------------------------------------------- responsive + tema (ruxsatsiz dashboard)
for (const [vp, theme] of [390, 768, 1366].map((w) => ({ width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 })).flatMap((v) => [[v, "light"], [v, "dark"]])) {
  const { ctx, page } = await ctxFor("nox", { viewport: vp, theme });
  await dash(page);
  const g = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const lockCards = [...document.querySelectorAll('.att-day[data-state="restricted"]')];
    const today = document.querySelector("[data-today]").getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - W, cards: lockCards.length,
      inside: lockCards.every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= W + 1; }) && today.right <= W + 1,
      cta: lockCards.every((c) => { const r = c.querySelector("[data-access-cta]").getBoundingClientRect(); return r.right <= W + 1 && r.height >= 32; }),
      theme: document.documentElement.dataset.theme };
  });
  ok(`${vp.width}px ${theme}: yopiq kartalar to‘liq, overflow yo‘q, CTA ekranda`, g.over <= 0 && g.cards === 3 && g.inside && g.cta && g.theme === theme, J(g));
  await page.locator('.att-day[data-state="restricted"]').first().screenshot({ path: path.join(OUT, `access-card-${vp.width}-${theme}.png`) });
  ok(`${vp.width}px ${theme}: konsol xatolari yo‘q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-access.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
