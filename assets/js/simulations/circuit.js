// ==========================================================================
// Elektr zanjiri — virtual laboratoriya (simulations/circuit.html)
// Foydalanuvchi asboblar qutisidan qurilmalarni (manba, kalit, rezistor, reostat, o'tkazgich, lampochka,
// diod, LED, ampermetr, voltmetr) maydonga sudrab yoki tanlab qo'yadi, sim tortadi va zanjir yig'adi.
// Fizika: circuit-physics.js (tugun potensiallari usuli + diodlar uchun Nyuton, Node'da tekshirilgan).
// To'r va tayyor zanjirlar: circuit-grid.js. Grafiklar: circuit-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { solve, resistanceOf, voltmeterReading, MATERIALS, LED_COLORS, LED_I_NOM, LED_I_MAX, R_VOLT } from "./circuit-physics.js";
import {
  COLS, ROWS, NODE_COUNT, EDGES, nodeCR, hEdge, vEdge, PRESETS, PRESET_ORDER, defaultProps, toElements, labelsFor, TYPE_INFO,
} from "./circuit-grid.js";
import { drawBars, drawIU, drawSource } from "./circuit-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 11px Inter, system-ui, sans-serif";
const LOAD_TYPES = new Set(["resistor", "rheostat", "conductor", "lamp", "diode", "led"]);
const LINEAR = new Set(["resistor", "rheostat", "conductor", "lamp"]);
const DIODES = new Set(["diode", "led"]);
const FLIPPABLE = new Set(["battery", "diode", "led", "voltmeter"]);
const I_ZERO = 1e-6;     // bundan kichik tok ko'rsatkichlarda 0
const I_OPEN = 1e-4;     // manba toki bundan kichik — zanjir amalda ochiq (voltmetr toki hisobga olinmaydi)

/* ------------------------------------------------------------------ Asboblar qutisi */

const S = (d) => `<svg viewBox="0 0 44 24" aria-hidden="true" focusable="false">${d}</svg>`;
const PALETTE = [
  { group: "Boshqarish", items: [
    { tool: "select", label: "Tanlash", title: "Elementni tanlash va sudrab ko‘chirish; kalitni bosish — ulash/uzish", svg: S('<path d="M16 3l12 9.5-5.6.9 3.3 6.3-2.7 1.4-3.2-6.3L16 19Z" fill="currentColor" stroke="none"/>'), noDrag: true },
    { tool: "wire", label: "Sim", title: "Ulovchi sim: qirraga bosing yoki sudrab torting", svg: S('<path d="M5 12h34"/><circle cx="5" cy="12" r="2.4" fill="currentColor"/><circle cx="39" cy="12" r="2.4" fill="currentColor"/>') },
    { tool: "erase", label: "O‘chirish", title: "Elementni yoki simni o‘chirish", svg: S('<path d="M15 7h14M19 7V5h6v2M17 7l1.2 13h7.6L27 7"/>'), noDrag: true },
  ] },
  { group: "Manba va kalit", items: [
    { tool: "battery", label: "Batareya", title: "Tok manbai: EYuK ε va ichki qarshilik r", svg: S('<path d="M3 12h15M27 12h14M18 4v16"/><path d="M26 8v8" stroke-width="4"/><path d="M10 4.5h4M12 2.5v4" stroke-width="1.6"/>') },
    { tool: "switch", label: "Kalit", title: "Kalit: zanjirni ulaydi va uzadi", svg: S('<path d="M3 12h11M30 12h11M14 12l14-7"/><circle cx="14" cy="12" r="2.2" fill="currentColor"/><circle cx="30" cy="12" r="2.2" fill="currentColor"/>') },
  ] },
  { group: "Iste’molchilar", items: [
    { tool: "resistor", label: "Rezistor", title: "Rezistor: o‘zgarmas qarshilik R", svg: S('<path d="M3 12h9M32 12h9"/><rect x="12" y="7" width="20" height="10" rx="1"/>') },
    { tool: "rheostat", label: "Reostat", title: "Reostat: siljitgich bilan o‘zgaruvchan qarshilik", svg: S('<path d="M3 12h9M32 12h9"/><rect x="12" y="7" width="20" height="10" rx="1"/><path d="M10 21L33 3M33 3l-5.5.6M33 3l-1.4 5.3"/>') },
    { tool: "conductor", label: "O‘tkazgich", title: "Sim o‘tkazgich: R = ρ·l/S", svg: S('<path d="M3 12h5c2-7 4-7 6 0s4 7 6 0 4-7 6 0 4 7 6 0h8"/>') },
    { tool: "lamp", label: "Lampochka", title: "Cho‘g‘lanma lampochka", svg: S('<path d="M3 12h11M30 12h11"/><circle cx="22" cy="12" r="8"/><path d="M16.4 6.4l11.2 11.2M27.6 6.4L16.4 17.6"/>') },
    { tool: "diode", label: "Diod", title: "Yarimo‘tkazgichli diod: tokni bir yo‘nalishda o‘tkazadi", svg: S('<path d="M3 12h13M28 12h13"/><path d="M16 5l12 7-12 7Z" fill="currentColor" fill-opacity=".18"/><path d="M28 5v14"/>') },
    { tool: "led", label: "LED", title: "Yorug‘lik diodi (LED)", svg: S('<path d="M3 12h13M28 12h13"/><path d="M16 6l11 6-11 6Z" fill="currentColor" fill-opacity=".18"/><path d="M27 6v12"/><path d="M26 5l4-3.5M30 1.5h-2.6M30 1.5v2.6M31 8l4-3.5M35 4.5h-2.6M35 4.5v2.6" stroke-width="1.5"/>') },
  ] },
  { group: "O‘lchov asboblari", items: [
    { tool: "ammeter", label: "Ampermetr", title: "Ampermetr: tok kuchini o‘lchaydi, ketma-ket ulanadi", svg: S('<path d="M3 12h9M32 12h9"/><circle cx="22" cy="12" r="9.5"/><text x="22" y="16.2" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, system-ui, sans-serif">A</text>') },
    { tool: "voltmeter", label: "Voltmetr", title: "Voltmetr: kuchlanishni o‘lchaydi, parallel ulanadi", svg: S('<path d="M3 12h9M32 12h9"/><circle cx="22" cy="12" r="9.5"/><text x="22" y="16.2" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, system-ui, sans-serif">V</text>') },
  ] },
];
const TOOL_BY_ID = new Map(PALETTE.flatMap((g) => g.items).map((t) => [t.tool, t]));
const PLACE_TOOLS = new Set([...TOOL_BY_ID.keys()].filter((t) => t !== "select" && t !== "erase"));

/* ------------------------------------------------------------------ Holat */

let cells = new Map();          // qirra → element xossalari
let selected = null;            // tanlangan qirra
let tool = "select";
let presetId = "ohm";
let lastPreset = "ohm";
let hover = null;               // { kind: "edge", id }
let model = null;               // { elements, index, labels, sol, kOf }
let points = [];                // I(U) o'lchov nuqtalari { edge, U, I }
let drag = null;                // sudrash holati (ko'chirish, sim tortish, qutidan olib kelish)
let dropPreview = null;         // { edge, el, swap }
const ui = { tab: "bars", dir: "conv", potential: true, values: false };
const phase = new Float64Array(EDGES.length);

function recompute() {
  const { elements, index } = toElements(cells);
  const sol = solve(NODE_COUNT, elements);
  model = { elements, index, sol, labels: labelsFor(cells), kOf: new Map(index.map((e, k) => [e, k])) };
}
const elOf = (edge) => (model.kOf.has(edge) ? model.elements[model.kOf.get(edge)] : null);
const resOf = (edge) => (model.kOf.has(edge) ? model.sol.el[model.kOf.get(edge)] : null);
const forEachType = (pred) => model.elements.map((x, k) => ({ x, r: model.sol.el[k], k, edge: model.index[k] })).filter((o) => pred(o.x));

/* ------------------------------------------------------------------ Geometriya */

