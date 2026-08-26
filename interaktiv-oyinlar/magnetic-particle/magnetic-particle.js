/* ==========================================================================
   MAGNIT MAYDON — ZARRANI QUTQAR
   OliyFizika.uz interaktiv fizika simulyatsiyasi
   (v2 — 3 daqiqalik yakka o'yinchi "target rush" rejimi)

   Modullar:
     CONFIG    — o'zgarmas sozlamalar
     STATE     — dinamik holat (parametrlar, zarracha, target, taymer)
     PHYSICS   — Lorens kuchi va RK4 integratsiya (O'ZGARMAGAN)
     VALIDATION— kiritilgan parametrlarni tekshirish
     TARGETGEN — fizik jihatdan erishiladigan target generatsiyasi
     SIM       — fixed-timestep simulyatsiya davri, taymer, target hit
     RENDERER  — canvas chizish (worldToScreen orqali)
     UI        — DOM bilan ikki tomonlama bog'lanish, readout yangilash
     RECORD    — localStorage orqali eng yaxshi natijani saqlash
     AUDIO     — Web Audio API orqali qisqa signal (tashqi fayl kerak emas)
     GAME      — chekli holatlar mashinasi
                 (IDLE / RUNNING / PAUSED / TARGET_HIT / FINISHED)
     EVENTS    — barcha listenerlarni ulash

   MUHIM: bitta o'yin davomida (START dan FINISHED gacha) q, m, v, B, θ,
   x0, y0 qiymatlari O'ZGARMAYDI. Shu sababli zarrachaning trayektoriyasi
   (aylana yoki to'g'ri chiziq) butun o'yin davomida bitta va bir xil —
   TARGETGEN aynan shu trayektoriya ustidan fizik jihatdan haqiqatan ham
   erishish mumkin bo'lgan nuqtalarni tanlaydi.
   ========================================================================== */

"use strict";

/* ============================== 1. CONFIG =============================== */

const CONFIG = Object.freeze({
  canvasWidth: 800,
  canvasHeight: 560,
  pixelsPerMeter: 5,          // world <-> screen scale
  physicsDt: 0.008,           // fixed physics timestep, s (RK4 barqarorligi uchun)
  maxSubStepsPerFrame: 40,    // sekinlashgan qurilmalarda "spiral of death"ni oldini olish
  maxTrailPoints: 4000,

  gameDurationSec: 180,       // 3 daqiqa
  timerWarningSec: 30,        // shu vaqtdan kam qolsa vizual ogohlantirish
  targetHitTransitionMs: 500, // target urilgach 300-700ms oralig'idagi qisqa pauza

  targetRadiusDefault: 6,     // metr
  targetBoundsMarginFactor: 0.88, // world yarim o'lchamining necha foizigacha target tushishi mumkin
  maxTargetGenAttempts: 40,

  fieldDotSpacingPx: 46,
  recordStorageKey: "oliyfizika_magnetic_rush_best",
});

/* ============================== 2. STATE ================================= */

const STATE = {
  // foydalanuvchi kiritgan, butun o'yin davomida O'ZGARMAYDIGAN parametrlar
  params: {
    q_uC: 2,          // mikrokulon
    m_mg: 1,           // milligram
    v0: 20,            // m/s
    theta_deg: 0,      // gradus
    Bmag: 0.5,         // Tesla
    Bsign: +1,         // +1 = ekrandan tashqariga (⊙), -1 = ichkariga (⊗)
    x0: -50,           // m
    y0: 0,             // m
    targetRadius: CONFIG.targetRadiusDefault,
  },

  // jonli fizik holat
  particle: { x: 0, y: 0, vx: 0, vy: 0 },
  t: 0,                 // joriy urinishning fizik vaqti, s
  accumulator: 0,        // fixed-step accumulator, s
  trail: [],             // {x,y} nuqtalar ro'yxati (world koordinatalarda)

  // trayektoriya geometriyasi — o'yin boshida bir marta hisoblanadi
  trajectory: null,       // { type:'circle', center:{x,y}, radius, startAngle } | { type:'line', ux, uy }

  // o'yin holati
  game: "IDLE",            // IDLE | RUNNING | PAUSED | TARGET_HIT | FINISHED
  timeRemaining: CONFIG.gameDurationSec,
  targetCount: 0,
  target: null,             // { x, y, radius }

  hitEffect: { active: false, x: 0, y: 0, timer: 0, duration: CONFIG.targetHitTransitionMs },

  lastForce: { fx: 0, fy: 0, mag: 0 },
  lastAccel: 0,
  distanceToTarget: null,
};

