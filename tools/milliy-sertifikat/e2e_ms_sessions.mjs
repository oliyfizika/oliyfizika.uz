// ==========================================================================
// Milliy sertifikat: yopiq (sessiyali) mock testlar + Rasch — E2E.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8798 &
//   E2E_PORT=8798 node tools/milliy-sertifikat/e2e_ms_sessions.mjs
// Har bir Firestore so'rovi repo firestore.rules orqali tekshiriladi (lokal interpretator). exit 1 — FAIL.
// Oqim: katalog (ochiq/yopiq/mashq/eski natija) → sessiyada test yechish (natijasiz) → admin «Yakunlash va natijani hisoblash»
//       → foydalanuvchi natijasi → sertifikat (rasm yuklash, PNG/PDF) → QR tekshirish sahifasi.
// ==========================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SDK = path.join(ROOT, "tools/attestatsiya-fizika/e2e/sdk");
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "ms-sessions-"));
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8798}/`;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });

const T0 = new Date("2026-11-20T06:00:00Z");          // 11:00 Toshkent
const OPEN = new Date(T0.getTime() - 3600000);
const CLOSE = new Date(T0.getTime() + 6 * 3600000);
const SID = "mock-test-3-20261120-e2e1";
const test3 = JSON.parse(fs.readFileSync(path.join(ROOT, "milliy-sertifikat/mock-testlar/data/mock-test-3.json"), "utf8"));

// Sintetik ishtirokchilar: k-ishtirokchi birinchi n ta bandni to'g'ri, qolganini noto'g'ri belgilaydi
function answersFor(nCorrect) {
  const out = {};
  let k = 0;
  test3.questions.forEach((q, i) => {
    if (q.type === "mcq") {
      const good = k++ < nCorrect;
      out[String(i)] = good ? q.answer : (q.answer === "A" ? "B" : "A");
      return;
    }
    const parts = {};
    q.parts.forEach((p) => { parts[p.key] = k++ < nCorrect ? String(p.answer) : "123456"; });
    out[String(i)] = parts;
  });
  return out;
}

const docs = {
  "users/admin1": { fullName: "Admin Bir", role: "admin", email: "admin1@example.com" },
  "users/uid1": { fullName: "Sarvar Amirov", firstName: "Sarvar", lastName: "Amirov", email: "uid1@example.com" },
  [`msMockSessions/${SID}`]: { testId: "mock-test-3", testNumber: 3, testTitle: test3.title, opensAt: ts(OPEN), closesAt: ts(CLOSE), durationMinutes: 180, status: "scheduled", createdBy: "admin1" },
  "msMockSessions/mock-test-6-20261201-e2e2": { testId: "mock-test-6", testNumber: 6, testTitle: "M6", opensAt: ts(new Date("2026-12-01T04:00:00Z")), closesAt: ts(new Date("2026-12-01T16:00:00Z")), durationMinutes: 180, status: "scheduled" },
  "msMockSettings/config": { practiceTests: ["mock-test-1"] },
};
const synth = [10, 18, 24, 30, 36, 40, 45, 52, 5, 28];
synth.forEach((n, j) => {
  const uid = `p${j + 1}`;
  docs[`users/${uid}`] = { fullName: `Ishtirokchi ${j + 1}`, firstName: `Ism${j + 1}`, lastName: `Familiya${j + 1}`, email: `${uid}@example.com` };
  docs[`msMockAttempts/${SID}__${uid}`] = { uid, name: `Ishtirokchi ${j + 1}`, sessionId: SID, testId: "mock-test-3", status: j === 9 ? "in_progress" : "submitted",
    startedAt: ts(new Date(OPEN.getTime() + j * 60000)), updatedAt: ts(new Date(OPEN.getTime() + j * 60000 + 3600000)), answers: answersFor(n) };
});
// javob bermagan ishtirokchi (hisobdan chiqariladi)
docs[`users/p99`] = { fullName: "Bo'sh Ishtirokchi", email: "p99@example.com" };
docs[`msMockAttempts/${SID}__p99`] = { uid: "p99", name: "Bo'sh", sessionId: SID, testId: "mock-test-3", status: "submitted", startedAt: ts(OPEN), answers: {} };

await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, init = {}, when = T0) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript(([u, extra]) => {
    if (u) localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u }));
    for (const [k, v] of Object.entries(extra)) if (localStorage.getItem(k) == null) localStorage.setItem(k, v);
  }, [uid, init]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(when);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  return { ctx, page };
}

// Eski mashq natijasi (Mock №2) — test yopiq bo'lsa ham ko'rinishi kerak
const oldKey = "oliyfizika:mock:uid1:mock-test-2:state:v1";
const oldState = { schemaVersion: 1, testId: "mock-test-2", attemptId: "old-attempt-0001", status: "SUBMITTED", uid: "uid1", name: "Sarvar Amirov",
  startTs: T0.getTime() - 86400000 * 5, deadlineTs: T0.getTime() - 86400000 * 5 + 3600000, endTs: T0.getTime() - 86400000 * 5 + 1800000,
  current: 0, answers: { 0: "A" }, marked: {}, focusLoss: 0, submitted: true, autoSubmitted: false, recorded: true };

// ---------------------------------------------------------------- 1. katalog
{
  const { ctx, page } = await ctxFor("uid1", { [oldKey]: JSON.stringify(oldState) });
  await page.goto(B + "milliy-sertifikat/mock-testlar/");
  await page.waitForSelector("[data-mock-list]:not([aria-busy])", { timeout: 20000 });
  const card = async (n) => page.evaluate((n) => [...document.querySelectorAll("[data-mock-list] article")].find((a) => a.textContent.includes(`№${n}`))?.innerText || "", n);
  const c3 = await card(3);
  ok("Katalog: Mock №3 — ochiq sessiya", /Ochiq/.test(c3) && /Testni boshlash/i.test(c3), c3.replace(/\s+/g, " ").slice(0, 120));
  ok("Katalog: ochiq sessiya birinchi turadi", (await page.textContent("[data-mock-list] li:first-child")).includes("№3"));
  ok("Katalog: Mock №1 — erkin mashq", /Erkin mashq/.test(await card(1)));
  ok("Katalog: Mock №5 — yopiq", /Yopiq/.test(await card(5)));
  ok("Katalog: Mock №6 — kelgusi sessiya sanasi", /Ochiladi: 01\.12, 09:00/.test(await card(6)), (await card(6)).replace(/\s+/g, " ").slice(0, 100));
  ok("Katalog: Mock №2 — eski natija saqlangan (Yakunlangan)", /Yakunlangan/.test(await card(2)) && /Natijani ko/.test(await card(2)));
  ok("Katalogda JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await page.screenshot({ path: path.join(OUT, "01-katalog.png"), fullPage: false });

  // eski natija
  await page.goto(B + "milliy-sertifikat/mock-testlar/test.html?id=mock-test-2");
  await page.waitForSelector("#resultScreen:not([hidden])", { timeout: 15000 });
  ok("Yopiq mock: eski mashq natijasi ko‘rinadi", /Test yakunlandi/.test(await page.textContent("#resultScreen")));
  // yangi urinish yopiq
  await page.click("#resultScreen .btn-danger-ghost");
  await page.waitForSelector("#messageScreen:not([hidden])");
  ok("Yopiq mock: «Yangi urinish» yopiq xabari", /hozircha yopiq/.test(await page.textContent("#messageScreen")));
  ok("Eski natija o‘chmadi", !!(await page.evaluate((k) => localStorage.getItem(k), oldKey)));

  // yopiq mock
  await page.goto(B + "milliy-sertifikat/mock-testlar/test.html?id=mock-test-5");
  await page.waitForSelector("#messageScreen:not([hidden])", { timeout: 15000 });
  ok("Yopiq mock (№5): yopiq xabari, start tugmasi yo‘q", /hozircha yopiq/.test(await page.textContent("#messageScreen")) && !(await page.$("#startScreen:not([hidden])")));

  // erkin mashq — eski rejim
  await page.goto(B + "milliy-sertifikat/mock-testlar/test.html?id=mock-test-1");
  await page.waitForSelector("#startScreen:not([hidden])", { timeout: 15000 });
  ok("Erkin mashq (№1): start ekrani, sessiya izohi yo‘q", !(await page.$(".session-notice")));
  await ctx.close();
}

// ---------------------------------------------------------------- 2. sessiyada test yechish
{
  const made = await ctxFor("uid1");
  const ctx = made.ctx;
  let page = made.page;
  await page.goto(B + `milliy-sertifikat/mock-testlar/test.html?id=mock-test-3&session=${SID}`);
  await page.waitForSelector("#startScreen:not([hidden])", { timeout: 15000 });
  ok("Sessiya: start ekranida «Rasmiy sessiya» izohi", /Rasmiy sessiya/.test(await page.textContent(".session-notice")));
  ok("Sessiya: «Saqlangan testni o‘chirish» yo‘q", !(await page.$("#startScreen .btn-danger-ghost")));
  await page.click("#startScreen .btn-primary");
  await page.waitForSelector("#examScreen:not([hidden])");
  let d = (await dump(`msMockAttempts/${SID}__uid1`))[`msMockAttempts/${SID}__uid1`];
  ok("START: urinish serverda in_progress, startedAt server vaqti", d && d.status === "in_progress" && !!d.startedAt);
  // UI orqali 3 ta savolga to'g'ri javob
  for (let i = 0; i < 3; i++) {
    const L = test3.questions[i].answer;
    await page.click(`#qContent .option:nth-child(${"ABCDEF".indexOf(L) + 1})`);
    await page.click("#nextBtn");
  }
  // qolganini qurilmadagi holat orqali (resume yo'lini ham sinaydi): 46 band to'g'ri
  const all = answersFor(46);
  // sahifani yopamiz (beforeunload holatni qayta yozmasin), qurilmadagi holatni boshqa sahifada o'zgartiramiz
  await page.waitForTimeout(300);
  const page2 = await ctx.newPage();
  await page2.clock.setSystemTime(T0);
  page2.errs = [];
  page2.on("pageerror", (e) => page2.errs.push(e.message));
  await page.close({ runBeforeUnload: false });
  await page2.goto(B + "milliy-sertifikat/mock-testlar/sertifikat.html");
  await page2.evaluate(([sid, ans]) => {
    const k = `oliyfizika:mock:uid1:session-${sid}:state:v1`;
    const s = JSON.parse(localStorage.getItem(k));
    s.answers = Object.fromEntries(Object.entries(ans).map(([i, v]) => [Number(i), v]));
    localStorage.setItem(k, JSON.stringify(s));
  }, [SID, all]);
  page = page2;
  await page.goto(B + `milliy-sertifikat/mock-testlar/test.html?id=mock-test-3&session=${SID}`);
  await page.waitForSelector("#startScreen:not([hidden])", { timeout: 15000 });
  await page.click("#startScreen .btn-primary");
  await page.waitForSelector("#examScreen:not([hidden])");
  ok("Davom ettirish: javoblar tiklandi", (await page.textContent("#answerCount")).startsWith("45"), await page.textContent("#answerCount"));
  await page.click("#finishBtn");
  await page.click(".confirm-modal .btn-danger");
  await page.waitForSelector("#resultScreen:not([hidden])");
  const res = await page.textContent("#resultScreen");
  ok("Topshirilgandan keyin ball KO‘RSATILMAYDI", /Javoblaringiz qabul qilindi/.test(res) && !/to‘g‘ri band/.test(res) && !/Rasch modeli bo‘yicha natija/.test(res));
  d = (await dump(`msMockAttempts/${SID}__uid1`))[`msMockAttempts/${SID}__uid1`];
  ok("Server: submitted, xom javoblar saqlangan, natija yo‘q", d.status === "submitted" && Object.keys(d.answers).length === 45 && !d.result, `${d.status}, ${Object.keys(d.answers || {}).length} javob`);
  ok("Server: to‘g‘ri javoblar yuborilmagan (faqat foydalanuvchi javobi)", JSON.stringify(d).indexOf("correctAnswer") < 0);
  // qayta ochilganda ham natijasiz
  await page.reload();
  await page.waitForSelector("#resultScreen:not([hidden])", { timeout: 15000 });
  ok("Qayta ochilganda: natija kutilmoqda", /Javoblaringiz qabul qilindi/.test(await page.textContent("#resultScreen")));
  // foydalanuvchi o'ziga natija yoza olmaydi
  const hack = await post("__mock/api", { op: "update", uid: "uid1", path: `msMockAttempts/${SID}__uid1`, data: { status: "published", result: { score: 75 } } });
  ok("Foydalanuvchi o‘ziga natija yozolmaydi (Rules)", hack.ok === false, hack.code || "");
  ok("Test sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await page.goto(B + "milliy-sertifikat/mock-testlar/");
  await page.waitForSelector("[data-mock-list]:not([aria-busy])");
  ok("Katalog: «natija kutilmoqda»", /natija kutilmoqda/.test(await page.textContent("[data-mock-list] li:first-child")));
  await ctx.close();
}

