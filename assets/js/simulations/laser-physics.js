// ==========================================================================
// Lazer — fizika (DOM'siz; simulations/laser.html).
// Foton energiyasi E = hν = hc/λ. Atom fotonni faqat hν = E₂ − E₁ bo'lganda yutadi (rezonans).
// Uyg'ongan atom: o'z-o'zidan (spontan) nurlanadi — yo'nalish va faza tasodifiy; yoki xuddi shunday
// foton ta'sirida majburiy (indutsirlangan) nurlanadi — yangi foton birinchisining aynan nusxasi
// (chastota, yo'nalish, faza bir xil). Kuchayish uchun populyatsiya inversiyasi kerak: N₂ > N₁.
// Rezonator (ikki ko'zgu) majburiy nurlanishni o'q bo'ylab ko'p marta takrorlaydi.
// Rezonator modeli — atomlar va fotonlar bo'yicha stoxastik (Monte-Karlo) hisob, vaqt shartli birlikda:
//   G — asosiy sath, P — nasos sathi (tez bo'shaydi), U — yuqori lazer sathi (metastabil, τ),
//   L — pastki lazer sathi (4 sathli sxemada tez bo'shaydi; 3 sathlida L = G).
// ==========================================================================

export const HC = 1239.84; // eV·nm
export const photonEV = (nm) => HC / nm;
export const nmOfEV = (eV) => HC / eV;

/** Rubin (Cr³⁺ ionlari): 3 sathli; He–Ne: 4 sathli (Ne atomlari, He orqali uyg'otiladi) */
export const LASERS = {
  ruby: { name: "Rubin lazeri", nm: 694.3, scheme: 3, tau: 3, levels: { E1: 0, E2: 1.786, E3lo: 2.1, E3hi: 2.6 }, pump: "ksenon chaqnash lampasi" },
  hene: { name: "Geliy–neon lazeri", nm: 632.8, scheme: 4, tau: 3, levels: { E0: 0, E1: 18.70, E2: 20.66, He: 20.61 }, pump: "gazdagi elektr razryad" },
};
/** Rubin atomi (sathlar diagrammasi uchun): fotonning qaysi o'tishni uyg'otishi */
export const RUBY = LASERS.ruby.levels;
/** atom holati s ("E1" | "E2") va foton λ bo'yicha: "absorb21" (E1→E2), "absorb31" (E1→E3 nasos), "stim", "pass" */
export function interact(s, nm, tol = 0.025) {
  const e = photonEV(nm), d21 = RUBY.E2 - RUBY.E1;
  if (s === "E1") { if (Math.abs(e - d21) <= tol) return "absorb21"; if (e >= RUBY.E3lo && e <= RUBY.E3hi) return "absorb31"; return "pass"; }
  if (s === "E2") return Math.abs(e - d21) <= tol ? "stim" : "pass";
  return "pass";
}

/** Takrorlanadigan tasodifiy sonlar (mulberry32) */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ Rezonator (Monte-Karlo) */

export const ROD = { L: 1, H: 0.24, nx: 20, ny: 4 };
export const C_SIM = 1.6;      // fotonning shartli tezligi (sterjen uzunligi / vaqt birligi)
export const P_INT = 0.3;      // foton atom yonidan o'tganda ta'sirlashish ehtimoli
export const TAU_FAST = 0.05;  // nasos sathi va pastki lazer sathining yashash vaqti
export const MAXP = 700;
export const MIRROR_FOCUS = 0.35; // qaytgan nurning o'qqa nisbatan og'ishi shuncha marta kamayadi

/** o: { scheme: 3|4, tau, W (nasos tezligi), R (chiqish ko'zgusi qaytarishi), seed } */
export function createCavity(o = {}) {
  const r = rng(o.seed ?? 7), atoms = [], cw = ROD.L / ROD.nx, ch = ROD.H / ROD.ny;
  for (let j = 0; j < ROD.ny; j++) for (let i = 0; i < ROD.nx; i++) atoms.push({ x: (i + 0.5) * cw + (r() - 0.5) * cw * 0.4, y: (j + 0.5) * ch, s: "G", flash: 0 });
  return { scheme: o.scheme ?? 3, tau: o.tau ?? 3, W: o.W ?? 1, R: o.R ?? 0.95, rnd: r, atoms, ph: [], out: [], t: 0, nOut: 0, nSpont: 0, nStim: 0, nAbs: 0, nBeam: 0, nextId: 1 };
}
const lowerOf = (st) => (st.scheme === 4 ? "L" : "G");
const absorberOf = lowerOf;

