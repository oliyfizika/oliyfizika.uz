// ==========================================================================
// Elektr zanjiri — fizika (DOM'siz). O'zgarmas tok, statsionar rejim.
// Zanjir — tugunlar (0..N-1) orasidagi ikki qutbli elementlar ro'yxati. Har elementda a, b — uchlari.
// Yechim: tugun potensiallari usuli (MNA): ideal sim/yopiq kalit tugunlarni birlashtiradi (aniq),
// EYuK manbai va ampermetr qo'shimcha noma'lum tok sifatida kiradi; Gauss usuli (qisman tanlov bilan).
// Diod va LED — nochiziqli (Shokli tenglamasi): Nyuton–Rafson iteratsiyasi, kuchlanishni cheklash (pnjlim).
// Voltmetr — katta qarshilik R_V = 1 MΩ (amalda ideal), ampermetr — ideal (0 Ω).
// Belgilar: I — a→b yo'nalishdagi tok (element ichida), U = φa − φb, P = U·I (musbat — iste'mol).
// Batareya: plus = "a" | "b" (musbat qutb); Iout — musbat qutbdan tashqi zanjirga chiqayotgan tok.
// Diod: rev = false — anod a uchida (a→b o'tkazadi), rev = true — anod b uchida.
// Sim va kalitdagi toklar — birlashgan tugunlar ichida daraxt (spanning tree) bo'ylab KCL dan aniq topiladi.
// ==========================================================================

/** Solishtirma qarshilik ρ (Ω·mm²/m), 20 °C. */
export const MATERIALS = {
  kumush:     { name: "Kumush",      rho: 0.016 },
  mis:        { name: "Mis",         rho: 0.017 },
  alyuminiy:  { name: "Alyuminiy",   rho: 0.028 },
  volfram:    { name: "Volfram",     rho: 0.055 },
  temir:      { name: "Temir",       rho: 0.10 },
  konstantan: { name: "Konstantan",  rho: 0.50 },
  nixrom:     { name: "Nixrom",      rho: 1.10 },
};

export const R_MIN = 0.01;   // eng kichik qarshilik (Ω) — nolga bo'linmasin
export const R_VOLT = 1e6;   // voltmetr ichki qarshiligi (Ω)
export const GMIN = 1e-10;   // diodga parallel juda kichik o'tkazuvchanlik (S) — matritsa yagona bo'lmasin
export const VT = 0.02585;   // issiqlik kuchlanishi kT/e, 300 K

/** LED ranglari: to'yinish toki Is (n = 2) — ochilish kuchlanishi rangga bog'liq (10 mA da ≈ 1,9 / 2,0 / 2,1 / 2,6 V). */
export const LED_COLORS = {
  red:    { name: "Qizil",  Is: 1e-18, color: "#ef4444" },
  yellow: { name: "Sariq",  Is: 1e-19, color: "#eab308" },
  green:  { name: "Yashil", Is: 1e-20, color: "#22c55e" },
  blue:   { name: "Ko‘k",   Is: 1e-24, color: "#3b82f6" },
};
export const LED_I_NOM = 0.02;  // LED nominal toki (A)
export const LED_I_MAX = 0.05;  // bundan katta tok — LED kuyadi

/** Diod parametrlari: Is (A), nVt (V), vmax — undan keyin xarakteristika chiziqli davom etadi (toshib ketmasin). */
export function diodeParams(el) {
  if (el.type === "led") return { Is: LED_COLORS[el.color]?.Is ?? 1e-18, nVt: 2 * VT, vmax: 3.4 };
  return { Is: 1e-14, nVt: VT, vmax: 0.95 }; // kremniy diod: 10 mA da ≈ 0,71 V
}

/** To'g'ri yo'nalishdagi kuchlanish v uchun tok i(v) va differensial o'tkazuvchanlik g = di/dv (GMIN bilan). */
export function diodeIV(el, v) {
  const { Is, nVt, vmax } = diodeParams(el);
  let i, g;
  if (v > vmax) { const e = Math.exp(vmax / nVt); g = (Is / nVt) * e; i = Is * (e - 1) + g * (v - vmax); }
  else { const e = Math.exp(v / nVt); i = Is * (e - 1); g = (Is / nVt) * e; }
  return { i: i + GMIN * v, g: g + GMIN };
}