// ---------------------------------------------------------------- 3. admin: yakunlash va natijani hisoblash
const T1 = new Date(CLOSE.getTime() + 4 * 3600000);
await post("__mock/clock", { iso: T1.toISOString() });
{
  const { ctx, page } = await ctxFor("admin1", {}, T1);
  await page.goto(B + "admin/milliy-sertifikat-sessiyalar.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])", { timeout: 20000 });
  await page.waitForSelector(`[data-finalize="${SID}"]`, { timeout: 15000 });
  const row = await page.textContent(`[data-row="${SID}"]`);
  ok("Admin: sessiya «yopilgan • yakunlanmagan», 12 ishtirokchi", /yopilgan/.test(row) && /12/.test(row), row.replace(/\s+/g, " ").slice(0, 160));
  ok("Admin: erkin mashq — Mock №1 belgilangan", await page.isChecked('[data-practice] input[value="mock-test-1"]'));
  await page.click(`[data-finalize="${SID}"]`);
  await page.click(".of-modal__actions .of-btn >> nth=0");
  await page.waitForSelector(`[data-detail="${SID}"]:not([hidden]) table`, { timeout: 20000 });
  const sess = (await dump(`msMockSessions/${SID}`))[`msMockSessions/${SID}`];
  ok("Sessiya finalized, statistika yozildi", sess.status === "finalized" && sess.stats?.participants === 11 && sess.stats?.excluded === 1, JSON.stringify(sess.stats?.levels));
  const atts = await dump(`msMockAttempts/${SID}__`);
  const pub = Object.values(atts).filter((a) => a.status === "published");
  ok("Barcha 12 urinish e’lon qilindi", pub.length === 12, String(pub.length));
  const u1 = atts[`msMockAttempts/${SID}__uid1`].result;
  ok("uid1: Rasch ball, daraja, foiz, bo‘limlar", Number.isFinite(u1.score) && u1.score <= 75 && !!u1.level && u1.percent > 0 && u1.sections.length >= 4, `${u1.score} ${u1.level} ${u1.percent}% raw ${u1.raw}/${u1.maxRaw}`);
  const secSum = Math.round(u1.sections.reduce((s, x) => s + x.score, 0) * 100) / 100;
  ok("Bo‘limlar yig‘indisi = umumiy ball", Math.abs(secSum - u1.score) < 0.01, `${secSum} vs ${u1.score}`);
  const scored = pub.map((a) => a.result).filter((r) => !r.excluded);
  const sortedByRaw = scored.slice().sort((a, b) => a.raw - b.raw);
  ok("Ball xom ball bo‘yicha monoton", sortedByRaw.every((r, i) => i === 0 || r.score >= sortedByRaw[i - 1].score));
  ok("Javob bermagan ishtirokchi hisobdan chiqarilgan", atts[`msMockAttempts/${SID}__p99`].result.excluded === true);
  ok("Topshirmagan (in_progress) ishtirokchi qoralamasi baholandi", atts[`msMockAttempts/${SID}__p10`].result.submitted === false && Number.isFinite(atts[`msMockAttempts/${SID}__p10`].result.score));
  const certs = await dump("msMockCertificates/");
  const withLevel = scored.filter((r) => r.level).length;
  ok("Darajasi borlarga sertifikat yaratildi", Object.keys(certs).length === withLevel && !!u1.certNo && !!certs[`msMockCertificates/${u1.certNo}`], `${Object.keys(certs).length} ta, uid1: ${u1.certNo}`);
  ok("Sertifikatda familiya/ism profildan", certs[`msMockCertificates/${u1.certNo}`]?.lastName === "Amirov" && certs[`msMockCertificates/${u1.certNo}`]?.firstName === "Sarvar");
  ok("Admin natijalar jadvali: 12 qator", (await page.$$(`[data-detail="${SID}"] tbody tr`)).length === 12);
  const audit = await dump("adminAuditLog/");
  ok("Amallar jurnaliga yozildi", Object.values(audit).some((a) => a.action === "ms-session-finalize"));
  await page.screenshot({ path: path.join(OUT, "02-admin.png"), fullPage: true });

  // Qayta hisoblash — sertifikat raqami o'zgarmaydi
  await page.click(`[data-finalize="${SID}"][data-again]`);
  await page.click(".of-modal__actions .of-btn >> nth=0");
  await page.waitForFunction(() => /e’lon qilindi/.test(document.querySelector(".of-toast-region")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const again = (await dump(`msMockAttempts/${SID}__uid1`))[`msMockAttempts/${SID}__uid1`].result;
  ok("Qayta hisoblash: sertifikat raqami saqlandi", again.certNo === u1.certNo && Object.keys(await dump("msMockCertificates/")).length === withLevel);

  // yangi sessiya formasi
  await page.selectOption("#msTest", "mock-test-4");
  await page.fill("#msOpen", "2026-12-05T09:00");
  await page.fill("#msClose", "2026-12-05T21:00");
  await page.click("[data-new-form] button[type=submit]");
  await page.click(".of-modal__actions .of-btn >> nth=0");
  await page.waitForFunction(() => document.querySelectorAll("[data-row]").length === 3, null, { timeout: 10000 }).catch(() => {});
  const s4 = Object.values(await dump("msMockSessions/")).find((s) => s.testId === "mock-test-4");
  ok("Yangi sessiya: Toshkent 09:00 → 04:00 UTC", s4 && new Date(s4.opensAt.__ts ? s4.opensAt.__ts[0] * 1000 : s4.opensAt).toISOString().startsWith("2026-12-05T04:00"), JSON.stringify(s4?.opensAt));
  ok("Admin sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 4. foydalanuvchi: natija va sertifikat
{
  const { ctx, page } = await ctxFor("uid1", {}, T1);
  await page.goto(B + `milliy-sertifikat/mock-testlar/test.html?id=mock-test-3&session=${SID}`);
  await page.waitForSelector("#resultScreen:not([hidden]) .rasch-hero", { timeout: 15000 });
  const t = await page.textContent("#resultScreen");
  ok("Natija sahifasi: Rasch ball, daraja, bo‘limlar", /Rasch modeli bo‘yicha natija/.test(t) && /Bo‘limlar bo‘yicha natija/.test(t) && /Mexanika/.test(t));
  ok("Natija sahifasi: to‘g‘ri javoblar ko‘rsatiladi", /To‘g‘ri javob/.test(t));
  await page.screenshot({ path: path.join(OUT, "03-natija.png") });
  await page.click("text=Sertifikatni ochish");
  await page.waitForSelector("[data-canvas]", { timeout: 15000 });
  // rasm yuklash (PNG 400×500)
  const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 500; const x = c.getContext("2d"); x.fillStyle = "#3a6"; x.fillRect(0, 0, 400, 500); x.fillStyle = "#fdd"; x.beginPath(); x.arc(200, 190, 90, 0, 7); x.fill(); return c.toDataURL("image/png").split(",")[1]; });
  const photoPath = path.join(OUT, "photo.png");
  fs.writeFileSync(photoPath, Buffer.from(png, "base64"));
  await page.setInputFiles("#certPhoto", photoPath);
  await page.waitForFunction(() => /saqlandi/.test(document.querySelector("[data-msg]")?.textContent || ""), null, { timeout: 15000 });
  await page.fill("#certPatr", "Erkin o‘g‘li");
  await page.click("[data-save]");
  await page.waitForFunction(() => /Saqlandi/.test(document.querySelector("[data-msg]")?.textContent || ""), null, { timeout: 15000 });
  const prof = (await dump("msMockProfiles/uid1"))["msMockProfiles/uid1"];
  ok("Rasm va otasining ismi saqlandi (JPEG data URL, ≤ 350 KB)", prof && prof.photo.startsWith("data:image/jpeg;base64,") && prof.photo.length < 360000 && prof.patronymic === "Erkin o‘g‘li", `${prof?.photo?.length} belgi`);
  // noto'g'ri fayl turi
  const txt = path.join(OUT, "bad.txt");
  fs.writeFileSync(txt, "salom");
  await page.setInputFiles("#certPhoto", { name: "bad.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await page.waitForFunction(() => /Faqat JPG/.test(document.querySelector("[data-msg]")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
  ok("Noto‘g‘ri fayl turi rad etildi", /Faqat JPG/.test(await page.textContent("[data-msg]")));
  const [dpng] = await Promise.all([page.waitForEvent("download"), page.click("[data-png]")]);
  const fpng = path.join(OUT, dpng.suggestedFilename());
  await dpng.saveAs(fpng);
  const pb = fs.readFileSync(fpng);
  ok("PNG yuklandi (1240×1754)", pb.slice(1, 4).toString() === "PNG" && pb.readUInt32BE(16) === 1240 && pb.readUInt32BE(20) === 1754, dpng.suggestedFilename());
  const [dpdf] = await Promise.all([page.waitForEvent("download"), page.click("[data-pdf]")]);
  const fpdf = path.join(OUT, dpdf.suggestedFilename());
  await dpdf.saveAs(fpdf);
  const pdf = fs.readFileSync(fpdf).toString("latin1");
  ok("PDF yuklandi (A4, JPEG)", pdf.startsWith("%PDF-1.4") && /MediaBox \[0 0 595\.28 841\.89\]/.test(pdf) && /DCTDecode/.test(pdf) && pdf.trimEnd().endsWith("%%EOF"), `${fs.statSync(fpdf).size} bayt`);
  ok("Sertifikat sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  void zlib;
  ctx.cert = (await dump(`msMockAttempts/${SID}__uid1`))[`msMockAttempts/${SID}__uid1`].result.certNo;
  const certNo = ctx.cert;
  await ctx.close();

  // boshqa foydalanuvchi rasmni o'qiy olmaydi
  const peek = await post("__mock/api", { op: "get", uid: "p1", path: "msMockProfiles/uid1" });
  ok("Boshqa foydalanuvchi rasmni o‘qiy olmaydi", peek.ok === false, peek.code || "");

  // QR tekshirish — mehmon
  const g = await ctxFor(null, {}, T1);
  await g.page.goto(B + `milliy-sertifikat/mock-testlar/sertifikat.html?cert=${certNo}`);
  await g.page.waitForSelector("[data-verified]", { timeout: 15000 });
  const v = await g.page.textContent("[data-verified]");
  ok("QR tekshirish: mehmon «Haqiqiy sertifikat» ko‘radi", /Haqiqiy sertifikat/.test(v) && /Amirov Sarvar/.test(v) && v.includes(certNo));
  await g.page.goto(B + "milliy-sertifikat/mock-testlar/sertifikat.html?cert=OF26-000000");
  await g.page.waitForSelector(".cert-verify h2");
  ok("Noto‘g‘ri raqam: topilmadi", /topilmadi/.test(await g.page.textContent(".cert-verify h2")));
  await g.ctx.close();
}

// sertifikat ko'rinishini rasmga olish (vizual tekshiruv uchun)
{
  const { ctx, page } = await ctxFor("uid1", {}, T1);
  await page.goto(B + `milliy-sertifikat/mock-testlar/sertifikat.html?session=${SID}`);
  await page.waitForSelector("[data-canvas]");
  await page.waitForTimeout(800);
  const dataUrl = await page.evaluate(() => document.querySelector("[data-canvas]").toDataURL("image/png"));
  fs.writeFileSync(path.join(OUT, "04-sertifikat.png"), Buffer.from(dataUrl.split(",")[1], "base64"));
  await page.screenshot({ path: path.join(OUT, "05-sertifikat-sahifa.png") });
  await ctx.close();
}

await browser.close();
const fails = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - fails}/${checks.length} PASS — ${OUT}`);
process.exit(fails ? 1 : 0);
