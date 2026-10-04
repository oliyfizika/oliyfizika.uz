// ==========================================================================
// Attestatsiya → Fizika: E2E — kunlik test sahifasidagi ilmiy kalkulyator (mock test kalkulyatori qayta ishlatilgan).
// Kalkulyator test holatiga (javoblar, taymer, urinish, Firestore) ta'sir qilmasligi tekshiriladi.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8801 &
//   E2E_PORT=8801 node tools/attestatsiya-fizika/e2e/e2e_calculator.mjs
// Natija: _private/attestatsiya-fizika/e2e/report-calculator.json; exit 1 — biror tekshiruv FAIL.
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
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8801}/`;
const SDK = path.join(HERE, "sdk");
const bundle = JSON.parse(fs.readFileSync(path.join(PRIV, "firestore-import.json"), "utf8"));
const opData = (p) => structuredClone(bundle.ops.find((o) => o.path === p).data);
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: Boolean(cond), detail }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const clock = (d) => post("__mock/clock", { iso: d.toISOString() });
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });
const J = (x) => JSON.stringify(x);
const TC = "attestationPhysicsDailyTests";
const AC = "attestationPhysicsAttempts";
const D1 = "att-fizika-day-01";
const T0 = new Date("2026-10-04T16:00:00Z");
const S = new Date(T0.getTime() + 3 * 3600000);
const plus = (d, s) => new Date(d.getTime() + s * 1000);

const docs = { "attestationPhysicsSettings/config": { ...opData("attestationPhysicsSettings/config"), figureBackend: "firestore" } };
docs[`${TC}/${D1}`] = { ...opData(`${TC}/${D1}`), status: "published", published: true, publishedAt: ts(new Date(T0.getTime() - 3600000)), publishedBy: "admin1", solutionAvailableAt: ts(S) };
for (const c of ["versions", "keys", "solutions"]) docs[`${TC}/${D1}/${c}/v1`] = opData(`${TC}/${D1}/${c}/v1`);
for (const u of ["u1", "u2", "u3", "u4"]) docs[`users/${u}`] = { fullName: u, email: `${u}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) };
await post("__mock/reset", {});
await clock(T0);
await post("__mock/seed", { docs });

const browser = await chromium.launch();
async function ctxFor(uid, time, { viewport = { width: 1366, height: 900 }, theme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport });
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
  await page.clock.setSystemTime(time);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) page.errs.push(m.text()); });
  page.apiLog = [];
  page.on("request", (r) => { if (r.url().endsWith("/__mock/api")) { try { const j = JSON.parse(r.postData()); page.apiLog.push(j.op + ":" + (j.path || j.col || "")); } catch { /* */ } } });
  return { ctx, page };
}
const att = async (uid) => (await dump(`${AC}/${uid}__${D1}`))[`${AC}/${uid}__${D1}`];
const calcOpen = (page) => page.$(".att-calc-modal .att-calc");
const press = async (page, keys) => { for (const k of keys) await page.click(`.att-calc-modal .calc-grid button[data-k="${k}"]`); };
const result = (page) => page.textContent(".att-calc-modal .calc-result").then((t) => t.trim());
const pageState = (page) => page.evaluate(() => ({
  q: document.querySelector("#attQNum")?.textContent.trim() || document.querySelector(".att-q h2, .att-q__num")?.textContent.trim() || "",
  selected: [...document.querySelectorAll(".att-opt")].filter((o) => o.getAttribute("aria-checked") === "true" || o.classList.contains("is-selected") || o.getAttribute("aria-pressed") === "true").map((o) => o.dataset.key),
  answered: document.querySelector("[data-count]")?.textContent.trim(),
}));
async function startTest(page) {
  await page.goto(B + "attestatsiya/fizika-test.html?day=1");
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
}

