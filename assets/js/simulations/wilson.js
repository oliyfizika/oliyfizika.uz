// ==========================================================================
// Vilson kamerasi — virtual laboratoriya (simulations/wilson.html)
// Kengaytirish (porshen) → o‘ta to‘yingan bug‘da zarralar izlari tomchilar zanjiri sifatida paydo bo‘ladi va suratga olinadi.
// Manbalar: ²¹⁰Po, ²⁴¹Am, ²²⁸Th (α), ⁹⁰Sr/⁹⁰Y (β⁻), ²²Na (β⁺); kosmik myuonlar. Magnit maydon B = 0…0,3 T, ⊙/⊗.
// Suratda o‘lchash: chizg‘ich (ikki nuqta) va 3 nuqta orqali aylana (egrilik radiusi), lupa ×4.
// Daftar: labnotebook.js; hisobot: wilson-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, prefersReducedMotion } from "./sim-kit.js";
import { SMALL, MID, BOLD, circle, tagIn, chipBtn, lcd, chipGrid, readouts, u, clamp, fmt } from "./labkit.js";
import * as P from "./wilson-physics.js";
import * as L from "./wilson-lab.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildWilsonDoc, SITE, DOC_LABEL } from "./wilson-report.js";

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const KEY = "of-wilson-v1";
const saved = store.get(KEY, {});
const R = P.rng((Date.now() % 99989) + 7);
const st = { src: "Po-210", B: 0, dir: 1, tool: "ruler", ruler: null, pts3: [], photo: saved.photo || null, nextId: saved.nextId || 1, frame: saved.frame || 0, archive: saved.archive || [], flash: 0, grow: 1, hover: null };
const geo = {};
let presetId = null;
const isAlpha = (s) => P.SOURCES[s].kind === "a";
function persist() { clearTimeout(persist.t); persist.t = setTimeout(() => store.set(KEY, { photo: st.photo, nextId: st.nextId, frame: st.frame, archive: st.archive.slice(-400) }), 300); }
function expand() {
  const e = P.expansion(R, st.src, st.B, st.dir, st.nextId); st.nextId = e.nextId; st.frame++;
  e.tracks.forEach((t) => { t.B = st.B; t.dir = t.t === "b" ? st.dir : undefined; t.pts = t.pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]); });
  st.photo = { frame: st.frame, src: st.src, B: st.B, dir: st.dir, tracks: e.tracks };
  e.tracks.forEach((t) => { const { pts, ...rest } = t; void pts; st.archive.push(rest); });
  st.ruler = null; st.pts3 = []; st.flash = 1; st.grow = 0; cache = null; persist();
}
const findTrack = (id) => st.archive.find((t) => t.id === id);
const circ = () => (st.pts3.length === 3 ? P.circle3(...st.pts3) : null);
const rulerLen = () => (st.ruler && st.ruler[1] ? Math.hypot(st.ruler[1][0] - st.ruler[0][0], st.ruler[1][1] - st.ruler[0][1]) : null);