const geo = { sp: 60, ox: 0, oy: 0, len: 36 };
function layout(w, h) {
  const padX = w >= 700 ? 96 : w >= 600 ? 76 : 34, padT = 34, padB = 34;
  geo.sp = Math.max(26, Math.min((w - 2 * padX) / (COLS - 1), (h - padT - padB) / (ROWS - 1)));
  geo.ox = (w - (COLS - 1) * geo.sp) / 2;
  geo.oy = padT + (h - padT - padB - (ROWS - 1) * geo.sp) / 2;
  geo.len = clamp(geo.sp * 0.62, 20, 52);
}
const g0 = (edge) => EDGES[edge];
const nx = (n) => geo.ox + nodeCR(n).c * geo.sp;
const ny = (n) => geo.oy + nodeCR(n).r * geo.sp;

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

let touchMode = false;
function pick(px, py) {
  let best = null, bd = Infinity;
  for (const e of EDGES) { const d = segDist(px, py, nx(e.a), ny(e.a), nx(e.b), ny(e.b)); if (d < bd) { bd = d; best = e.i; } }
  return bd <= (touchMode ? Math.max(18, geo.sp * 0.45) : Math.max(12, geo.sp * 0.3)) ? { kind: "edge", id: best } : null;
}

const hE = (c, r) => (c >= 0 && c < COLS - 1 && r >= 0 && r < ROWS ? hEdge(c, r) : -1);
const vE = (c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS - 1 ? vEdge(c, r) : -1);
const occ = (edge) => edge >= 0 && cells.has(edge) && cells.get(edge).type !== "wire";

/** Yorliq tomoni: tashqariga (sxemadagi odat), qo'shni qirrada element bo'lsa — qarama-qarshi tomonga. */
function labelSide(e) {
  if (e.orient === "h") {
    const upBlocked = e.r === 0 || occ(hE(e.c, e.r - 1));
    const dnBlocked = e.r === ROWS - 1 || occ(hE(e.c, e.r + 1));
    const pref = e.r <= (ROWS - 1) / 2 ? -1 : 1;
    if (pref < 0) return upBlocked && !dnBlocked ? 1 : e.r === 0 ? 1 : -1;
    return dnBlocked && !upBlocked ? -1 : e.r === ROWS - 1 ? -1 : 1;
  }
  const lBlocked = occ(vE(e.c - 1, e.r)), rBlocked = occ(vE(e.c + 1, e.r));
  const pref = e.c < (COLS - 1) / 2 ? -1 : 1;
  if (pref < 0) return lBlocked && !rBlocked ? 1 : -1;
  return rBlocked && !lBlocked ? -1 : 1;
}

/* ------------------------------------------------------------------ Ranglar (potensial) */

const rgbCache = new Map();
let probeCtx = null;
function toRGB(str) {
  if (rgbCache.has(str)) return rgbCache.get(str);
  probeCtx ||= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  probeCtx.canvas.width = probeCtx.canvas.height = 1;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = str; probeCtx.fillRect(0, 0, 1, 1);
  const d = probeCtx.getImageData(0, 0, 1, 1).data;
  const rgb = [d[0], d[1], d[2]];
  rgbCache.set(str, rgb);
  return rgb;
}
const mixRGB = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const rgba = (rgb, a) => `rgba(${rgb.join(",")},${a})`;

function potentialRange() {
  let lo = Infinity, hi = -Infinity;
  model.sol.phi.forEach((p) => { if (Number.isFinite(p)) { lo = Math.min(lo, p); hi = Math.max(hi, p); } });
  return hi - lo > 1e-9 ? [lo, hi] : null;
}

/* ------------------------------------------------------------------ Elementlar belgilari */

function glow(ctx, rgb, rad, b) {
  const g = ctx.createRadialGradient(0, 0, rad * 0.3, 0, 0, rad * (1.5 + b));
  g.addColorStop(0, rgba(rgb, 0.55 * Math.min(b, 1) + 0.15));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rad * (1.5 + b), 0, TAU); ctx.fill();
}

