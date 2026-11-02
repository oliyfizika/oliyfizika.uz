// ==========================================================================
// Milliy sertifikat mock testlari: E2E — urinish Firestore'ga yoziladi (mockTestAttempts) va admin «Mock natijalari» sahifasi.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8799 &
//   E2E_PORT=8799 node tools/milliy-sertifikat/e2e_mock_results.mjs
// Har bir Firestore so'rovi repo firestore.rules orqali tekshiriladi (lokal interpretator). exit 1 — FAIL.
// ==========================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SDK = path.join(ROOT, "tools/attestatsiya-fizika/e2e/sdk");
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "mock-results-"));
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8799}/`;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const T0 = new Date("2026-11-02T08:00:00Z");
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const C = "mockTestAttempts";

const docs = {
  "users/admin1": { fullName: "Admin Bir", role: "admin", email: "admin1@example.com" },
  "users/uid1": { fullName: "Sarvar Amirov", email: "uid1@example.com" },
  "users/uid2": { fullName: "Ali Valiyev", email: "uid2@example.com" },
};
const rec = (uid, name, test, n, correct, max, hAgo, extra = {}) => ({ schemaVersion: 1, uid, name, email: `${uid}@example.com`, testId: test, testNumber: n,
  testTitle: `Fizika Mock Test №${n}`, attemptId: `a-${uid}-${test}-${hAgo}`, correct, maxScore: max, percent: Math.round(correct / max * 100),
  full: correct - 2, partial: 2, blank: max - correct - 3, questionCount: 45, durationSec: 5400, autoSubmitted: false, focusLoss: 0,
  startedAtMs: T0.getTime() - hAgo * 3600000 - 5400000, finishedAtMs: T0.getTime() - hAgo * 3600000, submittedAt: ts(new Date(T0.getTime() - hAgo * 3600000)), ...extra });
const seed = [
  rec("uid1", "Sarvar Amirov", "mock-test-1", 1, 44, 55, 30),
  rec("uid1", "Sarvar Amirov", "mock-test-1", 1, 50, 55, 5),
  rec("uid2", "Ali Valiyev", "mock-test-1", 1, 33, 55, 10, { autoSubmitted: true, focusLoss: 3 }),
  rec("uid2", "Ali Valiyev", "mock-test-2", 2, 22, 55, 3),
];
for (const r of seed) docs[`${C}/${r.uid}__${r.attemptId}`] = r;
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, init = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript(([u, extra]) => {
    localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u }));
    for (const [k, v] of Object.entries(extra)) if (localStorage.getItem(k) == null) localStorage.setItem(k, v);
  }, [uid, init]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(T0);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  return { ctx, page };
}

// ---------------------------------------------------------------- 1. o'quvchi: topshirilgan urinish yoziladi
{
  const now = T0.getTime();
  const key = "oliyfizika:mock:uid1:mock-test-3:state:v1";
  const state = { schemaVersion: 1, testId: "mock-test-3", attemptId: "e2e-attempt-0001", status: "SUBMITTED", uid: "uid1", name: "Sarvar Amirov",
    email: "uid1@example.com", startTs: now - 3600000, deadlineTs: now + 7200000, endTs: now - 60000, current: 0, answers: { 0: "A", 1: "B" }, marked: {},
    focusLoss: 1, submitted: true, autoSubmitted: false };
  const { ctx, page } = await ctxFor("uid1", { [key]: JSON.stringify(state) });
  await page.goto(B + "milliy-sertifikat/mock-testlar/test.html?id=mock-test-3");
  await page.waitForSelector("#resultScreen:not([hidden])", { timeout: 20000 });
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").recorded === true, key, { timeout: 15000 }).catch(() => {});
  const d = await dump(`${C}/uid1__e2e-attempt-0001`);
  const doc = d[`${C}/uid1__e2e-attempt-0001`];
  ok("Topshirilgan urinish mockTestAttempts'ga yozildi", !!doc, doc ? `${doc.correct}/${doc.maxScore} ${doc.percent}%` : "yo‘q");
  ok("Yozuvda xom javoblar yo‘q, ism/test/ball bor", doc && !("answers" in doc) && doc.name === "Sarvar Amirov" && doc.testId === "mock-test-3" && doc.maxScore > 0 && doc.focusLoss === 1);
  ok("localStorage: recorded=true", await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).recorded === true, key));
  // qayta ochish — dublikat yo'q, xato yo'q
  await page.reload();
  await page.waitForSelector("#resultScreen:not([hidden])");
  await page.waitForTimeout(800);
  ok("Qayta ochilganda dublikat yozilmadi", Object.keys(await dump(`${C}/uid1__`)).length === 3);
  ok("O‘quvchi sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  const list = await post("__mock/api", { op: "query", uid: "uid1", col: C, filters: [], order: [], limit: null });
  ok("Oddiy user boshqalarning urinishlari ro‘yxatini o‘qiy olmaydi", list.ok === false, list.code || "");
  await ctx.close();
}

// ---------------------------------------------------------------- 2. oddiy user admin sahifasini ko'rmaydi
{
  const { ctx, page } = await ctxFor("uid2");
  await page.goto(B + "admin/mock-results.html");
  await page.waitForTimeout(2000);
  ok("Oddiy user admin sahifasida ma’lumot ko‘rmaydi", (await page.$("[data-admin-root]:not([hidden])")) === null && !/Sarvar Amirov/.test(await page.textContent("body")));
  await ctx.close();
}

// ---------------------------------------------------------------- 3. admin sahifasi
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/mock-results.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.waitForFunction(() => document.querySelector("[data-mock-body]")?.getAttribute("aria-busy") === "false", null, { timeout: 15000 });
  const stat = (k) => page.textContent(`[data-mstat="${k}"]`);
  ok("Barcha urinishlar: 5 ta, 2 foydalanuvchi", (await stat("attempts")) === "5" && (await stat("users")) === "2", `${await stat("attempts")} / ${await stat("users")}`);
  const sum = await page.$$eval("[data-mock-summary] tr", (rs) => rs.map((r) => [...r.children].map((c) => c.textContent.trim())));
  ok("Xulosa: Mock №1, №2, №3 qatorlari tartibda", sum.map((r) => r[0]).join(",") === "Mock №1,Mock №2,Mock №3", JSON.stringify(sum));
  ok("Mock №1: 3 urinish, 2 user, eng yuqori 91%", sum[0][1] === "3" && sum[0][2] === "2" && sum[0][5] === "91%", sum[0].join(" | "));
  ok("O‘rtacha o‘nlik vergul bilan", /^\d+,\d%$/.test(sum[0][3]), sum[0][3]);
  ok("Jadval: 5 qator, eng yangisi birinchi (Sarvar, Mock №3)", (await page.$$("[data-mock-body] tr")).length === 5
     && /Sarvar Amirov/.test(await page.textContent("[data-mock-body] tr:first-child")) && /Mock №3/.test(await page.textContent("[data-mock-body] tr:first-child")));
  ok("Izoh: avtomatik yakunlangan va oynadan chiqqan", /avtomatik yakunlangan; oynadan 3 marta chiqqan/.test(await page.textContent("[data-mock-body]")));

  await page.selectOption("#mrView", "best");
  ok("Eng yaxshi natija ko‘rinishi: 4 qator (har user×mock)", (await stat("attempts")) === "4");
  await page.fill("#mrUser", "ali");
  ok("Qidiruv «ali»: faqat Ali Valiyev (2 qator)", (await page.$$("[data-mock-body] tr")).length === 2 && !/Sarvar/.test(await page.textContent("[data-mock-body]")));
  await page.fill("#mrUser", "");
  await page.selectOption("#mrView", "all");

  await page.selectOption("#mrTest", "mock-test-1");
  await page.click("[data-mock-form] button[type=submit]");
  await page.waitForFunction(() => document.querySelector("[data-mstat=attempts]").textContent === "3", null, { timeout: 10000 }).catch(() => {});
  ok("Mock №1 filtri (Firestore so‘rovi, indeksli): 3 urinish", (await stat("attempts")) === "3");

  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-mock-export="xlsx"]')]);
  const fx = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(fx);
  const x = JSON.parse(execFileSync("python3", ["-c", `import openpyxl,json,sys
