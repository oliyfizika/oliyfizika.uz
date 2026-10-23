// ==========================================================================
// Laboratoriya daftari — umumiy modul (virtual laboratoriya ishlari uchun).
// Sahifadagi <section data-notebook> ichini konfiguratsiya bo‘yicha quradi:
//   1) Bajaruvchi;  2…) jadvallar (kiritish → hisoblangan ustunlar, tekshiruv ✓/?, jonli xulosa kartochkalari);
//   xulosa;  hisobot: «Ko‘rib chiqish» (iframe), «PDF yuklab olish» (chop etish oynasi), «LaTeX (.tex)».
// Ma’lumotlar brauzerda (localStorage) saqlanadi. Hisobot labreport.js orqali (KaTeX HTML va LaTeX).
//
// cfg = {
//   key, intro, conclusionPh, hint, docLabel, site: {url, label}, fileBase: (nb) => "…",
//   tables: [{ key, title, desc, head: [html], cols: [{k, kind: "num"|"text"|"sel", opts?: [[v, t]], mode?}],
//              outs: [k], blank: () => ({}), rows: n, max: n, cond?: {fields: [{k, label, opts}], sync: () => ({}), init: {}},
//              parse(raw, cond) → r, check(r, cond) → {ok, err}, analyze(rows, cond) → A,
//              out(A, j, r, cond) → {k: text}, match?(r, cond) → bool | {ok, why}, summary?(A, cond) → [[a, b, c]], ok(A) → bool, okLabel }],
//   (jadvalda req: true — majburiy topshiriq; analyze(rows, cond, res) — res da oldingi jadvallar natijasi)
//   minTables: 1, build(nb, res) → doc, progressExtra?
// }
// ==========================================================================

import { renderHTML, renderTeX } from "./labreport.js";

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* xotira yo‘q */ } },
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const num = (s) => { const v = parseFloat(String(s ?? "").replace(",", ".").replace("−", "-")); return Number.isFinite(v) ? v : NaN; };