function resetParticleFromParams() {
  const p = STATE.params;
  const rad = (p.theta_deg * Math.PI) / 180;
  STATE.particle.x = p.x0;
  STATE.particle.y = p.y0;
  STATE.particle.vx = p.v0 * Math.cos(rad);
  STATE.particle.vy = p.v0 * Math.sin(rad);
  STATE.t = 0;
  STATE.accumulator = 0;
  STATE.trail = [{ x: p.x0, y: p.y0 }];
  STATE.lastForce = { fx: 0, fy: 0, mag: 0 };
  STATE.lastAccel = 0;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clampVal(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ============================== 3. PHYSICS ================================ */
/* O'ZGARMAGAN: Lorens kuchi + RK4 integratsiya. */

const PHYSICS = {
  siParams() {
    const p = STATE.params;
    return {
      q: p.q_uC * 1e-6,           // μC -> C
      m: p.m_mg * 1e-6,           // mg -> kg
      Bz: p.Bsign * p.Bmag,        // T
    };
  },

  /** Lorens kuchining magnit qismi: F = q(v × B), B = (0,0,Bz) */
  computeForce(vx, vy, q, Bz) {
    const fx = q * vy * Bz;
    const fy = -q * vx * Bz;
    return { fx, fy };
  },

  derivative(state, q, m, Bz) {
    const { fx, fy } = this.computeForce(state.vx, state.vy, q, Bz);
    return { x: state.vx, y: state.vy, vx: fx / m, vy: fy / m };
  },

  /** Bitta RK4 qadami (barqaror sonli integratsiya) */
  rk4Step(state, dt, q, m, Bz) {
    const s = state;
    const k1 = this.derivative(s, q, m, Bz);

    const s2 = {
      x: s.x + (dt / 2) * k1.x, y: s.y + (dt / 2) * k1.y,
      vx: s.vx + (dt / 2) * k1.vx, vy: s.vy + (dt / 2) * k1.vy,
    };
    const k2 = this.derivative(s2, q, m, Bz);

    const s3 = {
      x: s.x + (dt / 2) * k2.x, y: s.y + (dt / 2) * k2.y,
      vx: s.vx + (dt / 2) * k2.vx, vy: s.vy + (dt / 2) * k2.vy,
    };
    const k3 = this.derivative(s3, q, m, Bz);

    const s4 = {
      x: s.x + dt * k3.x, y: s.y + dt * k3.y,
      vx: s.vx + dt * k3.vx, vy: s.vy + dt * k3.vy,
    };
    const k4 = this.derivative(s4, q, m, Bz);

    return {
      x: s.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: s.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      vx: s.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
      vy: s.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
    };
  },

  /** Analitik kattaliklar: aylanish radiusi, burchak chastota, davr */
  derivedQuantities() {
    const { q, m, Bz } = this.siParams();
    const absQ = Math.abs(q);
    const absB = Math.abs(Bz);
    const v = Math.hypot(STATE.particle.vx, STATE.particle.vy);

    if (absQ < 1e-15 || absB < 1e-15) {
      return { r: null, omega: null, period: null };
    }
    const omega = (absQ * absB) / m;
    const r = (m * v) / (absQ * absB);
    const period = (2 * Math.PI * m) / (absQ * absB);
    return { r, omega, period };
  },
};

/* ============================== 4. VALIDATION ============================= */

const VALIDATION = {
  /** @returns {string|null} xato matni yoki null (hammasi to'g'ri bo'lsa) */
  check() {
    const p = STATE.params;
    if (Math.abs(p.q_uC) < 0.05) {
      return "Zaryad qiymati noto'g'ri. Zaryad 0 bo'lishi mumkin emas (q \u2260 0).";
    }
    if (p.m_mg <= 0) {
      return "Massani 0 dan katta kiriting.";
    }
    if (p.Bmag < 0) {
      return "Magnit maydon qiymati manfiy bo'lishi mumkin emas.";
    }
    if (p.v0 <= 0) {
      return "Boshlang'ich tezlikni 0 dan katta kiriting.";
    }
    return null;
  },
};

/* ============================== 5. TARGET GENERATION ======================= */
/*
   Butun o'yin davomida q, m, v, B, θ, x0, y0 o'zgarmasligi sababli zarracha
   HAR DOIM bitta va bir xil trayektoriya (aylana yoki B=0 bo'lsa to'g'ri
   chiziq) bo'ylab harakatlanadi. Shu sababli "fizik jihatdan erishiladigan"
   target — aynan shu trayektoriya ustidagi nuqta. Bu yondashuv tasodifiy
   nuqta tanlab, keyin "erishib bo'lmaydi" deb qayta-qayta urinishdan ko'ra
   ancha ishonchli.
*/

const TARGETGEN = {
  /** O'yin boshida bir marta chaqiriladi: aylana markazi/radiusi yoki chiziq yo'nalishini hisoblaydi */
  computeTrajectoryGeometry() {
    const p = STATE.params;
    const { q, m, Bz } = PHYSICS.siParams();
    const rad = (p.theta_deg * Math.PI) / 180;
    const vx0 = p.v0 * Math.cos(rad);
    const vy0 = p.v0 * Math.sin(rad);

    if (Math.abs(Bz) < 1e-9) {
      // B = 0 -> to'g'ri chiziqli harakat
      STATE.trajectory = { type: "line", ux: Math.cos(rad), uy: Math.sin(rad) };
      return;
    }

    const r = (m * p.v0) / (Math.abs(q) * Math.abs(Bz));
    const { fx, fy } = PHYSICS.computeForce(vx0, vy0, q, Bz);
    const fmag = Math.hypot(fx, fy) || 1;
    const center = {
      x: p.x0 + (fx / fmag) * r,
      y: p.y0 + (fy / fmag) * r,
    };
    STATE.trajectory = {
      type: "circle",
      center,
      radius: r,
      startAngle: Math.atan2(p.y0 - center.y, p.x0 - center.x),
    };
  },

  worldBounds() {
    const halfW = CONFIG.canvasWidth / CONFIG.pixelsPerMeter / 2;
    const halfH = CONFIG.canvasHeight / CONFIG.pixelsPerMeter / 2;
    return {
      maxX: halfW * CONFIG.targetBoundsMarginFactor,
      maxY: halfH * CONFIG.targetBoundsMarginFactor,
    };
  },

  withinBounds(x, y) {
    const { maxX, maxY } = this.worldBounds();
    return Math.abs(x) <= maxX && Math.abs(y) <= maxY;
  },

  /** @returns {{x:number,y:number,radius:number}} */
  generateNewTarget() {
    const p = STATE.params;
    const traj = STATE.trajectory;
    const minDist = Math.max(p.targetRadius * 4, 14);
    const { maxX, maxY } = this.worldBounds();

    let candidate = null;

    for (let i = 0; i < CONFIG.maxTargetGenAttempts && !candidate; i++) {
      let pt;

      if (traj.type === "circle") {
        // Trayektoriya (aylana) bo'ylab tasodifiy yoy uzunligi — juda katta
        // radiusda ham nuqta ekrandan uzoqlashib ketmasligi uchun cheklangan.
        const maxArc = Math.min(2 * Math.PI * traj.radius, maxX + maxY);
        const span = Math.max(maxArc - minDist, minDist);
        const s = minDist + Math.random() * span;
        const sign = Math.random() < 0.5 ? 1 : -1;
        const angle = traj.startAngle + sign * (s / traj.radius);
        pt = {
          x: traj.center.x + traj.radius * Math.cos(angle),
          y: traj.center.y + traj.radius * Math.sin(angle),
        };
      } else {
        // To'g'ri chiziq bo'ylab tasodifiy oldinga masofa
        const maxForward = (maxX + maxY) * 1.2;
        const t = minDist + Math.random() * Math.max(maxForward - minDist, minDist);
        pt = { x: p.x0 + traj.ux * t, y: p.y0 + traj.uy * t };
      }

      const farEnough = distance(pt.x, pt.y, p.x0, p.y0) >= minDist;
      if (farEnough && this.withinBounds(pt.x, pt.y)) {
        candidate = pt;
      }
    }

    if (!candidate) {
      // Kafolatlangan zaxira nuqta (juda katta radius/chiziq holatlari uchun)
      if (traj.type === "circle") {
        const angle = traj.startAngle + minDist / traj.radius;
        candidate = {
          x: clampVal(traj.center.x + traj.radius * Math.cos(angle), -maxX, maxX),
          y: clampVal(traj.center.y + traj.radius * Math.sin(angle), -maxY, maxY),
        };
      } else {
        candidate = {
          x: clampVal(p.x0 + traj.ux * minDist, -maxX, maxX),
          y: clampVal(p.y0 + traj.uy * minDist, -maxY, maxY),
        };
      }
    }

    return { x: candidate.x, y: candidate.y, radius: p.targetRadius };
  },
};

/* ============================== 6. SIMULATION ============================== */

const SIM = {
  /**
   * Har animatsiya kadrida chaqiriladi. `dtReal` — oxirgi kadrdan beri
   * o'tgan haqiqiy vaqt (soniyalarda).
   *  - Umumiy 3 daqiqalik taymer RUNNING va TARGET_HIT holatlarida kamayadi
   *    (PAUSE vaqtni hisoblamaydi — 16-bo'lim).
   *  - Fizika faqat RUNNING holatida fixed-timestep bilan yangilanadi.
   *  - TARGET_HIT holatida fizika 300-700ms muzlaydi, so'ng avtomatik davom etadi.
   */
  tick(dtReal) {
    const g = STATE.game;

    if (g === "RUNNING" || g === "TARGET_HIT") {
      STATE.timeRemaining = Math.max(0, STATE.timeRemaining - dtReal);
      if (STATE.timeRemaining <= 0) {
        GAME.finish();
        return;
      }
    }

    if (g === "RUNNING") {
      STATE.accumulator += dtReal;
      let steps = 0;
      while (STATE.accumulator >= CONFIG.physicsDt && steps < CONFIG.maxSubStepsPerFrame) {
        this.physicsStep(CONFIG.physicsDt);
        STATE.accumulator -= CONFIG.physicsDt;
        steps++;
        if (STATE.game !== "RUNNING") break; // target hit shu qadam ichida bo'lishi mumkin
      }
    } else if (g === "TARGET_HIT") {
      STATE.hitEffect.timer -= dtReal * 1000;
      if (STATE.hitEffect.timer <= 0) {
        GAME.completeTargetHitTransition();
      }
    }
  },

  /** Bitta aniq fizik qadam: RK4 + t oshirish + iz + target-hit tekshiruvi */
  physicsStep(dt) {
    const { q, m, Bz } = PHYSICS.siParams();
    const next = PHYSICS.rk4Step(STATE.particle, dt, q, m, Bz);

    STATE.particle = next;
    STATE.t += dt;

    const { fx, fy } = PHYSICS.computeForce(next.vx, next.vy, q, Bz);
    STATE.lastForce = { fx, fy, mag: Math.hypot(fx, fy) };
    STATE.lastAccel = STATE.lastForce.mag / m;

    STATE.trail.push({ x: next.x, y: next.y });
    if (STATE.trail.length > CONFIG.maxTrailPoints) STATE.trail.shift();

    if (!STATE.target) return;
    const d = distance(next.x, next.y, STATE.target.x, STATE.target.y);
    STATE.distanceToTarget = d;

    if (d <= STATE.target.radius) {
      GAME.onTargetHit();
    }
  },
};

/* ============================== 7. RENDERER ================================ */

const RENDERER = {
  ctx: null,
  canvas: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  },

  worldToScreen(x, y) {
    return {
      sx: CONFIG.canvasWidth / 2 + x * CONFIG.pixelsPerMeter,
      sy: CONFIG.canvasHeight / 2 - y * CONFIG.pixelsPerMeter,
    };
  },

  screenToWorld(sx, sy) {
    return {
      x: (sx - CONFIG.canvasWidth / 2) / CONFIG.pixelsPerMeter,
      y: (CONFIG.canvasHeight / 2 - sy) / CONFIG.pixelsPerMeter,
    };
  },

  drawAll() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    this.drawFieldGrid();
    this.drawTarget();
    this.drawTrail();
    this.drawVectors();
    this.drawParticle();
    this.drawHitEffect();
  },

  drawFieldGrid() {
    const ctx = this.ctx;
    const spacing = CONFIG.fieldDotSpacingPx;
    const symbol = STATE.params.Bsign >= 0 ? "\u2299" : "\u2297"; // ⊙ / ⊗
    const isOff = STATE.params.Bmag <= 0;

    ctx.save();
    ctx.font = "13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isOff ? "rgba(125,139,165,0.18)" : "rgba(70,212,224,0.28)";

    for (let sx = spacing / 2; sx < CONFIG.canvasWidth; sx += spacing) {
      for (let sy = spacing / 2; sy < CONFIG.canvasHeight; sy += spacing) {
        ctx.fillText(symbol, sx, sy);
      }
    }
    ctx.restore();
  },

  drawTarget() {
    if (!STATE.target) return;
    const ctx = this.ctx;
    const t = STATE.target;
    const { sx, sy } = this.worldToScreen(t.x, t.y);
    const rPx = t.radius * CONFIG.pixelsPerMeter;

    ctx.save();
    ctx.strokeStyle = "#f2a93b";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u{1F3AF}", sx, sy);
    ctx.restore();
  },

  drawTrail() {
    const ctx = this.ctx;
    const trail = STATE.trail;
    if (trail.length < 2) return;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(70,212,224,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const first = this.worldToScreen(trail[0].x, trail[0].y);
    ctx.moveTo(first.sx, first.sy);
    for (let i = 1; i < trail.length; i++) {
      const pt = this.worldToScreen(trail[i].x, trail[i].y);
      ctx.lineTo(pt.sx, pt.sy);
    }
    ctx.stroke();
    ctx.restore();
  },

  drawArrow(fromX, fromY, toX, toY, color) {
    const ctx = this.ctx;
    const headLen = 9;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle - Math.PI / 6),
      toY - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLen * Math.cos(angle + Math.PI / 6),
      toY - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawVectors() {
    if (STATE.game === "IDLE") return;
    const { x, y, vx, vy } = STATE.particle;
    const origin = this.worldToScreen(x, y);

    // Kuch va tezlik miqyoslari juda farq qiladi (N vs m/s), shuning uchun
    // vektorlarni EKRAN fazosida qat'iy uzunlik bilan chizamiz — bu ularning
    // yo'nalishini (jumladan F ⟂ v xususiyatini) aniq ko'rsatadi.
    const v = Math.hypot(vx, vy);
    if (v > 0.01) {
      const L = 48; // px
      this.drawArrow(origin.sx, origin.sy, origin.sx + (vx / v) * L, origin.sy - (vy / v) * L, "#5ad68f");
    }

    const f = STATE.lastForce;
    if (f.mag > 1e-18) {
      const L = 34; // px
      this.drawArrow(
        origin.sx, origin.sy,
        origin.sx + (f.fx / f.mag) * L, origin.sy - (f.fy / f.mag) * L,
        "#f2a93b"
      );
    }
  },

  drawParticle() {
    const { x, y } = STATE.particle;
    const { sx, sy } = this.worldToScreen(x, y);
    const positive = STATE.params.q_uC >= 0;
    const color = positive ? "#46d4e0" : "#ea5a7a";

    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#060a12";
    ctx.font = "bold 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(positive ? "+" : "\u2212", sx, sy + 0.5);

    ctx.fillStyle = color;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`q = ${formatNum(STATE.params.q_uC, 1)} \u03BCC`, sx + 14, sy - 12);
    ctx.restore();
  },

  /** Target urilgan lahzada — kengayuvchi halqa + "+1", to'liq Canvas ichida (modal EMAS) */
  drawHitEffect() {
    const fx = STATE.hitEffect;
    if (!fx.active) return;

    const progress = clampVal(1 - fx.timer / fx.duration, 0, 1);
    const { sx, sy } = this.worldToScreen(fx.x, fx.y);
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = "#5ad68f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 10 + progress * 44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = Math.max(0, 1 - progress * 1.3);
    ctx.fillStyle = "#5ad68f";
    ctx.font = "bold 20px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("+1", sx, sy - 24 - progress * 22);
    ctx.restore();
  },
};

