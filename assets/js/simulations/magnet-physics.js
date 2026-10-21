// ==========================================================================
// Magnit maydon va Amper kuchi — fizika (DOM'siz). SI birliklari, koordinatalar metrda, y yuqoriga.
// Manbalar (tekislikdagi model):
//   wire   — tekislikka tik cheksiz to'g'ri o'tkazgich: B = μ₀I / (2πr), I > 0 — bizga qarab (⊙), maydon soat
//            mili teskarisiga (o'ng vint / o'ng qo'l qoidasi).
//   magnet — doimiy magnit: qutblar uchlaridagi «magnit zaryadlar» (har bir uch bir nechta nuqtaga bo'lingan),
//            B = μ₀q / (4πr²) — uzoqda dipol maydoni (1/r³).
//   coil   — g'altak (solenoid) bo'ylama kesimi: ikki qator tokli o'tkazgich (⊙ va ⊗). Ichida B ≈ μ₀μNI / l.
//   earth  — Yer magnit maydoni (bir jinsli, gorizontal tashkil etuvchi, shimolga).
// Amper kuchi F = BIl·sinα, tokli ramka momenti M = NBIS·sinφ, parallel toklar F/l = μ₀I₁I₂ / (2πd).
// ==========================================================================

export const MU0 = 4e-7 * Math.PI;
export const B_EARTH = 2e-5; // Yer maydonining gorizontal tashkil etuvchisi (T), O'zbekistonda ≈ 20–25 μT

/** G'altakning o'tkazgichlari (ko'rinadigan kesimlar): qatorlar bo'yicha. */
export function coilWires(c) {
  const k = Math.max(2, Math.min(14, Math.round(c.N / 10)));
  const ux = Math.cos(c.angle), uy = Math.sin(c.angle);   // o'q yo'nalishi (N qutb tomoni)
  const vx = -uy, vy = ux;                                  // o'qqa tik
  const Ieach = (c.I * c.N * (c.core ? c.mu : 1)) / k;
  const out = [];
  for (let i = 0; i < k; i++) {
    const s = -c.len / 2 + (c.len * (i + 0.5)) / k;
    const r = c.diam / 2;
    // +v tomondagi qatorda tok bizga qarab (⊙), −v tomonda bizdan (⊗) → ichida maydon +u (N qutb) yo'nalishda
    out.push({ x: c.x + ux * s + vx * r, y: c.y + uy * s + vy * r, I: Ieach });
    out.push({ x: c.x + ux * s - vx * r, y: c.y + uy * s - vy * r, I: -Ieach });
  }
  return out;
}

/** Magnit qutblari: [{x, y, q}] — q > 0 shimoliy (N). */
export function magnetPoles(m) {
  const ux = Math.cos(m.angle), uy = Math.sin(m.angle), vx = -uy, vy = ux;
  const k = 5, out = [];
  for (let i = 0; i < k; i++) {
    const t = -m.width / 2 + (m.width * (i + 0.5)) / k;
    out.push({ x: m.x + ux * (m.len / 2) + vx * t, y: m.y + uy * (m.len / 2) + vy * t, q: m.q / k });
    out.push({ x: m.x - ux * (m.len / 2) + vx * t, y: m.y - uy * (m.len / 2) + vy * t, q: -m.q / k });
  }
  return out;
}

/** Manbalarni hisob uchun tekis ro'yxatga keltirish (har o'zgarishda bir marta). */
export function compile(sources) {
  const wires = [], poles = [], strips = [];
  let ex = 0, ey = 0;
  sources.forEach((s, idx) => {
    if (s.type === "wire") wires.push({ x: s.x, y: s.y, I: s.I, src: idx });
    else if (s.type === "coil") {
      // g'altak — ikki tokli varaq (sirt tok zichligi K = μNI/l): ichida aniq μ₀K, uchlarida tarqoq maydon
      const ux = Math.cos(s.angle), uy = Math.sin(s.angle), vx = -uy, vy = ux, r = s.diam / 2, h = s.len / 2;
      const K = (s.I * s.N * (s.core ? s.mu : 1)) / s.len;
      strips.push({ ax: s.x - ux * h + vx * r, ay: s.y - uy * h + vy * r, bx: s.x + ux * h + vx * r, by: s.y + uy * h + vy * r, K, src: idx });
      strips.push({ ax: s.x - ux * h - vx * r, ay: s.y - uy * h - vy * r, bx: s.x + ux * h - vx * r, by: s.y + uy * h - vy * r, K: -K, src: idx });
    }
    else if (s.type === "magnet") magnetPoles(s).forEach((p) => poles.push({ ...p, src: idx }));
    else if (s.type === "earth") { ex += s.B * Math.cos(s.angle ?? Math.PI / 2); ey += s.B * Math.sin(s.angle ?? Math.PI / 2); }
  });
  return { wires, poles, strips, ex, ey };
}

const K_WIRE = MU0 / (2 * Math.PI), K_POLE = MU0 / (4 * Math.PI);