/* ------------------------------------------------------------------ Surat (tomchilar) */
let cache = null;
function hash(n) { let s = (n * 2654435761) >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function renderPhoto(size, dark) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), cv = document.createElement("canvas"); cv.width = cv.height = Math.round(size * dpr);
  const g = cv.getContext("2d"); g.scale(dpr, dpr); const s = size / (2 * P.VIEW), c0 = size / 2, X = (x) => c0 + x * s, Y = (y) => c0 - y * s;
  const bg = g.createRadialGradient(c0 - size * 0.25, c0, size * 0.05, c0, c0, size * 0.55); bg.addColorStop(0, "#1b2433"); bg.addColorStop(1, "#05070c");
  g.fillStyle = bg; g.beginPath(); g.arc(c0, c0, size / 2, 0, 2 * Math.PI); g.fill();
  // fon tomchilari (tuman)
  const H = hash(st.photo ? st.photo.frame * 7919 : 1); g.fillStyle = "rgba(226,232,240,0.10)"; for (let i = 0; i < 420; i++) { const a = H() * 2 * Math.PI, r = Math.sqrt(H()) * P.VIEW; g.beginPath(); g.arc(X(Math.cos(a) * r), Y(Math.sin(a) * r), 0.5 + H() * 0.6, 0, 2 * Math.PI); g.fill(); }
  (st.photo?.tracks || []).forEach((t) => {
    const h = hash(t.id * 104729 + 13), n = t.pts.length;
    const per = t.t === "a" ? 4 : 1, jit = t.t === "a" ? 0.38 : 0.12, prob = t.t === "a" ? 1 : t.t === "b" ? 0.8 : 0.5, rad = t.t === "a" ? 0.3 : 0.2;
    t.pts.forEach(([x, y], i) => {
      const fade = t.partial ? Math.max(0.15, 1 - (i / n) * 0.9) * 0.7 : t.t === "a" ? (i > n - 6 ? 0.75 : 1) : 1;
      for (let k = 0; k < per; k++) { if (h() > prob) continue; const dx = (h() * 2 - 1) * jit, dy = (h() * 2 - 1) * jit, rr = Math.max(t.t === "a" ? 0.9 : 0.75, (rad + h() * rad * 0.6) * s), al = (0.65 + 0.35 * h()) * fade; g.fillStyle = `rgba(241,245,249,${al})`; g.beginPath(); g.arc(X(x + dx), Y(y + dy), rr, 0, 2 * Math.PI); g.fill(); }
      if (t.t === "a" && h() < 0.025 && i > 4) { const a = h() * 2 * Math.PI, L2 = 0.8 + h() * 1.6; for (let q = 0; q < L2; q += 0.25) { g.fillStyle = "rgba(241,245,249,0.55)"; g.beginPath(); g.arc(X(x + Math.cos(a) * q), Y(y + Math.sin(a) * q), 0.6, 0, 2 * Math.PI); g.fill(); } } // δ-elektronlar
    });
    if (t.t === "a" && !t.partial) { const [x, y] = t.pts.at(-1); g.fillStyle = "rgba(241,245,249,0.9)"; g.beginPath(); g.arc(X(x), Y(y), Math.max(0.9, 0.3 * s), 0, 2 * Math.PI); g.fill(); } // oxiridagi zichlik (Bregg)
  });
  // devor yoritilishi
  const vg = g.createRadialGradient(c0, c0, size * 0.42, c0, c0, size * 0.5); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.65)"); g.fillStyle = vg; g.beginPath(); g.arc(c0, c0, size / 2, 0, 2 * Math.PI); g.fill();
  void dark; return cv;
}

