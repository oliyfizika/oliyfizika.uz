// ==========================================================================
// Attestatsiya → Fizika: E2E — rasm pipeline (figureBackend = "firestore", Storage'siz) va tiklangan kalitlar.
// Production ketma-ketligi: import → Firestore rasm hujjatlari → manba «firestore» → Day 1 + Day 4 publish → user.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8781 &
//   E2E_PORT=8781 node tools/attestatsiya-fizika/e2e/e2e_figures.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-figures.json; exit 1 — biror tekshiruv FAIL.
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
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8781}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const figBundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-figures.json"), "utf8"));
const opData = (p) => bundle.ops.find((o) => o.path === p).data;
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const figsIn = (bs, out = []) => {
  for (const b of bs || []) {
    if (b.t === "figure") out.push(b.id);
    if (b.blocks) figsIn(b.blocks, out);
    for (const it of b.t === "list" ? b.items : []) figsIn(it.blocks ?? it, out);
    for (const r of b.t === "table" ? b.rows : []) for (const c of r.cells ?? r) figsIn(c.blocks, out);
  }
  return out;
};

const T0 = new Date("2026-10-05T04:00:00Z");
await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs: {
  "users/admin1": { fullName: "Admin Bir", firstName: "Admin", email: "admin1@example.com", role: "admin", xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) },
  "users/user1": { fullName: "Ali Valiyev", firstName: "Ali", email: "user1@example.com", xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) },
} });
const browser = await chromium.launch();
async function ctxFor(uid, viewport = { width: 1366, height: 900 }, time = T0) {
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

// ---------------------------------------------------------------- admin
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-admin-root]:not([hidden])");
  await page.setInputFiles("[data-bundle]", path.join(PRIV, "firestore-import.json"));
  await page.waitForFunction(() => !document.querySelector("[data-import]").disabled);
  await page.click("[data-import]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Tayyor:/.test(document.querySelector("[data-bundle-info]").textContent), null, { timeout: 240000 });
  // Himoya: Firestore rasm hujjatlari hali yo'q — «firestore» ga o'tkazish rad etiladi, sozlama o'zgarmaydi
  await page.waitForSelector("[data-body] tr");
  await page.click("[data-backend]");
  await page.waitForTimeout(1500);
  const guard = await post("__mock/dump", { prefix: "attestationPhysicsSettings" });
  const modalShown = await page.$(".of-admin-confirm");
  ok("himoya: rasm hujjatlarisiz «firestore» ga o‘tkazib bo‘lmaydi", guard.docs["attestationPhysicsSettings/config"]?.figureBackend === "storage" && !modalShown,
     await page.textContent("body").then((t) => (t.match(/Firestore rasm hujjatlari to‘liq emas[^.]*/) || [""])[0]));
  ok("tugma joriy qiymat va aniq maqsadni ko‘rsatadi", /Rasm manbai: storage → «firestore» ga o‘tkazish/.test(await page.textContent("[data-backend]")));
  await page.setInputFiles("[data-figdocs]", path.join(PRIV, "firestore-figures.json"));
  await page.waitForFunction(() => !document.querySelector("[data-figdocs-import]").disabled);
  await page.click("[data-figdocs-import]");
  const n = figBundle.ops.length;
  await page.waitForFunction((n) => new RegExp(`Yozildi ${n} `).test(document.querySelector("[data-figdocs-info]").textContent), n, { timeout: 240000 });
  ok(`admin: Firestore rasm hujjatlari yozildi (${n})`, true);
  await page.click("[data-backend]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /Rasm manbai: firestore → «storage»/.test(document.querySelector("[data-backend]").textContent));
  for (const id of ["att-fizika-day-01", "att-fizika-day-04"]) {
    await page.click(`[data-publish="${id}"]`);
    await page.click(".of-admin-confirm .of-btn--primary");
    await page.waitForTimeout(800);
  }
  const st = await post("__mock/dump", { prefix: "attestationPhysicsSettings" });
  ok("sozlama: figureBackend = firestore", st.docs["attestationPhysicsSettings/config"]?.figureBackend === "firestore");
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- user: Day 1 test (savol rasmlari + tiklangan variantlar)
// (Storage rejimi production'dagi kabi bo'sh bucket bilan alohida tekshiriladi: e2e.mjs Storage'ga yuklaydi;
//  bu yerda manba «firestore» — production'dagi tuzatishdan keyingi holat.)
const snap1 = opData("attestationPhysicsDailyTests/att-fizika-day-01/versions/v1");
const withFig = snap1.questions.map((q, i) => ({ i, id: q.id, n: [...figsIn(q.question), ...q.options.flatMap((o) => figsIn(o.blocks))].length })).filter((x) => x.n);
for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  const { ctx, page } = await ctxFor("user1", vp);
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  const fails = [];
  let rec = null;
  for (let i = 0; i < snap1.questions.length; i++) {
    const q = snap1.questions[i];
    const want = withFig.find((x) => x.i === i);
    if (want) {
      await page.waitForFunction((n) => [...document.querySelectorAll(".att-q .att-fig")].length === n
        && [...document.querySelectorAll(".att-q .att-fig")].every((f) => f.dataset.state !== "loading"), want.n, { timeout: 15000 }).catch(() => {});
      const st = await page.$$eval(".att-q .att-fig", (fs) => fs.map((f) => ({ s: f.dataset.state, w: f.querySelector("img").naturalWidth })));
      if (st.length !== want.n || st.some((f) => f.s !== "ready" || !f.w)) fails.push({ q: want.id, st });
    }
    if (q.id === "AF-1-005") {
      rec = await page.$$eval(".att-opt", (os) => os.map((o) => o.textContent.replace(/\s+/g, " ").trim()));
    }
    if (i < snap1.questions.length - 1) await page.click("[data-next]");
  }
  ok(`${vp.width}px: Day 1 savol rasmlari (${withFig.reduce((s, x) => s + x.n, 0)} ta, ${withFig.length} savol) — barchasi yuklandi`, !fails.length, JSON.stringify(fails.slice(0, 3)));
  ok(`${vp.width}px: tiklangan savol AF-1-005 — 4 variant (A–D)`, rec && rec.length === 4 && rec.every((t, i) => t.startsWith("ABCD"[i])), `${rec?.length} variant`);
  ok(`${vp.width}px: konsol xatolari yo'q`, !page.errs.length, page.errs.join(" | "));
  await page.screenshot({ path: path.join(OUT, `figures-fs-${vp.width}.png`) });
  await ctx.close();
}

// ---------------------------------------------------------------- user: Day 4 yechimlari (savoldagi rasm yechimda ham — avval topilmasdi)
{
  const t4 = opData("attestationPhysicsDailyTests/att-fizika-day-04/solutions/v1");
  const expected = t4.items.reduce((s, it) => s + figsIn(it.solution).length, 0);
  const later = new Date(T0.getTime() + 2 * 86400000);
  await post("__mock/clock", { iso: later.toISOString() });
  const { ctx, page } = await ctxFor("user1", { width: 1366, height: 900 }, later);
  await page.goto(B + "attestatsiya/fizika-yechimlar.html?day=4");
  await page.waitForSelector(".att-solq");
  const solFigs = await page.$$(".att-sol .att-fig");
  for (const f of solFigs) { await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500);
  const st = await page.$$eval(".att-sol .att-fig", (fs) => fs.map((f) => ({ s: f.dataset.state, w: f.querySelector("img").naturalWidth })));
  ok(`Day 4 yechim rasmlari (${expected} ta, AF-1-131/132 savol rasmini qayta ishlatadi) — barchasi yuklandi`,
     st.length === expected && expected > 0 && st.every((f) => f.s === "ready" && f.w > 0), JSON.stringify(st));
  ok("yechimlar sahifasi: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-figures.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