/* ============================== 8. UI ====================================== */

function formatNum(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  return n.toFixed(digits);
}

function formatClock(totalSeconds) {
  const secs = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const UI = {
  els: {},

  cacheElements() {
    const ids = [
      "charge", "chargeValue", "mass", "massValue", "speed", "speedValue",
      "field", "fieldValue", "angle", "angleValue", "x0", "y0",
      "bOut", "bIn", "errorBox",
      "startBtn", "pauseBtn", "stepBtn", "resetBtn", "resetSmall",
      "stateLabel", "timeDisplay", "targetCountDisplay",
      "recordBadge", "recordValue",
      "resultPanel", "resultCount", "resultSummary", "resultRecord", "replayBtn",
      "outT", "outX", "outY", "outVx", "outVy", "outV", "outF", "outA",
      "outR", "outOmega", "outPeriod", "outDist",
    ];
    ids.forEach((id) => (this.els[id] = document.getElementById(id)));
  },

  /** Slayder/inputlardan STATE.params ga o'qiydi */
  readParamsFromInputs() {
    const p = STATE.params;
    p.q_uC = parseFloat(this.els.charge.value);
    p.m_mg = parseFloat(this.els.mass.value);
    p.v0 = parseFloat(this.els.speed.value);
    p.Bmag = parseFloat(this.els.field.value);
    p.theta_deg = parseFloat(this.els.angle.value);
    p.x0 = parseFloat(this.els.x0.value) || 0;
    p.y0 = parseFloat(this.els.y0.value) || 0;
  },

  updateReadoutLabels() {
    const p = STATE.params;
    this.els.chargeValue.textContent = `${p.q_uC >= 0 ? "+" : ""}${formatNum(p.q_uC, 1)} \u03BCC`;
    this.els.massValue.textContent = `${formatNum(p.m_mg, 1)} mg`;
    this.els.speedValue.textContent = `${formatNum(p.v0, 0)} m/s`;
    this.els.fieldValue.textContent = `${formatNum(p.Bmag, 2)} T`;
    this.els.angleValue.textContent = `${formatNum(p.theta_deg, 0)}\u00B0`;
  },

  updateErrorBox() {
    const msg = VALIDATION.check();
    if (msg) {
      this.els.errorBox.hidden = false;
      this.els.errorBox.textContent = msg;
    } else {
      this.els.errorBox.hidden = true;
      this.els.errorBox.textContent = "";
    }
    return msg === null;
  },

  updatePhysicsPanel() {
    const t = STATE.t;
    const { x, y, vx, vy } = STATE.particle;
    const v = Math.hypot(vx, vy);
    const f = STATE.lastForce;
    const { r, omega, period } = PHYSICS.derivedQuantities();

    this.els.outT.textContent = `${formatNum(t, 2)} s`;
    this.els.outX.textContent = `${formatNum(x, 1)} m`;
    this.els.outY.textContent = `${formatNum(y, 1)} m`;
    this.els.outVx.textContent = `${formatNum(vx, 1)} m/s`;
    this.els.outVy.textContent = `${formatNum(vy, 1)} m/s`;
    this.els.outV.textContent = `${formatNum(v, 1)} m/s`;
    this.els.outF.textContent = `${f.mag.toExponential(2)} N`;
    this.els.outA.textContent = `${STATE.lastAccel.toExponential(2)} m/s\u00B2`;
    this.els.outR.textContent = r === null ? "\u2014" : `${formatNum(r, 1)} m`;
    this.els.outOmega.textContent = omega === null ? "\u2014" : `${formatNum(omega, 3)} rad/s`;
    this.els.outPeriod.textContent = period === null ? "\u2014" : `${formatNum(period, 2)} s`;
    this.els.outDist.textContent =
      STATE.distanceToTarget === null ? "\u2014" : `${formatNum(STATE.distanceToTarget, 1)} m`;
  },

  updateStatsBar() {
    const active = STATE.game === "RUNNING" || STATE.game === "TARGET_HIT";
    const secs = Math.ceil(STATE.timeRemaining);
    this.els.timeDisplay.textContent = formatClock(STATE.timeRemaining);
    this.els.timeDisplay.classList.toggle(
      "timer-warning",
      active && secs <= CONFIG.timerWarningSec && secs > 0
    );
    this.els.targetCountDisplay.textContent = String(STATE.targetCount);
  },

  setStatePill(game) {
    const pill = this.els.stateLabel;
    pill.classList.remove("state-idle", "state-running", "state-paused", "state-target_hit", "state-finished");
    const map = {
      IDLE: ["state-idle", "TAYYOR"],
      RUNNING: ["state-running", "HARAKATDA"],
      PAUSED: ["state-paused", "TO'XTATILGAN"],
      TARGET_HIT: ["state-target_hit", "MAQSADGA YETDI"],
      FINISHED: ["state-finished", "YAKUNLANDI"],
    };
    const [cls, label] = map[game] || map.IDLE;
    pill.classList.add(cls);
    pill.textContent = label;
  },

  /** Joriy game holatiga qarab tugmalar va inputlarni yoqadi/o'chiradi */
  syncButtons() {
    const g = STATE.game;
    const b = this.els;
    b.startBtn.disabled = !(g === "IDLE" || g === "PAUSED");
    b.pauseBtn.disabled = g !== "RUNNING";
    b.stepBtn.disabled = !(g === "IDLE" || g === "PAUSED");
    b.resetBtn.disabled = g === "IDLE" && STATE.targetCount === 0 && STATE.timeRemaining === CONFIG.gameDurationSec;

    const controlInputs = [
      b.charge, b.mass, b.speed, b.field, b.angle, b.x0, b.y0, b.bOut, b.bIn,
    ];
    const locked = g !== "IDLE"; // parametrlar faqat IDLE holatda o'zgartiriladi
    controlInputs.forEach((el) => (el.disabled = locked));
  },

  showResultPanel(count, isNewRecord) {
    this.els.resultCount.textContent = String(count);
    this.els.resultSummary.textContent = `Siz 3 daqiqa davomida ${count} ta targetga yetdingiz!`;
    this.els.resultRecord.hidden = !isNewRecord;
    this.els.resultPanel.hidden = false;
    this.updateRecordBadge();
  },

  hideResultPanel() {
    this.els.resultPanel.hidden = true;
  },

  updateRecordBadge() {
    const best = RECORD.load();
    if (best > 0) {
      this.els.recordBadge.hidden = false;
      this.els.recordValue.textContent = String(best);
    }
  },

  setBToggle(sign) {
    const isOut = sign >= 0;
    this.els.bOut.classList.toggle("active", isOut);
    this.els.bOut.setAttribute("aria-pressed", String(isOut));
    this.els.bIn.classList.toggle("active", !isOut);
    this.els.bIn.setAttribute("aria-pressed", String(!isOut));
  },

  render() {
    this.updateReadoutLabels();
    this.updatePhysicsPanel();
    this.updateStatsBar();
    this.syncButtons();
  },
};

/* ============================== 9. RECORD (localStorage) =================== */

const RECORD = {
  load() {
    try {
      const v = parseInt(localStorage.getItem(CONFIG.recordStorageKey), 10);
      return Number.isFinite(v) ? v : 0;
    } catch (e) {
      return 0;
    }
  },

  /** @returns {{value:number, isNew:boolean}} */
  submit(count) {
    const current = this.load();
    if (count > current) {
      try {
        localStorage.setItem(CONFIG.recordStorageKey, String(count));
      } catch (e) {
        /* localStorage mavjud bo'lmasa jim o'tkazamiz */
      }
      return { value: count, isNew: true };
    }
    return { value: current, isNew: false };
  },
};

/* ============================== 10. AUDIO =================================== */
/* Tashqi fayl kerak emas — Web Audio API orqali qisqa signal generatsiya
   qilinadi. Faqat START/STEP bosilgandan (foydalanuvchi gesture'idan) keyin
   ishga tushadi — brauzerning autoplay cheklovlariga mos. */

const AUDIO = {
  ctx: null,

  ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },

  beep(freq, durMs, type, gainVal) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain).connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  },

  targetHit() {
    this.beep(880, 140, "triangle", 0.09);
  },

  finish() {
    this.beep(220, 200, "sawtooth", 0.06);
    setTimeout(() => this.beep(330, 260, "sawtooth", 0.06), 140);
  },
};

