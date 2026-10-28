// ==========================================================================
// Maktab virtual laboratoriyalari uchun umumiy sahifa yadrosi (simulations/lab-*.html).
// Sahifada faqat sarlavha (.sim-head) va <div data-lab-body> bo‘ladi — qolganini shu modul quradi:
//   sahna (canvas, sudrab boshqarish, «Qaydga yozish»), natija kartochkalari, o‘ng panel (topshiriq, asboblar,
//   «Qaydlar»), laboratoriya daftari (labnotebook.js) va «Ish tartibi» / «Formulalar» kartochkalari.
//
// «Qaydlar» — tajriba davomida asboblardan yozib olingan o‘lchovlar ro‘yxati. Har qayd bitta jadvalga tegishli
// ({t: jadval kaliti, v: {ustun: qiymat}}); «→ jadval» tugmasi uni daftar jadvalining bo‘sh qatoriga o‘tkazadi.
// Daftardagi qator qaydlardagi biror o‘lchovga mos kelsa ✓ (asbob ko‘rsatkichi), aks holda «?».
//
// cfg = {
//   key, title, docLabel, site: {url, label}, fileBase,
//   modes?: [{id, label, hint}], mode?,                       — topshiriqlar (sahna ustidagi tugmalar)
//   height?: (w) => px, vw?/vh?: (narrow) => virtual kenglik/balandlik (680×340 / 400×400), draw(ctx, S = {w, h, k, narrow, colors}, lab) — virtual koordinatalarda, step?(dt, lab) → bool (qayta chizish kerakmi),
//   down?(x, y, lab) → dastak | null, move?(h, x, y, lab), up?(h, lab), cursor?(x, y, lab) → css,
//   controls: [{type: "range"|"seg"|"note", label, only?, min, max, step, get(), set(v), fmt(v)} | {type: "seg", opts: [[v, t]]}],
//   tools?: [{label, run(lab), primary?}],                   — sahna ostidagi qo‘shimcha tugmalar
//   readouts(lab) → [[label, value, sub, tone]] (3–4 ta),
//   record(lab) → {t, v, text} | {err},                       — «Qaydga yozish»
//   steps: [html], formulas: [html], note?: html,              — «Ish tartibi» va «Formulalar»
//   notebook: createNotebook cfg (tables[].match berilmasa — qaydlar bilan solishtiriladi), build(nb, res, lab)
// }
// ==========================================================================

import { createStage, createLoop, bindRange, fmt } from "./sim-kit.js";
import { readouts as makeReadouts } from "./labkit.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { userText } from "./labreport.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* xotira yo‘q */ } },
};
const ICON_SLIDERS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>';
const ICON_NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></svg>';

/** Qayddagi son va jadvaldagi son mosmi: nisbiy 1,5 % yoki qayddagi oxirgi xonaning yarmi. */
export function sameValue(noteStr, v, rel = 0.015) {
  const a = num(noteStr);
  if (!Number.isFinite(a)) return String(noteStr).trim() === String(v ?? "").trim();
  if (!Number.isFinite(v)) return false;
  const dec = (String(noteStr).replace("−", "-").split(/[.,]/)[1] || "").length;
  return Math.abs(a - v) <= Math.max(rel * Math.abs(a), 0.51 * 10 ** -dec) + 1e-12;
}

