// ==========================================================================
// «Hozir online» (admin dashboard): E2E — mehmon presence yozadi, tizimga kirgan foydalanuvchi lastActiveAt yozadi,
// admin dashboard ikkalasini sanaydi va ro'yxatni ko'rsatadi.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8799 &
//   E2E_PORT=8799 node tools/admin/e2e_online.mjs
// Har bir Firestore so'rovi repo firestore.rules orqali tekshiriladi (lokal interpretator). exit 1 — FAIL.
// ==========================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SDK = path.join(ROOT, "tools/attestatsiya-fizika/e2e/sdk");
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "admin-online-"));
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8799}/`;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const ts = (msAgo) => { const ms = Date.now() - msAgo; return { __ts: [Math.floor(ms / 1000), (ms % 1000) * 1e6] }; };
const MIN = 60 * 1000;

const base = { xp: 0, level: 1, fullAccess: false };
await post("__mock/reset", {});
await post("__mock/seed", { docs: {
  "users/owner": { ...base, fullName: "Sarvar Amirov", role: "admin", adminRole: "owner", email: "owner@example.com", lastActiveAt: ts(0) },
  "users/none": { ...base, fullName: "Bo‘limsiz Admin", role: "admin", adminSections: [], email: "none@example.com", lastActiveAt: ts(0) },
  "users/a1": { ...base, fullName: "Ali Valiyev", email: "a1@example.com", lastActiveAt: ts(2 * MIN) },
  "users/a2": { ...base, fullName: "Vali Aliyev", email: "a2@example.com", lastActiveAt: ts(30 * MIN) },   // online emas
  "users/a3": { ...base, fullName: "Hasan Husanov", email: "a3@example.com" },                         // hech qachon faol emas
  ["presence/g_" + "c".repeat(32)]: { at: ts(1 * MIN), expireAt: ts(-59 * MIN) },
  ["presence/g_" + "d".repeat(32)]: { at: ts(40 * MIN), expireAt: ts(-20 * MIN) },                    // eski
} });

const browser = await chromium.launch();
async function ctxFor(uid, theme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: theme });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  if (uid) await ctx.addInitScript((u) => localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u })), uid);
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  return { ctx, page };
}

// ---------------------------------------------------------------- 1. mehmon: presence yoziladi
{
  const { ctx, page } = await ctxFor(null);
  await page.goto(B + "index.html");
  await page.waitForFunction(() => /^g_[0-9a-f]{32}$/.test(localStorage.getItem("oliyfizika:presence-id") || ""), null, { timeout: 20000 });
  const id = await page.evaluate(() => localStorage.getItem("oliyfizika:presence-id"));
  await page.waitForTimeout(800);
  const doc = (await dump("presence/" + id))["presence/" + id];
  ok("Mehmon: presence hujjati yozildi (faqat at + expireAt)", doc && JSON.stringify(Object.keys(doc).sort()) === '["at","expireAt"]', JSON.stringify(doc));
  await page.goto(B + "umumiy-fizika/index.html");
  await page.waitForTimeout(800);
  const same = await page.evaluate(() => localStorage.getItem("oliyfizika:presence-id"));
  ok("Mehmon: boshqa sahifada ham o‘sha ID (tab/sahifa bo‘yicha takrorlanmaydi)", same === id);
  ok("Mehmon sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 2. tizimga kirgan foydalanuvchi: lastActiveAt yoziladi, presence emas
{
  const before = Object.keys(await dump("presence")).length;
  const { ctx, page } = await ctxFor("a3");
  await page.goto(B + "index.html");
  await page.waitForTimeout(1500);
  const a3 = (await dump("users/a3"))["users/a3"];
  ok("Kirgan foydalanuvchi: lastActiveAt yangilandi", !!a3?.lastActiveAt, JSON.stringify(a3?.lastActiveAt));
  ok("Kirgan foydalanuvchi: presence hujjati yaratilmadi", Object.keys(await dump("presence")).length === before);
  await ctx.close();
}

// ---------------------------------------------------------------- 3. admin dashboard
for (const [uid, theme] of [["owner", "light"], ["none", "dark"]]) {
  const { ctx, page } = await ctxFor(uid, theme);
  await page.goto(B + "admin/index.html");
  await page.waitForFunction(() => document.querySelector("[data-online-stats]")?.getAttribute("aria-busy") === "false", null, { timeout: 20000 });
  const v = await page.evaluate(() => Object.fromEntries(["total", "signed", "guests"].map((k) => [k, document.querySelector(`[data-online="${k}"]`).textContent.trim()])));
  // online: a1, a3 (2-bosqichda), owner, none; mehmonlar: c… va 1-bosqichdagi mehmon
  ok(`${uid}: tizimga kirganlar soni to‘g‘ri (4)`, v.signed === "4", JSON.stringify(v));
  ok(`${uid}: mehmonlar soni to‘g‘ri (2)`, v.guests === "2", JSON.stringify(v));
  ok(`${uid}: jami = 6`, v.total === "6", JSON.stringify(v));
  await page.click("[data-online-toggle]");
  await page.waitForSelector("[data-online-list] .of-admin-mini li", { timeout: 10000 });
  const list = await page.textContent("[data-online-list]");
  ok(`${uid}: ro‘yxatda Ali Valiyev bor, Vali Aliyev yo‘q`, list.includes("Ali Valiyev") && !list.includes("Vali Aliyev"));
  await page.screenshot({ path: path.join(OUT, `dashboard-${uid}-${theme}.png`), fullPage: false });
  ok(`${uid}: dashboard'da JS xatosi yo‘q`, page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} o‘tdi · skrinshotlar: ${OUT}`);
process.exit(failed.length ? 1 : 0);
