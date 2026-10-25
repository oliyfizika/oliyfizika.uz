// Kulon qonuni va elektr maydon fizikasini tekshirish: node tools/simulations/tests/t_coulomb.mjs
import * as P from "../../../assets/js/simulations/coulomb-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));
const nC = P.NC, cm = 0.01;

// 1. Kulon qonuni
ok(near(P.coulomb(1e-6, 1e-6, 1), 8.98755e-3, 1e-5), "1 μC va 1 μC, 1 m: F = 8,99 mN");
ok(near(P.coulomb(4e-6, 2e-6, 0.1) / P.coulomb(4e-6, 2e-6, 0.2), 4), "masofa 2 marta ortsa — kuch 4 marta kamayadi");
ok(P.coulomb(2e-9, -3e-9, 0.05) < 0 && P.coulomb(-2e-9, -3e-9, 0.05) > 0, "ishora: har xil — tortishish (F < 0), bir xil — itarilish");
ok(near(P.coulomb(1e-6, 1e-6, 0.1, P.MEDIA.water.eps), P.coulomb(1e-6, 1e-6, 0.1) / 81), "suvda kuch 81 marta kichik");
ok(near(P.fieldPoint(10 * nC, 5 * cm), 35950, 1e-3), "10 nC zaryad maydoni 5 cm da E = kq/r² = 36 kN/C");
ok(near(P.maxCharge(5e-3) / nC, 8.345, 1e-3), "r = 5 mm sharchada eng ko‘pi bilan ≈ 8,3 nC (E = 3 MV/m)");
ok(near(P.maxCharge(0.1) * 1e6, 3.338, 1e-3), "Van de Graaf (R = 10 cm): Q_max ≈ 3,3 μC");

// 2. Osma sharcha muvozanati
{
  const o = { L: 0.15, D: 0.05, m: 0.1e-3, r: 5e-3, q1: 6 * nC, q2: 6 * nC, eps: 1 };
  const eq = P.equilibrium(o);
  ok(eq.a < 0 && !eq.contact, `itarilish: sharcha uzoqlashadi (α = ${(eq.a / P.DEG).toFixed(2)}°)`);
  // muvozanatda ipga perpendikulyar kuchlar yig'indisi nolga teng: mg·sinα = F·(r̂ · t̂)
  const b = P.bobPos(o.L, eq.a), dx = b.x - o.D, dy = b.y - o.L, d = Math.hypot(dx, dy), F = P.coulomb(o.q1, o.q2, d);
  const tx = Math.cos(eq.a), ty = -Math.sin(eq.a); // α ortadigan yo'nalish
  const torque = (F * (dx * tx + dy * ty)) / d - o.m * P.G * Math.sin(eq.a);
  ok(Math.abs(torque) < 1e-3 * o.m * P.G, `muvozanatda urinma kuchlar yig‘indisi ≈ 0 (${torque.toExponential(1)} N)`);
  ok(near(d, eq.d, 1e-9) && d > o.D, `markazlar orasi ${(d * 100).toFixed(2)} cm > 5 cm`);
  const Fm = P.measuredForce(o.m, eq.a), err = Math.abs(Fm - F) / F;
  ok(err < 0.03, `mg·tg α Kulon kuchidan ${(err * 100).toFixed(2)} % farq qiladi (kuch to‘liq gorizontal emas)`);
  const heavy = P.equilibrium({ ...o, m: 0.3e-3 });
  ok(Math.abs(heavy.a) < Math.abs(eq.a), "og‘irroq sharcha kamroq og‘adi");
  const att = P.equilibrium({ ...o, q2: -6 * nC });
  ok(att.contact && att.a > 0 && near(att.d, 2 * o.r), "kuchli tortishishda sharchalar tegadi");
  const weak = P.equilibrium({ ...o, D: 0.08, q1: 1 * nC, q2: -1 * nC });
  ok(!weak.contact && weak.a > 0 && weak.d < 0.08, `kuchsiz tortishishda turg‘un muvozanat (α = ${(weak.a / P.DEG).toFixed(2)}°)`);
  ok(P.equilibrium({ ...o, q2: 0 }).a === 0, "zaryadsiz sharcha — og‘ish yo‘q");
  ok(near(P.gap(o.L, o.D, P.touchAngle(o.L, o.D, 0.01)), 0.01, 1e-6), "tegish burchagi: markazlar orasi 2r");
  ok(P.share(6 * nC, -2 * nC).every((q) => near(q, 2 * nC)), "bir xil sharchalar tekkanda: (q₁ + q₂)/2");
  ok(near(P.tension(o.m, 0), o.m * P.G), "vertikal ipda T = mg");
}

