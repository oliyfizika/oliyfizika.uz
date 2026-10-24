// Yadro fizikasini tekshirish: node tools/simulations/tests/t_nuclear.mjs
import * as P from "../../../assets/js/simulations/nuclear-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// 1. Yemirilish qonuni
ok(near(P.remaining(1000, 5730, 5730), 500) && near(P.remaining(1000, 3 * 5730, 5730), 125), "N(T½) = N₀/2, N(3T½) = N₀/8");
ok(near(P.lambdaOf(8.02), Math.LN2 / 8.02), "λ = ln2/T½");
ok(near(P.age(0.25, 5730), 11460), "¹⁴C: 25 % qolsa — yosh 2·5730 = 11 460 yil");
{ // Monte-Karlo: 20 000 yadro, bitta T½ dan keyin ≈ yarmi (3σ ichida)
  const s = P.createSample(20000, 3); for (let k = 0; k < 100; k++) s.step(0.01, 1);
  const sig = Math.sqrt(20000 * 0.25); ok(Math.abs(s.N - 10000) < 3 * sig, `Monte-Karlo: T½ dan keyin N = ${s.N} (kutilgan 10000 ± ${Math.round(3 * sig)})`);
  for (let k = 0; k < 200; k++) s.step(0.01, 1); ok(Math.abs(s.N - 2500) < 3 * Math.sqrt(20000 * 0.125 * 0.875), `3T½ dan keyin N = ${s.N} (≈ 2500)`);
}
{ // EKK bilan T½ ni topish
  const s = P.createSample(4000, 5), pts = [{ t: 0, N: 4000 }]; for (let k = 1; k <= 40; k++) { s.step(0.1, 2); pts.push({ t: s.t, N: s.N }); }
  const T = P.fitHalfLife(pts); ok(Math.abs(T - 2) < 0.1, `o'lchovdan T½ = ${T.toFixed(3)} (haqiqiy 2)`);
  const exact = Array.from({ length: 10 }, (_, i) => ({ t: i, N: P.remaining(100, i, 3) })); ok(near(P.fitHalfLife(exact), 3, 1e-9), "aniq egri chiziqdan EKK T½ = 3");
}
{ const a = P.createSample(50, 9), b = P.createSample(50, 9); a.step(0.5, 1); b.step(0.5, 1); ok(a.N === b.N, "bir xil urug' — bir xil natija (takrorlanadi)"); }

// 2. Bog'lanish energiyasi
const BA = (Z, A) => P.binding(Z, A).B / A;
ok(near(BA(2, 4), 7.074, 1e-3) && near(BA(26, 56), 8.790, 1e-3) && near(BA(92, 238), 7.570, 1e-3), "E_b/A: ⁴He 7,07; ⁵⁶Fe 8,79; ²³⁸U 7,57 MeV");
{ let best = null; for (const k of Object.keys(P.B_REAL)) { const [Z, A] = k.split("-").map(Number); const v = P.B_REAL[k] / A; if (!best || v > best.v) best = { k, v }; }
  ok(best.k === "28-62" || best.k === "26-56", `eng katta E_b/A: ${best.k} (${best.v.toFixed(3)} MeV)`); }
for (const [Z, A] of [[8, 16], [20, 40], [26, 56], [56, 141], [92, 235], [92, 238]]) {
  const e = Math.abs(P.semf(Z, A) - P.B_REAL[`${Z}-${A}`]) / P.B_REAL[`${Z}-${A}`];
  ok(e < 0.02, `Bete–Vaytszekker ${Z}-${A}: xato ${(e * 100).toFixed(2)} % (< 2 %)`);
}
ok(near(P.massDefect(28.2957), 0.030377, 1e-4), "⁴He massa defekti Δm = 0,0304 u");
{ const m = P.nucleusMass(2, 4, 28.2957) + 2 * P.ME; ok(Math.abs(m - 4.002602) < 2e-5, `⁴He atom massasi ${m.toFixed(6)} u (jadval 4,002602)`); }
ok(near(P.reactionQ(...[P.REACTIONS.dt.inp, P.REACTIONS.dt.out]), 17.59, 1e-3), `D + T: Q = ${P.reactionQ(P.REACTIONS.dt.inp, P.REACTIONS.dt.out).toFixed(2)} MeV (17,59)`);
ok(near(P.reactionQ(P.REACTIONS.dd.inp, P.REACTIONS.dd.out), 3.27, 3e-3), `D + D → ³He + n: Q = ${P.reactionQ(P.REACTIONS.dd.inp, P.REACTIONS.dd.out).toFixed(2)} MeV (3,27)`);
{ const Q = P.reactionQ(P.REACTIONS.u235.inp, P.REACTIONS.u235.out); ok(Q > 165 && Q < 180, `²³⁵U bo'linishi: Q = ${Q.toFixed(1)} MeV (≈ 173)`); }

// Barqarorlik
ok(P.stability(6, 12).stable && P.stability(2, 4).stable && P.stability(26, 56).stable, "¹²C, ⁴He, ⁵⁶Fe — barqaror");
ok(P.stability(6, 14).decay === "β⁻" && P.stability(1, 3).decay === "β⁻", "¹⁴C, ³H — β⁻");
ok(P.stability(6, 11).decay === "β⁺" && P.stability(8, 15).decay === "β⁺", "¹¹C, ¹⁵O — β⁺ (protonlar ortiqcha)");
ok(P.stability(4, 8).decay === "α", "⁸Be — ikkita α ga ajraladi");
ok(P.stability(0, 1).decay === "β⁻" && !P.stability(19, 40).stable, "erkin neytron — β⁻; ⁴⁰K — radioaktiv");

// 3. Zanjir reaksiya: k parametrlarga to'g'ri bog'liq
const base = { w: 24, h: 14, cols: 24, rows: 14, rods: [] };
const k1 = P.measureK({ ...base, enrich: 1 }, 600), k02 = P.measureK({ ...base, enrich: 0.2 }, 600);
ok(k1 > 1.3 && k02 < 0.9, `boyitish: 100 % — k = ${k1.toFixed(2)} (> 1), 20 % — k = ${k02.toFixed(2)} (< 1)`);
const ksmall = P.measureK({ w: 6, h: 4, cols: 6, rows: 4, rods: [], enrich: 1 }, 600);
ok(ksmall < k1, `kichik zonada neytronlar ko'proq chiqib ketadi: k = ${ksmall.toFixed(2)} < ${k1.toFixed(2)}`);
const rods = [4, 8, 12, 16, 20].map((x) => ({ x, depth: 1 }));
const kr = P.measureK({ ...base, enrich: 1, rods }, 600);
ok(kr < 0.95, `sterjenlar to'liq tushirilgan: k = ${kr.toFixed(2)} < 1`);
{ const c = P.createCore({ ...base, enrich: 1, seed: 2 }); for (let k = 0; k < 10; k++) c.inject(12, 7, k * 0.6); let n0 = 0;
  for (let i = 0; i < 600; i++) c.step(1 / 60); n0 = c.stats.fissions;
  const L = c.stats.lost; ok(c.stats.born === L.leak + L.rod + L.cap + c.neutrons.length + c.stats.fissions, `neytronlar balansi: tug'ilgan = yo'qolgan + mavjud + bo'linishga sarflangan (${c.stats.born})`);
  ok(n0 > 20, `o'ta kritik zona: 10 s da ${n0} ta bo'linish`); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to'g'ri");
process.exit(fail ? 1 : 0);
