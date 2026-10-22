// ==========================================================================
// Laboratoriya hisoboti (lab varaq) — bitta hujjat modeli, ikki chiqish:
//   • renderHTML(): KaTeX bilan terilgan A4 hujjat (LaTeX sifatidagi formulalar, vektor SVG grafiklar) →
//     brauzer «Chop etish → PDF sifatida saqlash» orqali vektor PDF (matn tanlanadi, havola bosiladi).
//   • renderTeX(): to‘liq LaTeX manba (article, amsmath, booktabs, pgfplots, qrcode, hyperref) — pdfLaTeX
//     (masalan, Overleaf) da kompilyatsiya qilinadi.
// Matnda formulalar $...$ ichida (LaTeX sintaksisi); foydalanuvchi matni userText() orqali qo‘shiladi.
// Bloklar: title, meta, sec, p, list (ol/ul), eq, table, fig, box, sign, link.
// Boshqa virtual laboratoriyalar ham shu moduldan foydalanadi.
// ==========================================================================

import { qrMatrix } from "./lab-qr.js";

/* ------------------------------------------------------------------ Raqamlar (TeX matematika) */

/** O‘nlik vergul bilan: 5{,}49 */
export function fx(v, d = 2) {
  if (!Number.isFinite(v)) return "\\text{--}";
  const s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  return s.replace(".", "{,}");
}
/** sig ta muhim raqam; katta/kichik sonlar a\cdot 10^{n} ko‘rinishida. */
export function sx(v, sig = 3) {
  if (!Number.isFinite(v)) return "\\text{--}";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e-2 && a < 1e4) { const r = Math.abs(Number(v.toPrecision(sig))), dec = Math.max(0, sig - 1 - Math.floor(Math.log10(r))); return fx(v, dec); }
  let e = Math.floor(Math.log10(a)), m = v / 10 ** e;
  if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) { m /= 10; e += 1; }
  return `${fx(m, sig - 1)}\\cdot 10^{${e}}`;
}
/** Foydalanuvchi matni: $ belgisi formula deb o‘qilmasin. */
export const userText = (s) => String(s ?? "").replace(/\$/g, "\\$");

/* ------------------------------------------------------------------ Matn bo‘laklari */