// 3. Superpozitsiya
{
  const two = [{ x: 0, y: 0, q: 5 * nC }, { x: 0.1, y: 0, q: 5 * nC }];
  ok(P.field(two, 0.05, 0).e < 1e-9, "teng zaryadlar o‘rtasida E = 0");
  const z = P.zeroPoint(4 * nC, 1 * nC, 0.12);
  ok(near(z, 0.08) && P.field([{ x: 0, y: 0, q: 4 * nC }, { x: 0.12, y: 0, q: 1 * nC }], z, 0).e < 1e-6, "4q va q orasida E = 0 nuqta 2/3 masofada");
  const dip = [{ x: -0.05, y: 0, q: 10 * nC }, { x: 0.05, y: 0, q: -10 * nC }];
  const f0 = P.field(dip, 0, 0);
  ok(near(f0.ex, 2 * P.fieldPoint(10 * nC, 0.05)) && Math.abs(f0.ey) < 1e-9, "dipol o‘rtasida E = 2kq/a², + dan − ga");
  const fy = P.field(dip, 0, 0.05);
  ok(near(fy.ex, (2 * P.K * 10 * nC * 0.05) / Math.pow(0.05 * Math.SQRT2, 3), 1e-9) && Math.abs(fy.ey) < 1e-6, "dipol o‘qiga perpendikulyar chiziqda E dipol o‘qiga parallel");
  const sum = f0.parts.reduce((s, p) => ({ ex: s.ex + p.ex, ey: s.ey + p.ey }), { ex: 0, ey: 0 });
  ok(near(sum.ex, f0.ex) && near(sum.ey + 1, f0.ey + 1), "natijaviy vektor — qismlar yig‘indisi");
  const tri = [0, 1, 2].map((i) => ({ x: 0.05 * Math.cos((i * 2 * Math.PI) / 3), y: 0.05 * Math.sin((i * 2 * Math.PI) / 3), q: 3 * nC }));
  ok(P.field(tri, 0, 0).e < 1e-6, "teng tomonli uchburchak markazida E = 0 (lekin φ ≠ 0)");
  ok(P.potentialAt(tri, 0, 0) > 0 && near(P.potentialAt(tri, 0, 0), 3 * P.K * 3 * nC / 0.05), "φ — skalyar: φ = Σ kq/r");
  ok(near(P.field(two, 0.2, 0, 4.7).e, P.field(two, 0.2, 0).e / 4.7), "kastor moyida E 4,7 marta kichik");
}

// 4. Zaryadlangan shar
{
  const Q = 100 * nC, R = 0.05;
  ok(P.sphereE(Q, R, 0.02, "shell") === 0, "o‘tkazgich shar ichida E = 0");
  ok(near(P.spherePhi(Q, R, 0.01, "shell"), P.spherePhi(Q, R, R, "shell")), "o‘tkazgich ichida φ = kQ/R (o‘zgarmas)");
  ok(near(P.sphereE(Q, R, 0.1), P.fieldPoint(Q, 0.1)), "tashqarida shar nuqtaviy zaryaddek");
  ok(near(P.sphereE(Q, R, R / 2, "solid"), P.sphereE(Q, R, R, "solid") / 2), "dielektrik shar ichida E ∝ r");
  ok(near(P.spherePhi(Q, R, 0, "solid"), 1.5 * P.spherePhi(Q, R, R, "solid")), "tekis zaryadlangan shar markazida φ = 1,5·kQ/R");
  ok(near(P.surfaceField(Q, R), P.sphereE(Q, R, R), 1e-9), "sirt yonida E = σ/ε₀ = kQ/R²");
  ok(near(P.capacitance(0.09) * 1e12, 10.01, 1e-3), "R = 9 cm shar sig‘imi 10 pF");
  const Rs = 0.1, Qm = P.maxCharge(Rs);
  ok(near(P.sphereE(Qm, Rs, Rs), P.E_BD, 1e-9), "Q_max da sirtdagi maydon 3 MV/m — havo teshiladi");
  ok(near(P.spherePhi(Qm, Rs, Rs) / 1e3, 300, 1e-6), "R = 10 cm shar ≈ 300 kV gacha zaryadlanadi");
}

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
