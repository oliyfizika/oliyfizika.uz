// Metallarda elektr toki fizikasini tekshirish: node tools/simulations/tests/t_metals.mjs
import * as P from "../../../assets/js/simulations/metals-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Dreyf tezligi
{ const v = P.driftSpeed(1, P.METALS.copper.n, 1e-6); ok(Math.abs(v * 1000 - 0.0734) < 0.001, `mis, I = 1 A, S = 1 mm²: v = I/(enS) = ${(v * 1000).toFixed(4)} mm/s`);
  ok(near(P.currentFrom(P.METALS.copper.n, 1e-6, v), 1), "I = enSv — teskari hisob");
  const t = P.travelTime(1, v) / 3600; ok(t > 3 && t < 4, `elektron 1 m ni ≈ ${t.toFixed(1)} soatda bosib o‘tadi`); }
ok(near(P.driftSpeed(2, 8.5e28, 1e-6), 2 * P.driftSpeed(1, 8.5e28, 1e-6)), "v ∝ I");
ok(near(P.driftSpeed(1, 8.5e28, 0.5e-6), 2 * P.driftSpeed(1, 8.5e28, 1e-6)), "ingichka simda (S/2) elektronlar 2 marta tez: v ∝ 1/S");
ok(P.driftSpeed(1, P.METALS.aluminum.n, 1e-6) < P.driftSpeed(1, P.METALS.copper.n, 1e-6), "alyuminiyda n katta — v kichik");
{ const vt = P.thermalSpeed(293); ok(vt > 1.1e5 && vt < 1.2e5, `tartibsiz harakat tezligi √(3kT/m) ≈ ${(vt / 1e5).toFixed(2)}·10⁵ m/s`);
  ok(vt / P.driftSpeed(1, 8.5e28, 1e-6) > 1e9, "tartibsiz harakat tezligi dreyf tezligidan 10⁹ marta katta"); }

// 2. Tok zichligi
ok(near(P.currentDensity(2, 1e-6), 2e6), "j = I/S = 2 A/mm² = 2·10⁶ A/m²");
{ const I = 3, S1 = 2e-6, S2 = 0.5e-6, n = 8.5e28;
  ok(near(P.currentDensity(I, S1) * S1, P.currentDensity(I, S2) * S2), "tarmoqlanmagan simda I = jS hamma kesimda bir xil");
  ok(near(P.currentDensity(I, S2) / P.currentDensity(I, S1), 4) && near(P.driftSpeed(I, n, S2) / P.driftSpeed(I, n, S1), 4), "kesim 4 marta kichik — j va v 4 marta katta"); }

// 3. Qarshilik va temperatura
{ const m = P.METALS.copper; ok(near(P.rhoAt(m, 20), m.rho20), "ρ(20 °C) jadval qiymatiga teng");
  ok(near(P.resistance(m.rho20, 1, 1e-6), 0.017), "mis, l = 1 m, S = 1 mm²: R = ρl/S = 0,017 Ω");
  const R0 = 10, R100 = P.Rt(R0, m.alpha, 100); ok(near(R100, 14.3), `R = R₀(1 + αt): 10 Ω → ${R100.toFixed(1)} Ω (100 °C)`);
  ok(near(P.alphaFrom(P.Rt(R0, m.alpha, 20), 20, P.Rt(R0, m.alpha, 80), 80), m.alpha), "ikki o‘lchashdan α qaytariladi"); }
{ const w = P.METALS.tungsten, r = P.rhoAt(w, 2500) / P.rhoAt(w, 20); ok(r > 10 && r < 14, `cho‘g‘lanma lampa tolasi: R(2500 °C)/R(20 °C) ≈ ${r.toFixed(1)}`); }
ok(P.rhoAt(P.METALS.constantan, 500) / P.rhoAt(P.METALS.constantan, 20) < 1.01, "konstantan qarshiligi deyarli o‘zgarmaydi (etalon rezistorlar)");
ok(P.mercuryR(10, 4.0) === 0 && P.mercuryR(10, 4.3) > 0.012 && P.mercuryR(10, 4.3) < 0.015, "simob: T < 4,15 K da R = 0 (o‘ta o‘tkazuvchanlik), 4,3 K da ≈ 0,013 Ω");
ok(P.mercuryR(10, P.HG_TC) > 0 && P.mercuryR(10, P.HG_TC) < P.mercuryR(10, 4.3), "o‘tish keskin (≈ 0,02 K)");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
