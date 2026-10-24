// Massa, zichlik va suzish fizikasini tekshirish: node tools/simulations/tests/t_density.mjs
import * as P from "../../../assets/js/simulations/density-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Zichlik va jadval
ok(near(P.density(89, 10), 8.9) && P.identify(8.9).key === "copper", "ρ = m/V: 89 g / 10 cm³ = 8,9 g/cm³ → mis");
ok(P.identify(2.68).key === "alu" && P.identify(11.0).key === "lead" && P.identify(0.52).key === "wood", "o‘lchangan ρ bo‘yicha modda aniqlanadi (2,68 → alyuminiy, 11,0 → qo‘rg‘oshin)");
ok(near(P.toKgM3(2.7), 2700), "2,7 g/cm³ = 2700 kg/m³");
ok(near(P.readCylinder(137.3), 138) && near(P.readCylinder(136.9), 136), "menzurka shkalasi bo‘limi 2 mL");

// 2. Tarozi
ok(P.balanceAngle(0) === 0 && P.balanceAngle(0.04) === 0, "farq sezgirlikdan (50 mg) kichik — tarozi muvozanatda");
ok(P.balanceAngle(5) < 0 && P.balanceAngle(-5) > 0 && P.balanceAngle(1000) === -0.22, "og‘irroq palla pastga tushadi, katta farqda tirgakkacha");
ok(near(P.sumWeights([20, 10, 1, 0.2]), 31.2), "toshlar yig‘indisi: 20 + 10 + 1 + 0,2 = 31,2 g");
{ let all = true; for (const m of [89, 54, 31.2, 137.5, 0.1, 199.9, 24.3]) { const g = P.greedyWeights(m); if (Math.abs(g.rest) > 1e-9 || !near(P.sumWeights(g.out), m)) all = false; } ok(all, "gira to‘plami 0,1 g aniqlikda 0,1…211 g gacha istalgan massani beradi"); }
ok(near(P.sumWeights(P.WEIGHTS), 211), "to‘plamdagi barcha toshlar: 211 g");

// 3. Arximed kuchi
{ const A = 4, H = 5, m = 2.7 * A * H; // alyuminiy brusok 20 cm³
  const b = P.buoyancy({ A, H, rhoL: 1, d: H }); ok(near(b.Vsub, 20) && near(b.FA, 0.02 * 9.81), "to‘liq botgan 20 cm³ jism: F_A = ρgV = 0,196 N");
  ok(near(P.springReading({ m, A, H, rhoL: 1, d: 0 }), P.weight(m)) && near(P.springReading({ m, A, H, rhoL: 1, d: H }), P.weight(m) - b.FA), "dinamometr: havoda P, suvda P − F_A");
  ok(near(P.springReading({ m, A, H, rhoL: 1, d: 10 }), P.springReading({ m, A, H, rhoL: 1, d: H })), "to‘liq botgandan keyin chuqurlikka bog‘liq emas");
  ok(P.springReading({ m, A, H, rhoL: 0.8, d: H }) > P.springReading({ m, A, H, rhoL: 1, d: H }), "kerosinda Arximed kuchi kichikroq — dinamometr ko‘proq ko‘rsatadi"); }

// 4. Suzish
{ const A = 16, H = 4; // 4×4×4 cm kub
  const mw = 0.5 * A * H, d = P.floatDepth({ m: mw, A, H, rhoL: 1 }); ok(near(d / H, 0.5), "yog‘och (0,5) suvda yarmigacha botib suzadi");
  const mi = 0.9 * A * H; ok(near(P.floatDepth({ m: mi, A, H, rhoL: 1 }) / H, 0.9), "muz suvda 90 % botadi (aysberg)");
  ok(P.floatDepth({ m: 2.7 * A * H, A, H, rhoL: 1 }) === null, "alyuminiy cho‘kadi");
  ok(near(P.buoyancy({ A, H, rhoL: 1, d: P.floatDepth({ m: mw, A, H, rhoL: 1 }) }).FA, P.weight(mw)), "suzayotgan jismda F_A = mg");
  ok(!P.floats(1.05, 1.0) && P.floats(1.05, 1.2), "tuxum chuchuk suvda cho‘kadi, sho‘r suvda suzadi");
  ok(P.floats(7.8, 13.6), "po‘lat simobda suzadi"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