function emit(st, a, dx, dy, src) {
  if (st.ph.length >= MAXP) return null;
  const p = { x: a.x, y: a.y, dx, dy, last: -1, id: src ? src.id : st.nextId++, ph: src ? src.ph : st.rnd() * Math.PI * 2 };
  st.ph.push(p); return p;
}

/** Bir qadam (dt ≤ 0.012 tavsiya etiladi) */
export function stepCavity(st, dt) {
  const r = st.rnd, cw = ROD.L / ROD.nx, ch = ROD.H / ROD.ny, low = lowerOf(st);
  const pPump = 1 - Math.exp(-st.W * dt), pSp = 1 - Math.exp(-dt / st.tau), pFast = 1 - Math.exp(-dt / TAU_FAST);
  // atomlar: nasos, tez o'tishlar, spontan nurlanish
  for (const a of st.atoms) {
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt);
    if (a.s === "G") { if (r() < pPump) a.s = "P"; }
    else if (a.s === "P") { if (r() < pFast) a.s = "U"; }
    else if (a.s === "L") { if (r() < pFast) a.s = "G"; }
    else if (a.s === "U" && r() < pSp) {
      a.s = low; a.flash = 0.25; st.nSpont++;
      const th = r() * Math.PI * 2; emit(st, a, Math.cos(th), Math.sin(th), null);
    }
  }
  // fotonlar
  const ds = C_SIM * dt, keep = [], born = [];
  for (const p of st.ph) {
    p.x += p.dx * ds; p.y += p.dy * ds;
    if (p.y < 0 || p.y > ROD.H) continue;               // yon devordan chiqib ketdi
    if (p.x < 0) { p.x = -p.x; reflect(p); } // chap ko'zgu: 100 %
    if (p.x > ROD.L) {
      if (r() < st.R) { p.x = 2 * ROD.L - p.x; reflect(p); }
      else { st.nOut++; if (Math.abs(p.dy) < 0.1) st.nBeam++; if (st.out.length < 260) st.out.push({ y: p.y, dy: p.dy, d: 0, id: p.id, ph: p.ph }); continue; }
    }
    const i = Math.floor(p.x / cw), j = Math.floor(p.y / ch), k = j * ROD.nx + i;
    if (i >= 0 && i < ROD.nx && j >= 0 && j < ROD.ny && k !== p.last) {
      p.last = k; const a = st.atoms[k];
      if (Math.abs(p.y - a.y) < ch / 2 && r() < P_INT) {
        if (a.s === "U") { a.s = low; a.flash = 0.25; st.nStim++; const n = { x: p.x, y: clampY(p.y + (r() - 0.5) * ch * 0.5, j, ch), dx: p.dx, dy: p.dy, last: k, id: p.id, ph: p.ph }; born.push(n); }
        else if (a.s === absorberOf(st)) { a.s = "U"; st.nAbs++; continue; }
      }
    }
    keep.push(p);
  }
  for (const n of born) if (keep.length < MAXP) keep.push(n);
  st.ph = keep;
  for (const o of st.out) o.d += ds;
  st.out = st.out.filter((o) => o.d < 0.6);
  st.t += dt;
  return st;
}
/** Botiq (sferik) ko'zgu nurni o'qqa yaqinlashtiradi — barqaror rezonator */
function reflect(p) { p.dy *= MIRROR_FOCUS; p.dx = -Math.sign(p.dx) * Math.sqrt(1 - p.dy * p.dy); p.last = -1; }
const clampY = (y, j, ch) => Math.min((j + 1) * ch - 1e-4, Math.max(j * ch + 1e-4, y));

/** Sathlar bo'yicha atomlar soni */
export function counts(st) {
  const n = { G: 0, P: 0, U: 0, L: 0 }; for (const a of st.atoms) n[a.s]++;
  const lower = st.scheme === 4 ? n.L : n.G;
  return { ...n, N: st.atoms.length, upper: n.U, lower, inversion: n.U > lower };
}
/** O'q bo'ylab harakatlanayotgan fotonlar soni (|dy| < 0.1) */
export const axial = (st) => st.ph.reduce((s, p) => s + (Math.abs(p.dy) < 0.1 ? 1 : 0), 0);

/** Nasossiz (lazer nurlanishisiz) statsionar holat: yuqori sath ulushi n_U = Wτ/(1 + Wτ) (3 sathli),
 *  inversiya sharti (3 sathli): n_U > 1/2 ⇒ Wτ > 1. 4 sathlida pastki sath deyarli bo'sh — har qanday Wτ da inversiya. */
export const upperFraction = (W, tau) => (W * tau) / (1 + W * tau);
export const inversionPump3 = (tau) => 1 / tau;
