// ==========================================================================
// Attestatsiya → Fizika: E2E — admin «Urinishlar → Ko‘rish» (F.I.Sh., kun bo'yicha panel, toggle, versiya) va Excel eksport.
// Seed: Day 1 v2 (published), Day 2 v2 (published; v1 + v2 urinishlari), Day 3 (published, urinishsiz), Day 4 draft.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8798 &
//   E2E_PORT=8798 node tools/attestatsiya-fizika/e2e/e2e_attempts_admin.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-attempts-admin.json; exit 1 — biror tekshiruv FAIL.
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/npm-tools/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const PRIV = path.join(ROOT, "_private/attestatsiya-fizika");
const OUT = path.join(PRIV, "e2e");
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8798}/`;
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
const [D1, D2, D3, D4] = [1, 2, 3, 4].map((n) => `att-fizika-day-0${n}`);
const T0 = new Date("2026-10-06T06:00:00Z");
const H = 3600000;
const at = (h) => ts(new Date(T0.getTime() + h * H));

// ---------------------------------------------------------------- seed
const docs = { "attestationPhysicsSettings/config": { ...opData("attestationPhysicsSettings/config"), figureBackend: "firestore" } };
for (const id of [D1, D2, D3, D4]) {
  docs[`${TC}/${id}`] = opData(`${TC}/${id}`);
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${id}/${c}/v1`] = opData(`${TC}/${id}/${c}/v1`);
}
for (const id of [D1, D2]) {
  for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${id}/${c}/v2`] = { ...opData(`${TC}/${id}/${c}/v1`), version: 2 };
  Object.assign(docs[`${TC}/${id}`], { currentVersion: 2 });
}
for (const id of [D1, D2, D3]) Object.assign(docs[`${TC}/${id}`], { status: "published", published: true, publishedAt: at(-5), publishedBy: "admin1", solutionAvailableAt: at(13) });
const profiles = {
  admin1: { fullName: "Admin Bir", role: "admin" },
  uid1: { fullName: "Sarvar Amirov", firstName: "Sarvar", lastName: "Amirov" },
  uid2: { fullName: "Ali Valiyev" },                                       // faqat fullName
  uid5: { fullName: "Bobur Toshmatov" },
  uid6: { fullName: "Dilnoza Karimova" },
  uid7: { fullName: "Jarayondagi User" },
  user1: { fullName: "Oddiy User" },
};                                                                           // uid3 — profil yo'q (fallback)
for (const [u, p] of Object.entries(profiles)) docs[`users/${u}`] = { email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0), ...p };
const att = (uid, testId, day, v, score, c, w, u, sec, over = {}) => ({ userId: uid, testId, dayNumber: day, testVersion: v, attemptNumber: 1, kind: "official",
  status: "graded", questionCount: 32, startedAt: at(-4), completedAt: ts(new Date(T0.getTime() - 4 * H + sec * 1000)), timeSpentSeconds: sec,
  answers: {}, scorableQuestions: c + w + u, correctAnswers: c, wrongAnswers: w, unanswered: u, scorePercent: score, correctIds: [], wrongIds: [], ...over });
const A = {
  [`${AC}/uid1__${D2}`]: att("uid1", D2, 2, 2, 95, 29, 1, 1, 5075),
  [`${AC}/uid2__${D2}`]: att("uid2", D2, 2, 2, 88, 27, 3, 1, 3600),
  [`${AC}/uid3__${D2}`]: att("uid3", D2, 2, 2, 70, 22, 6, 3, 2400),
  [`${AC}/uid7__${D2}`]: { ...att("uid7", D2, 2, 2, 0, 0, 0, 0, 0), status: "in_progress", completedAt: null, timeSpentSeconds: null },
  [`${AC}/uid5__${D2}`]: att("uid5", D2, 2, 1, 60, 18, 8, 5, 3000),         // Day 2 v1
  [`${AC}/uid6__${D1}`]: att("uid6", D1, 1, 2, 77, 24, 5, 2, 2800),         // Day 1 v2
};
Object.assign(docs, A);
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });
const before = await dump("");

const browser = await chromium.launch();
async function ctxFor(uid, { viewport = { width: 1366, height: 900 }, theme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
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
    if (r.url().endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); page.apiLog.push({ op: j.op, path: j.path || j.col || "", filters: j.filters || null }); } catch { /* */ } }
  });
  return { ctx, page };
}
const panelRow = (id) => `tr[data-test-attempts="${id}"]`;
async function openAttempts(page, id) {
  await page.click(`[data-action="view-attempts"][data-test-id="${id}"]`);
  await page.waitForFunction((id) => {
    const b = document.querySelector(`[data-att-body="${id}"]`);
    return b && !b.hasAttribute("aria-busy") && !/Yuklanmoqda/.test(b.textContent);
  }, id, { timeout: 15000 });
}
const tableNames = (page, id) => page.$$eval(`[data-att-rows="${id}"] tbody tr`, (rs) => rs.map((r) => ({
  n: r.children[0].textContent.trim(), name: r.querySelector(".att-attempts__name a").textContent.trim(), score: r.children[2].textContent.trim(),
  c: r.children[3].textContent.trim(), w: r.children[4].textContent.trim(), u: r.children[5].textContent.trim(), time: r.children[6].textContent.trim() })));
function readXlsx(file) {
  return JSON.parse(execFileSync("python3", ["-c", `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); ws=wb.active