/* ============================== 11. GAME (state machine) =================== */

const GAME = {
  /** IDLE dan yangi 3-daqiqalik urinishni tayyorlaydi (lekin RUNNINGga o'tkazmaydi) */
  prepareFreshRound() {
    TARGETGEN.computeTrajectoryGeometry();
    resetParticleFromParams();
    STATE.targetCount = 0;
    STATE.timeRemaining = CONFIG.gameDurationSec;
    STATE.target = TARGETGEN.generateNewTarget();
    STATE.distanceToTarget = distance(STATE.particle.x, STATE.particle.y, STATE.target.x, STATE.target.y);
    STATE.hitEffect.active = false;
    UI.hideResultPanel();
  },

  start() {
    if (STATE.game === "RUNNING") return;

    if (STATE.game === "PAUSED") {
      AUDIO.ensureContext();
      STATE.game = "RUNNING";
      UI.setStatePill(STATE.game);
      UI.syncButtons();
      return;
    }

    // IDLE -> yangi urinish
    UI.readParamsFromInputs();
    if (!UI.updateErrorBox()) return;

    AUDIO.ensureContext();
    this.prepareFreshRound();
    STATE.game = "RUNNING";
    UI.setStatePill(STATE.game);
    UI.syncButtons();
  },

  pause() {
    if (STATE.game !== "RUNNING") return;
    STATE.game = "PAUSED";
    UI.setStatePill(STATE.game);
    UI.syncButtons();
  },

  step() {
    if (!(STATE.game === "IDLE" || STATE.game === "PAUSED")) return;

    UI.readParamsFromInputs();
    if (!UI.updateErrorBox()) return;

    if (STATE.game === "IDLE") {
      AUDIO.ensureContext();
      this.prepareFreshRound();
    }

    SIM.physicsStep(CONFIG.physicsDt);

    if (STATE.game !== "TARGET_HIT" && STATE.game !== "FINISHED") {
      STATE.game = "PAUSED";
    }
    UI.setStatePill(STATE.game);
    UI.syncButtons();
  },

  reset() {
    STATE.game = "IDLE";
    UI.readParamsFromInputs();
    this.prepareFreshRound();
    UI.setStatePill(STATE.game);
    UI.syncButtons();
  },

  replay() {
    this.reset();
    this.start();
  },

  /** Zarracha targetga yetganda (SIM.physicsStep ichidan chaqiriladi) */
  onTargetHit() {
    STATE.targetCount++;
    STATE.hitEffect = {
      active: true,
      x: STATE.target.x,
      y: STATE.target.y,
      timer: CONFIG.targetHitTransitionMs,
      duration: CONFIG.targetHitTransitionMs,
    };
    STATE.game = "TARGET_HIT";
    AUDIO.targetHit();
    UI.setStatePill(STATE.game);
    UI.syncButtons();
  },

  /** 300-700ms qisqa pauzadan keyin: particle reset + yangi target + davom etish */
  completeTargetHitTransition() {
    STATE.hitEffect.active = false;

    if (STATE.timeRemaining <= 0) {
      this.finish();
      return;
    }

    resetParticleFromParams();
    STATE.target = TARGETGEN.generateNewTarget();
    STATE.distanceToTarget = distance(STATE.particle.x, STATE.particle.y, STATE.target.x, STATE.target.y);

    STATE.game = "RUNNING";
    UI.setStatePill(STATE.game);
    UI.syncButtons();
  },

  finish() {
    STATE.timeRemaining = 0;
    STATE.hitEffect.active = false;
    STATE.game = "FINISHED";

    const result = RECORD.submit(STATE.targetCount);
    AUDIO.finish();
    UI.setStatePill(STATE.game);
    UI.syncButtons();
    UI.showResultPanel(STATE.targetCount, result.isNew);
  },
};

