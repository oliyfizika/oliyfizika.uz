// ==========================================================================
// Bosh sahifa: "Gorizontga burchak ostida otilgan jism" — yengil canvas simulyatsiyasi
//
//  x(t) = v·cosα·t,   y(t) = v·sinα·t − g·t²/2
//  H = v²·sin²α / (2g),   L = v²·sin2α / g,   T = 2v·sinα / g
//
// Unumdorlik: requestAnimationFrame faqat (1) o'ynash yoqilgan, (2) canvas ekranda ko'rinadigan,
// (3) tab faol bo'lganda ishlaydi. DPR ≤ 2. Tashqi kutubxona yo'q.
// prefers-reduced-motion: avtomatik boshlanmaydi — to'liq trayektoriyaning statik ko'rinishi chiziladi.
// ==========================================================================

const G = 9.8;
const TIME_SCALE = 1.1;     // sekin-harakat emas, lekin tez ham emas
const LANDED_PAUSE = 1.4;   // yerga tushgach kutish (s)

export function mountProjectileSim(root) {
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const angleInput = root.querySelector("[data-sim-angle]");
  const speedInput = root.querySelector("[data-sim-speed]");
  const angleOut = root.querySelector("[data-sim-angle-out]");
  const speedOut = root.querySelector("[data-sim-speed-out]");
  const playBtn = root.querySelector("[data-sim-play]");
  const resetBtn = root.querySelector("[data-sim-reset]");
  const outH = root.querySelector("[data-sim-h]");
  const outL = root.querySelector("[data-sim-l]");
  const outT = root.querySelector("[data-sim-t]");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let state = {
    angle: Number(angleInput.value),
    speed: Number(speedInput.value),
    t: 0,
    landedFor: 0,
  };
  let playing = !reduceMotion.matches;
  let visible = true;
  let raf = 0;
  let lastTs = 0;
  let size = { w: 0, h: 0, dpr: 1 };
  let colors = readColors();

  // ------------------------------------------------------------------ fizika
  function params() {
    const a = (state.angle * Math.PI) / 180;
    const v = state.speed;
    const vx = v * Math.cos(a);
    const vy0 = v * Math.sin(a);
    const T = (2 * vy0) / G;
    return { a, v, vx, vy0, T, H: (vy0 * vy0) / (2 * G), L: vx * T };
  }

  function updateReadouts() {
    const p = params();
    angleOut.textContent = `${state.angle}°`;
    speedOut.textContent = `${state.speed} m/s`;
    outH.textContent = `${p.H.toFixed(1)} m`;
    outL.textContent = `${p.L.toFixed(1)} m`;
    outT.textContent = `${p.T.toFixed(2)} s`;
    canvas.setAttribute(
      "aria-label",
      `Simulyatsiya: jism ${state.angle}° burchak ostida ${state.speed} m/s tezlik bilan otildi. ` +
        `Maksimal balandlik ${p.H.toFixed(1)} m, uchish uzoqligi ${p.L.toFixed(1)} m, uchish vaqti ${p.T.toFixed(2)} s.`
    );
  }

  // ------------------------------------------------------------------ chizish
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
    return {
      text: v("--of-text-2", "#4c586e"),
      muted: v("--of-text-3", "#5b677e"),
      ground: v("--of-border-strong", "#cad2df"),
      blue: v("--of-primary", "#2150dc"),
      green: v("--of-success", "#05935e"),
      orange: v("--of-orange-500", "#e8850c"),
      surface: v("--of-surface", "#ffffff"),
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === size.w && h === size.h && dpr === size.dpr) return;
    size = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw();
  }

  function layout() {
    // Masshtab tezlikka bog'liq (burchak o'zgarganda sahna "sakramasligi" uchun)
    const v = state.speed;
    const maxL = (v * v) / G;              // 45° dagi uzoqlik
    const maxH = (v * v) / (2 * G);        // 90° dagi balandlik
    const pad = { l: 44, r: 28, t: 34, b: 34 };
    const aw = size.w - pad.l - pad.r;
    const ah = size.h - pad.t - pad.b;
    const k = Math.min(aw / maxL, ah / (maxH * 0.95));
    return { pad, k, ox: pad.l, oy: size.h - pad.b };
  }

  function arrow(x1, y1, x2, y2, color, width = 2) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 4) return;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.min(9, len * 0.4);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(ang) * head * 0.6, y2 - Math.sin(ang) * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - 0.42), y2 - head * Math.sin(ang - 0.42));
    ctx.lineTo(x2 - head * Math.cos(ang + 0.42), y2 - head * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
  }

  function label(text, x, y, color, align = "left") {
    ctx.font = "600 12px Inter, system-ui, sans-serif";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function labelSub(base, sub, x, y, color) {
    label(base, x, y, color);
    ctx.font = "600 9px Inter, system-ui, sans-serif";
    ctx.fillText(sub, x + ctx.measureText(base).width + 5, y + 4);
  }

  function draw() {
    if (!size.w) return;
    const p = params();
    const { k, ox, oy } = layout();
    const X = (x) => ox + x * k;
    const Y = (y) => oy - y * k;

    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // Yer
    ctx.strokeStyle = colors.ground;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, oy + 0.5);
    ctx.lineTo(size.w - 12, oy + 0.5);
    ctx.stroke();

    // Bashorat qilingan trayektoriya (shtrix)
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = colors.muted;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const tt = (p.T * i) / 64;
      const x = p.vx * tt;
      const y = p.vy0 * tt - (G * tt * tt) / 2;
      i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Otish burchagi yoyi
    ctx.strokeStyle = colors.orange;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, 26, -p.a, 0);
    ctx.stroke();
    label("α", ox + 32 * Math.cos(p.a / 2), oy - 32 * Math.sin(p.a / 2), colors.orange);

    // Maksimal balandlik belgisi
    const apexX = X(p.vx * (p.T / 2));
    const apexY = Y(p.H);
    ctx.strokeStyle = colors.muted;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX, oy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    label("H", apexX + 6, (apexY + oy) / 2, colors.muted);

    // Joriy vaqt (reduced motion + to'xtatilgan: cho'qqi holati ko'rsatiladi)
    const t = Math.min(state.t, p.T);
    const bx = p.vx * t;
    const by = p.vy0 * t - (G * t * t) / 2;
    const vyNow = p.vy0 - G * t;

    // Bosib o'tilgan yo'l
    ctx.strokeStyle = colors.blue;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const steps = Math.max(2, Math.ceil((t / p.T) * 64));
    for (let i = 0; i <= steps; i++) {
      const tt = (t * i) / steps;
      const x = p.vx * tt;
      const y = p.vy0 * tt - (G * tt * tt) / 2;
      i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
    }
    ctx.stroke();

    // Tezlik vektorlari (masshtab: 1 m/s = vk px)
    const vk = Math.min(3.2, (size.h * 0.32) / p.v);
    const cx = X(bx);
    const cy = Y(by);
    arrow(cx, cy, cx + p.vx * vk, cy, colors.blue, 1.6);
    arrow(cx, cy, cx, cy - vyNow * vk, colors.green, 1.6);
    arrow(cx, cy, cx + p.vx * vk, cy - vyNow * vk, colors.text, 2);
    labelSub("v", "x", cx + p.vx * vk + 6, cy + 12, colors.blue);
    labelSub("v", "y", cx - 24, cy - vyNow * vk, colors.green);
    label("v", cx + p.vx * vk + 6, cy - vyNow * vk - 6, colors.text);

    // Jism
    ctx.fillStyle = colors.blue;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Uzoqlik belgisi (yerga tushganda)
    if (t >= p.T) {
      label(`L = ${p.L.toFixed(1)} m`, X(p.L), oy + 16, colors.green, "center");
    }
  }

  // ------------------------------------------------------------------ sikl
  function frame(ts) {
    raf = 0;
    if (!running()) return;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    const p = params();
    if (state.t < p.T) {
      state.t = Math.min(p.T, state.t + dt * TIME_SCALE);
    } else {
      state.landedFor += dt;
      if (state.landedFor > LANDED_PAUSE) {
        state.t = 0;
        state.landedFor = 0;
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  const running = () => playing && visible && document.visibilityState === "visible";

  function sync() {
    if (running() && !raf) {
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    } else if (!running() && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.setAttribute("aria-label", playing ? "Simulyatsiyani to‘xtatish" : "Simulyatsiyani boshlash");
    playBtn.dataset.state = playing ? "playing" : "paused";
  }

  function restart() {
    state.t = playing ? 0 : params().T / 2; // to'xtatilganda cho'qqi holati
    state.landedFor = 0;
    updateReadouts();
    draw();
  }

  // ------------------------------------------------------------------ hodisalar
  angleInput.addEventListener("input", () => { state.angle = Number(angleInput.value); restart(); });
  speedInput.addEventListener("input", () => { state.speed = Number(speedInput.value); restart(); });
  playBtn.addEventListener("click", () => {
    playing = !playing;
    if (playing && state.t >= params().T) state.t = 0;
    sync();
    if (!playing) draw();
  });
  resetBtn.addEventListener("click", () => {
    state.angle = Number(angleInput.defaultValue);
    state.speed = Number(speedInput.defaultValue);
    angleInput.value = state.angle;
    speedInput.value = state.speed;
    restart();
  });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  }, { threshold: 0.05 }).observe(canvas);
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("of:themechange", () => { colors = readColors(); draw(); });
  new MutationObserver(() => { colors = readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  reduceMotion.addEventListener?.("change", (e) => { if (e.matches) { playing = false; sync(); restart(); } });

  // Boshlang'ich holat
  if (!playing) state.t = params().T / 2;
  updateReadouts();
  resize();
  sync();

  return {
    get running() { return Boolean(raf); },
    get playing() { return playing; },
  };
}