/** Berilgan to'g'ri tok uchun diod kuchlanishi (teskari funksiya, GMIN siz). */
export function diodeVoltage(el, I) {
  const { Is, nVt } = diodeParams(el);
  return I > 0 ? nVt * Math.log(I / Is + 1) : 0;
}

const isDiode = (e) => e.type === "diode" || e.type === "led";

/** Qarshilik turidagi elementning R qiymati (Ω). Boshqa turlar uchun null. */
export function resistanceOf(el) {
  switch (el.type) {
    case "resistor": return Math.max(el.R, R_MIN);
    case "lamp": return Math.max(el.R, R_MIN);
    case "rheostat": return Math.max(el.Rmax * el.pos, R_MIN);
    case "conductor": return Math.max((MATERIALS[el.mat]?.rho ?? 1) * el.l / el.S, R_MIN); // R = ρ l / S
    case "voltmeter": return R_VOLT;
    default: return null;
  }
}

/** Parallel / ketma-ket ekvivalent (yordamchi, sahifada tekshirish uchun). */
export const seriesR = (...r) => r.reduce((s, x) => s + x, 0);
export const parallelR = (...r) => 1 / r.reduce((s, x) => s + 1 / x, 0);

/** Gauss usuli (qisman tanlov). Yagona bo'lmasa null. */
function gauss(A, b) {
  const n = b.length;
  let scale = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) scale = Math.max(scale, Math.abs(A[i][j]));
  const eps = 1e-14 * Math.max(scale, 1);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < eps) return null;
    if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; [b[p], b[c]] = [b[c], b[p]]; }
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

class UF {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(x) { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
  union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[b] = a; }
}

/** SPICE pnjlim: eksponenta uchun Nyuton qadamini cheklash. */
function pnjlim(vnew, vold, nVt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * nVt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nVt;
      return arg > 0 ? vold + nVt * Math.log(arg) : vcrit;
    }
    return nVt * Math.log(vnew / nVt);
  }
  return vnew;
}

/**
 * solve(nodeCount, elements) → {
 *   ok, error ("short" | null), converged, iterations, phi[node] (NaN — ulanmagan tugun), comp[node] (komponent id yoki −1),
 *   el[i] = { I, U, P, R, Iout?, Ut?, drop?, Vf?, If? }  (elements bilan bir xil tartib)
 * }
 * elements[i]: { type, a, b, ...}  — type: wire | switch(closed) | resistor | lamp | rheostat | conductor | voltmeter |
 *              battery | ammeter | diode(rev) | led(rev, color)
 */