/* ------------------------------------------------------------------ Sahna */
function draw(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, cw, ch);
  geo.chips = [];
  const size = narrow ? cw - 16 : Math.min(ch - 20, cw * 0.56), x0 = 8, y0 = narrow ? 8 : (ch - size) / 2, s = size / (2 * P.VIEW), cxp = x0 + size / 2, cyp = y0 + size / 2;
  geo.ph = { x0, y0, size, s, cx: cxp, cy: cyp };
  // kamera korpusi
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; circle(ctx, cxp, cyp, size / 2 + 6); ctx.fill();
  const key = `${Math.round(size)}|${st.photo?.frame || 0}`;
  if (!cache || cache.key !== key) cache = { key, cv: renderPhoto(size, c.dark) };
  ctx.save(); circle(ctx, cxp, cyp, size / 2); ctx.clip();
  if (st.photo) {
    if (st.grow < 1) { ctx.globalAlpha = st.grow; }
    ctx.drawImage(cache.cv, x0, y0, size, size); ctx.globalAlpha = 1;
  } else { ctx.fillStyle = "#05070c"; ctx.fillRect(x0, y0, size, size); ctx.fillStyle = "#94a3b8"; ctx.font = MID; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("«Kengaytirish» — surat oling", cxp, cyp); }
  if (st.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * st.flash})`; ctx.fillRect(x0, y0, size, size); }
  // manba ignasi
  const X = (x) => cxp + x * s, Y = (y) => cyp - y * s;
  const SP = P.srcPos(st.photo?.src || st.src); ctx.fillStyle = "#cbd5e1"; ctx.fillRect(X(-P.VIEW), Y(0) - 2, (SP.x + P.VIEW) * s, 4); ctx.fillStyle = "#facc15"; circle(ctx, X(SP.x), Y(SP.y), 3.5); ctx.fill();
  // iz raqamlari
  if (st.photo && st.grow >= 1) st.photo.tracks.forEach((t) => { if (t.t === "m") return; const [x, y] = t.pts.at(-1), [xp, yp] = t.pts[Math.max(0, t.pts.length - 6)], ang = Math.atan2(y - yp, x - xp), lx = X(x) + Math.cos(ang) * 10, ly = Y(y) - Math.sin(ang) * 10; ctx.fillStyle = "rgba(125,211,252,0.95)"; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(t.id), lx, ly); });
  // o‘lchov asboblari
  ctx.strokeStyle = "#fb923c"; ctx.fillStyle = "#fb923c"; ctx.lineWidth = 1.5;
  if (st.ruler) { const [a, b] = st.ruler; circle(ctx, X(a[0]), Y(a[1]), 3); ctx.fill(); if (b) { ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke(); circle(ctx, X(b[0]), Y(b[1]), 3); ctx.fill(); } }
  st.pts3.forEach((p) => { ctx.beginPath(); ctx.moveTo(X(p[0]) - 5, Y(p[1])); ctx.lineTo(X(p[0]) + 5, Y(p[1])); ctx.moveTo(X(p[0]), Y(p[1]) - 5); ctx.lineTo(X(p[0]), Y(p[1]) + 5); ctx.stroke(); });
  const cc = circ(); if (cc) { ctx.setLineDash([5, 4]); circle(ctx, X(cc.cx), Y(cc.cy), cc.r * s); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  // masshtab
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 6, y0 + size - 6); ctx.lineTo(x0 + 6 + 20 * s, y0 + size - 6); ctx.stroke(); ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("20 mm", x0 + 6, y0 + size - 9);
  ctx.textBaseline = "top"; ctx.fillText(st.photo ? `surat № ${st.photo.frame} · ${P.SOURCES[st.photo.src].name}` : "", x0 + 2, y0 - 2);
  // maydon belgisi
  if (st.photo?.B) { const bx = x0 + size - 26, by = y0 + 18; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; circle(ctx, bx, by, 8); ctx.stroke(); if (st.photo.dir > 0) { ctx.fillStyle = c.text; circle(ctx, bx, by, 2.2); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(bx - 5, by - 5); ctx.lineTo(bx + 5, by + 5); ctx.moveTo(bx + 5, by - 5); ctx.lineTo(bx - 5, by + 5); ctx.stroke(); } ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`B = ${fmt(st.photo.B, 1)} T`, bx - 12, by); }
  // boshqaruv
  const srcItems = Object.keys(P.SOURCES).map((k) => [k, k]), bItems = [["B = 0", 0], ["0,1 T", 0.1], ["0,2 T", 0.2], ["0,3 T", 0.3]];
  const L1 = rulerLen(), C3 = circ();
  if (narrow) {
    let y = y0 + size + 10;
    lcd(ctx, 8, y, cw / 2 - 12, 44, "CHIZG‘ICH L, mm", L1 !== null ? fmt(L1, 1) : "—", "", "#fbbf24"); lcd(ctx, cw / 2 + 4, y, cw / 2 - 12, 44, "RADIUS r, mm", C3 ? fmt(C3.r, 1) : "—", "", "#fbbf24"); y += 50;
    const eb = chipBtn(ctx, c, 8, y, "◉ Kengaytirish (surat olish)", true, cw - 16, 28); geo.chips.push({ ...eb, k: "exp" }); y += 32;
    geo.chips.push(...chipGrid(ctx, c, 8, y, cw - 16, srcItems, 5, 26, 4, (v) => v === st.src).map((q) => ({ ...q, k: "src" }))); y += 30;
    geo.chips.push(...chipGrid(ctx, c, 8, y, cw - 16, [...bItems, [st.dir > 0 ? "⊙" : "⊗", "dir"]], 5, 26, 4, (v) => v === st.B).map((q) => ({ ...q, k: q.v === "dir" ? "dir" : "B" }))); y += 30;
    geo.chips.push(...chipGrid(ctx, c, 8, y, cw - 16, [["Chizg‘ich", "ruler"], ["3 nuqta", "circle"], ["Tozalash", "clr"]], 3, 26, 4, (v) => v === st.tool).map((q) => ({ ...q, k: "tool" })));
    return;
  }
  const rx = x0 + size + 22, rw = cw - rx - 10;
  const eb = chipBtn(ctx, c, rx, 8, "◉ Kengaytirish (surat olish)", true, rw, 30); geo.chips.push({ ...eb, k: "exp" });
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Manba", rx, 54);
  geo.chips.push(...chipGrid(ctx, c, rx, 60, rw, srcItems, 3, 24, 4, (v) => v === st.src).map((q) => ({ ...q, k: "src" })));
  ctx.fillText("Magnit maydon (keyingi suratga)", rx, 130);
  geo.chips.push(...chipGrid(ctx, c, rx, 136, rw, [...bItems, [st.dir > 0 ? "⊙ bizga" : "⊗ bizdan", "dir"]], 5, 24, 3, (v) => v === st.B).map((q) => ({ ...q, k: q.v === "dir" ? "dir" : "B" })));
  ctx.fillText("O‘lchash", rx, 182);
  geo.chips.push(...chipGrid(ctx, c, rx, 188, rw, [["Chizg‘ich", "ruler"], ["3 nuqta → r", "circle"], ["Tozalash", "clr"]], 3, 24, 4, (v) => v === st.tool).map((q) => ({ ...q, k: "tool" })));
  lcd(ctx, rx, 220, rw / 2 - 3, 44, "CHIZG‘ICH L, mm", L1 !== null ? fmt(L1, 1) : "—", "", "#fbbf24"); lcd(ctx, rx + rw / 2 + 3, 220, rw / 2 - 3, 44, "AYLANA r, mm", C3 ? fmt(C3.r, 1) : "—", "", "#fbbf24");
  // lupa
  const lr = Math.min(70, (ch - 286) / 2 - 6, rw / 2 - 4);
  if (lr > 30 && st.photo) {
    const lx = rx + rw / 2, ly = 276 + lr, hv = st.hover || [0, 0], zoom = 4, sp = size / 2 / P.VIEW;
    ctx.save(); circle(ctx, lx, ly, lr); ctx.clip(); ctx.fillStyle = "#05070c"; ctx.fillRect(lx - lr, ly - lr, 2 * lr, 2 * lr);
    const srcSize = (2 * lr) / zoom, sx = cxp + hv[0] * sp - x0 - srcSize / 2, sy = cyp - hv[1] * sp - y0 - srcSize / 2, k = cache.cv.width / size;
    ctx.drawImage(cache.cv, sx * k, sy * k, srcSize * k, srcSize * k, lx - lr, ly - lr, 2 * lr, 2 * lr);
    const ZX = (x) => lx + (x - hv[0]) * sp * zoom, ZY = (y) => ly - (y - hv[1]) * sp * zoom;
    ctx.strokeStyle = "#fb923c"; ctx.fillStyle = "#fb923c"; ctx.lineWidth = 1.5;
    if (st.ruler) { const [a, b] = st.ruler; circle(ctx, ZX(a[0]), ZY(a[1]), 3); ctx.fill(); if (b) { ctx.beginPath(); ctx.moveTo(ZX(a[0]), ZY(a[1])); ctx.lineTo(ZX(b[0]), ZY(b[1])); ctx.stroke(); } }
    st.pts3.forEach((p) => { circle(ctx, ZX(p[0]), ZY(p[1]), 3); ctx.fill(); });
    if (cc) { ctx.setLineDash([5, 4]); circle(ctx, ZX(cc.cx), ZY(cc.cy), cc.r * sp * zoom); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx - lr, ly); ctx.lineTo(lx + lr, ly); ctx.moveTo(lx, ly - lr); ctx.lineTo(lx, ly + lr); ctx.stroke();
    ctx.restore(); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 3; circle(ctx, lx, ly, lr); ctx.stroke();
    ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`lupa ×${zoom} · (${fmt(hv[0], 1)}; ${fmt(hv[1], 1)}) mm`, lx, ly + lr + 4);
  }
}
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round(cw - 16 + 8 + 10 + 50 + 32 + 30 + 30 + 30 + 8) : Math.round(clamp(Math.min(cw * 0.55, (window.innerHeight || 800) * 0.62), 420, 520))) });

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  const ph = st.photo, L1 = rulerLen(), C3 = circ();
  setRO("r1", "Manba", P.SOURCES[st.src].name, isAlpha(st.src) ? "α-nurlanish" : "β-nurlanish");
  setRO("r2", "Magnit maydon", u(fmt(st.B, 1), "T"), st.B ? (st.dir > 0 ? "⊙ — bizga qarab" : "⊗ — bizdan") : "maydonsiz");
  setRO("r3", "Surat", ph ? `№ ${ph.frame}` : "—", ph ? `${ph.tracks.length} ta iz, ${P.SOURCES[ph.src].name}, B = ${fmt(ph.B, 1)} T` : "kengaytiring");
  setRO("r4", "Chizg‘ich", L1 !== null ? u(fmt(L1, 1), "mm") : "—", "ikki nuqta orasidagi masofa");
  setRO("r5", "Egrilik radiusi", C3 ? u(fmt(C3.r, 1), "mm") : "—", C3 ? "3 nuqta orqali aylana" : `${st.pts3.length}/3 nuqta`);
  setRO("r6", "Asbob", st.tool === "ruler" ? "chizg‘ich" : "3 nuqta", "suratni bosing; lupa — kursor atrofi");
}
function updateStatus() { const el = $("[data-status]"), t = st.photo ? `Surat № ${st.photo.frame}` : "Surat yo‘q"; if (el.textContent !== t) el.textContent = t; el.dataset.tone = "blue"; }
let lastEx = "";
function updateExplain() {
  const html = isAlpha(st.src)
    ? `<p>Porshen tez tushganda kameradagi havo–spirt bug‘i adiabatik soviydi va o‘ta to‘yingan holatga o‘tadi. Zaryadli zarra yo‘lida hosil qilgan ionlar kondensatsiya markazlari bo‘ladi — tomchilar zanjiri zarra izini ko‘rsatadi.</p><p>α-zarralar qalin, to‘g‘ri va bir xil uzunlikdagi izlar qoldiradi: yugurish yo‘li energiyaga bog‘liq — <b>R = 3,18·E<sup>3/2</sup></b> mm (Geyger qonuni). Xira, oxiri sezilmay tugaydigan izlar yoritilgan qatlamdan chiqib ketgan — ularni o‘lchamang.</p>`
    : `<p>β-zarralar (elektron yoki pozitron) yengil, havoni kam ionlaydi — izlari ingichka va siyrak. Magnit maydonda Lorens kuchi ularni aylana bo‘ylab egadi: <b>r = p/(eB)</b>, ya’ni r[mm] = p[MeV/c]/(0,3·B[T]).</p><p>Izga 3 ta nuqta qo‘yib radiusni o‘lchang. Egrilik yo‘nalishi va B yo‘nalishidan zaryad ishorasini aniqlang (F = q·v×B).</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() { actBtn.textContent = "Kengaytirish (surat)"; resetBtn.textContent = "O‘lchovlarni tozalash"; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); }