print(json.dumps({"title":ws.title,"rows":[list(r) for r in ws.iter_rows(values_only=True)]}, default=str))`, file], { encoding: "utf8" }));
}

// ---------------------------------------------------------------- J. security
{
  const q = await apiAs("user1", "query", { col: "users", filters: [["__name__", "in", ["uid1", "uid2"]]], order: [], limit: null });
  ok("J: oddiy user boshqa userlar profillarini (ism) so‘ray olmaydi", q.ok === false, q.code || "");
  const a = await apiAs("user1", "query", { col: AC, filters: [["testId", "==", D2], ["testVersion", "==", 2]], order: [], limit: null });
  ok("J: oddiy user kun urinishlarini so‘ray olmaydi", a.ok === false, a.code || "");
  const g = await apiAs("user1", "get", { path: "users/uid1" });
  ok("J: oddiy user boshqa user profilini o‘qiy olmaydi", g.ok === false, g.code || "");
  const { ctx, page } = await ctxFor("user1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForTimeout(2500);
  ok("J: oddiy user admin sahifasida urinishlar/ism/Excel ko‘rmaydi",
     (await page.$("[data-admin-root]:not([hidden])")) === null && (await page.$('[data-action="view-attempts"]')) === null && !/Sarvar Amirov/.test(await page.textContent("body")));
  await ctx.close();
}

// ---------------------------------------------------------------- admin
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForSelector(`[data-test-id="${D2}"]`);
  // D. har kunning o'z containeri
  const rows = await page.$$eval("[data-body] > tr", (rs) => rs.map((r) => ({ details: r.dataset.testAttempts || null, btn: r.querySelector('[data-action="view-attempts"]')?.dataset.testId || null })));
  const pairs = rows.map((r, i) => (r.btn ? rows[i + 1]?.details === r.btn : true));
  ok("D: har bir e’lon qilingan kun qatoridan keyin o‘z details qatori (Day 1–3), draft'da yo‘q",
     pairs.every(Boolean) && J(rows.filter((r) => r.details).map((r) => r.details)) === J([D1, D2, D3]) && !rows.some((r) => r.btn === D4));
  ok("D: details qatorlari boshida yopiq", await page.$$eval("[data-test-attempts]", (rs) => rs.every((r) => r.hidden)));
  ok("tugma: data-action=view-attempts + data-test-id, matn «Ko‘rish», aria-expanded=false",
     await page.$eval(`[data-test-id="${D2}"]`, (b) => b.textContent.trim() === "Ko‘rish" && b.getAttribute("aria-expanded") === "false"));

  // C. Day 2 → faqat Day 2
  page.apiLog.length = 0;
  await openAttempts(page, D2);
  const log2 = page.apiLog.slice();
  const geo = await page.evaluate(([d1, d2]) => {
    const btn = document.querySelector(`[data-test-id="${d2}"]`);
    const own = btn.closest("tr");
    const det = document.querySelector(`tr[data-test-attempts="${d2}"]`);
    return { next: own.nextElementSibling === det, gap: Math.round(det.getBoundingClientRect().top - own.getBoundingClientRect().bottom),
             d1Hidden: document.querySelector(`tr[data-test-attempts="${d1}"]`).hidden,
             d1Empty: !document.querySelector(`tr[data-test-attempts="${d1}"] td`).innerHTML.trim(),
             d1Btn: document.querySelector(`[data-test-id="${d1}"]`).textContent.trim(), expanded: btn.getAttribute("aria-expanded"),
             title: det.querySelector("h3").textContent.trim(), inView: det.getBoundingClientRect().top < innerHeight };
  }, [D1, D2]);
  ok("C: Day 2 paneli aynan Day 2 qatori ostida ochildi", geo.next && Math.abs(geo.gap) <= 2 && geo.title === "Day 2 — urinishlar" && geo.expanded === "true", J(geo));
  ok("C: Day 1 paneli va «Ko‘rish» tugmasiga hech narsa yozilmadi", geo.d1Hidden && geo.d1Empty && geo.d1Btn === "Ko‘rish");
  const n2 = await tableNames(page, D2);
  ok("A: F.I.Sh. ko‘rsatiladi (Sarvar Amirov, Ali Valiyev), natija bo‘yicha tartib",
     J(n2.map((r) => r.name)) === J(["Sarvar Amirov", "Ali Valiyev", "uid3"]) && J(n2.map((r) => r.n)) === J(["1", "2", "3"]), J(n2.map((r) => r.name)));
  ok("A: qiymatlar: 95% · 29/1/1 · 01:24:35", J(n2[0]) === J({ n: "1", name: "Sarvar Amirov", score: "95%", c: "29", w: "1", u: "1", time: "01:24:35" }), J(n2[0]));
  const bodyTxt = await page.textContent(`[data-att-body="${D2}"]`);
  ok("A: userId asosiy matnda yo‘q (faqat title/havolada); B: profil yo‘q — userId fallback belgisi bilan",
     !/uid1|uid2/.test(bodyTxt) && /uid3/.test(bodyTxt) && /profil\/ism topilmadi/.test(bodyTxt));
  ok("14: in_progress alohida «Hisobga olinmagan urinishlar»da, jadvalda yo‘q",
     /Hisobga olinmagan urinishlar \(1\)/.test(bodyTxt) && !n2.some((r) => r.name === "Jarayondagi User"));
  ok("N+1 yo‘q: Day 2 ochilganda 2 so‘rov (urinishlar test+versiya, users `in` — 4 unikal userga 1 ta)",
     log2.length === 2 && log2.some((r) => r.path === AC && J(r.filters) === J([["testId", "==", D2], ["testVersion", "==", 2]]))
     && log2.filter((r) => r.path === "users").length === 1 && J(log2.find((r) => r.path === "users").filters[0][2].sort()) === J(["uid1", "uid2", "uid3", "uid7"]),
     J(log2.map((r) => r.op + ":" + r.path)));
  ok("read-only: commit (write) yo‘q", !log2.some((r) => r.op === "commit"));

  // G/H. Excel (Day 2 v2)
  page.apiLog.length = 0;
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`[data-att-export="${D2}"]`)]);
  const f2 = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(f2);
  ok("G: Excel eksport qo‘shimcha so‘rov qilmaydi (yuklangan ma’lumotdan)", page.apiLog.length === 0, J(page.apiLog));
  ok("G: fayl nomi attestatsiya-day-2-v2-statistika.xlsx", dl.suggestedFilename() === "attestatsiya-day-2-v2-statistika.xlsx");
  const x2 = readXlsx(f2);
  const hdr = x2.rows[0];
  ok("H: Excel ustunlari", J(hdr) === J(["№", "F.I.Sh.", "Test", "Kun", "Test versiyasi", "Natija (%)", "To‘g‘ri javoblar", "Noto‘g‘ri javoblar", "Javobsiz",
    "Sarflangan vaqt", "Boshlangan vaqt", "Tugallangan vaqt", "Holat", "User ID"]));
  const body2 = x2.rows.slice(1);
  ok("G: faqat Day 2 v2 (3 qator, Day 1 va v1 yo‘q, in_progress yo‘q)", body2.length === 3 && body2.every((r) => r[3] === 2 && r[4] === 2 && /^Day 2/.test(r[2]))
     && !body2.some((r) => ["Dilnoza Karimova", "Bobur Toshmatov", "Jarayondagi User"].includes(r[1])), J(body2.map((r) => r[1])));
  ok("H: 1-qator: Sarvar Amirov · 95 · 29/1/1 · 01:24:35 · Baholangan", J([body2[0][1], body2[0][5], body2[0][6], body2[0][7], body2[0][8], body2[0][9], body2[0][12]])
     === J(["Sarvar Amirov", 95, 29, 1, 1, "01:24:35", "Baholangan"]), J(body2[0]));
  ok("H: sonlar raqam katakchada, vaqtlar Toshkent bo‘yicha", typeof body2[0][5] === "number" && /2026, \d{2}:\d{2}$/.test(body2[0][10]), `${body2[0][10]}`);
  let lo = null;
  try {
    execFileSync("soffice", ["--headless", "--convert-to", "csv", "--outdir", OUT, f2], { stdio: "ignore", timeout: 60000 });
    lo = fs.readFileSync(f2.replace(/\.xlsx$/, ".csv"), "utf8");
  } catch { lo = null; }
  if (lo != null) ok("H: LibreOffice faylni ochadi (CSV'ga o‘girildi, Sarvar Amirov bor)", /Sarvar Amirov/.test(lo) && lo.trim().split("\n").length === 4);

  // F. versiya: v1
  page.apiLog.length = 0;
  await page.selectOption(`[data-att-version="${D2}"]`, "1");
  await page.waitForFunction((id) => /versiya v1/.test(document.querySelector(`[data-att-body="${id}"]`)?.textContent || ""), D2, { timeout: 15000 });
  const n21 = await tableNames(page, D2);
  ok("F: v1 tanlanganda faqat Day 2 v1 (Bobur Toshmatov)", J(n21.map((r) => r.name)) === J(["Bobur Toshmatov"]));
  ok("ism keshi: v1 da faqat yangi user o‘qildi (users so‘rovi 1, faqat uid5)",
     page.apiLog.filter((r) => r.path === "users").length === 1 && J(page.apiLog.find((r) => r.path === "users").filters[0][2]) === J(["uid5"]), J(page.apiLog.map((r) => r.op + ":" + r.path)));
  const [dl1] = await Promise.all([page.waitForEvent("download"), page.click(`[data-att-export="${D2}"]`)]);
  const f21 = path.join(OUT, dl1.suggestedFilename());
  await dl1.saveAs(f21);
  const x21 = readXlsx(f21);
  ok("G: v1 eksport — faqat v1 (1 qator, versiya 1)", dl1.suggestedFilename() === "attestatsiya-day-2-v1-statistika.xlsx" && x21.rows.length === 2 && x21.rows[1][1] === "Bobur Toshmatov" && x21.rows[1][4] === 1);
  await page.selectOption(`[data-att-version="${D2}"]`, "2");
  await page.waitForFunction((id) => /versiya v2/.test(document.querySelector(`[data-att-body="${id}"]`)?.textContent || ""), D2, { timeout: 15000 });

  // ikki panel bir vaqtda — mustaqil
  await openAttempts(page, D1);
  const n1 = await tableNames(page, D1);
  ok("ko‘p panel: Day 1 o‘z panelida (Dilnoza Karimova), Day 2 o‘zgarmadi",
     J(n1.map((r) => r.name)) === J(["Dilnoza Karimova"]) && J((await tableNames(page, D2)).map((r) => r.name)) === J(["Sarvar Amirov", "Ali Valiyev", "uid3"]));

  // E. toggle
  await page.click(`[data-test-id="${D2}"]`);
  ok("E: Day 2 qayta bosilsa — yopiladi (aria-expanded=false), Day 1 ochiq qoladi",
     await page.$eval(panelRow(D2), (r) => r.hidden) && (await page.getAttribute(`[data-test-id="${D2}"]`, "aria-expanded")) === "false" && !(await page.$eval(panelRow(D1), (r) => r.hidden)));
  page.apiLog.length = 0;
  await page.click(`[data-test-id="${D2}"]`);
  await page.waitForTimeout(400);
  ok("E: qayta ochilganda — keshdan, qayta so‘rov yo‘q", !(await page.$eval(panelRow(D2), (r) => r.hidden)) && page.apiLog.length === 0, J(page.apiLog));

  // I. urinishsiz kun
  await openAttempts(page, D3);
  ok("I: urinishsiz kun — «Hali urinish yo‘q», Excel tugmasi o‘chiq", /Hali urinish yo‘q/.test(await page.textContent(`[data-att-body="${D3}"]`))
     && await page.$eval(`[data-att-export="${D3}"]`, (b) => b.disabled));

  // klaviatura
  await page.focus(`[data-test-id="${D3}"]`);
  await page.keyboard.press("Enter");
  ok("klaviatura: Enter bilan yopiladi", await page.$eval(panelRow(D3), (r) => r.hidden));

  // Savollar statistikasi alohida va ishlaydi
  await page.click(`[data-qstats="${D2}"]`);
  await page.waitForFunction(() => /DAY 2 — SAVOLLAR STATISTIKASI/.test(document.querySelector("[data-qstats-title]")?.textContent || ""));
  ok("Savollar statistikasi tugmasi o‘z panelini ochadi, urinishlar paneliga ta’sir yo‘q",
     !(await page.$eval(panelRow(D2), (r) => r.hidden)) && (await tableNames(page, D2)).length === 3);
  // lastActiveAt — mavjud sessiya (app-shell) kirishda yozadi; bu modulga tegishli emas, solishtirishdan chiqariladi
  const norm = (d) => J(Object.fromEntries(Object.entries(d).map(([p, v]) => [p, p.startsWith("users/") ? { ...v, lastActiveAt: null } : v])));
  ok("read-only: barcha hujjatlar (attempts, tests, keys, users, …) o‘zgarmagan", norm(await dump("")) === norm(before));
  ok("admin: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await page.screenshot({ path: path.join(OUT, "attempts-admin-1366.png"), fullPage: false });
  await ctx.close();
}

// ---------------------------------------------------------------- responsive + tema
for (const [vp, theme] of [390, 768, 1366].map((w) => ({ width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 })).flatMap((v) => [[v, "light"], [v, "dark"]])) {
  const { ctx, page } = await ctxFor("admin1", { viewport: vp, theme });
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector(`[data-test-id="${D2}"]`);
  await openAttempts(page, D2);
  await page.locator(panelRow(D2)).scrollIntoViewIfNeeded();
  const g = await page.evaluate((id) => {
    const W = document.documentElement.clientWidth;
    const det = document.querySelector(`tr[data-test-attempts="${id}"]`);
    const over = [...det.querySelectorAll("*")].filter((e) => {
      const r = e.getBoundingClientRect();
      if (!r.width || e.closest("thead")?.getBoundingClientRect().height <= 1) return false;   // sr-only sarlavha (mobil karta rejimi)
      const wrap = e.closest(".of-admin-table-wrap");
      return r.right > W + 1 && !(wrap && getComputedStyle(wrap).overflowX === "auto" && wrap.getBoundingClientRect().right <= W + 1);
    }).length;
    const btn = det.querySelector("[data-att-export]").getBoundingClientRect();
    const names = [...det.querySelectorAll(".att-attempts__name a")];
    const cut = names.filter((a) => a.scrollWidth > a.clientWidth + 1 && getComputedStyle(a).overflow !== "visible").length;
    return { over, btnIn: btn.left >= 0 && btn.right <= W + 1, names: names.length, cut, theme: document.documentElement.dataset.theme };
  }, D2);
  ok(`${vp.width}px ${theme}: overflow yo‘q, Excel tugmasi ekranda, F.I.Sh. kesilmaydi`, g.over === 0 && g.btnIn && g.names === 3 && g.cut === 0 && g.theme === theme, J(g));
  await page.locator(panelRow(D2)).screenshot({ path: path.join(OUT, `attempts-admin-${vp.width}-${theme}.png`) });
  ok(`${vp.width}px ${theme}: konsol xatolari yo‘q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-attempts-admin.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
