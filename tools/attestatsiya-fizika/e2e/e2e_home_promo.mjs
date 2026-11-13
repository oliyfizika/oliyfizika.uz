// ==========================================================================
// Bosh sahifa: «Milliy sertifikat — bepul mock testlar» 3D karuseli (oldingi Attestatsiya — Fizika banneri o'rnida).
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
const TITLES = [15, 14, 13, 12, 11].map((n) => `Fizika Mock Test №${n}`);
const HREFS = [15, 14, 13, 12, 11].map((n) => `milliy-sertifikat/mock-testlar/test.html?id=mock-test-${n}`);
const ALL_PATH = "milliy-sertifikat/mock-testlar/index.html";
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
const active = (page) => page.$eval('[data-cf-card][data-pos="0"] .of-cf__title', (e) => e.textContent.trim());
const positions = (page) => page.$$eval("[data-cf-card]", (l) => l.map((c) => c.dataset.pos));

{
  const { ctx, page } = await ctxFor("u1");
  await page.goto(B + "index.html");
  await page.waitForSelector("[data-promo]");
  await page.waitForFunction(() => window.__ofPromo);
  ok("B: simulyatsiya promo bloki yo‘q (data-sim / canvas)", !(await page.$("[data-sim]")) && !(await page.$(".of-sim__canvas")) && !(await page.evaluate(() => window.__ofSim)));
  ok("C: karusel — «Bepul mock testlar», hero ichida, Attestatsiya reklamasi yo‘q", (await page.textContent("#promoTitle")).trim() === "Bepul mock testlar" && !(await page.$("[data-promo] a[href*='t.me']")) && !/attestatsiya/i.test(await page.textContent("[data-promo]")) && !!(await page.$(".of-hero [data-promo]")));
  ok("kartochkalar: 5 ta mock test (№15…№11), har biri o‘z testiga havola", J(await page.$$eval("[data-cf-card] .of-cf__title", (l) => l.map((x) => x.textContent.trim()))) === J(TITLES) && J(await page.$$eval("[data-cf-card] a", (l) => l.map((x) => x.getAttribute("href")))) === J(HREFS));
  ok("boshlang‘ich holat: o‘rtada №15, yonlarida №11 va №14", (await active(page)) === TITLES[0] && J(await positions(page)) === J(["0", "1", "2", "-2", "-1"]), J(await positions(page)));
  ok("faqat o‘rtadagi kartochka fokuslanadi (yonlari tabindex=-1, aria-hidden)", J(await page.$$eval("[data-cf-card]", (l) => l.map((c) => c.querySelector("a").tabIndex + "/" + c.getAttribute("aria-hidden")))) === J(["0/false", "-1/true", "-1/true", "-1/true", "-1/true"]));
  ok("nuqtalar: 5 ta tugma, birinchisi faol", (await page.$$("[data-promo-dots] button")).length === 5 && (await page.getAttribute("[data-promo-dots] li:first-child button", "aria-current")) === "true");
  // D: avtomatik aylanish
  const seen = [await active(page)];
  for (let k = 0; k < 5; k++) {
    await page.waitForFunction((prev) => document.querySelector('[data-cf-card][data-pos="0"] .of-cf__title').textContent.trim() !== prev, seen.at(-1), { timeout: 7000 });
    seen.push(await active(page));
  }
  ok("D: kartochkalar ketma-ket almashadi va aylana bo‘yicha qaytadi", J(seen) === J([...TITLES, TITLES[0]]), J(seen));
  const tr = await page.$eval("[data-cf-card]", (m) => getComputedStyle(m).transitionProperty + " " + getComputedStyle(m).transitionDuration);
  ok("E: yumshoq o‘tish (transform, 0.52 s)", /transform/.test(tr) && /0\.52s/.test(tr), tr);
  // yon kartochka, nuqtalar, klaviatura
  await page.click("[data-promo-pause]"); // avtomatik aylanish to'xtaydi, o'tish animatsiyasi tugaydi
  await page.waitForTimeout(700);
  const sb = await page.locator('[data-cf-card][data-pos="1"]').boundingBox();
  const cb = await page.locator('[data-cf-card][data-pos="0"]').boundingBox();
  const ab = await page.locator("[data-promo]").boundingBox();
  await page.mouse.click((cb.x + cb.width + Math.min(sb.x + sb.width, ab.x + ab.width)) / 2, sb.y + sb.height / 2);
  await page.waitForTimeout(150);
  ok("F: yon kartochka bosilsa — o‘rtaga keladi, sahifa o‘zgarmaydi", (await active(page)) === TITLES[1] && page.url() === B + "index.html", await active(page));
  await page.click("[data-promo-dots] li:nth-child(4) button");
  ok("G: nuqta bosilsa — shu kartochka o‘rtaga keladi", (await active(page)) === TITLES[3]);
  await page.focus("[data-promo-dots] li:nth-child(4) button");
  await page.keyboard.press("ArrowRight");
  ok("klaviatura: → keyingi kartochka", (await active(page)) === TITLES[4]);
  await page.keyboard.press("ArrowLeft");
  ok("klaviatura: ← oldingi kartochka", (await active(page)) === TITLES[3]);
  // surish
  const box = await page.locator("[data-cf]").boundingBox();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + 60, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  ok("surish (swipe) chapga — keyingi kartochka, havola ochilmaydi", (await active(page)) === TITLES[4] && page.url() === B + "index.html", await active(page));
  const all = await page.$eval("[data-promo-cta]", (a) => ({ href: a.href, text: a.textContent.trim(), target: a.target }));
  ok("«Barcha mock testlar» — katalogga havola, shu oynada", all.href === B + ALL_PATH && all.text === "Barcha mock testlar" && !all.target, J(all));
  // o'rtadagi kartochka — testga o'tadi
  await page.click("[data-promo-dots] li:nth-child(1) button");
  await Promise.all([page.waitForURL(/test\.html\?id=mock-test-15/), page.click('[data-cf-card][data-pos="0"] a')]);
  ok("o‘rtadagi kartochka bosilsa — Mock Test №15 ochiladi", /test\.html\?id=mock-test-15$/.test(page.url()), page.url());
  await page.goto(B + "index.html");
  await page.waitForFunction(() => window.__ofPromo);
  // pauza
  await page.mouse.move(1, 1);
  await page.click("[data-promo-pause]");
  await page.mouse.move(1, 1);
  await page.$eval("[data-promo-pause]", (b) => b.blur());
  const p0 = await active(page);
  await page.waitForTimeout(5600);
  ok("pauza tugmasi to‘xtatadi (aria-pressed=true)", (await active(page)) === p0 && (await page.getAttribute("[data-promo-pause]", "aria-pressed")) === "true" && !(await page.evaluate(() => window.__ofPromo.running)));
  await page.click("[data-promo-pause]");
  await page.mouse.move(1, 1);
  await page.$eval("[data-promo-pause]", (b) => b.blur());
  await page.waitForTimeout(300);
  ok("pauzadan keyin davom etadi", await page.evaluate(() => window.__ofPromo.running));
  await page.hover("[data-cf]");
  ok("sichqoncha ustida — to‘xtaydi", !(await page.evaluate(() => window.__ofPromo.running)));
  await page.mouse.move(1, 1);
  await page.waitForTimeout(100);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  ok("sahifa yashirin — taymer to‘xtaydi", !(await page.evaluate(() => window.__ofPromo.running)));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  ok("sahifa ko‘rinadi — davom etadi", await page.evaluate(() => window.__ofPromo.running));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  ok("pagehide — taymer tozalanadi", !(await page.evaluate(() => window.__ofPromo.running)));
  ok("O: karusel Firestore'ga yozmaydi", !page.writes.flat().some((p) => !/^users\/u1$/.test(p)), J(page.writes));
  ok("P: mavjud bosh sahifa funksiyalari (statistika, bo‘limlar) ishlaydi", !!(await page.$("#sections .of-feature-item")) && (await page.$$("[data-stats] li")).length > 0);
  ok("N: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// reduced motion
{
  const { ctx, page } = await ctxFor("u1", { reduce: true });
  await page.goto(B + "index.html");
  await page.waitForFunction(() => window.__ofPromo);
  const tr = await page.$eval("[data-cf-card]", (m) => getComputedStyle(m).transitionDuration);
  const t0 = Date.now();
  await page.waitForFunction((p) => document.querySelector('[data-cf-card][data-pos="0"] .of-cf__title').textContent.trim() !== p, TITLES[0], { timeout: 9000 });
  const dt = Date.now() - t0;
  ok("prefers-reduced-motion: animatsiyasiz, sekinroq (≈7 s) almashadi", parseFloat(tr) <= 0.001 && dt > 6000, `${tr} ${dt} ms`);
  await ctx.close();
}
// mehmon
{
  const { ctx, page } = await ctxFor(null);
  await page.goto(B + "index.html");
  await page.waitForFunction(() => window.__ofPromo);
  ok("mehmon ham karuselni ko‘radi", (await page.$$("[data-cf-card]")).length === 5 && !page.errs.length, page.errs.join(" | "));
  await page.click('[data-cf-card][data-pos="0"] a');
  await page.waitForTimeout(400);
  ok("mehmon kartochkani bossa — kirish oynasi ochiladi, sahifa o‘zgarmaydi", page.url() === B + "index.html" && await page.evaluate(() => [...document.querySelectorAll("dialog[open], [role=dialog]")].some((d) => d.offsetParent !== null || d.open)), page.url());
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
    const cta = document.querySelector('[data-cf-card][data-pos="0"]').getBoundingClientRect();
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([R, G, Bb]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(Bb); };
    const bgOf = (e) => { for (; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3); } return [255, 255, 255]; };
    // Kartochka matni to'q qoplama (slate-950, ≥ 82 %) ustida — fon shu rang bilan o'lchanadi.
    const cr = (sel, onCard = false) => { const e = document.querySelector(sel); const a = lum(rgb(getComputedStyle(e).color)), b = lum(onCard ? [11, 16, 27] : bgOf(e)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
    return { over: document.documentElement.scrollWidth - W, inside: r.left >= 0 && r.right <= W + 1, ctaIn: cta.left >= 0 && cta.right <= W + 1 && cta.height >= 200,
      title: cr("#promoTitle"), msg: cr('[data-cf-card][data-pos="0"] .of-cf__meta span:last-child', true), cta: cr("[data-promo-cta] span"), card: cr('[data-cf-card][data-pos="0"] .of-cf__title', true), theme: document.documentElement.dataset.theme };
  });
  ok(`${vp.width}px ${theme}: overflow yo‘q, karusel va o‘rtadagi kartochka ekranda`, g.over <= 0 && g.inside && g.ctaIn && g.theme === theme, J(g));
  ok(`${vp.width}px ${theme}: kontrast — sarlavha/kartochka/havola ≥ 4.5`, g.title >= 4.5 && g.msg >= 4.5 && g.cta >= 4.5 && g.card >= 4.5, J({ t: g.title, m: g.msg, c: g.cta, k: g.card }));
  await page.locator("[data-promo]").screenshot({ path: path.join(OUT, `promo-${vp.width}-${theme}.png`) });
  ok(`${vp.width}px ${theme}: konsol xatolari yo‘q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-home-promo.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
