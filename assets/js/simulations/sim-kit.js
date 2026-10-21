// ==========================================================================
// OliyFizika.uz 2.0 — simulyatsiyalar uchun umumiy yadro (sim-kit)
// - Stage: Retina (devicePixelRatio) ga mos canvas, ResizeObserver, tema o'zgarsa qayta chizish.
// - Loop: real vaqt bo'yicha dt (ekran chastotasidan qat'i nazar), pauza, sahifa yashirilsa to'xtaydi.
// - Ranglar: dizayn tokenlaridan (CSS o'zgaruvchilar) o'qiladi — light/dark avtomatik.
// - Yordamchilar: o'q (vektor), burchak yoyi, slayder bog'lash, son formatlash.
// ==========================================================================

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** O'zbekcha son formati: 1.5 -> "1,5" (o'nlik vergul), minus belgisi to'g'ri. */
export function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const s = Math.abs(value) < 0.5 * 10 ** -digits ? (0).toFixed(digits) : value.toFixed(digits);
  return s.replace("-", "−").replace(".", ",");
}

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ Ranglar */

const TOKENS = {
  bg: "--of-surface",
  bg2: "--of-surface-2",
  sunken: "--of-surface-sunken",
  border: "--of-border",
  borderStrong: "--of-border-strong",
  text: "--of-text",
  text2: "--of-text-2",
  text3: "--of-text-3",
  primary: "--of-primary",
  success: "--of-success",
  warning: "--of-warning",
  special: "--of-special",
  danger: "--of-danger",
  grid: "--of-grid-line",
};

export function readColors(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const out = {};
  for (const [k, v] of Object.entries(TOKENS)) out[k] = cs.getPropertyValue(v).trim() || "#888";
  out.dark = document.documentElement.dataset.theme === "dark";
  return out;
}

/* ------------------------------------------------------------------ Stage */

/**
 * createStage(canvas, draw)
 * draw(ctx, { w, h, colors }) — CSS pikselda chizadi (DPR avtomatik).
 * Qaytaradi: { render(), size, colors }
 */
export function createStage(canvas, draw, { minHeight = 280, aspect = 0.62, maxHeight = 640, height = null } = {}) {
  const ctx = canvas.getContext("2d");
  const stage = { canvas, ctx, w: 0, h: 0, colors: readColors() };

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(260, Math.floor(box.width));
    const h = height ? Math.round(height(w)) : Math.round(clamp(w * aspect, minHeight, maxHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (w === stage.w && h === stage.h && canvas.width === Math.round(w * dpr)) return;
    stage.w = w;
    stage.h = h;
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stage.render();
  }

  stage.render = () => {
    if (!stage.w) return;
    ctx.save();
    ctx.clearRect(0, 0, stage.w, stage.h);
    draw(ctx, stage);
    ctx.restore();
  };

  const refreshColors = () => {
    stage.colors = readColors();
    stage.render();
  };

  new ResizeObserver(resize).observe(canvas.parentElement);
  if (height) window.addEventListener("resize", resize);
  new MutationObserver(refreshColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("of:themechange", refreshColors);
  resize();
  return stage;
}

/* ------------------------------------------------------------------ Loop */

/**
 * createLoop(step) — step(dt) har kadrda real vaqt (soniya) bilan chaqiriladi.
 * dt 1/30 s dan oshmaydi (tab almashtirilganda "sakrash" bo'lmasin).
 */
export function createLoop(step, { onStateChange } = {}) {
  let raf = 0;
  let last = 0;
  let running = false;

  const frame = (t) => {
    if (!running) return;
    const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 0;
    last = t;
    step(dt);
    raf = requestAnimationFrame(frame);
  };

  const loop = {
    get running() { return running; },
    start() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
      onStateChange?.(true);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      onStateChange?.(false);
    },
    toggle() { running ? loop.stop() : loop.start(); },
  };

  // Sahifa ko'rinmasa — resurs sarflamaslik uchun to'xtatamiz va qaytganda davom ettiramiz.
  let resumeOnShow = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { resumeOnShow = running; loop.stop(); }
    else if (resumeOnShow) { resumeOnShow = false; loop.start(); }
  });
  return loop;
}

/* ------------------------------------------------------------------ Chizish */

/** Vektor: (x,y) dan (x+dx, y+dy) gacha, uchi bilan. Juda qisqa bo'lsa faqat nuqta. */
export function arrow(ctx, x, y, dx, dy, color, { width = 2.5, head = 10, label = "", labelColor, dash = null, font } = {}) {
  const len = Math.hypot(dx, dy);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  if (len < 2) {
    ctx.beginPath();
    ctx.arc(x, y, width, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const ux = dx / len, uy = dy / len;
  const h = Math.min(head, len * 0.6);
  const ex = x + dx, ey = y + dy;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex - ux * h * 0.6, ey - uy * h * 0.6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ux * h - uy * h * 0.5, ey - uy * h + ux * h * 0.5);
  ctx.lineTo(ex - ux * h + uy * h * 0.5, ey - uy * h - ux * h * 0.5);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = font || "600 13px Inter, system-ui, sans-serif";
    ctx.fillStyle = labelColor || color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, ex + ux * 16, ey + uy * 16);
  }
  ctx.restore();
}