/** "matn $formula$ matn" → [{m:false,s}, {m:true,s}, ...]; \$ — oddiy belgi. */
function split(s) {
  const out = []; let buf = "", math = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "$" && !math) { buf += "\u0000"; i++; continue; }
    if (ch === "$") { out.push({ m: math, s: buf }); buf = ""; math = !math; continue; }
    buf += ch;
  }
  out.push({ m: math, s: buf });
  return out.filter((p) => p.s !== "");
}
const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CYR = { А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "Yo", Ж: "J", З: "Z", И: "I", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "X", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sh", Ъ: "’", Ы: "I", Ь: "", Э: "E", Ю: "Yu", Я: "Ya", Ў: "O‘", Қ: "Q", Ғ: "G‘", Ҳ: "H" };
const cyr2lat = (s) => s.replace(/[\u0400-\u04FF]/g, (ch) => { const up = CYR[ch]; if (up !== undefined) return up; const lo = CYR[ch.toUpperCase()]; return lo !== undefined ? lo.toLowerCase() : ""; });
const TEXSYM = { "•": "\\textbullet{}", "≈": "$\\approx$", "±": "$\\pm$", "×": "$\\times$", "≤": "$\\le$", "≥": "$\\ge$", "≠": "$\\ne$", "→": "$\\to$", "←": "$\\leftarrow$", "∞": "$\\infty$", "√": "$\\surd$", "θ": "$\\theta$", "α": "$\\alpha$", "β": "$\\beta$", "γ": "$\\gamma$", "π": "$\\pi$", "Δ": "$\\Delta$", "σ": "$\\sigma$", "ρ": "$\\rho$", "λ": "$\\lambda$", "φ": "$\\varphi$", "ω": "$\\omega$", "Ω": "$\\Omega$", "⁰": "$^0$", "¹": "$^1$", "⁴": "$^4$", "⁵": "$^5$", "⁶": "$^6$", "⁷": "$^7$", "⁸": "$^8$", "⁹": "$^9$", "⁻": "$^-$", "₀": "$_0$", "₁": "$_1$", "₂": "$_2$", "₃": "$_3$", "₄": "$_4$", "μ": "$\\mu$", "η": "$\\eta$", "ν": "$\\nu$", "Φ": "$\\Phi$", "²": "$^2$", "³": "$^3$" };
const SYMK = Object.keys(TEXSYM);
/** LaTeX matn qismi (pdfLaTeX + T1): maxsus belgilar, tirnoqlar, kirill → lotin. */
export function texEsc(s) {
  return cyr2lat(s).replace(/№/g, "No.").replace(/[•≈±×≤≥≠→←∞√θαβγπΔσρλφωΩ⁰¹⁴⁵⁶⁷⁸⁹⁻₀₁₂₃₄μηνΦ²³]/g, (ch) => `\u0002${SYMK.indexOf(ch)}\u0003`)
    .replace(/[ʻʼ`]/g, "‘").replace(/[´]/g, "’")
    .replace(/\\/g, "\u0001").replace(/([{}%&#_])/g, "\\$1").replace(/\^/g, "\\^{}").replace(/~/g, "\\textasciitilde{}").replace(/\u0001/g, "\\textbackslash{}")
    .replace(/\u0000/g, "\\$").replace(/—/g, "---").replace(/–/g, "--").replace(/…/g, "\\ldots{}").replace(/«/g, "<<").replace(/»/g, ">>")
    .replace(/[^\u0000-\u024F\u2018\u2019\u201C\u201D]/g, "")
    .replace(/\u0002(\d+)\u0003/g, (_, i) => TEXSYM[SYMK[+i]]);
}
/** **qalin** — matn qismlarida (formulalarni ham o‘z ichiga olishi mumkin). */
function boldWalk(s, txt, math, open, close) {
  let bold = false; const out = [];
  split(s).forEach((p) => {
    if (p.m) { out.push(math(p.s)); return; }
    p.s.split("**").forEach((seg, i) => { if (i > 0) { out.push(bold ? close : open); bold = !bold; } if (seg) out.push(txt(seg)); });
  });
  if (bold) out.push(close);
  return out.join("");
}
function inlineTeX(s) { return boldWalk(s, texEsc, (m) => `$${m}$`, "{\\bfseries ", "}"); }
function inlineHTML(s, katex) { return boldWalk(s, (t) => escHtml(t.replace(/\u0000/g, "$")), (m) => katex.renderToString(m, { throwOnError: false, output: "html" }), "<b>", "</b>"); }

/* ------------------------------------------------------------------ SVG grafik */

const SUP = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;
function niceStep(range, target) { const raw = range / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
const dc = (v, d) => v.toFixed(d).replace("-", "−").replace(".", ",");

/**
 * o = { xmin, xmax, ymin, ymax, ylog, xticks, xlab, ylab (SVG matn), series: [{kind:"pts"|"line", data|fn, color, dash, label}] }
 * label — SVG matn bo‘lagi (SUP mumkin).
 */
export function svgPlot(o) {
  const W = 640, H = 340, pl = 64, pr = 16, pt = 30, pb = 46, w = W - pl - pr, h = H - pt - pb;
  const ty = (v) => (o.ylog ? Math.log10(v) : v), y0 = ty(o.ymin), y1 = ty(o.ymax);
  const X = (x) => pl + ((x - o.xmin) / (o.xmax - o.xmin)) * w, Y = (v) => pt + h - ((ty(v) - y0) / (y1 - y0)) * h;
  const g = [];
  g.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="plot" font-family="KaTeX_Main, 'Latin Modern Roman', 'Times New Roman', serif" font-size="13">`);
  g.push(`<defs><clipPath id="c${o.id}"><rect x="${pl}" y="${pt}" width="${w}" height="${h}"/></clipPath></defs>`);
  // to‘r va belgilar
  const xs = o.xticks || (() => { const s = niceStep(o.xmax - o.xmin, 6), a = []; for (let v = Math.ceil(o.xmin / s) * s; v <= o.xmax + 1e-9; v += s) a.push(+v.toFixed(10)); return a; })();
  const xstep = xs.length > 1 ? Math.min(...xs.slice(1).map((v, i) => Math.abs(v - xs[i]))) : 1, xdec = xstep >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(xstep) - 1e-9));
  xs.forEach((v) => { g.push(`<line x1="${X(v)}" y1="${pt}" x2="${X(v)}" y2="${pt + h}" stroke="#e3e6ec" stroke-width="0.8"/>`); g.push(`<line x1="${X(v)}" y1="${pt + h}" x2="${X(v)}" y2="${pt + h - 5}" stroke="#111" stroke-width="0.8"/><text x="${X(v)}" y="${pt + h + 17}" text-anchor="middle">${dc(v, Math.abs(v % 1) > 1e-9 ? Math.max(1, xdec) : 0)}</text>`); });
  if (o.ylog) {
    for (let k = Math.floor(y0); k <= Math.ceil(y1); k++) for (let m = 1; m < 10; m++) {
      const v = m * 10 ** k, yy = Math.log10(v); if (yy < y0 - 1e-9 || yy > y1 + 1e-9) continue;
      g.push(`<line x1="${pl}" y1="${Y(v)}" x2="${pl + w}" y2="${Y(v)}" stroke="${m === 1 ? "#d6dae2" : "#f0f2f5"}" stroke-width="0.8"/>`);
      g.push(`<line x1="${pl}" y1="${Y(v)}" x2="${pl + (m === 1 ? 6 : 3)}" y2="${Y(v)}" stroke="#111" stroke-width="0.8"/>`);
      if (m === 1) g.push(`<text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${k === 0 ? "1" : k === 1 ? "10" : `10${SUP(dc(k, 0))}`}</text>`);
    }
  } else {
    const s = niceStep(o.ymax - o.ymin, 6);
    for (let v = Math.ceil(o.ymin / s) * s; v <= o.ymax + 1e-9; v += s) { g.push(`<line x1="${pl}" y1="${Y(v)}" x2="${pl + w}" y2="${Y(v)}" stroke="#e3e6ec" stroke-width="0.8"/><line x1="${pl}" y1="${Y(v)}" x2="${pl + 5}" y2="${Y(v)}" stroke="#111" stroke-width="0.8"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${dc(v, s >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(s) - 1e-9)))}</text>`); }
  }
  g.push(`<rect x="${pl}" y="${pt}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="1"/>`);
  g.push(`<text x="${pl + w / 2}" y="${H - 8}" text-anchor="middle">${o.xlab}</text><text x="${pl}" y="${pt - 10}" text-anchor="start">${o.ylab}</text>`);
  // seriyalar
  g.push(`<g clip-path="url(#c${o.id})">`);
  for (const s of o.series) {
    const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
    if (s.kind === "line") {
      const pts = s.fn ? Array.from({ length: 300 }, (_, i) => { const x = o.xmin + ((o.xmax - o.xmin) * i) / 299; return [x, s.fn(x)]; }) : s.data;
      let d = "", pen = false;
      pts.forEach(([x, v]) => { if (!Number.isFinite(v) || (o.ylog && !(v > 0))) { pen = false; return; } d += `${pen ? "L" : "M"}${X(x).toFixed(2)} ${Math.max(-1e4, Math.min(1e4, Y(v))).toFixed(2)}`; pen = true; });
      g.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.6"${dash}/>`);
    } else {
      s.data.forEach(([x, v, lo, hi]) => {
        if (lo !== undefined) { const a = Y(Math.max(lo, o.ylog ? o.ymin / 10 : -1e30)), b = Y(hi); g.push(`<path d="M${X(x)} ${a}V${b}M${X(x) - 4} ${b}H${X(x) + 4}${lo > (o.ylog ? 0 : -1e30) ? `M${X(x) - 4} ${a}H${X(x) + 4}` : ""}" stroke="${s.color}" stroke-width="1"/>`); }
        g.push(`<circle cx="${X(x)}" cy="${Y(v)}" r="3.6" fill="${s.color}" stroke="#fff" stroke-width="0.8"/>`);
      });
    }
  }
  g.push("</g>");
  // afsona
  const items = o.series.filter((s) => s.label);
  if (items.length) {
    const lw = 300, lh = 18, bx = o.legendPos === "north west" ? pl + 8 : pl + w - lw - 8, by = pt + 8;
    g.push(`<rect x="${bx}" y="${by}" width="${lw}" height="${items.length * lh + 10}" fill="#fff" fill-opacity="0.94" stroke="#bbb" stroke-width="0.6"/>`);
    items.forEach((s, i) => {
      const yy = by + 14 + i * lh;
      g.push(s.kind === "line" ? `<line x1="${bx + 8}" y1="${yy - 4}" x2="${bx + 34}" y2="${yy - 4}" stroke="${s.color}" stroke-width="1.6"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>` : `<circle cx="${bx + 21}" cy="${yy - 4}" r="3.6" fill="${s.color}"/>`);
      g.push(`<text x="${bx + 42}" y="${yy}" font-size="12">${s.label}</text>`);
    });
  }
  g.push("</svg>");
  return g.join("");
}

