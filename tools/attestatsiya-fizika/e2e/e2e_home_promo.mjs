// ==========================================================================
// Bosh sahifa: «Attestatsiya — Fizika» kurs banneri (oldingi simulyatsiya promo bloki o'rnida).
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8803 &
//   E2E_PORT=8803 node tools/attestatsiya-fizika/e2e/e2e_home_promo.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-home-promo.json
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/npm-tools/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const OUT = path.join(ROOT, "_private/attestatsiya-fizika/e2e");
fs.mkdirSync(OUT, { recursive: true });
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8803}/`;
const SDK = path.join(HERE, "sdk");
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const J = (x) => JSON.stringify(x);
const MSGS = ["32 kunlik tayyorgarlik challenge", "1000+ test savollari", "Har kuni yangi attestatsiya testi",
  "Natijalar va shaxsiy statistika", "Test jarayonida kalkulyator", "Fizika attestatsiyasiga tizimli tayyorgarlik"];
const T0 = new Date("2026-10-07T06:00:00Z");
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });

await post("__mock/reset", {});
await post("__mock/clock", { iso: T0.toISOString() });
await post("__mock/seed", { docs: { "users/u1": { fullName: "Ali Valiyev", firstName: "Ali", email: "u1@example.com", xp: 10, level: 1, fullAccess: false, createdAt: ts(T0) } } });

const browser = await chromium.launch();
async function ctxFor(uid, { viewport = { width: 1366, height: 900 }, theme = "light", reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => {
    const m = r.request().url().match(/\/([a-z-]+\.js)$/);
    r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) });
  });
  await ctx.route(/t\.me/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>tg</title>" }));
  await ctx.addInitScript(([u, th]) => {
    if (u) localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u }));
    localStorage.setItem("oliyfizika:theme", JSON.stringify(th));
  }, [uid, theme]);
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::|favicon/.test(m.text())) page.errs.push(m.text()); });
  page.writes = [];
  page.on("request", (r) => { if (r.url().endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); if (j.op === "commit") page.writes.push((j.writes || []).map((w) => w.path)); } catch { /* */ } } });
  return { ctx, page };
}
const msgText = (page) => page.textContent("[data-promo-msg]").then((t) => t.trim());

{
  const { ctx, page } = await ctxFor("u1");
  await page.goto(B + "index.html");
  await page.waitForSelector("[data-promo]");
  await page.waitForFunction(() => window.__ofPromo);
  ok("B: simulyatsiya promo bloki almashtirildi (data-sim / canvas yo‘q)", !(await page.$("[data-sim]")) && !(await page.$(".of-sim__canvas")) && !(await page.evaluate(() => window.__ofSim)));
  ok("C: banner — «ATTESTATSIYA — FIZIKA», hero ichida", (await page.textContent("#promoTitle")).trim() === "ATTESTATSIYA — FIZIKA" && !!(await page.$(".of-hero [data-promo]")));
  ok("matnlar: 6 ta xabar (sr-only ro‘yxat) — talab qilinganlar", J(await page.$$eval("[data-promo-list] li", (l) => l.map((x) => x.textContent.trim()))) === J(MSGS));
  ok("bir vaqtda faqat bitta xabar ko‘rinadi", (await page.$$("[data-promo-msg]")).length === 1 && (await msgText(page)) === MSGS[0]);
  // D/E: aylanish
  const seen = [await msgText(page)];
  for (let k = 0; k < 6; k++) {
    await page.waitForFunction((prev) => document.querySelector("[data-promo-msg]").textContent.trim() !== prev, seen.at(-1), { timeout: 6000 });
    await page.waitForTimeout(400);
    seen.push(await msgText(page));
  }
  ok("D: xabarlar ketma-ket almashadi va qaytadan boshlanadi", J(seen) === J([...MSGS, MSGS[0]]), J(seen));
  const tr = await page.$eval("[data-promo-msg]", (m) => getComputedStyle(m).transitionProperty + " " + getComputedStyle(m).transitionDuration);
  ok("E: yumshoq o‘tish (opacity + transform, 0.26 s)", /opacity/.test(tr) && /transform/.test(tr) && /0\.26s/.test(tr), tr);
  // F/G: CTA
  const cta = await page.$eval("[data-promo-cta]", (a) => ({ href: a.href, text: a.textContent.trim(), target: a.target, rel: a.rel, tag: a.tagName }));
  ok("F/G: CTA — haqiqiy havola https://t.me/oliy_fizik, «📲 Kursga yozilish», yangi oynada", cta.tag === "A" && cta.href === "https://t.me/oliy_fizik" && cta.text === "📲 Kursga yozilish" && cta.target === "_blank" && /noopener/.test(cta.rel), J(cta));
  const before = await page.$eval("[data-promo-cta]", (a) => a.getBoundingClientRect().top);
  await page.waitForTimeout(4300);
  ok("F: CTA xabar almashganda joyidan qimirlamaydi", Math.abs((await page.$eval("[data-promo-cta]", (a) => a.getBoundingClientRect().top)) - before) < 1);
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("[data-promo-cta]")]);
  ok("G: CTA bosilganda t.me/oliy_fizik ochiladi", popup.url() === "https://t.me/oliy_fizik", popup.url());
  await popup.close();
  // pauza
  await page.mouse.move(1, 1);
  await page.$eval("[data-promo-cta]", (a) => a.blur());
  await page.click("[data-promo-pause]");
  const p0 = await msgText(page);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(5000);
  ok("pauza tugmasi to‘xtatadi (aria-pressed=true)", (await msgText(page)) === p0 && (await page.getAttribute("[data-promo-pause]", "aria-pressed")) === "true" && !(await page.evaluate(() => window.__ofPromo.running)));
  await page.click("[data-promo-pause]");
  await page.mouse.move(1, 1);
  await page.$eval("[data-promo-pause]", (b) => b.blur());
  await page.waitForTimeout(400);
  ok("pauzadan keyin davom etadi", await page.evaluate(() => window.__ofPromo.running));
  // sahifa yashirin
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  ok("sahifa yashirin — taymer to‘xtaydi", !(await page.evaluate(() => window.__ofPromo.running)));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  ok("sahifa ko‘rinadi — davom etadi", await page.evaluate(() => window.__ofPromo.running));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  ok("pagehide — taymer tozalanadi", !(await page.evaluate(() => window.__ofPromo.running)));
  ok("O: banner Firestore'ga yozmaydi", !page.writes.flat().some((p) => !/^users\/u1$/.test(p)), J(page.writes));
  ok("P: mavjud bosh sahifa funksiyalari (statistika, bo‘limlar) ishlaydi", !!(await page.$("#sections .of-feature-item")) && (await page.$$("[data-stats] li")).length > 0);
  ok("N: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// reduced motion
{
  const { ctx, page } = await ctxFor("u1", { reduce: true });
  await page.goto(B + "index.html");
  await page.waitForFunction(() => window.__ofPromo);
  const tr = await page.$eval("[data-promo-msg]", (m) => getComputedStyle(m).transitionDuration);
  const first = await msgText(page);
  await page.waitForFunction((p) => document.querySelector("[data-promo-msg]").textContent.trim() !== p, first, { timeout: 8000 });
  ok("prefers-reduced-motion: animatsiyasiz (transition ≤ 1 ms), sekinroq almashadi", parseFloat(tr) <= 0.001 && !(await page.$(".of-promo__msg.is-leaving")), tr);
  await ctx.close();
}
// mehmon
{
  const { ctx, page } = await ctxFor(null);
  await page.goto(B + "index.html");
  await page.waitForFunction(() => window.__ofPromo);
  ok("mehmon ham bannerni ko‘radi, CTA ishlaydi", (await page.getAttribute("[data-promo-cta]", "href")) === "https://t.me/oliy_fizik" && !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// H–M: responsive + tema
for (const [vp, theme] of [390, 768, 1366].map((w) => ({ width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 })).flatMap((v) => [[v, "light"], [v, "dark"]])) {
  const { ctx, page } = await ctxFor("u1", { viewport: vp, theme });
  await page.goto(B + "index.html");
  await page.waitForFunction(() => window.__ofPromo);
  await page.waitForTimeout(500);
  const g = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const el = document.querySelector("[data-promo]");
    const r = el.getBoundingClientRect();
    const cta = document.querySelector("[data-promo-cta]").getBoundingClientRect();
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([R, G, Bb]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(Bb); };
    const bgOf = (e) => { for (; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3); } return [255, 255, 255]; };
    const cr = (sel) => { const e = document.querySelector(sel); const a = lum(rgb(getComputedStyle(e).color)), b = lum(bgOf(e)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
    return { over: document.documentElement.scrollWidth - W, inside: r.left >= 0 && r.right <= W + 1, ctaIn: cta.left >= 0 && cta.right <= W + 1 && cta.height >= 44,
      title: cr("#promoTitle"), msg: cr("[data-promo-msg]"), cta: cr("[data-promo-cta]"), theme: document.documentElement.dataset.theme };
  });
  ok(`${vp.width}px ${theme}: overflow yo‘q, banner va CTA (≥44 px) ekranda`, g.over <= 0 && g.inside && g.ctaIn && g.theme === theme, J(g));
  ok(`${vp.width}px ${theme}: kontrast — sarlavha/xabar/CTA ≥ 4.5`, g.title >= 4.5 && g.msg >= 4.5 && g.cta >= 4.5, J({ t: g.title, m: g.msg, c: g.cta }));
  await page.locator("[data-promo]").screenshot({ path: path.join(OUT, `promo-${vp.width}-${theme}.png`) });
  ok(`${vp.width}px ${theme}: konsol xatolari yo‘q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-home-promo.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
