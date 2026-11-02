// ==========================================================================
// Attestatsiya → Fizika: E2E — admin «Yangi pullik mock testlar» generatori (mock-03..05), SUN'IY bank bilan
// (haqiqiy bank _private'da; bu test unga bog'liq emas). Yozuvlar mock_server orqali repo firestore.rules dan o'tadi.
//   python3 tools/attestatsiya-fizika/e2e/mock_server.py --port 8811 &
//   E2E_PORT=8811 node tools/attestatsiya-fizika/e2e/e2e_mock_generator.mjs
// ==========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/npm-tools/node_modules/playwright/index.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SDK = path.join(HERE, "sdk");
const B = `http://127.0.0.1:${process.env.E2E_PORT || 8811}/`;
const TC = "attestationPhysicsDailyTests";
const QC = "attestationPhysicsQuestions";
let fails = 0;
const ok = (name, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const post = async (p, body) => (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const dump = async (prefix) => (await post("__mock/dump", { prefix })).docs;
const T0 = new Date("2026-11-02T06:00:00Z");
const ts = (d) => ({ __ts: [Math.floor(d.getTime() / 1000), 0] });

// ---- sun'iy bank: 5 bob × 3 kun, har kunda 3 mavzu × 6 savol; i=1 — savol rasmi, i=2 — yechim rasmi (Firestore figure hujjatlari);
//      Day 2 dagi bitta rasm hujjati ATAYIN yo'q — generator o'sha savolni almashtirishi kerak
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_BYTES = Buffer.from(PNG, "base64").length;
const MISSING = "q2-0-1.png";
const SECS = [["mexanika", "Mexanika"], ["molekulyar", "Molekulyar fizika va termodinamika"], ["elektromagnetizm", "Elektromagnetizm"], ["optika", "Optika"], ["atom-yadro", "Atom va yadro fizikasi"]];
const docs = { "attestationPhysicsSettings/config": { accessMode: "paid", figureBackend: "firestore", totalDays: 15 } };
let day = 0;
for (const [sec, title] of SECS) {
  for (let d = 0; d < 3; d++) {
    day++;
    const tid = `att-fizika-day-${String(day).padStart(2, "0")}`;
    const topics = [0, 1, 2].map((k) => `${title} mavzu ${d * 3 + k}`);
    const qs = [], answers = {}, items = [];
    topics.forEach((tp, ti) => {
      for (let i = 0; i < 6; i++) {
        const id = `AF-${day}-${ti}${i}`;
        const letter = "ABCD"[(day + ti + i) % 4];
        const words = Array.from({ length: 10 }, (_, k) => `so${day}z${ti}${i}w${k}`).join(" ");
        qs.push({ id, section: sec, sectionTitle: title, topic: tp, type: "mcq", evaluationType: "auto", difficulty: "medium", difficultyLevel: 1 + (i % 3),
                  question: [{ t: "p", text: `${title}: ${words} — $v = ${day},${i}\\,\\text{m/s}$ bo‘lsa, toping.` }],
                  options: "ABCD".split("").map((k, j) => ({ key: k, blocks: [{ t: "p", text: `$${day * 10 + ti * 6 + i + j}\\,\\text{J}$` }] })),
                  optionCount: 4, position: qs.length + 1, bookNumber: `${day}.${ti}${i}`, contentVersion: 1 });
        const qf = `q${day}-${ti}-${i}.png`;
        if (i === 1) {
          qs[qs.length - 1].question.push({ t: "figure", id: qf, w: 1, h: 1 });
          if (qf !== MISSING) docs[`${TC}/${tid}/figures/${qf}`] = { testId: tid, id: qf, mime: "image/png", bytes: PNG_BYTES, data: PNG };
        }
        answers[id] = letter;
        items.push({ id, evaluationType: "auto", correctAnswer: letter, solutionResult: letter, solutionStatus: "full",
                     solution: [{ t: "heading", text: "Yechim" }, { t: "p", text: `Hisob: ${words}` }, ...(i === 2 ? [{ t: "figure", id: `s${day}-${ti}.png`, w: 1, h: 1 }] : []), { t: "answer", blocks: [{ t: "p", text: `${letter})` }] }] });
        if (i === 2) docs[`${TC}/${tid}/solutionFigures/s${day}-${ti}.png`] = { testId: tid, id: `s${day}-${ti}.png`, mime: "image/png", bytes: PNG_BYTES, data: PNG };
        docs[`${QC}/${id}/private/answer`] = { id, keyStatus: "valid", correctAnswer: letter, review: { check: null } };
      }
    });
    const ids = qs.map((q) => q.id);
    docs[`${TC}/${tid}`] = { id: tid, course: "fizika", dayNumber: day, section: sec, sectionTitle: title, topics, topicParts: [], questionIds: ids, questionCount: ids.length,
      questionTopicIdx: qs.map((q) => topics.indexOf(q.topic)), questionEval: ids.map(() => "a"), scorableCount: ids.length, openCount: 0, unreliableCount: 0,
      status: day <= 3 ? "published" : "draft", published: day <= 3, publishAt: null, publishedAt: day <= 3 ? ts(new Date(T0 - 864e5 * (5 - day))) : null,
      publishedBy: day <= 3 ? "admin1" : null, solutionAvailableAt: day <= 3 ? ts(new Date(T0 - 864e5 * (4 - day))) : null, archivedAt: null, timeLimitSeconds: null, currentVersion: 1 };
    docs[`${TC}/${tid}/versions/v1`] = { testId: tid, version: 1, dayNumber: day, questionIds: ids, questions: qs };
    docs[`${TC}/${tid}/keys/v1`] = { testId: tid, version: 1, questionIds: ids, answers, scorableCount: ids.length };
    docs[`${TC}/${tid}/solutions/v1`] = { testId: tid, version: 1, questionIds: ids, items };
  }
}
// avvalgi mock-01 (bepul) va mock-02 (pullik): bankdagi 2 ta savolni o'z ichiga oladi
const prevQ = docs[`${TC}/att-fizika-day-01/versions/v1`].questions.slice(0, 2);
for (const [n, paid] of [[1, false], [2, true]]) {
  const tid = `att-fizika-mock-0${n}`;
  docs[`${TC}/${tid}`] = { id: tid, course: "fizika", kind: "mock", dayNumber: 100 + n, mockNumber: n, section: "mock", sectionTitle: `Mock test ${n}`, topics: ["Mexanika"],
    questionIds: [prevQ[n - 1].id], questionCount: 1, questionTopicIdx: [0], questionEval: ["a"], scorableCount: 1, pointsPerQuestion: 2, maxScore: 100,
    status: "published", published: true, publishedAt: ts(new Date(T0 - 864e5)), publishedBy: "admin1", solutionAvailableAt: ts(new Date(T0 - 1e3)), archivedAt: null,
    timeLimitSeconds: 7200, currentVersion: 1, ...(paid ? { paidOnly: true, composition: { fizika: 35, kasbiyStandart: 5, pedagogikMahorat: 10 } } : {}) };
  docs[`${TC}/${tid}/versions/v1`] = { testId: tid, version: 1, dayNumber: 100 + n, questionIds: [prevQ[n - 1].id], questions: [prevQ[n - 1]] };
}
for (const [u, p] of Object.entries({ admin1: { role: "admin" }, pay: { attestationAccess: true }, nox: {} })) docs[`users/${u}`] = { email: `${u}@example.com`, fullName: u, ...p };
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
  await ctx.addInitScript(([u]) => localStorage.setItem("mock-auth", JSON.stringify({ uid: u, email: `${u}@example.com`, displayName: u })), [uid]);
  const page = await ctx.newPage();
  await page.clock.setSystemTime(T0);
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) page.errs.push(m.text()); });
  return { ctx, page };
}
const txt = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, " ").trim();
const MIDS = ["att-fizika-mock-03", "att-fizika-mock-04", "att-fizika-mock-05"];
{
  const { ctx, page } = await ctxFor("admin1");
  await page.goto(B + "admin/attestatsiya-fizika.html");
  await page.waitForSelector("[data-body] tr");
  await page.click("[data-gen-build]");
  await page.waitForFunction(() => /Tayyor|o‘tmadi|xato|yetmadi/i.test(document.querySelector("[data-gen-info]").textContent), null, { timeout: 60000 });
  const info = await txt(page, "[data-gen-info]");
  ok("generator: 3 ta mock tayyor, takror yo'q", /att-fizika-mock-03/.test(info) && /att-fizika-mock-05/.test(info) && /takror yo‘q/.test(info), info.slice(0, 260));
  ok("generator: «Tayyorlash» hech narsa yozmagan", !Object.keys(await dump(`${TC}/att-fizika-mock-03`)).length);
  await page.click("[data-gen-write]");
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => /^Tayyor:/.test(document.querySelector("[data-gen-info]").textContent.trim()), null, { timeout: 120000 });
  const all = [];
  let nFig = 0;
  for (const id of MIDS) {
    const w = await dump(`${TC}/${id}`);
    const t = w[`${TC}/${id}`];
    const figs = Object.keys(w).filter((k) => /\/(figures|solutionFigures)\//.test(k));
    const ver = w[`${TC}/${id}/versions/v1`];
    const sol = w[`${TC}/${id}/solutions/v1`];
    const refs = (x) => (JSON.stringify(x).match(/"t":"figure","id":"([^"]+)"/g) || []).map((m) => m.split('"')[7]);
    const qRefs = refs(ver.questions), sRefs = refs(sol.items);
    ok(`${id}: 4 hujjat + rasmlar (Rules'dan o'tdi), draft, paidOnly, 35+15`, Object.keys(w).length === 4 + figs.length && t.status === "draft" && t.paidOnly === true && t.physicsCount === 35 && t.pedagogyCount === 15, `${Object.keys(w).length}`);
    ok(`${id}: har rasm havolasi uchun mockning o'z figure hujjati bor`, qRefs.every((f) => w[`${TC}/${id}/figures/${f}`]) && sRefs.every((f) => w[`${TC}/${id}/solutionFigures/${f}`]) && figs.length === new Set(qRefs).size + new Set(sRefs).size, `savol ${qRefs.length}, yechim ${sRefs.length}`);
    ok(`${id}: rasmi yo'q savol (${MISSING}) kirmagan`, !qRefs.includes(MISSING));
    nFig += figs.length;
    all.push(...t.questionIds);
  }
  ok("rasmli savollar ham tanlangan", nFig > 0, `${nFig} ta rasm hujjati`);
  ok("150 savol noyob, mock-01/02 savollari yo'q", new Set(all).size === 150 && !all.includes(prevQ[0].id) && !all.includes(prevQ[1].id));
  const rows = await txt(page, "[data-body]");
  ok("jadval: tarkib «35 fizika + 15 pedagogika · pullik»", /35 fizika \+ 15 pedagogika · pullik/.test(rows), rows.slice(0, 200));
  await page.click(`[data-publish="att-fizika-mock-03"]`);
  await page.click(".of-admin-confirm .of-btn--primary");
  await page.waitForFunction(() => !document.querySelector('[data-publish="att-fizika-mock-03"]'), null, { timeout: 15000 });
  ok("mock-03 PUBLISH", (await dump(`${TC}/att-fizika-mock-03`))[`${TC}/att-fizika-mock-03`].status === "published");
  ok("admin: konsol xatolari yo'q", !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
for (const [uid, open] of [["pay", true], ["nox", false]]) {
  const { ctx, page } = await ctxFor(uid);
  await page.goto(B + "attestatsiya/fizikaattestatsiya.html");
  await page.waitForFunction(() => document.querySelector("[data-mock-section]") && !document.querySelector("[data-mock-section]").hidden, null, { timeout: 20000 });
  const cards = await page.$$eval("[data-mock-card]", (els) => els.map((e) => ({ t: e.textContent.replace(/\s+/g, " "), r: e.hasAttribute("data-mock-restricted"), start: !!e.querySelector('a[href="fizika-test.html?day=103"]') })));
  const c3 = cards.find((c) => /Mock test 3/.test(c.t));
  ok(`${uid}: Mock test 3 kartasi ${open ? "ochiq" : "qulflangan"}`, c3 && (open ? c3.start && !c3.r : c3.r && !c3.start) && /35 fizika \+ 15 pedagogika/.test(c3.t), c3?.t.slice(0, 160));
  if (open) {
    await page.goto(B + "attestatsiya/fizika-test.html?day=103");
    await page.waitForSelector("[data-start]", { timeout: 20000 });
    const intro = await txt(page, ".att-intro");
    ok("pay: test sahifasi — «har bobdan 7 tadan; so‘ng Pedagogika bo‘limi (15 ta)»", /7 tadan/.test(intro) && /15 ta/.test(intro), intro.slice(0, 300));
    await page.click("[data-start]");
    await page.waitForSelector(".att-q", { timeout: 20000 });
    let figQ = 0, bad = 0;
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(80);
      const all = await page.$$eval(".att-q img", (a) => a.length);
      if (all) {
        await page.waitForFunction(() => [...document.querySelectorAll(".att-q img")].every((x) => x.complete && x.src.startsWith("blob:")), null, { timeout: 8000 }).catch(() => {});
        figQ++;
        if (await page.$$eval(".att-q img", (a) => a.filter((x) => !(x.complete && x.naturalWidth > 0)).length)) bad++;
      }
      if (i < 49) await page.click("[data-next]");
    }
    const imgs = figQ, imgs2 = bad ? 0 : figQ;
    ok("pay: mock testdagi rasmlar yuklanadi (mockning o'z Firestore hujjatidan)", imgs > 0 && imgs2 === imgs, `rasmli ${imgs}, yuklanmagan ${imgs - imgs2}`);
  }
  ok(`${uid}: konsol xatolari yo'q`, !page.errs.length, page.errs.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAIL` : "\nALL PASS");
process.exit(fails ? 1 : 0);