const KATEX_JS = new URL("../../vendor/katex/katex.min.js", import.meta.url).href;
const KATEX_CSS = new URL("../../vendor/katex/katex.min.css", import.meta.url).href;
let katexP = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  katexP ||= new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = KATEX_JS; sc.onload = () => res(window.katex); sc.onerror = () => { katexP = null; rej(new Error("katex")); }; document.head.append(sc); });
  return katexP;
}
export const translit = (s) => String(s).normalize("NFKD").replace(/[ʻʼ‘’'`]/g, "").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9Ѐ-ӿ]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "talaba";

export function createNotebook(root, cfg) {
  const KEY = `of-nb-${cfg.key}-v1`;
  const def = { f: { name: "", group: "", school: "", teacher: "", date: today(), conclusion: "" }, c: {}, t: {} };
  cfg.tables.forEach((T) => { def.t[T.key] = Array.from({ length: T.rows || 4 }, (_, i) => T.blank(i)); if (T.cond) def.c[T.key] = { ...T.cond.init }; });
  const saved = store.get(KEY, {});
  const nb = { f: { ...def.f, ...(saved.f || {}) }, c: { ...def.c, ...(saved.c || {}) }, t: { ...def.t, ...(saved.t || {}) } };
  const save = () => store.set(KEY, nb);
  const res = {};
  let built = false;

  /* ---------------- HTML */
  const field = (k, label, ph, req, type = "text") => `<label class="of-field"><span class="of-label">${label}${req ? ' <b class="lab-req">*</b>' : ""}</span><input class="of-input" type="${type}" data-f="${k}" placeholder="${esc(ph)}"></label>`;
  let n = 1;
  const tablesHTML = cfg.tables.map((T) => `
      <li class="lab-step" data-tbl="${T.key}">
        <h3><span class="lab-step__n">${++n}</span>${T.title}</h3>
        ${T.desc ? `<p class="of-subtle">${T.desc}</p>` : ""}
        ${T.cond ? `<div class="lab-cond">${T.cond.fields.map((f) => `<label class="of-field"><span class="of-label">${f.label}</span><select class="of-input" data-c="${f.k}">${f.opts.map(([v, t]) => `<option value="${esc(v)}">${t}</option>`).join("")}</select></label>`).join("")}${T.cond.sync ? '<button class="of-btn of-btn--sm" type="button" data-sync>Qurilmadagi sozlamani olish</button>' : ""}</div>` : ""}
        <div class="lab-table-wrap"><table class="lab-table${T.narrow ? " lab-table--narrow" : ""}"><thead><tr><th>№</th>${T.head.map((h) => `<th>${h}</th>`).join("")}<th><span class="of-sr-only">O‘chirish</span></th></tr></thead><tbody></tbody></table></div>
        <div class="lab-actions"><button class="of-btn of-btn--sm" type="button" data-add>+ Qator qo‘shish</button><span class="lab-msg" data-msg></span></div>
        <div class="lab-summary" data-sum></div>
      </li>`).join("");
  root.innerHTML = `
    <header class="lab-nb__head">
      <div><span class="of-badge of-badge--green">Laboratoriya ishi</span><h2>Laboratoriya daftari</h2><p class="of-subtle">${cfg.intro}</p></div>
      <div class="lab-nb__progress" data-nb-progress></div>
    </header>
    <ol class="lab-steps">
      <li class="lab-step"><h3><span class="lab-step__n">1</span>Bajaruvchi</h3><div class="lab-grid">
        ${field("name", "F.I.Sh.", "Familiya Ism", true)}${field("group", "Guruh / sinf", "masalan, 11-A yoki FZ-21")}${field("school", "O‘quv muassasasi", "maktab, litsey yoki OTM")}${field("teacher", "O‘qituvchi", "F.I.Sh.")}${field("date", "Sana", "", false, "date")}
      </div></li>
      ${tablesHTML}
      <li class="lab-step"><h3><span class="lab-step__n">${++n}</span>Xulosa</h3>
        <label class="of-field"><span class="of-label">O‘z xulosangizni yozing <b class="lab-req">*</b></span><textarea class="of-input lab-textarea" data-f="conclusion" rows="5" placeholder="${esc(cfg.conclusionPh)}"></textarea></label>
        <div class="lab-actions"><button class="of-btn of-btn--sm" type="button" data-hint>Yordamchi savollar</button><span class="lab-msg" data-hint-msg></span></div>
      </li>
      <li class="lab-step"><h3><span class="lab-step__n">${++n}</span>Lab varaq (hisobot)</h3>
        <p class="of-subtle">${cfg.reportDesc || "Hisobot LaTeX uslubida teriladi: nazariya, ish tartibi, jadvallar, grafiklar, raqamlar qo‘yilgan hisoblashlar, xulosa, sayt havolasi va QR kod."}</p>
        <div class="lab-actions">
          <button class="of-btn" type="button" data-build>Ko‘rib chiqish</button>
          <button class="of-btn of-btn--primary" type="button" data-pdf>PDF yuklab olish</button>
          <button class="of-btn" type="button" data-tex>LaTeX (.tex)</button>
          <span class="lab-msg" data-build-msg role="status" aria-live="polite"></span>
        </div>
        <p class="of-subtle lab-hint">PDF: yangi oynada chop etish oynasi ochiladi — «Saqlash: PDF» (Save as PDF) ni tanlang. LaTeX: manba fayl — Overleaf yoki boshqa TeX tizimida pdfLaTeX bilan kompilyatsiya qilinadi.</p>
        <div class="lab-preview" data-preview hidden></div>
      </li>
    </ol>`;
  const $ = (s, el = root) => el.querySelector(s);

  /* ---------------- maydonlar */
  root.querySelectorAll("[data-f]").forEach((el) => { el.value = nb.f[el.dataset.f] || ""; el.addEventListener("input", () => { nb.f[el.dataset.f] = el.value; save(); progress(); }); });

  /* ---------------- jadvallar */
  const T = {};
  cfg.tables.forEach((tc) => {
    const li = root.querySelector(`[data-tbl="${tc.key}"]`), body = $("tbody", li);
    T[tc.key] = { tc, li, body };
    const cell = (c, v) => c.kind === "sel"
      ? `<select data-k="${c.k}" aria-label="${c.k}">${c.opts.map(([o, t]) => `<option value="${esc(o)}"${String(o) === String(v) ? " selected" : ""}>${t}</option>`).join("")}</select>`
      : `<input data-k="${c.k}" inputmode="${c.mode || (c.kind === "num" ? "decimal" : "text")}" value="${esc(v)}" aria-label="${c.k}">`;
    T[tc.key].render = () => {
      body.innerHTML = nb.t[tc.key].map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td>${tc.cols.map((c) => `<td>${cell(c, r[c.k])}</td>`).join("")}${tc.outs.map((o) => `<td class="lab-calc" data-o="${o}"></td>`).join("")}<td data-o="__j"></td><td><button class="lab-del" type="button" data-del aria-label="Qatorni o‘chirish">×</button></td></tr>`).join("");
    };
    const onInput = (e) => { const el = e.target.closest("[data-k]"), tr = e.target.closest("tr[data-i]"); if (!el || !tr) return; nb.t[tc.key][+tr.dataset.i][el.dataset.k] = el.value; save(); recalc(); };
    body.addEventListener("input", onInput); body.addEventListener("change", onInput);
    li.addEventListener("click", (e) => {
      if (e.target.closest("[data-del]")) { const i = +e.target.closest("tr").dataset.i; nb.t[tc.key].splice(i, 1); if (!nb.t[tc.key].length) nb.t[tc.key].push(tc.blank(0)); save(); T[tc.key].render(); recalc(); }
      else if (e.target.closest("[data-add]")) { if (nb.t[tc.key].length >= (tc.max || 12)) return; nb.t[tc.key].push(tc.blank(nb.t[tc.key].length)); save(); T[tc.key].render(); recalc(); }
      else if (e.target.closest("[data-sync]")) { nb.c[tc.key] = { ...nb.c[tc.key], ...tc.cond.sync() }; syncCond(tc.key); save(); recalc(); }
    });
    if (tc.cond) li.querySelectorAll("[data-c]").forEach((el) => el.addEventListener("change", () => { nb.c[tc.key][el.dataset.c] = el.value; save(); recalc(); }));
    T[tc.key].render();
  });
  function syncCond(key) { const li = T[key].li; li.querySelectorAll("[data-c]").forEach((el) => { el.value = String(nb.c[key][el.dataset.c]); }); }
  cfg.tables.forEach((tc) => tc.cond && syncCond(tc.key));

  /* ---------------- hisoblash */
  function recalc() {
    cfg.tables.forEach((tc) => {
      const { li, body } = T[tc.key], cond = nb.c[tc.key] || {};
      const parsed = nb.t[tc.key].map((raw) => tc.parse(raw, cond));
      const validIdx = []; parsed.forEach((r, i) => { if (tc.check(r, cond).ok) validIdx.push(i); });
      const A = tc.analyze(validIdx.map((i) => parsed[i]), cond, res); // res — oldingi jadvallar natijalari
      const flags = []; let bad = 0;
      [...body.rows].forEach((tr, i) => {
        const raw = nb.t[tc.key][i], r = parsed[i], ck = tc.check(r, cond), any = tc.cols.some((c) => c.kind !== "sel" && String(raw[c.k] ?? "") !== "");
        const o = (k) => tr.querySelector(`[data-o="${k}"]`);
        tr.classList.toggle("is-bad", any && !ck.ok);
        if (ck.ok) {
          const j = validIdx.indexOf(i), out = tc.out(A, j, r, cond);
          tc.outs.forEach((k) => { o(k).textContent = out[k] ?? "—"; });
          if (tc.match) { const mm = tc.match(r, cond), m = mm && typeof mm === "object" ? !!mm.ok : !!mm; flags.push(m); o("__j").innerHTML = m ? '<span class="lab-ok" title="Qurilma bilan mos">✓</span>' : `<span class="lab-no" title="${esc((mm && mm.why) || tc.noMatch || "Qurilmadagi qiymat bilan mos emas")}">?</span>`; }
          else { flags.push(true); o("__j").textContent = ""; }
        } else { tc.outs.forEach((k) => { o(k).textContent = ""; }); o("__j").textContent = any ? ck.err : ""; if (any) bad++; }
      });
      const ok = !!tc.ok(A, cond);
      res[tc.key] = { A, flags, ok, cond };
      const msg = $("[data-msg]", li); msg.textContent = `${validIdx.length} ta to‘liq qator${bad ? `, ${bad} ta xato` : ""}${validIdx.length && tc.match ? ` · ${flags.filter(Boolean).length} tasi tekshiruvdan o‘tdi` : ""}`; msg.dataset.tone = bad ? "red" : ok ? "green" : "";
      const sum = $("[data-sum]", li), items = validIdx.length && tc.summary ? tc.summary(A, cond) : null;
      sum.innerHTML = items ? items.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><small>${c || ""}</small></div>`).join("") : "";
    });
    progress();
  }
  function errors() {
    const e = [];
    if (!nb.f.name.trim()) e.push("F.I.Sh. kiritilmagan");
    const okN = cfg.tables.filter((tc) => res[tc.key]?.ok).length, need = cfg.minTables ?? cfg.tables.length;
    cfg.tables.forEach((tc) => { if (tc.req && !res[tc.key]?.ok) e.push(tc.need || tc.okLabel); });
    if (okN < need) { const fails = cfg.tables.filter((tc) => !res[tc.key]?.ok).map((tc) => tc.need || tc.okLabel); e.push(need >= cfg.tables.length ? fails.join("; ") : `kamida ${need} ta topshiriq bajarilsin (${fails.join(" yoki ")})`); }
    if (nb.f.conclusion.trim().length < 20) e.push("xulosa yozilmagan");
    return e;
  }
  function progress() {
    const st = [["Bajaruvchi", !!nb.f.name.trim()], ...cfg.tables.map((tc) => [tc.okLabel || tc.key, !!res[tc.key]?.ok]), ["Xulosa", nb.f.conclusion.trim().length >= 20], ["Hisobot", built]];
    $("[data-nb-progress]").innerHTML = st.map(([t, ok]) => `<span class="${ok ? "is-done" : ""}">${ok ? "✓ " : ""}${t}</span>`).join("");
  }
  $("[data-hint]").addEventListener("click", () => { $("[data-hint-msg]").textContent = cfg.hint; });

  /* ---------------- hisobot */
  const buildMsg = $("[data-build-msg]"), preview = $("[data-preview]");
  const say = (t, tone = "") => { buildMsg.textContent = t; buildMsg.dataset.tone = tone; };
  const fileBase = () => cfg.fileBase(nb);
  function makeDoc() { const e = errors(); if (e.length) { say(`Avval to‘ldiring: ${e.join("; ")}.`, "red"); return null; } return cfg.build(nb, res); }
  async function makeHTML(autoPrint) { const doc = makeDoc(); if (!doc) return null; const katex = await loadKatex(); return renderHTML(doc, { katex, katexCss: KATEX_CSS, title: fileBase(), docLabel: cfg.docLabel, autoPrint }); }
  $("[data-build]").addEventListener("click", async () => {
    say("Shakllantirilmoqda…");
    let html = null; try { html = await makeHTML(false); } catch { say("Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring.", "red"); }
    if (!html) { built = false; preview.hidden = true; progress(); return; }
    preview.innerHTML = ""; const fr = document.createElement("iframe"); fr.title = "Lab varaq ko‘rinishi"; fr.className = "lab-frame"; fr.srcdoc = html; preview.append(fr);
    preview.hidden = false; built = true; say("Tayyor. Pastda ko‘rib chiqing, so‘ng PDF yoki LaTeX faylni yuklab oling.", "green"); progress();
  });
  $("[data-pdf]").addEventListener("click", async () => {
    if (errors().length) { makeDoc(); return; }
    const w = window.open("", "_blank"); say("PDF tayyorlanmoqda…");
    try {
      const html = await makeHTML(true);
      if (!w) { say("Brauzer yangi oynani blokladi — ruxsat bering yoki «Ko‘rib chiqish» dagi tugmadan foydalaning.", "red"); return; }
      w.document.open(); w.document.write(html); w.document.close();
      say("Yangi oynada chop etish oynasi ochildi: «Saqlash: PDF» (Save as PDF) ni tanlang.", "green"); built = true; progress();
    } catch { w?.close(); say("Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring.", "red"); }
  });
  $("[data-tex]").addEventListener("click", () => {
    const doc = makeDoc(); if (!doc) return;
    const tex = renderTeX(doc, { docLabel: cfg.docLabel, url: cfg.site.url, label: cfg.site.label });
    const url = URL.createObjectURL(new Blob([tex], { type: "application/x-tex;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `${fileBase()}.tex`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    say("LaTeX fayl yuklab olindi. Overleaf (pdfLaTeX) yoki istalgan TeX tizimida kompilyatsiya qilinadi.", "green");
  });
  root.addEventListener("input", () => { if (built) { built = false; say("Ma’lumotlar o‘zgardi — hisobot yangi ma’lumotlar bilan tuziladi."); progress(); } });

  recalc();
  return { nb, res, recalc };
}

/** Umumiy: hujjat sarlavhasi uchun meta (bajaruvchi va sana). */
export function docMeta(nb, userText) {
  const now = new Date(), pad = (v) => String(v).padStart(2, "0"), d = nb.f.date ? nb.f.date.split("-") : null;
  return [["Bajaruvchi:", userText(nb.f.name)], ["Guruh / sinf:", userText(nb.f.group || "—")], ["Muassasa:", userText(nb.f.school || "—")], ["O‘qituvchi:", userText(nb.f.teacher || "—")],
    ["Bajarilgan sana:", d && d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : "—"], ["Hisobot yaratildi:", `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}`]];
}
/** Umumiy xulosa bloki + imzo + havola. */
export function docTail(X, nb, userText, boxItems, site) {
  X.push({ t: "box", items: ["**Hisob natijalari:**", ...boxItems] });
  X.push({ t: "p", text: "**Bajaruvchining xulosasi:**" });
  userText(nb.f.conclusion.trim()).split(/\n+/).forEach((par) => X.push({ t: "p", text: par }));
  X.push({ t: "sign", items: ["Bajaruvchi imzosi", "O‘qituvchi imzosi va bahosi"] });
  X.push({ t: "link", url: site.url, label: site.label, text: "Ushbu ish OliyFizika.uz virtual laboratoriyasida bajarildi. Laboratoriyani ochish:" });
}