function meter(ctx, c, Ls, ang, letter) {
  const rad = Ls * 0.4;
  ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(-ang); ctx.fillStyle = c.text; ctx.font = `700 ${Math.round(rad * 1.2)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(letter, 0, 1); ctx.restore();
}

function plusMark(ctx, c, x, y) {
  ctx.save(); ctx.lineWidth = 1.75; ctx.strokeStyle = c.danger;
  ctx.beginPath(); ctx.moveTo(x - 3.5, y); ctx.lineTo(x + 3.5, y); ctx.moveTo(x, y - 3.5); ctx.lineTo(x, y + 3.5); ctx.stroke();
  ctx.restore();
}

/** Lokal koordinata: markaz (0,0), x o'qi a→b bo'ylab. Uzunlik Ls. */
function drawSymbol(ctx, c, e, r, Ls, ang) {
  const stroke = c.text2;
  ctx.lineWidth = 2.25; ctx.strokeStyle = stroke; ctx.fillStyle = c.bg; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const h = Ls * 0.4;
  switch (e.type) {
    case "resistor":
    case "rheostat": {
      ctx.beginPath(); ctx.rect(-Ls / 2, -h / 2, Ls, h); ctx.fill(); ctx.stroke();
      if (e.type === "rheostat") {
        ctx.beginPath(); ctx.moveTo(-Ls * 0.42, h * 0.95); ctx.lineTo(Ls * 0.42, -h * 0.95); ctx.stroke();
        ctx.fillStyle = stroke; ctx.beginPath(); ctx.moveTo(Ls * 0.42, -h * 0.95); ctx.lineTo(Ls * 0.42 - 7, -h * 0.95 + 1.5); ctx.lineTo(Ls * 0.42 - 2.5, -h * 0.95 + 6.5); ctx.closePath(); ctx.fill();
        const px = -Ls / 2 + e.pos * Ls;
        ctx.fillStyle = c.warning; ctx.beginPath(); ctx.moveTo(px, h / 2 + 1); ctx.lineTo(px - 4.5, h / 2 + 8); ctx.lineTo(px + 4.5, h / 2 + 8); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case "lamp": {
      const rad = Ls * 0.36, b = clamp((r?.P ?? 0) / (e.pNom || 3), 0, 1.6);
      if (b > 0.01) glow(ctx, toRGB(c.warning), rad, b);
      ctx.fillStyle = b > 0.01 ? mixRGB(toRGB(c.bg), toRGB(c.warning), clamp(b, 0, 1) * 0.55) : c.bg;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); const k = rad * 0.7; ctx.moveTo(-k, -k); ctx.lineTo(k, k); ctx.moveTo(-k, k); ctx.lineTo(k, -k); ctx.stroke();
      break;
    }
    case "diode":
    case "led": {
      const s = e.rev ? -1 : 1, t = Ls * 0.24, hh = Ls * 0.3;
      const If = r?.If ?? 0;
      const led = e.type === "led";
      const ledRGB = led ? toRGB(LED_COLORS[e.color]?.color ?? c.danger) : null;
      const b = led ? clamp(If / LED_I_NOM, 0, 1.6) : 0;
      if (led && b > 0.02) glow(ctx, ledRGB, Ls * 0.34, b);
      ctx.beginPath(); ctx.moveTo(-Ls / 2, 0); ctx.lineTo(-t, 0); ctx.moveTo(t, 0); ctx.lineTo(Ls / 2, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * t, -hh); ctx.lineTo(s * t, 0); ctx.lineTo(-s * t, hh); ctx.closePath();
      ctx.fillStyle = led ? (b > 0.02 ? rgba(ledRGB, 0.35 + 0.6 * Math.min(b, 1)) : rgba(ledRGB, 0.16)) : c.bg;
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * t, -hh); ctx.lineTo(s * t, hh); ctx.stroke();
      if (led) {
        ctx.save(); ctx.strokeStyle = b > 0.02 ? rgba(ledRGB, 1) : stroke; ctx.lineWidth = 1.6;
        [[0, -hh - 2], [t * 0.9, -hh + 2]].forEach(([x0, y0]) => {
          const x1 = x0 + Ls * 0.16, y1 = y0 - Ls * 0.16;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1 - 4.5, y1 + 0.5); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 0.5, y1 + 4.5); ctx.stroke();
        });
        ctx.restore();
      }
      break;
    }
    case "battery": {
      const s = e.plus === "a" ? -1 : 1; // musbat qutb tomoni (lokal x ishorasi)
      const xl = s * Ls * 0.1, xs = -s * Ls * 0.1;
      ctx.beginPath(); ctx.moveTo(s * Ls / 2, 0); ctx.lineTo(xl, 0); ctx.moveTo(-s * Ls / 2, 0); ctx.lineTo(xs, 0); ctx.stroke();
      ctx.lineWidth = 2.25; ctx.beginPath(); ctx.moveTo(xl, -Ls * 0.34); ctx.lineTo(xl, Ls * 0.34); ctx.stroke();
      ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(xs, -Ls * 0.2); ctx.lineTo(xs, Ls * 0.2); ctx.stroke();
      plusMark(ctx, c, s * Ls * 0.3, -Ls * 0.3);
      break;
    }
    case "switch": {
      const t = Ls * 0.38;
      ctx.beginPath(); ctx.moveTo(-Ls / 2, 0); ctx.lineTo(-t, 0); ctx.moveTo(t, 0); ctx.lineTo(Ls / 2, 0); ctx.stroke();
      ctx.fillStyle = stroke; [[-t, 0], [t, 0]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); });
      ctx.strokeStyle = e.closed ? c.success : c.text2; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-t, 0); if (e.closed) ctx.lineTo(t, 0); else ctx.lineTo(t * 0.85, -Ls * 0.34); ctx.stroke();
      break;
    }
    case "ammeter": meter(ctx, c, Ls, ang, "A"); break;
    case "voltmeter": {
      meter(ctx, c, Ls, ang, "V");
      plusMark(ctx, c, (e.plus === "b" ? 1 : -1) * Ls * 0.47, -Ls * 0.24);
      break;
    }
    case "conductor": {
      ctx.strokeStyle = c.warning; ctx.lineWidth = 2.75;
      const A = Ls * 0.17, loops = 4;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const t = i / 48; const x = -Ls / 2 + t * Ls, y = A * Math.sin(t * loops * TAU); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      break;
    }
    default: break;
  }
}

/* ------------------------------------------------------------------ Chizish */

/** Yorliq uchun qisqa son: 20,0 → 20; 6,60 → 6,6. */
const short = (v) => sci(v, 3).replace(/,0+$/, "").replace(/(,\d*?)0+$/, "$1");
const amps = (I) => (Math.abs(I) < I_ZERO ? "0 A" : Math.abs(I) < 0.1 ? `${short(Math.abs(I) * 1000)} mA` : `${short(Math.abs(I))} A`);

function formatValue(e, r) {
  switch (e.type) {
    case "resistor": return `${short(e.R)} Ω`;
    case "rheostat": case "conductor": case "lamp": return `${short(r?.R ?? resistanceOf(e))} Ω`;
    case "battery": return `${short(e.emf)} V${e.r > 0 ? ` · r=${short(e.r)}` : ""}`;
    case "led": return LED_COLORS[e.color]?.name.toLowerCase() ?? "";
    default: return "";
  }
}

function edgeGeom(edge) {
  const e = EDGES[edge];
  const x1 = nx(e.a), y1 = ny(e.a), x2 = nx(e.b), y2 = ny(e.b);
  const L = Math.hypot(x2 - x1, y2 - y1);
  return { e, x1, y1, x2, y2, L, ang: Math.atan2(y2 - y1, x2 - x1), ux: (x2 - x1) / L, uy: (y2 - y1) / L, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

/** Bitta element: chiqish simlari + belgi. colorA/colorB — uchlar potensiali rangi. */
function drawElement(ctx, c, edge, el, r, colorA, colorB) {
  const g = edgeGeom(edge), Ls = geo.len;
  const hasSym = el.type !== "wire";
  const half = hasSym ? Ls / 2 : 0;
  ctx.lineWidth = 3.25; ctx.lineCap = "round";
  ctx.strokeStyle = colorA;
  ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(hasSym ? g.mx - g.ux * half : g.x2, hasSym ? g.my - g.uy * half : g.y2); ctx.stroke();
  if (hasSym) {
    ctx.strokeStyle = colorB;
    ctx.beginPath(); ctx.moveTo(g.mx + g.ux * half, g.my + g.uy * half); ctx.lineTo(g.x2, g.y2); ctx.stroke();
    ctx.save(); ctx.translate(g.mx, g.my); ctx.rotate(g.ang);
    drawSymbol(ctx, c, el, r, Ls, g.ang);
    ctx.restore();
  }
  return g;
}

function draw(ctx, stage) {
  const { w, h, colors: c } = stage;
  layout(w, h);
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  if (!model) return;
  const sol = model.sol;
  const range = ui.potential && sol.ok ? potentialRange() : null;
  const lo = toRGB(c.primary), hi = toRGB(c.danger), neutral = c.text3;
  const potColor = (n) => {
    const p = sol.phi[n];
    if (!range || !Number.isFinite(p)) return neutral;
    return mixRGB(lo, hi, (p - range[0]) / (range[1] - range[0]));
  };

  // Laboratoriya stoli (taxta) va to'r nuqtalari
  const bx = geo.ox - geo.sp * 0.42, by = geo.oy - geo.sp * 0.42, bw = (COLS - 1) * geo.sp + geo.sp * 0.84, bh = (ROWS - 1) * geo.sp + geo.sp * 0.84;
  ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill(); ctx.stroke(); ctx.restore();
  const degree = new Array(NODE_COUNT).fill(0);
  model.index.forEach((i) => { degree[EDGES[i].a]++; degree[EDGES[i].b]++; });
  const building = tool !== "select" || drag?.kind === "bin" || drag?.kind === "move";
  ctx.fillStyle = c.borderStrong;
  for (let n = 0; n < NODE_COUNT; n++) { if (degree[n]) continue; ctx.beginPath(); ctx.arc(nx(n), ny(n), building ? 2.8 : 2, 0, TAU); ctx.fill(); }

  // Ko'rsatkich (hover) qirrasi
  const target = dropPreview ? dropPreview.edge : hover?.kind === "edge" && tool !== "select" && !drag ? hover.id : null;
  if (target !== null && target !== undefined) {
    const g = edgeGeom(target);
    ctx.save(); ctx.strokeStyle = tool === "erase" && !dropPreview ? c.danger : dropPreview?.swap ? c.warning : c.primary; ctx.globalAlpha = 0.25; ctx.lineWidth = 16; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); ctx.restore();
  }

  const Ls = geo.len;
  const labels = [];
  const spacing = 13;
  const moving = drag?.kind === "move" && drag.active ? drag.from : null;

  model.index.forEach((edge, k) => {
    const el = model.elements[k], r = sol.el[k];
    if (edge === moving) ctx.globalAlpha = 0.3;
    const g = drawElement(ctx, c, edge, el, r, potColor(g0(edge).a), potColor(g0(edge).b));
    ctx.globalAlpha = 1;
    const hasSym = el.type !== "wire", half = hasSym ? Ls / 2 : 0;

    if (edge === selected && edge !== moving) {
      ctx.save(); ctx.fillStyle = c.primary; ctx.globalAlpha = 0.12; ctx.strokeStyle = c.primary;
      ctx.beginPath(); ctx.arc(g.mx, g.my, hasSym ? Ls * 0.72 : 12, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.restore();
    }

    // Zaryadlar oqimi
    const I = r.I;
    if (sol.ok && Math.abs(I) > 1e-5 && edge !== moving) {
      const ph = ((phase[edge] % spacing) + spacing) % spacing;
      ctx.fillStyle = ui.dir === "elec" ? c.primary : c.warning;
      ctx.strokeStyle = c.bg; ctx.lineWidth = 1;
      for (let s = ph - spacing; s <= g.L; s += spacing) {
        if (s < 3 || s > g.L - 3) continue;
        if (hasSym && s > g.L / 2 - half - 2 && s < g.L / 2 + half + 2) continue;
        ctx.beginPath(); ctx.arc(g.x1 + g.ux * s, g.y1 + g.uy * s, 2.7, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }

    if (hasSym && edge !== moving) {
      const lab = model.labels.get(edge);
      const tiny = geo.sp < 50;
      const vr = el.type === "voltmeter" ? voltmeterReading(el, r) : 0;
      let name = lab, value = "";
      if (el.type === "ammeter") { value = sol.ok ? amps(I) : "—"; if (tiny) name = ""; }
      else if (el.type === "voltmeter") { value = sol.ok ? `${fmt(vr, Math.abs(vr) < 10 ? 2 : 1)} V` : "—"; if (tiny) name = ""; }
      else if (el.type === "switch") value = tiny ? "" : `· ${el.closed ? "ulangan" : "uzilgan"}`;
      else if (!tiny || el.type === "battery") value = formatValue(el, r);
      const text = [name, value].filter(Boolean).join(" ");
      const sub = ui.values && sol.ok && !["ammeter", "switch", "voltmeter"].includes(el.type) ? `${amps(DIODES.has(el.type) ? r.If : I)} · ${short(Math.abs(el.type === "battery" ? r.Ut : r.U))} V` : "";
      labels.push({ text, name, value, sub, x: g.mx, y: g.my, horiz: g.e.orient === "h", side: labelSide(g.e), sel: edge === selected, meter: el.type === "ammeter" || el.type === "voltmeter" });
    }
  });

  // Tugunlar: tutashuv nuqtalari va ochiq uchlar
  for (let n = 0; n < NODE_COUNT; n++) {
    if (degree[n] >= 3) { ctx.fillStyle = potColor(n); ctx.beginPath(); ctx.arc(nx(n), ny(n), 4.6, 0, TAU); ctx.fill(); }
    else if (degree[n] === 1) { ctx.strokeStyle = c.text2; ctx.lineWidth = 1.75; ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(nx(n), ny(n), 3.8, 0, TAU); ctx.fill(); ctx.stroke(); }
  }

  // Joylashtirish oldindan ko'rinishi (qutidan sudrash, ko'chirish yoki asbob tanlanganda)
  const ghost = dropPreview || (target !== null && target !== undefined && PLACE_TOOLS.has(tool) && !drag ? { edge: target, el: defaultProps(tool) } : null);
  if (ghost && ghost.edge !== null && ghost.edge !== undefined) {
    ctx.save(); ctx.globalAlpha = 0.6;
    drawElement(ctx, c, ghost.edge, ghost.el, null, c.primary, c.primary);
    ctx.restore();
  }

  // Yorliqlar ustidan: har biri uchun bir necha joy sinab ko'riladi (ikki tomon, bir/ikki qator),
  // boshqa yorliq yoki element belgisi bilan ustma-ust tushmaydigan birinchisi tanlanadi.
  const fs = geo.sp < 46 ? 10 : 11;
  const fontOf = (l) => (l.sel ? `700 ${fs + 1}px Inter, system-ui, sans-serif` : `600 ${fs}px Inter, system-ui, sans-serif`);
  const subFont = `500 ${fs - 0.5}px Inter, system-ui, sans-serif`;
  const LH = 19, off = Ls * 0.5 + 12;
  const boxes = labels.map((l) => ({ x: l.x - Ls * 0.45, y: l.y - Ls * 0.45, w: Ls * 0.9, h: Ls * 0.9 }));
  const overlap = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
  const placed = [];
  const order = labels.map((l, i) => i).sort((i, j) => (labels[j].meter - labels[i].meter) || (labels[j].sel - labels[i].sel));
  order.forEach((i) => {
    const l = labels[i];
    ctx.font = fontOf(l);
    const variants = [[{ t: l.text, f: fontOf(l), main: true }]];
    if (l.name && l.value) variants.push([{ t: l.name, f: fontOf(l), main: true }, { t: l.value, f: fontOf(l), main: true }]);
    if (l.sub) variants.forEach((v) => v.push({ t: l.sub, f: subFont, main: false }));
    const cands = [];
    [l.side, -l.side].forEach((side) => variants.forEach((lines) => {
      const tw = Math.max(...lines.map((ln) => { ctx.font = ln.f; return ctx.measureText(ln.t).width; })) + 12;
      const hh = lines.length * LH;
      let r;
      if (l.horiz) {
        const cy = l.y + side * (off + (lines.length - 1) * LH / 2);
        const cx = clamp(l.x, tw / 2 + 2, w - tw / 2 - 2);
        r = { x: cx - tw / 2, y: cy - hh / 2, w: tw, h: hh, cx, side, lines };
      } else {
        const x0 = l.x + side * (Ls * 0.5 + 7);
        r = { x: side > 0 ? x0 : x0 - tw, y: l.y - hh / 2, w: tw, h: hh, cx: x0, side, lines };
      }
      const inside = r.x >= 1 && r.x + r.w <= w - 1 && r.y >= 1 && r.y + r.h <= h - 1;
      const hits = placed.filter((q) => overlap(r, q)).length * 2 + boxes.filter((q, k) => k !== i && overlap(r, q)).length;
      cands.push({ r, cost: hits + (inside ? 0 : 5) });
    }));
    const best = cands.find((cnd) => cnd.cost === 0) || cands.reduce((m, cnd) => (cnd.cost < m.cost ? cnd : m), cands[0]);
    const r = best.r;
    placed.push(r);
    const color = l.sel ? c.primary : c.text;
    r.lines.forEach((ln, k) => {
      const y = r.y + LH / 2 + k * LH;
      if (l.horiz) tag(ctx, ln.t, r.cx, y, { color: ln.main ? color : c.text2, bg: c.bg, align: "center", font: ln.f });
      else tag(ctx, ln.t, r.cx, y, { color: ln.main ? color : c.text2, bg: c.bg, align: r.side > 0 ? "left" : "right", font: ln.f });
    });
  });

  if (sol.error === "short") {
    tag(ctx, "Qisqa tutashuv! Manba qarshiliksiz tutashtirilgan", w / 2, h - 14, { color: "#fff", bg: c.danger, align: "center", font: "700 12px Inter, system-ui, sans-serif" });
  } else if (!model.index.length) {
    ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(w < 520 ? "Asbobni tanlab, ikki nuqta orasiga bosing" : "Laboratoriya stoli bo‘sh: asbobni yuqoridagi qutidan sudrab olib keling yoki tanlab ikki nuqta orasiga bosing", w / 2, h / 2);
  }

  // Sudralayotgan element kursor ostida
  if (drag?.kind === "move" && drag.active && dropPreview?.edge == null) {
    const el = cells.get(drag.from);
    if (el) {
      ctx.save(); ctx.globalAlpha = 0.75; ctx.translate(drag.x, drag.y);
      const horiz = EDGES[drag.from].orient === "h";
      ctx.rotate(horiz ? 0 : Math.PI / 2);
      ctx.strokeStyle = c.primary; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-Ls * 0.8, 0); ctx.lineTo(-Ls / 2, 0); ctx.moveTo(Ls / 2, 0); ctx.lineTo(Ls * 0.8, 0); ctx.stroke();
      drawSymbol(ctx, c, el, null, Ls, horiz ? 0 : Math.PI / 2);
      ctx.restore();
    }
  }
}
const heights = (w) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  const padX = w >= 700 ? 192 : w >= 600 ? 152 : 68;
  const need = 68 + (ROWS - 1) * Math.min((w - padX) / (COLS - 1), 96);
  return { stage: Math.round(clamp(Math.min(need, vh * 0.62), 210, 470)), graph: Math.round(clamp(vh * 0.27, 170, 260)) };
};

const stage = createStage($("#stage"), draw, { height: (w) => heights(w).stage });

/* ------------------------------------------------------------------ Grafik */

const TABS = {
  bars: ["Elementlardagi kuchlanish va tok", "Ustunlar balandligi U va I ga mos. Ketma-ket ulashda toklar bir xil, parallelda kuchlanishlar bir xil. Zanjirdagi elementni bosing — u ajratiladi."],
  iu: ["Volt-amper xarakteristikasi I(U)", "Tanlangan iste’molchi uchun. Rezistorda — to‘g‘ri chiziq (Om qonuni), diodda — nochiziqli egri chiziq. «Nuqta qo‘shish» hozirgi U va I ni yozadi; «Avto-o‘lchash» EYuK ni o‘zgartirib o‘lchaydi."],
  src: ["Manba xarakteristikasi U(I)", "Batareya qisqichlaridagi kuchlanish tok ortishi bilan kamayadi: U = ε − I·r. Nuqta — hozirgi rejim."],
};

function graphData() {
  const bk = model.elements.find((e) => e.type === "battery");
  return { ...model, selected, points, emfMax: bk ? bk.emf : 0 };
}
function drawGraphCanvas(ctx, st) {
  if (!model) return;
  const d = graphData();
  if (ui.tab === "iu") drawIU(ctx, st, d);
  else if (ui.tab === "src") drawSource(ctx, st, d);
  else drawBars(ctx, st, d);
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (w) => heights(w).graph });

function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === tab)));
  $("[data-graph-title]").textContent = TABS[tab][0];
  $("[data-graph-sub]").textContent = TABS[tab][1];
  $("[data-iu-tools]").hidden = tab !== "iu";
  graph.render();
}
document.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));

/* ------------------------------------------------------------------ Natijalar */

function setReadout(key, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-value]").innerHTML = value;
  el.querySelector("[data-sub]").textContent = sub;
  el.dataset.tone = tone || "";
}
const setLabel = (key, html) => { document.querySelector(`[data-readout="${key}"] [data-label]`).innerHTML = html; };
const val = (v, u) => `${sci(v, 3)}<small>${u}</small>`;
const valI = (I) => (Math.abs(I) < I_ZERO ? `0<small>A</small>` : Math.abs(I) < 0.1 ? val(Math.abs(I) * 1000, "mA") : val(Math.abs(I), "A"));

function updateReadouts() {
  const sol = model.sol, ok = sol.ok;
  const e = selected !== null ? elOf(selected) : null, r = selected !== null ? resOf(selected) : null;
  const name = e ? model.labels.get(selected) || TYPE_INFO[e.type].label : null;
  const sfx = name ? ` · ${name}` : "";
  setLabel("I", `Tok kuchi <i>I</i>${sfx}`); setLabel("U", `Kuchlanish <i>U</i>${sfx}`); setLabel("P", `Quvvat <i>P</i>${sfx}`); setLabel("R", `Qarshilik <i>R</i>${sfx}`);
  if (!e || !ok) {
    const why = !ok ? "Hisoblanmadi" : "Element tanlanmagan";
    ["I", "U", "P", "R"].forEach((k) => setReadout(k, "—", why, "muted"));
  } else if (e.type === "wire") {
    setReadout("I", valI(r.I), "Sim bo‘ylab oqayotgan tok");
    setReadout("U", `0<small>V</small>`, "Ideal sim: potensial o‘zgarmaydi");
    setReadout("P", `0<small>W</small>`, "Qizish yo‘q");
    setReadout("R", `0<small>Ω</small>`, "Ideal sim qarshiligi hisobga olinmaydi");
  } else if (e.type === "switch") {
    setReadout("I", valI(r.I), e.closed ? "Kalit ulangan" : "Kalit uzilgan: tok o‘tmaydi");
    setReadout("U", val(Math.abs(r.U), "V"), e.closed ? "Ulangan kalitda kuchlanish yo‘q" : "Uzilgan joydagi kuchlanish");
    setReadout("P", `0<small>W</small>`, "—"); setReadout("R", e.closed ? `0<small>Ω</small>` : "∞", e.closed ? "Ulangan" : "Uzilgan");
  } else if (e.type === "battery") {
    setReadout("I", valI(r.Iout), r.Iout >= -1e-12 ? "Manba tok beryapti" : "Manba zaryadlanyapti (teskari tok)");
    setReadout("U", val(r.Ut, "V"), `ε = ${fmt(e.emf, 1)} V, Ir = ${fmt(r.drop, 2)} V`);
    setReadout("P", val(r.P, "W"), `Ichki qarshilikda ${sci(r.Ploss, 2)} W isrof`);
    setReadout("R", `${fmt(e.r, 1)}<small>Ω</small>`, "Ichki qarshilik r");
  } else if (e.type === "ammeter") {
    setReadout("I", valI(r.I), "Ampermetr ketma-ket ulanadi"); setReadout("U", `0<small>V</small>`, "Ideal ampermetr: kuchlanish tushmaydi");
    setReadout("P", `0<small>W</small>`, "—"); setReadout("R", `0<small>Ω</small>`, "Ideal ampermetr");
  } else if (e.type === "voltmeter") {
    const v = voltmeterReading(e, r);
    setReadout("I", val(Math.abs(r.I) * 1e6, "μA"), "Voltmetr orqali juda kichik tok o‘tadi");
    setReadout("U", val(v, "V"), v < -1e-9 ? "Manfiy: qutblarini almashtiring" : "Voltmetr parallel ulanadi");
    setReadout("P", val(Math.abs(r.P), "W"), "Deyarli energiya olmaydi");
    setReadout("R", `${fmt(R_VOLT / 1e6, 0)}<small>MΩ</small>`, "Ichki qarshiligi juda katta");
  } else if (DIODES.has(e.type)) {
    const fwd = r.If > I_ZERO;
    setReadout("I", valI(r.If), fwd ? "To‘g‘ri yo‘nalishda o‘tkazyapti" : r.Vf < -1e-3 ? "Teskari ulangan: tok deyarli yo‘q" : "Tok yo‘q");
    setReadout("U", val(r.Vf, "V"), fwd ? (e.type === "led" ? "LED ochilish kuchlanishi ≈ 1,9–2,6 V" : "Kremniy diodda ≈ 0,6–0,8 V tushadi") : "Diodga qo‘yilgan kuchlanish");
    setReadout("P", val(Math.abs(r.P), "W"), e.type === "led" ? (r.If > LED_I_MAX ? "Tok juda katta — LED kuyadi!" : `Yorqinlik ${Math.round(100 * clamp(r.If / LED_I_NOM, 0, 9.99))}%`) : "Diodda ajralayotgan issiqlik");
    setReadout("R", fwd && r.R ? val(r.R, "Ω") : "∞", fwd ? "U/I — tokka bog‘liq (nochiziqli element)" : "Yopiq diod: qarshilik juda katta", r.If > LED_I_MAX && e.type === "led" ? "orange" : "");
  } else {
    setReadout("I", valI(r.I), `I = U/R = ${fmt(Math.abs(r.U), 2)}/${sci(r.R, 3)}`);
    setReadout("U", val(Math.abs(r.U), "V"), "Elementdagi kuchlanish tushuvi");
    setReadout("P", val(r.P, "W"), "P = U·I = I²R");
    const extra = e.type === "lamp" ? `Nominal ${fmt(e.pNom, 0)} W · yorqinlik ${Math.round(100 * clamp(r.P / e.pNom, 0, 9.99))}%` : e.type === "conductor" ? `ρl/S = ${fmt(MATERIALS[e.mat].rho, 3)}·${fmt(e.l, 1)}/${fmt(e.S, 1)}` : e.type === "rheostat" ? `R = ${fmt(e.Rmax, 0)} Ω × ${fmt(e.pos, 2)}` : "Rezistor";
    setReadout("R", val(r.R, "Ω"), extra);
  }

  const bats = forEachType((x) => x.type === "battery");
  if (!bats.length) {
    ["Ut", "Is", "Req", "Ps"].forEach((k) => setReadout(k, "—", "Zanjirda manba yo‘q", "muted"));
  } else if (!ok) {
    ["Ut", "Is", "Req", "Ps"].forEach((k) => setReadout(k, "—", "Qisqa tutashuv", "muted"));
  } else {
    const b = bats[0];
    const open = Math.abs(b.r.Iout) < I_OPEN;
    setReadout("Ut", val(b.r.Ut, "V"), `ε = ${fmt(b.x.emf, 1)} V${b.x.r > 0 ? ` · U = ε − Ir` : ""}`);
    setReadout("Is", valI(b.r.Iout), bats.length > 1 ? `Birinchi manba (jami ${bats.length} ta)` : open ? "Zanjir ochiq" : "Zanjirdagi umumiy tok");
    const Ps = bats.reduce((s, o) => s + o.r.P, 0);
    if (bats.length === 1 && !open) setReadout("Req", val(Math.abs(b.r.Ut / b.r.Iout), "Ω"), `Butun zanjir: ε/I = ${sci(b.x.emf / Math.abs(b.r.Iout), 3)} Ω`);
    else setReadout("Req", open ? "∞" : "—", open ? "Zanjir ochiq" : "Bir nechta manba");
    setReadout("Ps", val(Ps, "W"), "Tashqi zanjirga berilayotgan quvvat");
  }

  // Voltmetrlar
  const vms = forEachType((x) => x.type === "voltmeter");
  const vm = vms.find((o) => o.edge === selected) || vms[0];
  if (!vm) setReadout("Uv", "—", "Voltmetrni o‘lchanadigan elementga parallel ulang", "muted");
  else if (!ok) setReadout("Uv", "—", "Qisqa tutashuv", "muted");
  else {
    const v = voltmeterReading(vm.x, vm.r);
    const others = vms.filter((o) => o !== vm).map((o) => `${model.labels.get(o.edge)}: ${fmt(voltmeterReading(o.x, o.r), 2)} V`).join(" · ");
    setReadout("Uv", val(v, "V"), `${model.labels.get(vm.edge)}${others ? " · " + others : v < -1e-9 ? " · qutblari teskari" : " · parallel ulangan"}`);
  }
}

/* ------------------------------------------------------------------ Holat va tushuntirish */

function updateStatus() {
  const s = $("[data-status]"), sol = model.sol;
  const bats = forEachType((x) => x.type === "battery");
  const maxI = Math.max(0, ...bats.map((o) => Math.abs(o.r.Iout)));
  let text, tone;
  if (sol.error === "short") { text = "Qisqa tutashuv!"; tone = "red"; }
  else if (!model.index.length) { text = "Stol bo‘sh"; tone = ""; }
  else if (!bats.length) { text = "Manba yo‘q"; tone = "blue"; }
  else if (maxI < I_OPEN) { text = "Zanjir ochiq — tok yo‘q"; tone = "orange"; }
  else { text = "Zanjir yopiq — tok o‘tmoqda"; tone = "green"; }
  s.textContent = text; s.dataset.tone = tone;
}

let lastExplain = "";
function updateExplain() {
  const sol = model.sol;
  const bats = forEachType((x) => x.type === "battery");
  const parts = [];
  if (sol.error === "short") parts.push("<p><b>Qisqa tutashuv:</b> manba qarshiliksiz o‘tkazgich (yoki to‘g‘ri ulangan diod) bilan tutashgan, tok juda katta bo‘ladi — real hayotda sim kuyadi. Tutashtiruvchi simni o‘chiring yoki iste’molchi qo‘ying.</p>");
  else if (!bats.length) parts.push("<p>Zanjirda manba yo‘q — tok oqmaydi. Qutidan «Batareya» ni olib, zanjirga qo‘ying.</p>");
  else {
    const b = bats[0], I = Math.abs(b.r.Iout);
    if (I < I_OPEN) parts.push("<p><b>Zanjir ochiq:</b> tok oqmayapti. Uzilgan joyni (ochiq kalit, ulanmagan sim, teskari ulangan diod) toping — voltmetrni shu joyga parallel ulasangiz, u manba kuchlanishini ko‘rsatadi.</p>");
    else {
      const loads = forEachType((x) => LOAD_TYPES.has(x.type));
      const Pl = loads.reduce((s, o) => s + o.r.P, 0), Ps = bats.reduce((s, o) => s + o.r.P, 0);
      parts.push(`<p>Manba <b>ε = ${fmt(b.x.emf, 1)} V</b>${b.x.r > 0 ? `, r = ${fmt(b.x.r, 1)} Ω` : ""}: zanjirdagi tok <b>I = ${amps(I)}</b>, qisqichlardagi kuchlanish <b>${fmt(b.r.Ut, 2)} V</b>.</p>`);
      if (loads.length) parts.push(`<p>Quvvat balansi: manba beradi <b>${sci(Ps, 3)} W</b>, iste’molchilar sarflaydi <b>${sci(Pl, 3)} W</b>${b.x.r > 0 ? `, ichki qarshilikda ${sci(b.r.Ploss, 2)} W isrof bo‘ladi (jami ${sci(Ps + b.r.Ploss, 3)} W = ε·I)` : ""}.</p>`);
    }
  }
  if (sol.ok) {
    const leds = forEachType((x) => x.type === "led");
    if (leds.some((o) => o.r.If > LED_I_MAX)) parts.push(`<p><b>Ogohlantirish:</b> LED orqali ${LED_I_MAX * 1000} mA dan katta tok o‘tyapti — real LED kuyib ketardi. Ketma-ket cheklovchi rezistor qo‘ying.</p>`);
    const vms = forEachType((x) => x.type === "voltmeter");
    if (vms.some((o) => voltmeterReading(o.x, o.r) < -1e-6)) parts.push("<p>Voltmetr ko‘rsatishi manfiy — uning «+» qisqichi past potensialli nuqtaga ulangan. Voltmetrni tanlab «Yo‘nalishni almashtirish» ni bosing.</p>");
    const ams = forEachType((x) => x.type === "ammeter");
    if (ams.some((o) => Math.abs(o.r.I) > 50)) parts.push("<p>Ampermetr orqali juda katta tok o‘tyapti: ampermetrni hech qachon manbaga to‘g‘ridan-to‘g‘ri (iste’molchisiz) ulamang.</p>");
  }
  if (selected !== null && sol.ok) {
    const e = elOf(selected), r = resOf(selected), name = model.labels.get(selected);
    if (e && LINEAR.has(e.type)) parts.push(`<p><b>${name}:</b> U = ${fmt(Math.abs(r.U), 2)} V, R = ${sci(r.R, 3)} Ω → I = U/R = ${amps(r.I)}.</p>`);
    if (e && e.type === "lamp" && r.P > 2 * e.pNom) parts.push("<p><b>Ogohlantirish:</b> lampochkaga nominaldan ancha ortiq quvvat tushyapti — real lampochka kuyib ketardi.</p>");
    if (e && DIODES.has(e.type)) parts.push(r.If > I_ZERO
      ? `<p><b>${name}</b> to‘g‘ri yo‘nalishda ulangan (anod — yuqori potensialda): U = ${fmt(r.Vf, 2)} V, I = ${amps(r.If)}. Diod qarshiligi o‘zgarmas emas — tok ortgani sari U deyarli o‘zgarmaydi, shuning uchun u Om qonuniga bo‘ysunmaydi.</p>`
      : `<p><b>${name}</b> teskari yo‘nalishda (yoki kuchlanish yetarli emas): diod yopiq, tok deyarli o‘tmaydi. Unga ${fmt(Math.max(0, -r.Vf), 2)} V teskari kuchlanish qo‘yilgan.</p>`);
    if (e && e.type === "voltmeter") parts.push(`<p><b>${name}</b> ulangan ikki nuqta orasidagi kuchlanishni ko‘rsatadi. Uning qarshiligi juda katta (1 MΩ), shuning uchun zanjirdagi toklarni deyarli o‘zgartirmaydi. Voltmetrni ketma-ket ulasangiz — zanjirda tok to‘xtaydi.</p>`);
  }
  const html = parts.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}

/* ------------------------------------------------------------------ Panel: tanlangan element */

const propsBox = $("[data-props]");
const emfCtl = bindRange($("#emf"), $("#emfOut"), (v) => `${fmt(v, 1)} V`, (v) => edit((e) => { e.emf = v; }));
const rintCtl = bindRange($("#rint"), $("#rintOut"), (v) => (v === 0 ? "ideal (0)" : `${fmt(v, 1)} Ω`), (v) => edit((e) => { e.r = v; }));
const resCtl = bindRange($("#res"), $("#resOut"), (v) => `${fmt(v, 0)} Ω`, (v) => edit((e) => { if (e.type === "rheostat") e.Rmax = v; else e.R = v; }));
const posCtl = bindRange($("#pos"), $("#posOut"), (v) => `${Math.round(v * 100)}%`, (v) => edit((e) => { e.pos = v; }));
const lenCtl = bindRange($("#len"), $("#lenOut"), (v) => `${fmt(v, 1)} m`, (v) => edit((e) => { e.l = v; }));
const secCtl = bindRange($("#sec"), $("#secOut"), (v) => `${fmt(v, 1)} mm²`, (v) => edit((e) => { e.S = v; }));
const matSel = $("#mat");
Object.entries(MATERIALS).forEach(([k, m]) => matSel.insertAdjacentHTML("beforeend", `<option value="${k}">${m.name} — ${fmt(m.rho, 3)} Ω·mm²/m</option>`));
matSel.addEventListener("change", () => edit((e) => { e.mat = matSel.value; }));
const ledSel = $("#ledColor");
Object.entries(LED_COLORS).forEach(([k, m]) => ledSel.insertAdjacentHTML("beforeend", `<option value="${k}">${m.name}</option>`));
ledSel.addEventListener("change", () => edit((e) => { e.color = ledSel.value; }));

function edit(fn) {
  if (selected === null || !cells.has(selected)) return;
  fn(cells.get(selected));
  afterChange({ customize: true });
}

function syncProps() {
  const e = selected !== null ? cells.get(selected) : null;
  propsBox.hidden = !e;
  if (!e) return;
  const show = (key, on) => { propsBox.querySelector(`[data-prop="${key}"]`).hidden = !on; };
  $("[data-props-title]").textContent = `${TYPE_INFO[e.type].label}${model?.labels.get(selected) ? " · " + model.labels.get(selected) : ""}`;
  show("emf", e.type === "battery"); show("rint", e.type === "battery");
  show("res", e.type === "resistor" || e.type === "lamp" || e.type === "rheostat");
  show("pos", e.type === "rheostat");
  show("mat", e.type === "conductor"); show("len", e.type === "conductor"); show("sec", e.type === "conductor");
  show("led", e.type === "led");
  $("[data-switch]").hidden = e.type !== "switch";
  $("[data-flip]").hidden = !FLIPPABLE.has(e.type);
  $("[data-flip]").textContent = e.type === "battery" ? "Qutblarni almashtirish" : "Yo‘nalishni almashtirish";
  if (e.type === "battery") { emfCtl.set(e.emf); rintCtl.set(e.r); }
  if (e.type === "resistor" || e.type === "lamp") { $("[data-res-label]").textContent = e.type === "lamp" ? "Lampochka qarshiligi R" : "Qarshilik R"; resCtl.set(e.R); }
  if (e.type === "rheostat") { $("[data-res-label]").textContent = "Reostat to‘la qarshiligi"; resCtl.set(e.Rmax); posCtl.set(e.pos); }
  if (e.type === "conductor") { matSel.value = e.mat; lenCtl.set(e.l); secCtl.set(e.S); }
  if (e.type === "led") ledSel.value = e.color;
  $("[data-props-note]").textContent = e.type === "wire" ? "Sim — ideal o‘tkazgich (qarshiligi 0)." : e.type === "ammeter" ? "Ampermetr o‘lchanayotgan elementga ketma-ket ulanadi." : e.type === "voltmeter" ? "Voltmetr o‘lchanayotgan elementga parallel ulanadi. «+» qisqich — yuqori potensial tomonga." : DIODES.has(e.type) ? "Uchburchak uchi — tok o‘tadigan yo‘nalish (anoddan katodga)." : "";
}
$("[data-switch]").addEventListener("click", () => edit((e) => { e.closed = !e.closed; }));
$("[data-flip]").addEventListener("click", () => edit((e) => {
  if (e.type === "battery" || e.type === "voltmeter") e.plus = e.plus === "b" ? "a" : "b";
  else e.rev = !e.rev;
  points = points.filter((p) => p.edge !== selected);
}));
$("[data-delete]").addEventListener("click", () => { if (selected !== null) removeAt(selected); });

/* ------------------------------------------------------------------ O'zgarishlar */

function setPresetPressed(id) {
  document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
}

function afterChange({ customize = false, props = true } = {}) {
  if (customize && presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; }
  points = points.filter((p) => cells.has(p.edge));
  recompute();
  if (props) syncProps();
  updateReadouts(); updateStatus(); updateExplain();
  stage.render(); graph.render();
}

function removeAt(edge) {
  if (!cells.delete(edge)) return;
  if (selected === edge) selected = null;
  afterChange({ customize: true });
}

function loadPreset(id) {
  const p = PRESETS[id];
  cells = p.build();
  selected = p.select ?? null;
  points = []; presetId = id; lastPreset = id;
  if (tool !== "select") setTool("select");
  setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  if (p.tab) setTab(p.tab);
  afterChange();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const presetBox = $("[data-presets]");
PRESET_ORDER.forEach((id) => presetBox.insertAdjacentHTML("beforeend", `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`));
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
$("[data-clear]").addEventListener("click", () => { cells = new Map(); selected = null; points = []; afterChange({ customize: true }); setTool("battery"); });
$("[data-reset]").insertAdjacentHTML("afterbegin", icon("reset"));
$("[data-reset]").addEventListener("click", () => loadPreset(lastPreset));

/* ------------------------------------------------------------------ Asboblar qutisi (DOM) */

const bin = $("[data-tools]");
bin.innerHTML = PALETTE.map((g) => `<div class="sim-bin__group" role="group" aria-label="${g.group}"><span class="sim-bin__title">${g.group}</span><div class="sim-bin__items">${g.items.map((t) => `<button class="sim-bin__item" type="button" data-tool="${t.tool}" aria-pressed="${t.tool === "select"}" title="${t.title}"${t.noDrag ? "" : ' data-drag="true"'}>${t.svg}<span>${t.label}</span></button>`).join("")}</div></div>`).join("");
const hintEl = $("[data-hint]");

function toolHint(t) {
  if (t === "select") return "Elementni bosing — parametrlari o‘ngda chiqadi. Elementni sudrab boshqa joyga ko‘chiring. Kalitni bosish uni ulaydi yoki uzadi.";
  if (t === "wire") return "Ikki nuqta orasiga bosing yoki sichqonchani bosib turib sudrang — bir nechta sim tortiladi.";
  if (t === "erase") return "O‘chirmoqchi bo‘lgan element yoki simni bosing (sudrab bir nechtasini o‘chirish mumkin). Klaviaturada — Delete.";
  const info = TOOL_BY_ID.get(t);
  const extra = t === "ammeter" ? " Ampermetr zanjirga ketma-ket ulanadi." : t === "voltmeter" ? " Voltmetr elementga parallel ulanadi: alohida shoxcha qilib, element uchlariga ulang." : DIODES.has(t) ? " Uchburchak uchi — tok o‘tadigan yo‘nalish." : "";
  return `«${info.label}»: ikki nuqta orasidagi qirraga bosing — element qo‘yiladi.${extra} Asbobni qutidan to‘g‘ridan-to‘g‘ri sudrab olib kelish ham mumkin.`;
}

function setTool(t) {
  tool = t;
  bin.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
  stage.canvas.style.cursor = t === "select" ? "" : "crosshair";
  hintEl.textContent = toolHint(t);
  stage.render();
}

let suppressClick = false;
bin.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-tool]");
  if (!b) return;
  if (suppressClick) { suppressClick = false; return; }
  setTool(b.dataset.tool);
});

// Qutidan sudrab olib kelish (sichqoncha va qalam; sensorli ekranda — bosib tanlash)
let ghostEl = null;
bin.addEventListener("pointerdown", (ev) => {
  const b = ev.target.closest("[data-drag]");
  if (!b || ev.pointerType === "touch" || ev.button !== 0) return;
  drag = { kind: "bin", type: b.dataset.tool, sx: ev.clientX, sy: ev.clientY, active: false, btn: b };
  ev.preventDefault();
});
document.addEventListener("pointermove", (ev) => {
  if (drag?.kind !== "bin") return;
  if (!drag.active && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) {
    drag.active = true;
    ghostEl = document.createElement("div");
    ghostEl.className = "sim-bin__ghost";
    ghostEl.innerHTML = drag.btn.querySelector("svg").outerHTML;
    document.body.appendChild(ghostEl);
    document.body.classList.add("sim-dragging");
  }
  if (!drag.active) return;
  ghostEl.style.left = `${ev.clientX}px`; ghostEl.style.top = `${ev.clientY}px`;
  const r = stage.canvas.getBoundingClientRect();
  const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
  const h = inside ? pick(ev.clientX - r.left, ev.clientY - r.top) : null;
  ghostEl.hidden = !!h;
  const next = h ? { edge: h.id, el: defaultProps(drag.type) } : null;
  if ((next?.edge ?? null) !== (dropPreview?.edge ?? null)) { dropPreview = next; stage.render(); }
});
document.addEventListener("pointerup", () => {
  if (drag?.kind !== "bin") return;
  const d = drag; drag = null;
  ghostEl?.remove(); ghostEl = null; document.body.classList.remove("sim-dragging");
  if (!d.active) return; // oddiy bosish — click hodisasi asbobni tanlaydi
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const target = dropPreview?.edge;
  dropPreview = null;
  if (target === undefined || target === null) { stage.render(); return; }
  cells.set(target, defaultProps(d.type));
  selected = d.type === "wire" ? null : target;
  setTool("select");
  afterChange({ customize: true });
});

/* ------------------------------------------------------------------ Maydondagi sichqoncha / barmoq */

function local(ev) {
  const r = stage.canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function paintAt(h) {
  if (!h || h.id === drag.last) return;
  drag.last = h.id;
  if (tool === "wire") {
    if (cells.has(h.id)) return; // elementlarni ustidan yozmaymiz
    cells.set(h.id, { type: "wire" });
    afterChange({ customize: true, props: false });
  } else if (tool === "erase") removeAt(h.id);
}

function placeAt(h) {
  if (!h) return;
  const cur = cells.get(h.id);
  if (cur && cur.type === tool) { selected = h.id; afterChange(); return; }
  cells.set(h.id, defaultProps(tool));
  selected = h.id;
  afterChange({ customize: true });
}

function commitMove(from, to) {
  if (to === null || to === undefined || to === from) { stage.render(); return; }
  const a = cells.get(from), b = cells.get(to);
  cells.set(to, a);
  if (b) cells.set(from, b); else cells.delete(from);
  points.forEach((p) => { if (p.edge === from) p.edge = to; else if (p.edge === to && b) p.edge = from; });
  selected = to;
  afterChange({ customize: true });
}

stage.canvas.addEventListener("pointerdown", (ev) => {
  touchMode = ev.pointerType === "touch";
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  const p = local(ev);
  const h = pick(p.x, p.y);
  hover = h;
  try { stage.canvas.setPointerCapture(ev.pointerId); } catch { /* */ }
  if (tool === "select") {
    if (h && cells.has(h.id)) drag = { kind: "move", from: h.id, sx: p.x, sy: p.y, x: p.x, y: p.y, active: false };
    else { selected = null; afterChange(); }
  } else if (tool === "wire" || tool === "erase") {
    drag = { kind: "paint", last: null };
    paintAt(h);
  } else placeAt(h);
});

stage.canvas.addEventListener("pointermove", (ev) => {
  const p = local(ev);
  const h = pick(p.x, p.y);
  const changed = (h?.id ?? null) !== (hover?.id ?? null);
  hover = h;
  if (drag?.kind === "move") {
    if (!drag.active && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) { drag.active = true; stage.canvas.dataset.dragging = "true"; }
    if (drag.active) {
      drag.x = p.x; drag.y = p.y;
      const t = h && h.id !== drag.from ? h.id : null;
      dropPreview = t !== null ? { edge: t, el: cells.get(drag.from), swap: cells.has(t) } : null;
      stage.render();
      return;
    }
  } else if (drag?.kind === "paint") paintAt(h);
  stage.canvas.style.cursor = tool === "select" ? (h && cells.has(h.id) ? "grab" : "") : "crosshair";
  if (changed && !loop.running) stage.render();
});

function endCanvasDrag(cancel) {
  const d = drag;
  if (!d || d.kind === "bin") return;
  drag = null; delete stage.canvas.dataset.dragging;
  if (d.kind === "move") {
    const target = dropPreview?.edge;
    dropPreview = null;
    if (cancel) { stage.render(); return; }
    if (d.active) { commitMove(d.from, target); return; }
    // Oddiy bosish: tanlash, kalitni almashtirish
    selected = d.from;
    const e = cells.get(d.from);
    if (e?.type === "switch") { e.closed = !e.closed; afterChange({ customize: true }); return; }
    afterChange();
  }
}
stage.canvas.addEventListener("pointerup", () => endCanvasDrag(false));
stage.canvas.addEventListener("pointercancel", () => endCanvasDrag(true));
stage.canvas.addEventListener("pointerleave", () => { if (!drag) { hover = null; if (!loop.running) stage.render(); } });

document.addEventListener("keydown", (ev) => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  if ((ev.key === "Delete" || ev.key === "Backspace") && selected !== null) { ev.preventDefault(); removeAt(selected); }
  else if (ev.key === "Escape") { if (drag?.kind === "move") endCanvasDrag(true); setTool("select"); }
});

/* ------------------------------------------------------------------ Animatsiya */

const playBtn = $("[data-play]");
function syncPlay(running) {
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(running ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = running ? "Pauza" : "Davom ettirish";
}
const loop = createLoop((dt) => {
  if (!model) return;
  model.index.forEach((edge, k) => {
    const I = model.sol.el[k].I;
    if (!model.sol.ok || Math.abs(I) < 1e-5) return;
    const speed = Math.min(120, 20 + 55 * Math.log10(1 + 10 * Math.abs(I)));
    phase[edge] += (I > 0 ? 1 : -1) * (ui.dir === "elec" ? -1 : 1) * speed * dt;
  });
  stage.render();
}, { onStateChange: syncPlay });
playBtn.addEventListener("click", () => { loop.toggle(); stage.render(); });

document.querySelectorAll("[data-dir-value]").forEach((b) => b.addEventListener("click", () => {
  ui.dir = b.dataset.dirValue;
  document.querySelectorAll("[data-dir-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  stage.render();
}));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  ui[cb.dataset.toggle] = cb.checked; stage.render();
}));

/* ------------------------------------------------------------------ I(U) o'lchash */

function selectedLoad() {
  if (selected === null || !model.kOf.has(selected)) return null;
  const e = elOf(selected);
  return e && LOAD_TYPES.has(e.type) ? { e, k: model.kOf.get(selected) } : null;
}
const pointOf = (e, r) => (DIODES.has(e.type) ? { U: r.Vf, I: r.If } : { U: Math.abs(r.U), I: Math.abs(r.I) });
$("[data-iu-add]").addEventListener("click", () => {
  const s = selectedLoad();
  if (!s || !model.sol.ok) return;
  points.push({ edge: selected, ...pointOf(s.e, model.sol.el[s.k]) });
  graph.render();
});
$("[data-iu-clear]").addEventListener("click", () => { points = points.filter((p) => p.edge !== selected); graph.render(); });
$("[data-iu-scan]").addEventListener("click", () => {
  const s = selectedLoad();
  const bi = model.elements.findIndex((e) => e.type === "battery");
  if (!s || bi < 0) return;
  const base = model.elements[bi].emf;
  const diode = DIODES.has(s.e.type);
  points = points.filter((p) => p.edge !== selected);
  const steps = diode ? [-8, -6, -4, -2, 1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
  steps.forEach((i) => {
    const els = model.elements.map((e, k) => (k === bi ? { ...e, emf: (base * i) / 8 } : e));
    const sol = solve(NODE_COUNT, els);
    if (sol.ok) points.push({ edge: selected, ...pointOf(s.e, sol.el[s.k]) });
  });
  graph.render();
});

/* ------------------------------------------------------------------ Boshlash */

const q = new URLSearchParams(location.search).get("preset");
setTool("select");
loadPreset(PRESETS[q] ? q : "ohm");
if (!prefersReducedMotion()) loop.start(); else { syncPlay(false); stage.render(); }