export function createLab(cfg) {
  const body = $("[data-lab-body]");
  const NKEY = `of-lab-${cfg.key}-qaydlar-v1`;
  const lab = { mode: cfg.mode || cfg.modes?.[0]?.id || "", notes: store.get(NKEY, []), dirty: true, cfg };
  const tables = cfg.notebook.tables;
  const tName = (k) => { const i = tables.findIndex((t) => t.key === k); return i >= 0 ? `${i + 1}-jadval` : "jadval"; };

  /* ---------------- DOM */
  body.innerHTML = `
  <div class="sim-layout">
    <div class="sim-main">
      <section class="of-card sim-stage" aria-label="Tajriba maydoni">
        ${cfg.modes?.length > 1 ? `<div class="sim-modebar"><div class="of-segment" role="group" aria-label="Topshiriq">${cfg.modes.map((m) => `<button type="button" data-mode-value="${m.id}" aria-pressed="false">${m.label}</button>`).join("")}</div><span class="sim-modebar__hint" data-mode-hint></span></div>` : ""}
        <div class="sim-canvas-wrap"><canvas id="stage" role="img" aria-label="${esc(cfg.stageLabel || "Laboratoriya qurilmasi")}"></canvas></div>
        <div class="sim-toolbar">
          <button class="of-btn of-btn--primary of-btn--sm" type="button" data-record>Qaydga yozish</button>
          ${(cfg.tools || []).map((t, i) => `<button class="of-btn of-btn--sm" type="button" data-tool="${i}">${t.label}</button>`).join("")}
          <span class="sim-status" data-status role="status" aria-live="polite"></span>
        </div>
      </section>
      <section class="sim-readouts sim-readouts--4" aria-label="Asbob ko‘rsatkichlari" data-readouts></section>
    </div>
    <aside class="of-card sim-panel" aria-label="Boshqaruv">
      <h2>${ICON_SLIDERS}Qurilma</h2>
      <div class="sim-group sim-group--grid" data-controls></div>
      <div class="sim-group lab-notes" aria-label="Qaydlar">
        <div class="lab-notes__head"><h2>${ICON_NOTE}Qaydlar</h2><span class="lab-notes__count" data-notes-count></span></div>
        <p class="of-subtle lab-notes__hint">Asbob ko‘rsatkichini «Qaydga yozish» bilan shu yerga yozib boring. «→» tugmasi qaydni daftardagi jadvalning bo‘sh qatoriga o‘tkazadi.</p>
        <ol class="lab-journal lab-notes__list" data-notes></ol>
        <div class="lab-actions"><button class="of-btn of-btn--sm" type="button" data-notes-all>Hammasini jadvalga</button><button class="of-btn of-btn--sm" type="button" data-notes-clear>Tozalash</button></div>
      </div>
    </aside>
  </div>
  <section class="of-card lab-nb" id="labNotebook" data-notebook aria-label="Laboratoriya daftari"></section>
  <section class="sim-explain">
    <div class="of-card"><h2>Ish tartibi</h2><ol class="lab-howto">${cfg.steps.map((s) => `<li>${s}</li>`).join("")}</ol><div class="sim-live" data-explain aria-live="polite"></div></div>
    <div class="of-card"><h2>Formulalar</h2><ul>${cfg.formulas.map((f) => `<li>${f}</li>`).join("")}</ul>${cfg.note ? `<p class="of-subtle" style="margin-top:10px">${cfg.note}</p>` : ""}</div>
  </section>`;

  /* ---------------- holat xabari */
  const statusEl = $("[data-status]");
  lab.say = (t, tone = "") => { statusEl.textContent = t; statusEl.dataset.tone = tone; };

  /* ---------------- boshqaruv */
  const ctlBox = $("[data-controls]"), syncers = [];
  cfg.controls.forEach((c, i) => {
    const wrap = document.createElement("div");
    if (c.only) wrap.dataset.only = c.only;
    if (c.type === "range") {
      const id = `c${i}`;
      wrap.className = "sim-control";
      wrap.innerHTML = `<div class="sim-control__row"><label for="${id}">${c.label}</label><output for="${id}" id="${id}Out"></output></div><input class="sim-range" type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.get(lab)}">`;
      ctlBox.append(wrap);
      const r = bindRange($(`#${id}`), $(`#${id}Out`), (v) => c.fmt(v, lab), (v) => { c.set(v, lab); lab.changed(); });
      syncers.push(() => { const v = c.get(lab); if (Math.abs(r.value - v) > 1e-9) r.set(v); else r.sync(); });
    } else if (c.type === "seg") {
      wrap.className = "sim-control";
      wrap.innerHTML = `${c.label ? `<span class="sim-group__title">${c.label}</span>` : ""}<div class="of-segment of-segment--wrap" role="group" aria-label="${esc(c.label || "")}">${c.opts.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="false">${t}</button>`).join("")}</div>`;
      ctlBox.append(wrap);
      wrap.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; const o = c.opts.find(([v]) => String(v) === b.dataset.v); c.set(o[0], lab); syncControls(); lab.changed(); });
      syncers.push(() => { const cur = String(c.get(lab)); wrap.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === cur))); });
    } else if (c.type === "note") {
      wrap.innerHTML = `<p class="of-subtle">${c.text}</p>`; ctlBox.append(wrap);
    }
  });
  const syncControls = () => {
    syncers.forEach((f) => f());
    ctlBox.querySelectorAll("[data-only]").forEach((el) => { el.hidden = !el.dataset.only.split(" ").includes(lab.mode); });
  };
  lab.sync = syncControls;

  /* ---------------- topshiriqlar */
  lab.setMode = (m) => {
    lab.mode = m;
    document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
    const hint = $("[data-mode-hint]"), M = cfg.modes?.find((x) => x.id === m);
    if (hint) hint.textContent = M?.hint || "";
    cfg.onMode?.(m, lab);
    syncControls(); lab.changed();
  };
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => lab.setMode(b.dataset.modeValue)));

  /* ---------------- sahna */
  const vh = () => (typeof window !== "undefined" && window.innerHeight) || 800;
  // Virtual koordinatalar: keng ekranda 680 px, torda 400 px kenglik (cfg.vw) — sahna masshtablanadi, matn o‘qiladi.
  const view = { k: 1 };
  const stage = createStage($("#stage"), (ctx, S) => {
    ctx.fillStyle = S.colors.bg; ctx.fillRect(0, 0, S.w, S.h);
    const narrow = S.w < 560, VW = (cfg.vw || ((n) => (n ? 400 : 680)))(narrow), k = S.w / VW;
    view.k = k; ctx.scale(k, k);
    cfg.draw(ctx, { w: VW, h: S.h / k, k, narrow, colors: S.colors }, lab);
  }, {
    // balandlik: virtual o‘lcham nisbati (cfg.vh), lekin ekranning ~2/3 qismidan oshmaydi
    height: cfg.height || ((w) => { const n = w < 560, VW = (cfg.vw || ((q) => (q ? 400 : 680)))(n), VH = (cfg.vh || ((q) => (q ? 400 : 340)))(n); return Math.round(Math.min(Math.max(w * VH / VW, 300), Math.max(380, vh() * 0.66))); }),
  });
  lab.stage = stage;
  const canvas = stage.canvas;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / view.k, (e.clientY - r.top) / view.k]; };
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    const [x, y] = pos(e), h = cfg.down?.(x, y, lab);
    if (h == null) return;
    lab.changed();
    if (h === true) return; // bir martalik bosish (tugma)
    drag = h; canvas.setPointerCapture(e.pointerId); canvas.dataset.dragging = "true"; e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = pos(e);
    if (drag) { cfg.move?.(drag, x, y, lab); syncControls(); lab.changed(); return; }
    const cur = cfg.cursor?.(x, y, lab);
    canvas.style.cursor = cur || "";
  });
  const end = () => { if (!drag) return; cfg.up?.(drag, lab); drag = null; canvas.dataset.dragging = "false"; syncControls(); lab.changed(); };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  /* ---------------- natijalar */
  const setRO = makeReadouts($("[data-readouts]"));
  let roT = 0;
  const updateRO = () => {
    const rows = cfg.readouts(lab) || [];
    ["r1", "r2", "r3", "r4", "r5", "r6"].forEach((k, i) => {
      const el = document.querySelector(`[data-readout="${k}"]`), r = rows[i];
      el.hidden = !r; if (r) setRO(k, r[0], r[1], r[2] || "", r[3]);
    });
    const ex = cfg.explain?.(lab); if (ex != null) $("[data-explain]").innerHTML = ex;
  };

  /* ---------------- sikl */
  lab.changed = () => { lab.dirty = true; };
  lab.redraw = () => { stage.render(); updateRO(); };
  const loop = createLoop((dt) => {
    const moving = cfg.step ? cfg.step(dt, lab) : false;
    if (moving || lab.dirty) { lab.dirty = false; stage.render(); roT += 1; if (!moving || roT % 4 === 0) updateRO(); }
  });
  loop.start();
  (cfg.tools || []).forEach((t, i) => $(`[data-tool="${i}"]`).addEventListener("click", () => { t.run(lab); syncControls(); lab.changed(); }));

  /* ---------------- qaydlar */
  const list = $("[data-notes]");
  const saveNotes = () => store.set(NKEY, lab.notes);
  function renderNotes(fresh) {
    $("[data-notes-count]").textContent = lab.notes.length ? `${lab.notes.length} ta` : "";
    list.innerHTML = lab.notes.slice().reverse().map((n, i) => `<li class="${fresh && i === 0 ? "is-new" : ""}" data-id="${n.id}"><span class="lab-journal__n">${n.id}</span><span class="lab-journal__m">${esc(n.text)}</span><span class="lab-notes__btns"><button type="button" class="lab-notes__to" data-to title="${tName(n.t)} ga o‘tkazish" aria-label="${n.id}-qaydni ${tName(n.t)} ga o‘tkazish">→ ${tName(n.t).replace("-jadval", "")}</button><button type="button" class="lab-del" data-rm aria-label="${n.id}-qaydni o‘chirish">×</button></span></li>`).join("");
  }
  lab.addNote = (t, v, text) => {
    const n = { id: (lab.notes.at(-1)?.id || 0) + 1, t, v, text };
    lab.notes.push(n); if (lab.notes.length > 60) lab.notes.shift();
    saveNotes(); renderNotes(true); nbApi?.recalc();
    return n;
  };
  $("[data-record]").addEventListener("click", () => {
    const r = cfg.record(lab);
    if (!r) return;
    if (r.err) { lab.say(r.err, "orange"); return; }
    const n = lab.addNote(r.t, r.v, r.text);
    lab.say(`${n.id}-qayd yozildi: ${r.text}`, "green");
  });
  list.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]"); if (!li) return;
    const id = +li.dataset.id, n = lab.notes.find((q) => q.id === id); if (!n) return;
    if (e.target.closest("[data-rm]")) { lab.notes = lab.notes.filter((q) => q.id !== id); saveNotes(); renderNotes(); nbApi?.recalc(); return; }
    if (e.target.closest("[data-to]")) {
      const i = nbApi.fill(n.t, n.v);
      lab.say(i < 0 ? `${tName(n.t)} to‘lgan — keraksiz qatorni o‘chiring.` : `${n.id}-qayd ${tName(n.t)}ning ${i + 1}-qatoriga yozildi.`, i < 0 ? "orange" : "green");
    }
  });
  $("[data-notes-all]").addEventListener("click", () => {
    // bir xil qaydlar (masalan, ikki tajribada bir xil natija) alohida qatorlarga: n-chi nusxa jadvalda n ta mos qator bo‘lmasa yoziladi
    const seen = new Map(), have = (n) => (nbApi.nb.t[n.t] || []).filter((row) => Object.keys(n.v).every((k) => String(row[k] ?? "") === String(n.v[k]))).length;
    let k = 0;
    lab.notes.forEach((n) => { const s = `${n.t}|${JSON.stringify(n.v)}`, occ = (seen.get(s) || 0) + 1; seen.set(s, occ); if (have(n) < occ && nbApi.fill(n.t, n.v) >= 0) k++; });
    lab.say(k ? `${k} ta qayd jadvallarga o‘tkazildi.` : "Yangi qayd yo‘q — hammasi jadvalda.", k ? "green" : "");
  });
  $("[data-notes-clear]").addEventListener("click", () => {
    if (!lab.notes.length || !confirm("Barcha qaydlarni o‘chirasizmi? Daftar jadvallari saqlanib qoladi.")) return;
    lab.notes = []; saveNotes(); renderNotes(); nbApi?.recalc();
  });
  renderNotes();

  /* ---------------- daftar */
  // Qator qaydlarga mosmi: har bir qayd o‘z ustunlarida (hammasida birga) mos kelsa, shu ustunlarni «yopadi»;
  // qatorning barcha son ustunlari yopilsa — ✓. (Qayd qatorning bir qismini — masalan, faqat I ni — berishi mumkin.)
  const matchNotes = (tc) => (r) => {
    const keys = tc.cols.map((c) => c.k), need = tc.cols.filter((c) => c.kind !== "sel").map((c) => c.k), covered = new Set();
    lab.notes.forEach((n) => {
      if (n.t !== tc.key) return;
      const ks = keys.filter((k) => n.v[k] != null);
      if (ks.length && ks.every((k) => sameValue(n.v[k], r[k], tc.tol))) ks.forEach((k) => covered.add(k));
    });
    return need.every((k) => covered.has(k)) ? { ok: true } : { ok: false, why: "Bu o‘lchov «Qaydlar»da yo‘q — asbobdan o‘lchab, qaydga yozing" };
  };
  tables.forEach((tc) => { if (!tc.match) tc.match = matchNotes(tc); });
  let nbApi = null;
  const nbCfg = {
    ...cfg.notebook, key: cfg.key, docLabel: cfg.docLabel, site: cfg.site,
    fileBase: (nb) => `${cfg.fileBase}-${translit(nb.f.name)}`,
    build: (nb, res) => withNotes(cfg.notebook.build(nb, res, lab), lab, tables),
  };
  nbApi = createNotebook($("[data-notebook]"), nbCfg);
  lab.nb = nbApi;

  /* ---------------- ishga tushirish */
  const q = new URLSearchParams(location.search).get("preset");
  if (cfg.modes?.some((m) => m.id === q)) lab.mode = q;
  lab.setMode(lab.mode);
  if (cfg.preset && q) cfg.preset(q, lab);
  document.fonts?.ready.then(() => lab.changed());
  return lab;
}

/** Hisobotga «Ilova: o‘lchov qaydlari» bo‘limini imzolardan oldin qo‘shadi. */
function withNotes(doc, lab, tables) {
  if (!doc || !lab.notes.length) return doc;
  const i = doc.blocks.findIndex((b) => b.t === "sign"), at = i < 0 ? doc.blocks.length : i;
  const rows = lab.notes.slice(-40).map((n) => [String(n.id), `${tables.findIndex((t) => t.key === n.t) + 1}`, userText(n.text)]);
  doc.blocks.splice(at, 0,
    { t: "sec", text: "Ilova. O‘lchov qaydlari" },
    { t: "table", caption: "Tajriba davomida asboblardan yozib olingan qiymatlar (oxirgi 40 tasi)", head: ["№", "Jadval", "Qayd"], rows });
  return doc;
}

/* ------------------------------------------------------------------ Hisobot yordamchisi */

/** Raqamlangan bo‘limlar, jadvallar va rasmlar bilan hujjat bloklarini yig‘ish. */
export function docKit() {
  const X = []; let sec = 1, tab = 1, fig = 1;
  return {
    X,
    S: (t) => X.push({ t: "sec", text: `${sec++}. ${t}` }),
    p: (text) => X.push({ t: "p", text }),
    list: (items, ordered = false) => X.push({ t: "list", items, ordered }),
    eq: (lines, tag) => X.push({ t: "eq", lines: Array.isArray(lines) ? lines : [lines], ...(tag ? { tag } : {}) }),
    table: (caption, head, rows, note) => X.push({ t: "table", caption: `**${tab++}-jadval.** ${caption}`, head, rows, ...(note ? { note } : {}) }),
    fig: (id, caption, plot) => X.push({ t: "fig", id, caption: `**${fig++}-rasm.** ${caption}`, plot }),
  };
}

/** Eng kichik kvadratlar: y = a + b x (n ≥ 2). Qaytaradi {a, b, sa, sb, r2}. */
export function fitLine(pts) {
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const d = n * sxx - sx * sx; if (Math.abs(d) < 1e-300) return null;
  const b = (n * sxy - sx * sy) / d, a = (sy - b * sx) / n;
  let ss = 0, st = 0; const my = sy / n; for (const [x, y] of pts) { ss += (y - a - b * x) ** 2; st += (y - my) ** 2; }
  const s2 = n > 2 ? ss / (n - 2) : 0;
  return { a, b, sa: Math.sqrt((s2 * sxx) / d), sb: Math.sqrt((n * s2) / d), r2: st > 0 ? 1 - ss / st : 1 };
}
/** Koordinata boshidan o‘tuvchi to‘g‘ri chiziq: y = k x. */
export function fitOrigin(pts) {
  let sxy = 0, sxx = 0; for (const [x, y] of pts) { sxy += x * y; sxx += x * x; }
  if (!(sxx > 0)) return null;
  const k = sxy / sxx, n = pts.length; let ss = 0; for (const [x, y] of pts) ss += (y - k * x) ** 2;
  return { k, sk: n > 1 ? Math.sqrt(ss / (n - 1) / sxx) : 0 };
}
/** O‘rtacha va o‘rtachaning standart xatosi. */
export function meanErr(a) {
  const n = a.length; if (!n) return { m: NaN, s: NaN };
  const m = a.reduce((p, q) => p + q, 0) / n;
  return { m, s: n > 1 ? Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (n - 1) / n) : 0 };
}
export const pct = (v, ref) => (100 * (v - ref)) / ref;
export { fmt };
