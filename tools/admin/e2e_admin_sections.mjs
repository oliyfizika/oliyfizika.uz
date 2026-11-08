// ==========================================================================
// Admin System 2.0 (bo'limli adminlar): E2E — owner admin tayinlaydi, bo'limli admin faqat o'z bo'limlarini ko'radi,
// eski (to'liq) admin ishlashda davom etadi, amallar jurnali yoziladi.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8799 &
//   E2E_PORT=8799 node tools/admin/e2e_admin_sections.mjs
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
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "admin-sections-"));
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8799}/`;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const T0 = new Date("2026-11-08T08:00:00Z");

const docs = {
  "users/owner": { fullName: "Sarvar Amirov", role: "admin", adminRole: "owner", email: "owner@example.com", xp: 0, level: 1 },
  "users/legacy": { fullName: "Eski Admin", role: "admin", email: "legacy@example.com", xp: 0, level: 1 },
  "users/u2": { fullName: "Ali Valiyev", email: "u2@example.com", xp: 0, level: 1 },
  "users/u3": { fullName: "Vali Aliyev", email: "u3@example.com", xp: 0, level: 1 },
  "results/r1": { uid: "u3", lessonId: 1, percent: 80, score: 8, totalQuestions: 10, passed: true, fullName: "Vali Aliyev" },
  "attestationPhysicsSettings/config": { accessMode: "open", timezone: "Asia/Tashkent", totalDays: 32 },
};
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.addInitScript((u) => {
    localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u }));
  }, uid);
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  return { ctx, page };
}
const confirm = async (page) => {
  await page.waitForSelector(".of-admin-confirm .of-modal__actions .of-btn", { timeout: 10000 });
  await page.click(".of-admin-confirm .of-modal__actions .of-btn");
};
const navVisible = (page, id) => page.evaluate((i) => {
  const a = document.querySelector(`.of-sidebar [data-nav-id="${i}"]`);
  return !!a && !(a.closest("li") || a).hidden;
}, id);

// ---------------------------------------------------------------- 1. owner: admin tayinlaydi
{
  const { ctx, page } = await ctxFor("owner");
  await page.goto(B + "admin/admins.html");
  await page.waitForSelector("[data-admins-list] li", { timeout: 20000 });
  const listText = await page.textContent("[data-admins-list]");
  ok("Owner: «Adminlar» sahifasi ochiladi, ro‘yxatda owner va eski admin bor", listText.includes("Owner") && listText.includes("Eski Admin"));
  ok("Owner: menyuda «Adminlar» bandi ko‘rinadi", await navVisible(page, "admin-admins"));
  await page.fill("#findEmail", "u2@example.com");
  await page.click("[data-find-form] button[type=submit]");
  await page.click("[data-find-results] [data-edit='u2']");
  await page.waitForSelector("[data-editor]:not([hidden])");
  await page.check("[data-section][value='attestatsiya-fizika']");
  await page.check("[data-section][value='milliy-sertifikat']");
  await page.screenshot({ path: path.join(OUT, "owner-editor.png"), fullPage: true });
  await page.click("[data-editor-save]");
  await confirm(page);
  await page.waitForSelector("[data-msg]:not([hidden])", { timeout: 10000 });
  const u2 = (await dump("users/u2"))["users/u2"];
  ok("u2 admin etib tayinlandi (role=admin, 2 ta bo‘lim)", u2?.role === "admin" && JSON.stringify([...u2.adminSections].sort()) === JSON.stringify(["attestatsiya-fizika", "milliy-sertifikat"]),
    JSON.stringify(u2?.adminSections));
  const log = Object.values(await dump("adminAuditLog"));
  ok("Amallar jurnaliga «admin.appoint» yozildi", log.some((r) => r.action === "admin.appoint" && r.targetUid === "u2" && r.actorUid === "owner"));
  await page.waitForFunction(() => document.querySelector("[data-log]")?.children.length > 0, null, { timeout: 10000 });
  ok("Owner jurnalni ko‘radi", (await page.textContent("[data-log]")).includes("Admin tayinlandi"));
  await page.screenshot({ path: path.join(OUT, "owner-admins.png"), fullPage: true });
  ok("Owner sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 2. bo'limli admin (u2)
{
  const { ctx, page } = await ctxFor("u2");
  await page.goto(B + "admin/index.html");
  await page.waitForSelector("[data-my-sections] .of-admin-chip", { timeout: 20000 });
  ok("Bo‘limli admin: dashboard bo‘limlarini ko‘rsatadi", (await page.textContent("[data-my-sections]")).includes("Attestatsiya — Fizika"));
  ok("Bo‘limli admin: menyuda Attestatsiya va Mock natijalari bor",
    (await navVisible(page, "admin-attestatsiya-fizika")) && (await navVisible(page, "admin-mock-results")));
  ok("Bo‘limli admin: menyuda Foydalanuvchilar / Natijalar / Access / Adminlar yo‘q",
    !(await navVisible(page, "admin-users")) && !(await navVisible(page, "admin-results")) && !(await navVisible(page, "admin-access")) && !(await navVisible(page, "admin-admins")));
  ok("Bo‘limli admin: «Umumiy fizika natijalari» kartasi yashirin", await page.evaluate(() => document.querySelector('[data-stat="results"]').closest("li").hidden));
  await page.screenshot({ path: path.join(OUT, "section-admin-dashboard.png"), fullPage: true });
  await page.goto(B + "admin/results.html");
  await page.waitForSelector("[data-admin-gate]:not([hidden]) h1", { timeout: 20000 });
  ok("Bo‘limli admin: Natijalar sahifasi yopiq", (await page.textContent("[data-admin-gate]")).includes("sizga biriktirilmagan"));
  await page.goto(B + "admin/admins.html");
  await page.waitForSelector("[data-admin-gate]:not([hidden]) h1", { timeout: 20000 });
  ok("Bo‘limli admin: Adminlar sahifasi yopiq", (await page.textContent("[data-admin-gate]")).includes("faqat sayt egasi"));
  await page.goto(B + "admin/mock-results.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])", { timeout: 20000 });
  ok("Bo‘limli admin: Mock natijalari sahifasi ochiladi", true);
  ok("Bo‘limli admin sahifalarida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 3. eski (to'liq) admin
{
  const { ctx, page } = await ctxFor("legacy");
  await page.goto(B + "admin/access.html");
  await page.waitForSelector("[data-access-list] li", { timeout: 20000 });
  const t = await page.textContent("[data-access-list]");
  ok("Eski admin: Access sahifasi ochiladi; adminlikdan olish — faqat owner", t.includes("Faqat owner o‘zgartiradi") && !(await page.$("[data-access-list] [data-revoke]")));
  await page.goto(B + "admin/user.html?id=u3");
  await page.waitForSelector("[data-user-content]:not([hidden])", { timeout: 20000 });
  ok("Eski admin: foydalanuvchi sahifasida «Admin tayinlash» tugmasi yo‘q", await page.evaluate(() => document.querySelector("[data-admin-manage]").hidden));
  await page.click("[data-access='mockTestsAccess']");
  await confirm(page);
  await page.waitForFunction(() => document.querySelector("[data-access='mockTestsAccess']").getAttribute("aria-checked") === "true", null, { timeout: 10000 });
  const u3 = (await dump("users/u3"))["users/u3"];
  ok("Eski admin: Mock Test Access beradi (avvalgidek)", u3?.mockTestsAccess === true);
  const log = Object.values(await dump("adminAuditLog"));
  ok("Jurnal: «access.grant» yozildi", log.some((r) => r.action === "access.grant" && r.actorUid === "legacy" && r.targetUid === "u3"));
  await page.goto(B + "admin/admins.html");
  await page.waitForSelector("[data-admin-gate]:not([hidden]) h1", { timeout: 20000 });
  ok("Eski admin: Adminlar sahifasi yopiq (faqat owner)", (await page.textContent("[data-admin-gate]")).includes("faqat sayt egasi"));
  ok("Eski admin sahifalarida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- 4. owner: adminlikdan oladi
{
  const { ctx, page } = await ctxFor("owner");
  await page.goto(B + "admin/admins.html?uid=u2");
  await page.waitForSelector("[data-editor]:not([hidden]) [data-editor-remove]:not([hidden])", { timeout: 20000 });
  await page.click("[data-editor-remove]");
  await confirm(page);
  await page.waitForSelector("[data-msg]:not([hidden])", { timeout: 10000 });
  const u2 = (await dump("users/u2"))["users/u2"];
  ok("Owner: u2 adminlikdan olindi (role=user, adminSections yo‘q)", u2?.role === "user" && !("adminSections" in u2));
  const log = Object.values(await dump("adminAuditLog"));
  ok("Jurnal: «admin.remove» yozildi", log.some((r) => r.action === "admin.remove" && r.targetUid === "u2"));
  ok("Owner (2) sahifasida JS xatosi yo‘q", page.errs.length === 0, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} PASS · skrinshotlar: ${OUT}`);
process.exit(failed.length ? 1 : 0);