$("[data-formula]").innerHTML = "<small>Lorens</small> r = p/(qB)";
$("[data-graph-card]").hidden = true;

/* ------------------------------------------------------------------ Vaqt (chaqnash va tomchilar o‘sishi) */
const loop = createLoop((dt) => { if (!(dt > 0)) return; if (st.flash > 0 || st.grow < 1) { st.flash = Math.max(0, st.flash - dt * 3); st.grow = Math.min(1, st.grow + dt * 2.2); stage.render(); } }, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.hidden = true;
const doExpand = () => { expand(); if (prefersReducedMotion()) { st.flash = 0; st.grow = 1; } else if (!loop.running) loop.start(); };
actBtn.addEventListener("click", () => { doExpand(); customized(); refresh(); });
resetBtn.addEventListener("click", () => { st.ruler = null; st.pts3 = []; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
$("[data-srcset]").innerHTML = Object.entries(P.SOURCES).map(([k, v]) => `<button type="button" data-src="${k}" title="${v.name}">${k}</button>`).join("");
$("[data-srcset]").addEventListener("click", (e) => { const b = e.target.closest("[data-src]"); if (b) { st.src = b.dataset.src; customized(); refresh(); } });
$("[data-bset]").innerHTML = [0, 0.1, 0.2, 0.3].map((v) => `<button type="button" data-b="${v}">${v ? `${fmt(v, 1)} T` : "0"}</button>`).join("") + `<button type="button" data-bdir>⊙/⊗</button>`;
$("[data-bset]").addEventListener("click", (e) => { const b = e.target.closest("[data-b],[data-bdir]"); if (!b) return; if (b.dataset.b !== undefined) st.B = +b.dataset.b; else st.dir = -st.dir; customized(); refresh(); });
function syncUI() {
  document.querySelectorAll("[data-src]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.src === st.src)));
  document.querySelectorAll("[data-b]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.b === st.B)));
  const d = $("[data-bdir]"); if (d) d.textContent = st.dir > 0 ? "⊙ bizga" : "⊗ bizdan";
}
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, q) => q && p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1;
const toMM = (p) => [(p.x - geo.ph.cx) / geo.ph.s, -(p.y - geo.ph.cy) / geo.ph.s];
const onPhoto = (p) => geo.ph && Math.hypot(p.x - geo.ph.cx, p.y - geo.ph.cy) <= geo.ph.size / 2;
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e);
  for (const q of geo.chips || []) if (inBox(p, q)) {
    if (q.k === "exp") doExpand(); else if (q.k === "src") st.src = q.v; else if (q.k === "B") st.B = q.v; else if (q.k === "dir") st.dir = -st.dir;
    else if (q.k === "tool") { if (q.v === "clr") { st.ruler = null; st.pts3 = []; } else st.tool = q.v; }
    customized(); refresh(); return;
  }
  if (!onPhoto(p) || !st.photo) return;
  const m = toMM(p);
  if (st.tool === "ruler") {
    if (st.ruler && st.ruler[1] && Math.hypot(st.ruler[1][0] - m[0], st.ruler[1][1] - m[1]) * geo.ph.s < 8) { drag = 1; canvas.setPointerCapture?.(e.pointerId); return; } // oxirgi nuqtani aniqlashtirish
    st.ruler = [m, m.slice()]; drag = 1; canvas.setPointerCapture?.(e.pointerId);
  } else { if (st.pts3.length >= 3) st.pts3 = []; st.pts3.push(m); }
  e.preventDefault(); refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (onPhoto(p)) st.hover = toMM(p);
  if (drag !== null && st.ruler) st.ruler[drag] = toMM(p);
  canvas.style.cursor = (geo.chips || []).some((q) => inBox(p, q)) ? "pointer" : onPhoto(p) ? "crosshair" : "";
  if (drag !== null) refresh(); else stage.render();
});
const end = () => { drag = null; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

/* ------------------------------------------------------------------ Tayyor tajribalar */
const PRESETS = {
  po: { title: "α: ²¹⁰Po", lesson: "Bitta energiyali α-manba: barcha to‘liq izlar deyarli bir xil uzunlikda (≈ 39 mm). Bir nechta surat olib, 5–8 ta to‘liq izni o‘lchang.", set: () => Object.assign(st, { src: "Po-210", B: 0 }) },
  th: { title: "α: ²²⁸Th zanjiri", lesson: "Toriy zanjirida beshta α-nurlatgich bor — izlar uzunligi bir necha guruhga bo‘linadi; eng uzuni (≈ 83 mm) ²¹²Po dan, 8,78 MeV.", set: () => Object.assign(st, { src: "Th-228", B: 0 }) },
  beta: { title: "β⁻ magnit maydonda", lesson: "B = 0,2 T. Elektron izlari aylana yoylari: radius impulsga proporsional. Uchta nuqta qo‘yib r ni o‘lchang va B yo‘nalishidan zaryad ishorasini aniqlang.", set: () => Object.assign(st, { src: "Sr-90", B: 0.2, dir: 1 }) },
  pos: { title: "β⁺: pozitronlar", lesson: "²²Na pozitronlari elektronlarga nisbatan teskari tomonga egiladi — B yo‘nalishi bir xil bo‘lganda egrilik yo‘nalishi zaryad ishorasini ko‘rsatadi.", set: () => Object.assign(st, { src: "Na-22", B: 0.2, dir: 1 }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id, first) {
  const p = PRESETS[id]; p.set(); st.tool = isAlpha(st.src) ? "ruler" : "circle";
  if (!first || !st.photo || st.photo.src !== st.src || st.photo.B !== st.B) doExpand();
  presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson; $("[data-mode-hint]").textContent = "Suratni bosib o‘lchang: chizg‘ich — bosib suring; 3 nuqta — izga uch marta bosing";
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
const aOpts = Object.entries(P.SOURCES).filter(([, v]) => v.kind === "a").map(([k, v]) => [k, v.name]);
createNotebook($("[data-notebook]"), {
  key: "wilson", docLabel: DOC_LABEL, site: SITE,
  intro: "Suratlardagi to‘liq α-izlar uzunligini chizg‘ich bilan, β-izlar egrilik radiusini 3 nuqta usulida o‘lchang va iz raqami bilan yozing. Energiyalar avtomatik hisoblanadi.",
  conclusionPh: "α-zarralar energiyasi diskret qiymatlar qabul qiladimi? β-zarralar energiyasi qanday taqsimlangan? Zaryad ishorasi qanday aniqlandi?",
  hint: "Javob bering: 1) α-izlar uzunliklari nechta guruhga bo‘lindi va ularning energiyalari manba jadval qiymatlariga mosmi? 2) Nima uchun ba’zi izlar qisqa va xira? 3) β-zarralar energiyasi uzluksiz taqsimlanganmi (neytrino!)? 4) Egrilik yo‘nalishidan zaryad ishorasini qanday aniqladingiz?",
  fileBase: (nb) => `Vilson-kamerasi-lab-${translit(nb.f.name)}`,
  minTables: 1,
  tables: [
    { key: "t1", req: true, okLabel: "α-izlar", need: "1-jadvalda kamida 4 ta α-iz", title: "1-topshiriq. α-zarralar yugurish yo‘li va energiyasi",
      desc: "α-manba bilan olingan suratlarda <b>to‘liq</b> (oxirigacha yorqin) izlarning uzunligini manbadan iz oxirigacha chizg‘ich bilan o‘lchang. Kamida 4 ta iz.",
      cond: { fields: [{ k: "src", label: "Manba", opts: aOpts }], init: { src: "Po-210" }, sync: () => (isAlpha(st.src) ? { src: st.src } : {}) },
      head: ["Iz №", "R, mm", "R, sm", "E, MeV", "v, 10⁷ m/s", "Tekshiruv"], cols: [{ k: "id", kind: "num", mode: "numeric" }, { k: "R", kind: "num" }], outs: ["Rcm", "E", "v"],
      blank: () => ({ id: "", R: "" }), rows: 5, max: 30, narrow: true,
      parse: (r) => ({ id: num(r.id), R: num(r.R) }), check: L.check1, analyze: (rows, c) => L.analyze1(rows, c),
      out: (A, j) => { const r = A.rows[j]; return { Rcm: fmt(r.R / 10, 2), E: fmt(r.E, 2), v: fmt(r.v / 1e7, 3) }; },
      match: (r) => L.match1(r, findTrack(r.id)), noMatch: "Iz uzunligiga mos emas",
      summary: (A) => (A.G ? A.G.slice(0, 6).map((g, i) => [`${i + 1}-guruh (${g.n} ta)`, `${fmt(g.m, 2)} MeV`, g.n > 1 ? `± ${fmt(g.sd, 2)}` : ""]) : null),
      ok: (A) => A.ok },
    { key: "t2", okLabel: "β-izlar", need: "2-jadvalda kamida 3 ta β-iz (B > 0)", title: "2-topshiriq. β-zarralar impulsi va energiyasi (magnit maydonda)",
      desc: "B ≠ 0 bo‘lgan suratda β-izga 3 nuqta qo‘yib egrilik radiusini o‘lchang. Maydon yo‘nalishi va egrilik tomonidan zaryad ishorasini aniqlang.",
      cond: { fields: [{ k: "B", label: "B, T", opts: [["0.1", "0,1 T"], ["0.2", "0,2 T"], ["0.3", "0,3 T"]] }], init: { B: "0.2" }, sync: () => (st.photo?.B ? { B: String(st.photo.B) } : {}) },
      head: ["Iz №", "r, mm", "Zaryad", "p, MeV/c", "T, MeV", "Tekshiruv"], cols: [{ k: "id", kind: "num", mode: "numeric" }, { k: "r", kind: "num" }, { k: "sign", kind: "sel", opts: [["", "—"], ["-", "− (e⁻)"], ["+", "+ (e⁺)"]] }], outs: ["p", "T"],
      blank: () => ({ id: "", r: "", sign: "" }), rows: 4, max: 20,
      parse: (r) => ({ id: num(r.id), r: num(r.r), sign: r.sign }), check: L.check2, analyze: (rows, c) => L.analyze2(rows, c),
      out: (A, j) => { const r = A.rows[j]; return { p: fmt(r.p, 3), T: fmt(r.T, 3) }; },
      match: (r, c) => L.match2(r, findTrack(r.id), c.B), noMatch: "Radius izga mos emas",
      summary: (A) => (A.rows.length ? [["T o‘rtacha", `${fmt(A.Tm, 2)} MeV`, ""], ["T maksimal", `${fmt(A.Tmax, 2)} MeV`, "uzluksiz spektr"]] : null),
      ok: (A) => A.ok },
  ],
  build: (nb, res) => buildWilsonDoc(nb, res),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "po", true);