/** Burchak yoyi: markaz (cx,cy), radius r, a0→a1 (radian, canvas yo'nalishida). */
export function angleArc(ctx, cx, cy, r, a0, a1, color, { label = "", width = 1.75, labelR, font } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1, a1 < a0);
  ctx.stroke();
  if (label) {
    const mid = (a0 + a1) / 2;
    const lr = labelR ?? r + 14;
    ctx.fillStyle = color;
    ctx.font = font || "italic 600 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr);
  }
  ctx.restore();
}

/** Yorliq: fon bilan (o'qilishi oson) kichik matn. */
export function tag(ctx, text, x, y, { color, bg, align = "left", font = "600 12px Inter, system-ui, sans-serif", pad = 6 } = {}) {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width + pad * 2;
  const h = 22;
  let x0 = x;
  if (align === "center") x0 = x - w / 2;
  if (align === "right") x0 = x - w;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x0, y - h / 2, w, h, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x0 + pad, y + 0.5);
  ctx.restore();
}

/* ------------------------------------------------------------------ Boshqaruv */

/**
 * bindRange(input, output, format, onInput) — slayder qiymatini <output> ga yozadi
 * va slayder to'ldirilgan qismini (--fill) yangilaydi.
 */
export function bindRange(input, output, format, onInput) {
  const sync = () => {
    const v = Number(input.value);
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty("--fill", `${((v - min) / (max - min)) * 100}%`);
    const text = format(v);
    if (output) output.textContent = text;
    input.setAttribute("aria-valuetext", text);
    return v;
  };
  input.addEventListener("input", () => onInput(sync()));
  sync();
  return {
    set(v) { input.value = v; sync(); },
    get value() { return Number(input.value); },
    sync,
  };
}

/* ------------------------------------------------------------------ Ilmiy format */

const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/**
 * sci(value, sig = 3) — `sig` ta muhim raqam bilan: 0,0111 · 2774 · 6,67·10⁻¹¹ · 1,98·10²⁰.
 * 0,001 ≤ |x| < 10 000 oraliqda oddiy yozuv, aks holda ilmiy yozuv.
 */
export function sci(value, sig = 3) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const a = Math.abs(value);
  if (a >= 1e-3 && a < 1e4) {
    const rounded = Math.abs(Number(value.toPrecision(sig)));
    const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(rounded)));
    return fmt(value, decimals);
  }
  let exp = Math.floor(Math.log10(a));
  let man = value / 10 ** exp;
  if (Math.abs(Number(man.toFixed(sig - 1))) >= 10) { man /= 10; exp += 1; }
  const e = String(exp).split("").map((ch) => SUP[ch]).join("");
  return `${fmt(man, sig - 1)}·10${e}`;
}

/* ------------------------------------------------------------------ Grafik y = f(x) */

/**
 * drawGraph(ctx, stage, opts) — oddiy chiziqli grafik: o'qlar, egri chiziq, joriy nuqta.
 * opts: { xMin, xMax, yMax, f, xCur, xUnit, yLabel, fmtX, fmtY, color }
 */
export function drawGraph(ctx, { w, h, colors: c }, o) {
  const padL = 64, padR = 16, padT = 18, padB = 34;
  const pw = w - padL - padR, ph = h - padT - padB;
  const X = (x) => padL + ((x - o.xMin) / (o.xMax - o.xMin)) * pw;
  const Y = (y) => padT + ph - (y / o.yMax) * ph;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  ctx.font = "500 11px Inter, system-ui, sans-serif";
  ctx.fillStyle = c.text3;
  ctx.beginPath();
  const nx = w < 480 ? 3 : 5, ny = 4;
  for (let i = 0; i <= nx; i++) {
    const x = o.xMin + ((o.xMax - o.xMin) * i) / nx;
    ctx.moveTo(X(x) + 0.5, padT); ctx.lineTo(X(x) + 0.5, padT + ph);
  }
  for (let j = 0; j <= ny; j++) { const y = (o.yMax * j) / ny; ctx.moveTo(padL, Y(y) + 0.5); ctx.lineTo(padL + pw, Y(y) + 0.5); }
  ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let i = 0; i <= nx; i++) {
    const x = o.xMin + ((o.xMax - o.xMin) * i) / nx;
    ctx.textAlign = i === nx ? "right" : "center";
    ctx.fillText(o.fmtX(x) + (i === nx && o.xUnit ? ` ${o.xUnit}` : ""), X(x) + (i === nx ? 4 : 0), padT + ph + 8);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let j = 1; j <= ny; j++) { const y = (o.yMax * j) / ny; ctx.fillText(o.fmtY(y), padL - 8, Y(y)); }
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(o.yLabel, padL + 6, padT);
  ctx.strokeStyle = c.borderStrong;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ph); ctx.lineTo(padL + pw, padT + ph); ctx.stroke();

  // Egri chiziq (yuqoridan kesiladi)
  ctx.beginPath();
  ctx.rect(padL, padT, pw, ph);
  ctx.clip();
  ctx.strokeStyle = o.color || c.primary;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const x = o.xMin + ((o.xMax - o.xMin) * i) / N;
    const y = Math.min(o.f(x), o.yMax * 1.5);
    if (i === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
  }
  ctx.stroke();

  // Joriy nuqta
  const yc = o.f(o.xCur);
  if (Number.isFinite(yc)) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = c.text3;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(o.xCur), padT + ph); ctx.lineTo(X(o.xCur), Y(Math.min(yc, o.yMax))); ctx.lineTo(padL, Y(Math.min(yc, o.yMax))); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.warning;
    ctx.beginPath(); ctx.arc(X(o.xCur), Y(Math.min(yc, o.yMax)), 5.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
