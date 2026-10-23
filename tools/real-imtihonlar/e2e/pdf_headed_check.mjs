// Real imtihonlar — PDF ko'ruvchini HEADED (to'liq, headless EMAS) Chromium'da tekshirish.
//   xvfb-run -a node tools/real-imtihonlar/e2e/pdf_headed_check.mjs   (E2E_PORT — run_mock.py porti)
// Faqat lokal fixture PDF; production'ga ulanmaydi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
const { chromium } = await import(process.env.PLAYWRIGHT || "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const SDK = path.join(ROOT, "tools/attestatsiya-fizika/e2e/sdk");
const OUT = path.join(ROOT, "_private/real-imtihonlar/e2e");
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8801}/`;
const checks = [];
const ok = (n, c, d = "") => { checks.push({ name: n, pass: !!c, detail: String(d) }); console.log(`${c ? "PASS" : "FAIL"} ${n}${d !== "" ? ` — ${d}` : ""}`); };

await fetch(B + "__mock/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docs: { "users/C": { fullName: "User C", email: "c@example.com", xp: 0, level: 1, createdAt: { __ts: [1790000000, 0] }, mockTestsAccess: true } } }) });
const browser = await chromium.launch({ headless: false, args: ["--no-sandbox", "--window-position=0,0", "--window-size=1280,900"] });
ok("brauzer: headed Chromium", true, `${browser.version()} (headless: false, Xvfb displey)`);
const ctx = await browser.newContext({ viewport: null }); // haqiqiy oyna o'lchami (OS darajasidagi skrinshot uchun)
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await ctx.route(/www\.gstatic\.com\/firebasejs\/[^/]+\/([a-z-]+\.js)/, (r) => { const m = r.request().url().match(/\/([a-z-]+\.js)$/); r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(path.join(SDK, m[1])) }); });
await ctx.addInitScript(() => localStorage.setItem("mock-auth", JSON.stringify({ uid: "C", email: "c@example.com", displayName: "C" })));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });

const URL1 = B + "milliy-sertifikat/real-imtihonlar/imtihon.html?id=REAL-2026-09-30-B";
await page.goto(URL1);
await page.waitForSelector(".rx-pdf__frame", { timeout: 20000 });
ok("1. imtihon sahifasi ochildi", (await page.textContent("h1")).includes("30.09.2026 — Variant B"));
ok("2. PDF ko‘ruvchi UI chiqdi", await page.locator(".rx-pdf__frame").isVisible());
const src = await page.getAttribute(".rx-pdf__frame", "src");
ok("3. blob URL yaratildi", src.startsWith("blob:"), src.slice(0, 40));
const type = await page.evaluate(async (u) => (await (await fetch(u)).blob()).type, src);
ok("4. PDF turi application/pdf", type === "application/pdf", type);
ok("brauzer PDF ko‘ruvchisi yoqilgan (navigator.pdfViewerEnabled)", await page.evaluate(() => navigator.pdfViewerEnabled === true), await page.evaluate(() => String(navigator.pdfViewerEnabled)));
await page.evaluate(() => document.querySelector(".rx-pdf__frame").scrollIntoView({ block: "start" }));
await page.waitForTimeout(8000);
const viewerFrame = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith("blob:"));
let embed = null;
try { embed = viewerFrame ? await viewerFrame.evaluate(() => { const e = document.querySelector("embed"); return e ? { type: e.type, w: e.clientWidth, h: e.clientHeight } : null; }) : null; } catch (e) { embed = { error: e.message }; }
// Plugin (Chrome PDF viewer) CDP skrinshotida chiqmaydi — shuning uchun Xvfb displeyidan OS darajasida olinadi.
const geo = await page.evaluate(() => { const r = document.querySelector(".rx-pdf__frame").getBoundingClientRect();
  return { x: r.left + window.screenX, y: r.top + window.screenY + (window.outerHeight - window.innerHeight), w: r.width, h: r.height }; });
const shotPath = path.join(OUT, "pdf-headed-screen.png");
execSync(`import -window root ${shotPath}`);
const ana = JSON.parse(execSync(`python3 -c "
import json,sys
from PIL import Image
im=Image.open(sys.argv[1]).convert('L'); x,y,w,h=[int(float(v)) for v in sys.argv[2:6]]
c=im.crop((x+w//3,y+60,x+w-20,y+h-20)); px=list(c.getdata()); n=len(px)
print(json.dumps({'white':sum(1 for v in px if v>245)/n,'ink':sum(1 for v in px if v<60)/n}))
" ${shotPath} ${geo.x} ${geo.y} ${geo.w} ${geo.h}`).toString());
ok("5. brauzer PDF ko‘ruvchisi render qildi (embed application/pdf + ekranda oq sahifa va matn)", embed?.type === "application/pdf" && ana.white > 0.3 && ana.ink > 0.001,
  `embed ${JSON.stringify(embed)}; oq ${(ana.white * 100).toFixed(1)}%, matn ${(ana.ink * 100).toFixed(2)}%`);

// 6. reload
errs.length = 0;
await page.reload();
await page.waitForSelector(".rx-pdf__frame", { timeout: 20000 });
const src2 = await page.getAttribute(".rx-pdf__frame", "src");
ok("6. reloaddan keyin xato yo‘q, yangi blob URL", errs.length === 0 && src2.startsWith("blob:") && src2 !== src, errs.join(" | "));
// 7. back / forward
await page.click(".rx-head__actions a"); // Yechimlarni ko‘rish
await page.waitForSelector(".rx-q", { timeout: 20000 });
ok("7a. Yechimlar sahifasiga o‘tildi", page.url().includes("yechimlar.html?id=REAL-2026-09-30-B"));
await page.goBack();
await page.waitForSelector(".rx-pdf__frame", { timeout: 20000 });
ok("7b. back -> imtihon sahifasi, PDF qayta yuklandi", page.url() === URL1 && (await page.getAttribute(".rx-pdf__frame", "src")).startsWith("blob:"));
await page.goForward();
await page.waitForSelector(".rx-q", { timeout: 20000 });
ok("7c. forward -> yechimlar sahifasi", page.url().includes("yechimlar.html"));
await page.click("[data-next]"); await page.click("[data-next]");
await page.goBack(); await page.waitForTimeout(500);
ok("7d. yechimlar ichida back -> oldingi savol (?q)", (await page.textContent("#rxQTitle")) === "2-savol", await page.textContent("#rxQTitle"));
ok("JS xatolari yo‘q", errs.length === 0, errs.join(" | "));
await browser.close();
fs.writeFileSync(path.join(OUT, "pdf-headed-report.json"), JSON.stringify({ when: new Date().toISOString(), checks }, null, 1));
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} PASS`);
process.exit(failed ? 1 : 0);