/** B(x, y) — [Bx, By] (T). skip — shu manba indeksini hisobga olmaslik (o'z maydoni). */
export function field(cmp, x, y, skip = -1) {
  let bx = cmp.ex, by = cmp.ey;
  for (const w of cmp.wires) {
    if (w.src === skip) continue;
    const dx = x - w.x, dy = y - w.y, r2 = dx * dx + dy * dy + 1e-10;
    const k = (K_WIRE * w.I) / r2;
    bx += -k * dy; by += k * dx;
  }
  for (const st of cmp.strips) {
    if (st.src === skip) continue;
    const L = Math.hypot(st.bx - st.ax, st.by - st.ay), ux = (st.bx - st.ax) / L, uy = (st.by - st.ay) / L, vx = -uy, vy = ux;
    const px = x - st.ax, py = y - st.ay, x0 = px * ux + py * uy, y0 = px * vx + py * vy;
    const d = Math.atan2(y0 * L, -x0 * (L - x0) + y0 * y0);
    const ra = x0 * x0 + y0 * y0 + 1e-12, rb = (x0 - L) * (x0 - L) + y0 * y0 + 1e-12;
    const bl = (-K_WIRE * st.K) * d, bn = (K_WIRE * st.K / 2) * Math.log(ra / rb);
    bx += bl * ux + bn * vx; by += bl * uy + bn * vy;
  }
  for (const p of cmp.poles) {
    if (p.src === skip) continue;
    const dx = x - p.x, dy = y - p.y, r2 = dx * dx + dy * dy + 1e-10, r = Math.sqrt(r2);
    const k = (K_POLE * p.q) / (r2 * r);
    bx += k * dx; by += k * dy;
  }
  return [bx, by];
}

/** O'tkazgichga (tekislikka tik, uzunligi l) boshqa manbalar tomonidan ta'sir etuvchi kuch: F = I l (ẑ × B). */
export function forceOnWire(cmp, wire, idx, l = 1) {
  const [bx, by] = field(cmp, wire.x, wire.y, idx);
  return [-wire.I * l * by, wire.I * l * bx];
}

/** Ikki parallel tok orasidagi kuch (1 m uzunlikka): F/l = μ₀I₁I₂ / (2πd). */
export const parallelForce = (I1, I2, d) => (MU0 * I1 * I2) / (2 * Math.PI * d);

/** Uzun g'altak ichidagi maydon: B = μ₀μNI / l. */
export const solenoidB = (N, I, len, mu = 1) => (MU0 * mu * N * I) / len;

/** Amper kuchi: F = BIl sinα. */
export const ampereForce = (B, I, l, alpha) => B * I * l * Math.sin(alpha);

/** Tokli ramka momenti: M = NBIS sinφ (φ — ramka normali va B orasidagi burchak). */
export const frameTorque = (N, B, I, S, phi) => N * B * I * S * Math.sin(phi);

/**
 * Ramka dinamikasi (bitta qadam, yarim-implisit Eyler).
 * st: { phi, omega }, p: { N, B, I, S, J, k (ishqalanish N·m·s), load (N·m), commutator }
 * Kollektor bo'lsa, tok yo'nalishi ramka B ga tik holatdan o'tganda almashadi: M = NBIS|sinφ|·sign(ω yoki 1).
 */
export function frameStep(st, p, dt) {
  let s = Math.sin(st.phi);
  let Ieff = p.I;
  if (p.commutator) Ieff = p.I * (s >= 0 ? 1 : -1); // yarim halqalar: momentni bir xil yo'nalishda saqlaydi
  const M = frameTorque(p.N, p.B, Ieff, p.S, st.phi);
  const fr = -p.k * st.omega - (p.load || 0) * Math.sign(st.omega);
  // M = NBIS sinφ — φ ni kamaytirishga intiladi (normal B ga tomon buriladi)
  const alpha = (-M + fr) / p.J;
  st.omega += alpha * dt;
  st.phi += st.omega * dt;
  st.M = -M; st.Ieff = Ieff;
  return st;
}

/** Relsdagi o'tkazgich: m dv/dt = BIl − μmg·sign(v). Qaytaradi bajarilgan ish (J). */
export function railStep(st, p, dt) {
  const F = p.B * p.I * p.l;
  const fr = p.mu * p.m * 9.81;
  let a;
  if (Math.abs(st.v) < 1e-9 && Math.abs(F) <= fr) a = 0;
  else a = (F - fr * Math.sign(st.v || F)) / p.m;
  const v0 = st.v;
  st.v += a * dt;
  if (v0 !== 0 && Math.sign(st.v) !== Math.sign(v0) && Math.abs(F) <= fr) st.v = 0;
  const ds = ((v0 + st.v) / 2) * dt;
  st.x += ds;
  st.work += F * ds;
  return st;
}

/** Osma o'tkazgichning muvozanat og'ish burchagi: tgθ = F / (mg). */
export const swingAngle = (F, m) => Math.atan2(F, m * 9.81);