/* ============================== 12. EVENT HANDLERS =========================== */

const EVENTS = {
  bindAll() {
    const els = UI.els;

    ["charge", "mass", "speed", "field", "angle"].forEach((id) => {
      els[id].addEventListener("input", () => {
        UI.readParamsFromInputs();
        UI.updateReadoutLabels();
        UI.updateErrorBox();
        if (STATE.game === "IDLE") {
          resetParticleFromParams();
          RENDERER.drawAll();
          UI.updatePhysicsPanel();
        }
      });
    });

    ["x0", "y0"].forEach((id) => {
      els[id].addEventListener("change", () => {
        UI.readParamsFromInputs();
        if (STATE.game === "IDLE") {
          resetParticleFromParams();
          RENDERER.drawAll();
          UI.updatePhysicsPanel();
        }
      });
    });

    els.bOut.addEventListener("click", () => {
      STATE.params.Bsign = +1;
      UI.setBToggle(+1);
      if (STATE.game === "IDLE") RENDERER.drawAll();
    });
    els.bIn.addEventListener("click", () => {
      STATE.params.Bsign = -1;
      UI.setBToggle(-1);
      if (STATE.game === "IDLE") RENDERER.drawAll();
    });

    els.startBtn.addEventListener("click", () => GAME.start());
    els.pauseBtn.addEventListener("click", () => GAME.pause());
    els.stepBtn.addEventListener("click", () => GAME.step());
    els.resetBtn.addEventListener("click", () => GAME.reset());
    els.resetSmall.addEventListener("click", () => GAME.reset());
    els.replayBtn.addEventListener("click", () => GAME.replay());

    window.addEventListener("resize", debounce(() => RENDERER.drawAll(), 150));
  },
};

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/* ============================== 13. MAIN LOOP =============================== */

let lastFrameTime = null;

function frame(now) {
  if (lastFrameTime === null) lastFrameTime = now;
  const dtReal = Math.min((now - lastFrameTime) / 1000, 0.1); // sakrashlarni cheklash
  lastFrameTime = now;

  SIM.tick(dtReal);
  RENDERER.drawAll();
  UI.render();

  requestAnimationFrame(frame);
}

/* ============================== 14. BOOTSTRAP ================================ */

function init() {
  UI.cacheElements();
  RENDERER.init(document.getElementById("simCanvas"));
  EVENTS.bindAll();

  UI.readParamsFromInputs();
  const validationMsg = VALIDATION.check();
  if (validationMsg) {
    UI.els.errorBox.hidden = false;
    UI.els.errorBox.textContent = validationMsg;
  }

  TARGETGEN.computeTrajectoryGeometry();
  resetParticleFromParams();
  UI.setBToggle(STATE.params.Bsign);
  UI.setStatePill(STATE.game);
  UI.updateRecordBadge();
  UI.render();
  RENDERER.drawAll();

  requestAnimationFrame(frame);
}

document.addEventListener("DOMContentLoaded", init);