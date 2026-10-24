// Bosim, Paskal qonuni va suyuqlik bosimi fizikasini tekshirish: node tools/simulations/tests/t_pressure.mjs
import * as P from "../../../assets/js/simulations/pressure-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Qattiq jism
{ const F = P.weightN(P.BRICK.m), pf = P.pressure(F, P.FACES.flat.S), pe = P.pressure(F, P.FACES.end.S);
  ok(near(pf, 34.335 / 0.03, 1e-6) && Math.round(pf) === 1145, `g‘isht yassi: p = mg/S = 34,3 N / 300 cm² = ${pf.toFixed(0)} Pa`);
  ok(near(pe / pf, P.FACES.flat.S / P.FACES.end.S), `tik qo‘yilganda bosim ${ (pe / pf).toFixed(2) } marta katta (yuzalar nisbati)`); }
{ const pb = P.pressure(P.weightN(60), P.OBJECTS.boots.S), ps = P.pressure(P.weightN(60), P.OBJECTS.skis.S);
  ok(pb > 9000 && ps < 2000 && near(pb / ps, P.OBJECTS.skis.S / P.OBJECTS.boots.S), `etik ${pb.toFixed(0)} Pa, chang‘i ${ps.toFixed(0)} Pa — qorga botmaydi`); }
ok(near(P.pressure(1, P.OBJECTS.needle.S), 1e8), "igna: 1 N / 0,01 mm² = 10⁸ Pa");
{ const pt = P.pressure(P.weightN(6000), P.OBJECTS.tractor.S); ok(near(pt, 24525) && pt / P.pressure(P.weightN(60), P.OBJECTS.boots.S) < 3, `6 t traktor zanjiri: ${pt.toFixed(0)} Pa — massasi 100 marta katta, bosimi esa odamnikidan atigi 2,5 marta`); }

// 2. Gidravlik press
ok(near(P.pressForce(100, 2e-4, 0.02), 10000), "F₂ = F₁·S₂/S₁: 100 N, S₂/S₁ = 100 → 10 000 N");
ok(near(P.pressLift(0.1, 2e-4, 0.02), 0.001), "kichik porshen 10 cm tushsa, kattasi 1 mm ko‘tariladi");
{ const F1 = 100, S1 = 2e-4, S2 = 0.02, s1 = 0.1; ok(near(F1 * s1, P.pressForce(F1, S1, S2) * P.pressLift(s1, S1, S2)), "ishda yutuq yo‘q: F₁s₁ = F₂s₂"); }
ok(near(P.forceToLift(1200, 4e-4, 0.04), 1200 * 9.81 / 100), "1200 kg avtomobil, S₂/S₁ = 100: kichik porshenga 118 N");
ok(near(P.pistonPressure(50, 1e-3), 50000) && near(P.jetSpeed(50000), 10), "Paskal shari: 50 kPa ortiqcha bosim — barcha teshiklardan 10 m/s");

// 3. Suyuqlik bosimi
ok(near(P.hydro(1000, 10), 98100) && near(P.hydro(1000, 10, true), 199425), "10 m suv ustuni ≈ 98 kPa ≈ 1 atm; atmosfera bilan 199 kPa");
ok(near(P.hydro(13600, 0.76), 101396, 1e-3), "76 cm simob ustuni ≈ atmosfera bosimi (101,4 kPa)");
ok(near(P.hydro(800, 0.5) / P.hydro(1000, 0.5), 0.8), "bir xil chuqurlikda bosim zichlikka proporsional");
ok(near(P.bottomForce(1000, 0.3, 0.01), P.hydro(1000, 0.3) * 0.01), "tubga bosim kuchi F = ρghS — idish shakliga bog‘liq emas");
{ const u = P.uTube(1000, 930, 0.1); ok(near(930 * 0.1, 1000 * u.dWater), "U-nay: moy va suv ustunlari ρ₁h₁ = ρ₂h₂");
  ok(near(u.dTop, 0.1 * (1 - 0.93)) && u.dTop > 0, `moy sathi suvdan ${(u.dTop * 100).toFixed(1)} cm baland`); }
{ const u = P.uTube(1000, 1000, 0.1); ok(near(u.dTop, 0), "bir xil suyuqlik — sathlar teng (tutash idishlar)"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