export function solve(nodeCount, elements) {
  const N = nodeCount;
  const out = { ok: true, error: null, converged: true, iterations: 0, phi: new Array(N).fill(NaN), comp: new Array(N).fill(-1), el: elements.map(() => ({ I: 0, U: 0, P: 0, R: null })) };

  // 1) Sim va yopiq kalit — tugunlarni birlashtiradi
  const uf = new UF(N);
  const isLink = (e) => e.type === "wire" || (e.type === "switch" && e.closed);
  elements.forEach((e) => { if (isLink(e)) uf.union(e.a, e.b); });

  // 2) Faol elementlar (qarshilik, diod, batareya, ampermetr) va ularning tugunlari
  const active = [];
  elements.forEach((e, i) => { if (!isLink(e) && e.type !== "switch") active.push(i); });
  const used = new Set();
  active.forEach((i) => { used.add(uf.find(elements[i].a)); used.add(uf.find(elements[i].b)); });
  elements.forEach((e) => { if (isLink(e)) used.add(uf.find(e.a)); });

  // 3) Bog'langan komponentlar (faol elementlar bo'yicha), har birida bitta yer (φ = 0)
  const cuf = new UF(N);
  active.forEach((i) => cuf.union(uf.find(elements[i].a), uf.find(elements[i].b)));
  const compRoot = new Map(); // ildiz → komponent id
  const ground = new Set();
  const usedSorted = [...used].sort((x, y) => x - y);
  usedSorted.forEach((rep) => {
    const r = cuf.find(rep);
    if (!compRoot.has(r)) { compRoot.set(r, compRoot.size); ground.add(rep); }
  });

  // 4) Noma'lumlar: yer bo'lmagan tugun potensiallari + manba toklari
  const idx = new Map();
  usedSorted.forEach((rep) => { if (!ground.has(rep)) idx.set(rep, idx.size); });
  const nV = idx.size;
  const srcs = active.filter((i) => elements[i].type === "battery" || elements[i].type === "ammeter");
  const diodes = active.filter((i) => isDiode(elements[i]));
  const n = nV + srcs.length;
  const row = (rep) => (idx.has(rep) ? idx.get(rep) : -1);

  function assemble(vd) {
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const rhs = new Array(n).fill(0);
    const stampG = (a, b, g) => {
      if (a >= 0) A[a][a] += g;
      if (b >= 0) A[b][b] += g;
      if (a >= 0 && b >= 0) { A[a][b] -= g; A[b][a] -= g; }
    };
    active.forEach((i) => {
      const e = elements[i];
      const R = resistanceOf(e);
      if (R === null) return;
      stampG(row(uf.find(e.a)), row(uf.find(e.b)), 1 / R);
    });
    const lin = [];
    diodes.forEach((i, k) => {
      const e = elements[i], s = e.rev ? -1 : 1, v0 = vd[k];
      const { i: i0, g } = diodeIV(e, v0);
      const Ieq = s * (i0 - g * v0); // a→b tok: I = g·U + Ieq
      const a = row(uf.find(e.a)), b = row(uf.find(e.b));
      stampG(a, b, g);
      if (a >= 0) rhs[a] -= Ieq;
      if (b >= 0) rhs[b] += Ieq;
      lin.push({ g, Ieq });
    });
    srcs.forEach((i, k) => {
      const e = elements[i], col = nV + k;
      // j — element ichida a→b yo'nalishdagi tok; tugun tenglamasi: tugundan chiqayotgan toklar yig'indisi = 0
      const a = row(uf.find(e.a)), b = row(uf.find(e.b));
      if (a >= 0) A[a][col] += 1;
      if (b >= 0) A[b][col] -= 1;
      if (e.type === "ammeter") {
        if (a >= 0) A[col][a] += 1;
        if (b >= 0) A[col][b] -= 1;
        rhs[col] = 0;
      } else {
        // φplus − φminus + r·Iout = ε;  Iout = j (plus = b) yoki −j (plus = a)
        const sgn = e.plus === "a" ? -1 : 1;
        const plusIsB = e.plus !== "a";
        const p = plusIsB ? b : a, m = plusIsB ? a : b;
        if (p >= 0) A[col][p] += 1;
        if (m >= 0) A[col][m] -= 1;
        A[col][col] += (e.r || 0) * sgn;
        rhs[col] = e.emf;
      }
    });
    return { A, rhs, lin };
  }

  const phiOf = (x, v) => { const rep = uf.find(v); return ground.has(rep) ? 0 : x[idx.get(rep)]; };
  let x = [], lin = [];
  if (n > 0) {
    const vd = diodes.map(() => 0);
    const maxIter = diodes.length ? 400 : 1;
    let done = false;
    for (let it = 0; it < maxIter && !done; it++) {
      const sys = assemble(vd);
      x = gauss(sys.A, sys.rhs);
      lin = sys.lin;
      out.iterations = it + 1;
      if (!x) { out.ok = false; out.error = "short"; return out; }
      if (!diodes.length) break;
      done = true;
      diodes.forEach((i, k) => {
        const e = elements[i], s = e.rev ? -1 : 1;
        const { Is, nVt } = diodeParams(e);
        const vcrit = nVt * Math.log(nVt / (Math.SQRT2 * Is));
        const vnew = s * (phiOf(x, e.a) - phiOf(x, e.b));
        const vlim = pnjlim(vnew, vd[k], nVt, vcrit);
        if (Math.abs(vnew - vd[k]) > 1e-9 + 1e-9 * Math.abs(vnew) || vlim !== vnew) done = false;
        vd[k] = vlim;
      });
      if (!done && it === maxIter - 1) out.converged = false;
    }
  }

  // 5) Potensiallar
  const phiRep = new Map();
  used.forEach((rep) => phiRep.set(rep, ground.has(rep) ? 0 : x[idx.get(rep)]));
  for (let v = 0; v < N; v++) {
    const rep = uf.find(v);
    if (phiRep.has(rep)) { out.phi[v] = phiRep.get(rep); out.comp[v] = compRoot.get(cuf.find(rep)); }
  }

  // 6) Element toklari
  const injected = new Array(N).fill(0); // tugundan sim bo'lmagan elementlar orqali chiqayotgan tok
  elements.forEach((e, i) => {
    const r = out.el[i];
    const pa = out.phi[e.a], pb = out.phi[e.b];
    r.U = Number.isFinite(pa) && Number.isFinite(pb) ? pa - pb : 0;
    if (isLink(e) || e.type === "switch") return; // keyin
    const R = resistanceOf(e);
    if (R !== null) { r.R = R; r.I = r.U / R; }
    else if (isDiode(e)) {
      const { g, Ieq } = lin[diodes.indexOf(i)];
      r.I = g * r.U + Ieq; // matritsadagi chiziqlantirish bilan bir xil — KCL aniq bajariladi
      const s = e.rev ? -1 : 1;
      r.Vf = s * r.U; r.If = s * r.I;
      r.R = Math.abs(r.I) > 1e-12 ? Math.abs(r.U / r.I) : null;
    } else r.I = x[nV + srcs.indexOf(i)];
    if (e.type === "battery") {
      const plusIsB = e.plus !== "a";
      r.Iout = plusIsB ? r.I : -r.I;
      r.Ut = plusIsB ? -r.U : r.U; // φplus − φminus (U = φa − φb)
      r.r = e.r || 0;
      r.P = r.Ut * r.Iout; // manba beradigan quvvat
      r.drop = (e.r || 0) * r.Iout; // ichki kuchlanish tushuvi
      r.Ploss = (e.r || 0) * r.Iout * r.Iout;
    } else if (e.type === "ammeter") r.P = 0;
    else r.P = r.U * r.I;
    injected[e.a] += r.I;
    injected[e.b] -= r.I;
  });

  // 7) Sim / kalit toklari: har bir birlashgan guruhda daraxt bo'ylab
  const adj = new Map();
  elements.forEach((e, i) => {
    if (!isLink(e)) return;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a).push({ to: e.b, i });
    adj.get(e.b).push({ to: e.a, i });
  });
  const seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const order = [], parent = new Map([[start, { p: -1, i: -1 }]]);
    const stack = [start]; seen.add(start);
    while (stack.length) {
      const v = stack.pop(); order.push(v);
      for (const { to, i } of adj.get(v)) if (!seen.has(to)) { seen.add(to); parent.set(to, { p: v, i }); stack.push(to); }
    }
    const sub = new Map(order.map((v) => [v, injected[v]]));
    for (let k = order.length - 1; k > 0; k--) {
      const v = order[k], { p, i } = parent.get(v);
      const flow = sub.get(v); // p → v yo'nalishidagi tok
      out.el[i].I = elements[i].a === p ? flow : -flow;
      sub.set(p, sub.get(p) + flow);
    }
  }
  // Ochiq kalit
  elements.forEach((e, i) => { if (e.type === "switch" && !e.closed) { out.el[i].I = 0; const pa = out.phi[e.a], pb = out.phi[e.b]; out.el[i].U = Number.isFinite(pa) && Number.isFinite(pb) ? pa - pb : 0; } });

  // 8) Qisqa tutashuv belgisi: batareya qisqichlaridagi kuchlanish EYuK ning 2% idan kam, tok bor
  elements.forEach((e, i) => {
    if (e.type !== "battery") return;
    const r = out.el[i];
    if (e.emf > 0 && Math.abs(r.Iout) > 1e-6 && Math.abs(r.Ut) < 0.02 * e.emf) out.error = "short";
    if (Math.abs(r.Iout) > 100) out.error = "short"; // 100 A dan katta tok — amalda qisqa tutashuv
  });
  return out;
}

/** Tugunlar orasidagi potensiallar farqi (ideal voltmetr). Ulanmagan yoki turli komponent bo'lsa null. */
export function voltage(sol, a, b) {
  if (a == null || b == null) return null;
  const pa = sol.phi[a], pb = sol.phi[b];
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return null;
  if (sol.comp[a] !== sol.comp[b]) return null;
  return pa - pb;
}

/** Voltmetr ko'rsatishi: musbat qisqich (plus) potensiali minus manfiy qisqich. */
export const voltmeterReading = (el, r) => (el.plus === "b" ? -r.U : r.U);

/** Bitta batareya uchun qisqichlar xarakteristikasi: U = ε − I·r. */
export const terminalVoltage = (emf, r, I) => emf - I * r;