// ---------------------------------------------------------------- u1: test davomida kalkulyator
{
  const { ctx, page } = await ctxFor("u1", plus(T0, 60));
  await clock(plus(T0, 60));
  await startTest(page);
  ok("tugma: «Kalkulyator» test panelida (.att-bar)", !!(await page.$(".att-bar [data-calc]")) && /Kalkulyator/.test(await page.getAttribute("[data-calc]", "aria-label")));
  await page.click('.att-opt[data-key="B"]');
  await page.click("[data-next]");
  await page.click('.att-opt[data-key="C"]');
  await page.waitForTimeout(7000);                                   // qoralama saqlansin
  const saved = (await att("u1")).answers;
  const before = await pageState(page);
  const clock0 = await page.textContent("[data-clock]");
  page.apiLog.length = 0;
  // A. ochish
  await page.click("[data-calc]");
  await page.waitForSelector(".att-calc-modal .att-calc");
  ok("A: kalkulyator ochildi (mock test UI: displey + 30 tugma, DEG)", (await page.$$(".att-calc-modal .calc-grid button")).length === 30 && (await page.textContent(".att-calc-modal .calc-mode")) === "DEG"
     && (await page.getAttribute("[data-calc]", "aria-expanded")) === "true");
  // D. ifodalar (tugmalar)
  await press(page, ["2", "+", "3", "×", "4", "="]);
  ok("D: 2+3×4 = 14", (await result(page)) === "14");
  await press(page, ["C", "sin(", "3", "0", ")"]);
  ok("D: sin(30) = 0.5 (DEG, jonli natija)", (await result(page)) === "0.5");
  await press(page, ["C", "√", "1", "6", ")", "="]);
  ok("D: √(16) = 4", (await result(page)) === "4");
  await press(page, ["C", "ln(", "e", ")"]);
  ok("D: ln(e) = 1", (await result(page)) === "1");
  await press(page, ["C", "1", "÷", "0"]);
  ok("D: 1÷0 → «Xatolik»", (await result(page)) === "Xatolik");
  await press(page, ["C", "DEG", "sin(", "π", "÷", "2", ")"]);
  ok("D: RAD rejimi: sin(π÷2) = 1", (await result(page)) === "1" && (await page.textContent(".att-calc-modal .calc-mode")) === "RAD");
  await press(page, ["DEG", "C"]);
  // klaviatura (mock testdagi kabi)
  await page.keyboard.type("2^10");
  await page.keyboard.press("Enter");
  ok("klaviatura: 2^10 Enter → 1024", (await result(page)) === "1024");
  await page.keyboard.press("Delete");
  await page.keyboard.type("(1.5+2.5)*3/4-1");
  ok("klaviatura: (1.5+2.5)*3/4-1 → 2 (*, /, - xaritasi)", (await result(page)) === "2", await page.inputValue("#calcInput"));
  await page.keyboard.press("Backspace");
  ok("klaviatura: Backspace → ⌫", (await page.inputValue("#calcInput")) === "(1.5+2.5)×3÷4−");
  // ArrowRight / raqamlar test savoliga ta'sir qilmaydi
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("1234");
  // E. taymer davom etadi
  await page.waitForTimeout(2200);
  const clock1 = await page.textContent("[data-clock]");
  ok("E: kalkulyator ochiq — taymer davom etmoqda", clock1 !== clock0, `${clock0} → ${clock1}`);
  // B. yopish (Esc), C. qayta ochish — ifoda saqlanadi
  const expr = await page.inputValue("#calcInput");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("B: Esc bilan yopildi", !(await calcOpen(page)) && (await page.getAttribute("[data-calc]", "aria-expanded")) === "false");
  await page.click("[data-calc]");
  await page.waitForSelector(".att-calc-modal .att-calc");
  ok("C: qayta ochildi — ifoda saqlangan (mock testdagi kabi)", (await page.inputValue("#calcInput")) === expr && (await page.$$("#calcInput")).length === 1);
  await page.click(".att-calc-modal .of-modal__close");
  await page.waitForTimeout(200);
  ok("B: ✕ tugmasi bilan yopildi, fokus tugmaga qaytdi", !(await calcOpen(page)) && (await page.evaluate(() => document.activeElement?.dataset?.calc !== undefined)));
  // F. holat o'zgarmadi
  const after = await pageState(page);
  ok("F: savol, tanlangan variant va javoblar soni o‘zgarmadi", J(after) === J(before), `${J(before)} | ${J(after)}`);
  ok("F: Firestore'dagi javoblar o‘zgarmadi", J((await att("u1")).answers) === J(saved));
  ok("Firestore: kalkulyator hech narsa yozmadi/o‘qimadi", page.apiLog.length === 0, J(page.apiLog));
  // J. sahifani qayta yuklash
  await page.reload();
  await page.click("[data-start]");
  await page.waitForSelector(".att-q");
  await page.click("[data-calc]");
  await page.waitForSelector(".att-calc-modal .att-calc");
  await press(page, ["7", "×", "6", "="]);
  ok("J: qayta yuklangandan keyin kalkulyator ishlaydi (7×6 = 42), urinish o‘sha", (await result(page)) === "42" && (await att("u1")).status === "in_progress" && J((await att("u1")).answers) === J(saved));
  await page.keyboard.press("Escape");
  // G. qo'lda yakunlash
  await page.click("[data-calc]");
  await page.keyboard.press("Escape");
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-review .att-rev");
  const a1 = await att("u1");
  ok("G: kalkulyatordan keyin qo‘lda yakunlash — graded, javoblar aynan saqlangani", a1.status === "graded" && J(a1.answers) === J(saved) && !("autoFinalized" in a1));
  ok("Result Review: o‘zgarishsiz (32 karta), kalkulyator tugmasi natija sahifasida yo‘q", (await page.$$(".att-rev")).length === 32 && !(await page.$("[data-calc]")));
  ok("u1: konsol xatolari yo‘q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

// ---------------------------------------------------------------- u2: yechim vaqti yaqinida (H) va avtomatik yakun (I)
{
  await clock(plus(S, -1200));
  const { ctx, page } = await ctxFor("u2", plus(S, -1200));
  await startTest(page);
  await page.click('.att-opt[data-key="A"]');
  await page.waitForTimeout(7000);
  const saved = (await att("u2")).answers;
  await clock(plus(S, -30));
  await page.click("[data-calc]");
  await press(page, ["9", ".", "8", "×", "2", "="]);
  ok("H: S dan 30 s oldin kalkulyator ishlaydi (9.8×2 = 19.6), urinish in_progress", (await result(page)) === "19.6" && (await att("u2")).status === "in_progress");
  await clock(plus(S, 60));                                          // server vaqti S dan o'tdi
  await page.keyboard.press("Escape");
  await page.click("[data-finish]");
  await page.click(".of-modal__actions .of-btn--success");
  await page.waitForSelector(".att-review .att-rev", { timeout: 20000 });
  const a2 = await att("u2");
  ok("I: S dan keyin — avtomatik yakunlandi, javoblar o‘zgarmagan, kalkulyator ta’sirsiz", a2.status === "graded" && a2.autoFinalized === true && J(a2.answers) === J(saved));
  await ctx.close();
  const { ctx: c2, page: p2 } = await ctxFor("u2", plus(S, 3600));
  await clock(plus(S, 3600));
  await p2.goto(B + "attestatsiya/fizika-test.html?day=1");
  await p2.waitForSelector(".att-review .att-rev");
  ok("I: avtomatik yakundan keyin natija sahifasi xatosiz ochiladi", (await p2.$$(".att-rev")).length === 32 && !p2.errs.length, p2.errs.join(" | "));
  await c2.close();
}

// ---------------------------------------------------------------- K/L. responsive + tema
for (const [vp, theme] of [390, 768, 1366].map((w) => ({ width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 })).flatMap((v) => [[v, "light"], [v, "dark"]])) {
  await clock(plus(T0, 300));
  const uid = `r${vp.width}${theme}`;
  await post("__mock/seed", { docs: { [`users/${uid}`]: { fullName: uid, email: `${uid}@example.com`, xp: 0, level: 1, fullAccess: false, createdAt: ts(T0) } } });
  const { ctx, page } = await ctxFor(uid, plus(T0, 300), { viewport: vp, theme });
  await startTest(page);
  const btn = await page.$eval("[data-calc]", (b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, vis: r.width > 0 }; });
  await page.click("[data-calc]");
  await page.waitForSelector(".att-calc-modal .att-calc");
  await press(page, ["1", "2", "+", "3", "0", "="]);
  const g = await page.evaluate(() => {
    const W = document.documentElement.clientWidth, H = innerHeight;
    const d = document.querySelector(".att-calc-modal .of-modal__dialog").getBoundingClientRect();
    const btns = [...document.querySelectorAll(".att-calc-modal .calc-grid button")].map((b) => b.getBoundingClientRect());
    const disp = getComputedStyle(document.querySelector(".att-calc-modal .calc-display"));
    const eqEl = document.querySelector(".att-calc-modal .calc-grid .eq");
    const eq = getComputedStyle(eqEl);
    const probe = document.createElement("i"); probe.style.color = "var(--of-primary-solid)"; document.body.append(probe);
    const primary = getComputedStyle(probe).color; probe.remove();
    const key = getComputedStyle(document.querySelector('.att-calc-modal .calc-grid button[data-k="7"]'));
    return { inView: d.left >= 0 && d.right <= W + 1 && d.top >= 0, btnsIn: btns.every((r) => r.left >= d.left - 1 && r.right <= d.right + 1 && r.width >= 30 && r.height >= 30),
      over: document.documentElement.scrollWidth - W, theme: document.documentElement.dataset.theme, disp: disp.backgroundColor, eq: eq.backgroundColor, primary, eqText: eq.color,
      keyColor: key.color, keyBg: key.backgroundColor, minTap: Math.min(...btns.map((r) => Math.min(r.width, r.height))), dH: Math.round(d.height), H };
  });
  ok(`${vp.width}px ${theme}: tugma ekranda, oyna va 30 tugma ekranda, overflow yo‘q, natija 42`,
     btn.vis && btn.l >= 0 && btn.r <= btn.w && g.inView && g.btnsIn && g.over <= 0 && g.theme === theme && (await result(page)) === "42", J({ ...g, btn }));
  ok(`${vp.width}px ${theme}: mock test uslubi — displey #0f1522, «=» primary (hover holatida ham), tugma matni tema rangida`,
     g.disp === "rgb(15, 21, 34)" && g.eq === g.primary && g.eqText === "rgb(255, 255, 255)" && g.keyColor !== g.keyBg, `${g.disp} ${g.eq} ${g.keyColor}/${g.keyBg}`);
  await page.locator(".att-calc-modal .of-modal__dialog").screenshot({ path: path.join(OUT, `calc-${vp.width}-${theme}.png`) });
  ok(`${vp.width}px ${theme}: konsol xatolari yo‘q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}

await browser.close();
const passed = checks.filter((c) => c.pass).length;
fs.writeFileSync(path.join(OUT, "report-calculator.json"), JSON.stringify({ at: new Date().toISOString(), passed, total: checks.length, checks }, null, 1));
console.log(`\n${passed}/${checks.length} — ${passed === checks.length ? "PASS" : "FAIL"}`);
process.exit(passed === checks.length ? 0 : 1);