/** QR kod — SVG (vektor). */
export function svgQr(text, size = 96) {
  const m = qrMatrix(text), n = m.length, q = 2, cell = size / (n + 2 * q);
  let d = ""; m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${((c + q) * cell).toFixed(3)} ${((r + q) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ------------------------------------------------------------------ HTML (KaTeX) */

const REPORT_CSS = `
@page { size: A4; margin: 17mm 17mm 20mm;
  @top-left { content: "OliyFizika.uz"; font: 700 9pt KaTeX_Main, serif; color: #1d4ed8; }
  @top-right { content: var(--of-doc, "Virtual laboratoriya ishi"); font: 9pt KaTeX_Main, serif; color: #555; }
  @bottom-left { content: "Virtual laboratoriya: oliyfizika.uz"; font: 9pt KaTeX_Main, serif; color: #555; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 9pt KaTeX_Main, serif; color: #555; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #e8ebf0; color: #111; font-family: KaTeX_Main, "Latin Modern Roman", "CMU Serif", "Times New Roman", serif; font-size: 11pt; line-height: 1.42; text-rendering: optimizeLegibility; }
.bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; align-items: center; justify-content: center; padding: 10px; background: #0f172a; color: #e2e8f0; font: 500 14px Inter, system-ui, sans-serif; }
.bar button { font: 600 14px Inter, system-ui, sans-serif; border: 0; border-radius: 8px; padding: 9px 16px; cursor: pointer; background: #2563eb; color: #fff; }
.bar span { opacity: .8; }
.paper { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 17mm 17mm 20mm; background: #fff; box-shadow: 0 8px 30px rgba(15,23,42,.18); }
.brand { display: flex; justify-content: space-between; font-size: 9pt; color: #555; border-bottom: .6pt solid #999; padding-bottom: 4pt; margin-bottom: 12pt; }
.brand b { color: #1d4ed8; }
h1 { font-size: 17pt; text-align: center; margin: 4pt 0 2pt; font-weight: 700; letter-spacing: .1pt; }
.sub { text-align: center; font-style: italic; margin: 0 0 12pt; }
table.meta { width: 100%; border-collapse: collapse; margin: 0 0 6pt; font-size: 10.5pt; }
table.meta td { padding: 2pt 4pt; vertical-align: bottom; }
table.meta td.k { color: #444; white-space: nowrap; width: 1%; }
table.meta td.v { border-bottom: .5pt dotted #777; }
h2 { font-size: 12.5pt; margin: 14pt 0 5pt; font-weight: 700; break-after: avoid; }
p { margin: 0 0 6pt; text-align: justify; hyphens: auto; }
ol, ul { margin: 0 0 6pt; padding-left: 20pt; }
li { margin: 0 0 2pt; text-align: justify; }
.eq { display: flex; align-items: center; margin: 6pt 0 8pt; break-inside: avoid; }
.eq .m { flex: 1; text-align: center; }
.eq .tag { width: 34pt; text-align: right; }
.katex { font-size: 1.06em; }
.katex-display { margin: 0; }
.tcap, .fcap { font-size: 10pt; margin: 8pt 0 4pt; text-align: center; break-after: avoid; }
.tcap b, .fcap b { font-weight: 700; }
.fcap { margin: 2pt 0 10pt; }
.tw { break-inside: avoid; margin: 0 0 8pt; }
table.bk { border-collapse: collapse; margin: 0 auto; font-size: 9.6pt; font-variant-numeric: tabular-nums; }
table.bk th, table.bk td { padding: 2.6pt 6pt; text-align: center; white-space: nowrap; }
table.bk thead th { border-top: 1.1pt solid #000; border-bottom: .55pt solid #000; font-weight: 400; }
table.bk tbody tr:last-child td { border-bottom: 1.1pt solid #000; }
table.bk tr { break-inside: avoid; }
table.bk tr.hl td { background: #fff4e0; }
.tnote { font-size: 9pt; color: #333; margin: 3pt auto 6pt; max-width: 165mm; }
figure { margin: 6pt 0 0; break-inside: avoid; text-align: center; }
figure svg.plot { width: 100%; max-width: 160mm; height: auto; }
.box { border: .6pt solid #333; padding: 7pt 10pt; margin: 6pt 0 8pt; break-inside: avoid; }
.box p:last-child { margin-bottom: 0; }
.sign { display: flex; gap: 30pt; margin: 22pt 0 8pt; break-inside: avoid; }
.sign div { flex: 1; border-top: .6pt solid #000; padding-top: 3pt; font-size: 9.5pt; color: #333; }
.link { display: flex; gap: 12pt; align-items: center; margin-top: 12pt; padding-top: 8pt; border-top: .6pt solid #999; font-size: 9.5pt; break-inside: avoid; }
.link a { color: #1d4ed8; text-decoration: none; font-family: "Latin Modern Mono", "Courier New", monospace; }
.link svg { flex: none; }
@media print { body { background: #fff; } .bar { display: none; } .paper { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } .brand { display: none; } }
@media screen and (max-width: 820px) { .paper { width: auto; margin: 0; padding: 14px; min-height: 0; } table.bk { font-size: 8.5pt; } .tw { overflow-x: auto; } }
`;

function blockHTML(b, k) {
  const I = (s) => inlineHTML(s, k);
  switch (b.t) {
    case "sec": return `<h2>${I(b.text)}</h2>`;
    case "p": return `<p>${I(b.text)}</p>`;
    case "list": return `<${b.ordered ? "ol" : "ul"}>${b.items.map((x) => `<li>${I(x)}</li>`).join("")}</${b.ordered ? "ol" : "ul"}>`;
    case "eq": {
      const tex = b.lines.length > 1 ? `\\begin{aligned}${b.lines.join("\\\\[3pt]")}\\end{aligned}` : b.lines[0];
      return `<div class="eq"><div class="tag"></div><div class="m">${k.renderToString(tex, { displayMode: true, throwOnError: false })}</div><div class="tag">${b.tag ? `(${b.tag})` : ""}</div></div>`;
    }
    case "table": return `<div class="tw">${b.caption ? `<div class="tcap">${I(b.caption)}</div>` : ""}<table class="bk"><thead><tr>${b.head.map((x) => `<th>${I(x)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r, i) => `<tr${b.hl && b.hl[i] ? ' class="hl"' : ""}>${r.map((x) => `<td>${I(String(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>${b.note ? `<div class="tnote">${I(b.note)}</div>` : ""}</div>`;
    case "fig": return `<figure>${svgPlot({ ...b.plot, id: b.id })}<div class="fcap">${I(b.caption)}</div></figure>`;
    case "box": return `<div class="box">${b.items.map((x) => `<p>${I(x)}</p>`).join("")}</div>`;
    case "sign": return `<div class="sign">${b.items.map((x) => `<div>${I(x)}</div>`).join("")}</div>`;
    case "link": return `<div class="link">${svgQr(b.url, 92)}<div>${I(b.text)}<br><a href="${escHtml(b.url)}">${escHtml(b.label)}</a></div></div>`;
    default: return "";
  }
}

/** To‘liq HTML hujjat. o = { katex, katexCss, title, docLabel, autoPrint } */
export function renderHTML(doc, o) {
  const k = o.katex;
  const meta = `<table class="meta">${chunk(doc.meta, 2).map((row) => `<tr>${row.map(([a, b]) => `<td class="k">${inlineHTML(a, k)}</td><td class="v">${inlineHTML(b, k)}</td>`).join("")}</tr>`).join("")}</table>`;
  const body = doc.blocks.map((b) => blockHTML(b, k)).join("\n");
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(o.title)}</title>
<link rel="stylesheet" href="${o.katexCss}"><style>${REPORT_CSS.replace('var(--of-doc, "Virtual laboratoriya ishi")', JSON.stringify(o.docLabel || "Virtual laboratoriya ishi"))}</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">PDF sifatida saqlash</button><span>Chop etish oynasida «Saqlash: PDF» (Save as PDF) ni tanlang</span></div>
<main class="paper"><div class="brand"><b>OliyFizika.uz</b><span>${escHtml(o.docLabel || "")}</span></div>
<h1>${inlineHTML(doc.title, k)}</h1><p class="sub">${inlineHTML(doc.sub, k)}</p>${meta}
${body}
</main>${o.autoPrint ? `<script>window.addEventListener("load",function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print();},350);});});<\/script>` : ""}</body></html>`;
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

/* ------------------------------------------------------------------ LaTeX */

function plotTeX(p) {
  const fmtN = (v) => (Number.isFinite(v) ? Number(v.toPrecision(6)).toString() : "0");
  const env = p.ylog ? "semilogyaxis" : "axis";
  const opts = [
    "width=0.94\\linewidth", "height=6.2cm", `xmin=${fmtN(p.xmin)}`, `xmax=${fmtN(p.xmax)}`, `ymin=${fmtN(p.ymin)}`, `ymax=${fmtN(p.ymax)}`,
    p.xticks ? `xtick={${p.xticks.join(",")}}` : null, `xlabel={${p.xlabTeX}}`, `ylabel={${p.ylabTeX}}`,
    "grid=major", "major grid style={black!12}", `legend pos=${p.legendPos || "north east"}`, "legend cell align=left", "legend style={font=\\footnotesize, fill=white, fill opacity=0.92, text opacity=1}",
    "tick label style={font=\\small}", "label style={font=\\small}", "/pgf/number format/use comma", "scaled ticks=false", "xticklabel style={/pgf/number format/fixed, /pgf/number format/precision=3}",
  ].filter(Boolean);
  const L = [`\\begin{tikzpicture}`, `\\begin{${env}}[${opts.join(",\n  ")}]`];
  for (const s of p.series) {
    const col = s.texColor || "black";
    if (s.kind === "line") {
      if (s.texFn) L.push(`\\addplot[${col}${s.labelTeX ? "" : ", forget plot"}, thick${s.dash ? ", dashed" : ""}, domain=${fmtN(s.domain[0])}:${fmtN(s.domain[1])}, samples=${s.samples || 200}] {${s.texFn}};`);
      else L.push(`\\addplot[${col}${s.labelTeX ? "" : ", forget plot"}, thick${s.dash ? ", dashed" : ""}] coordinates {${s.data.map(([x, y]) => `(${fmtN(x)},${fmtN(y)})`).join(" ")}};`);
    } else {
      L.push(`\\addplot[only marks, mark=*, mark size=1.8pt, ${col}${s.labelTeX ? "" : ", forget plot"}, error bars/.cd, y dir=both, y explicit] coordinates {${s.data.map(([x, y, lo, hi]) => `(${fmtN(x)},${fmtN(y)}) +- (0,${fmtN((hi - lo) / 2)})`).join(" ")}};`);
    }
    if (s.labelTeX) L.push(`\\addlegendentry{${s.labelTeX}}`);
  }
  L.push(`\\end{${env}}`, `\\end{tikzpicture}`);
  return L.join("\n");
}
function blockTeX(b) {
  const I = inlineTeX;
  switch (b.t) {
    case "sec": return `\n\\section*{${I(b.text)}}`;
    case "p": return `${I(b.text)}\n`;
    case "list": return `\\begin{${b.ordered ? "enumerate" : "itemize"}}[leftmargin=*,itemsep=1pt,topsep=2pt]\n${b.items.map((x) => `  \\item ${I(x)}`).join("\n")}\n\\end{${b.ordered ? "enumerate" : "itemize"}}`;
    case "eq": return b.lines.length > 1 ? `\\begin{align*}\n${b.lines.join(" \\\\\n")}${b.tag ? ` \\tag{${b.tag}}` : ""}\n\\end{align*}` : `\\begin{equation*}\n${b.lines[0]}${b.tag ? ` \\tag{${b.tag}}` : ""}\n\\end{equation*}`;
    case "table": {
      const cols = b.head.length;
      return `\\begin{center}\n${b.caption ? `{\\small ${I(b.caption)}}\\\\[3pt]\n` : ""}{\\small\\setlength{\\tabcolsep}{${cols > 8 ? 3.4 : 5}pt}\n\\begin{tabular}{${"c".repeat(cols)}}\n\\toprule\n${b.head.map(I).join(" & ")} \\\\\n\\midrule\n${b.rows.map((r) => r.map((x) => I(String(x))).join(" & ") + " \\\\").join("\n")}\n\\bottomrule\n\\end{tabular}}\n${b.note ? `\\\\[3pt]\\parbox{0.92\\linewidth}{\\footnotesize ${I(b.note)}}\n` : ""}\\end{center}`;
    }
    case "fig": return `\\begin{center}\n${plotTeX(b.plot)}\\\\[2pt]\n{\\small ${I(b.caption)}}\n\\end{center}`;
    case "box": return `\\par\\smallskip\\noindent\\fbox{\\parbox{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule}{${b.items.map(I).join("\\par\\smallskip ")}}}\\par\\smallskip`;
    case "sign": return `\\vspace{14mm}\\noindent${b.items.map((x) => `\\parbox[t]{0.44\\linewidth}{\\rule{\\linewidth}{0.4pt}\\\\\\footnotesize ${I(x)}}`).join("\\hfill")}\\par`;
    case "link": return `\\vspace{6mm}\\noindent\\begin{minipage}{2.6cm}\\qrcode[height=2.3cm]{${b.url}}\\end{minipage}\\hspace{4mm}\\begin{minipage}{0.7\\linewidth}\\small ${I(b.text)}\\\\\\href{${b.url}}{\\texttt{${texEsc(b.label)}}}\\end{minipage}`;
    default: return "";
  }
}
/** To‘liq LaTeX manba. o = { docLabel, url, label } */
export function renderTeX(doc, o) {
  const meta = doc.meta.map(([a, b]) => `${inlineTeX(a)} & ${inlineTeX(b)} \\\\`).join("\n");
  return `% ==========================================================================
% ${texEsc(doc.titlePlain || "Laboratoriya ishi")} — OliyFizika.uz virtual laboratoriyasi
% Avtomatik yaratilgan LaTeX manba. Kompilyatsiya: pdfLaTeX (masalan, Overleaf: New Project → Upload).
% Sayt: ${o.url}
% ==========================================================================
\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\DeclareUnicodeCharacter{03BC}{\\ensuremath{\\mu}}\\DeclareUnicodeCharacter{03BB}{\\ensuremath{\\lambda}}\\DeclareUnicodeCharacter{03A6}{\\ensuremath{\\Phi}}\\DeclareUnicodeCharacter{03C6}{\\ensuremath{\\varphi}}\\DeclareUnicodeCharacter{03BD}{\\ensuremath{\\nu}}\\DeclareUnicodeCharacter{03C3}{\\ensuremath{\\sigma}}\\DeclareUnicodeCharacter{03A9}{\\ensuremath{\\Omega}}
\\usepackage[T1]{fontenc}
\\IfFileExists{lmodern.sty}{\\usepackage{lmodern}}{}
\\usepackage[a4paper,top=22mm,bottom=24mm,left=18mm,right=18mm,headheight=14pt]{geometry}
\\usepackage{amsmath,amssymb}
\\usepackage{array,booktabs}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.16}
\\usepackage{qrcode}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\usepackage[hidelinks]{hyperref}
\\definecolor{ofblue}{HTML}{1D4ED8}
\\pagestyle{fancy}\\fancyhf{}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancyhead[L]{\\small\\textcolor{ofblue}{\\textbf{OliyFizika.uz}}}
\\fancyhead[R]{\\small ${texEsc(o.docLabel || "")}}
\\fancyfoot[L]{\\small Virtual laboratoriya: \\href{${o.url}}{\\texttt{${texEsc(o.label)}}}}
\\fancyfoot[R]{\\small \\thepage{} / \\pageref{LastPage}}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{4pt}
\\hypersetup{pdftitle={${texEsc(doc.titlePlain || "")}}, pdfauthor={${texEsc(doc.author || "")}}, pdfcreator={OliyFizika.uz}}

\\begin{document}
\\begin{center}
{\\Large\\bfseries ${inlineTeX(doc.title)}}\\\\[4pt]
{\\itshape ${inlineTeX(doc.sub)}}
\\end{center}
\\vspace{2pt}
{\\small\\begin{tabular}{@{}>{\\raggedright\\arraybackslash}p{0.2\\linewidth}>{\\raggedright\\arraybackslash}p{0.74\\linewidth}@{}}
${meta}
\\end{tabular}}

${doc.blocks.map(blockTeX).join("\n\n")}

\\end{document}
`;
}