ws=openpyxl.load_workbook(sys.argv[1]).active
print(json.dumps([list(r) for r in ws.iter_rows(values_only=True)], default=str))`, fx], { encoding: "utf8" }));
  ok("Excel: sarlavha + 3 qator, foiz son katakda", x.length === 4 && x[0][1] === "F.I.Sh." && typeof x[1][7] === "number", dl.suggestedFilename());
  const [dc] = await Promise.all([page.waitForEvent("download"), page.click('[data-mock-export="csv"]')]);
  const fc = path.join(OUT, dc.suggestedFilename());
  await dc.saveAs(fc);
  const csv = fs.readFileSync(fc, "utf8");
  ok("CSV: BOM, «;» ajratgich, 4 qator", csv.charCodeAt(0) === 0xfeff && csv.split("\r\n").length === 4 && csv.includes(";Sarvar Amirov;"));
  ok("Admin sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await page.screenshot({ path: path.join(OUT, "mock-results-light.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: path.join(OUT, "mock-results-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(OUT, "mock-results-mobile.png"), fullPage: true });
  ok("Telefon kengligida gorizontal skroll yo‘q", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(B + "admin/index.html");
  await page.waitForFunction(() => /^\d+$/.test(document.querySelector('[data-stat="mockAttempts"]')?.textContent.trim() || ""), null, { timeout: 10000 }).catch(() => {});
  ok("Dashboard: «Mock test urinishlari» = 5", (await page.textContent('[data-stat="mockAttempts"]')).trim() === "5");
  ok("Sidebar: «Mock natijalari» havolasi bor", (await page.$('a[href$="admin/mock-results.html"]')) !== null);
  await ctx.close();
}

await browser.close();
console.log(`\nNatija: ${checks.filter((c) => c.pass).length}/${checks.length} · fayllar: ${OUT}`);
process.exit(checks.every((c) => c.pass) ? 0 : 1);
