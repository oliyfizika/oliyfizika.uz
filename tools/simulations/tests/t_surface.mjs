// Sirt tarangligi va kapillyarlik fizikasini tekshirish: node tools/simulations/tests/t_surface.mjs
import * as P from "../../../assets/js/simulations/surface-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Sirt taranglik kuchi va ish
ok(near(P.filmForce(0.04, 0.05), 0.004), "sovun pardasi: F = 2σL = 2 · 0,04 · 0,05 = 4 mN");
ok(near(P.filmWork(0.04, 0.05, 0.04), 2 * P.filmWork(0.04, 0.05, 0.02)), "kuch o‘zgarmas — ish siljishga proporsional (prujinadan farqli, parda cho‘zilganda kuch ortmaydi)");
ok(near(P.filmWork(0.04, 0.05, 0.02), P.filmForce(0.04, 0.05) * 0.02) && near(P.filmWork(0.04, 0.05, 0.02), P.surfaceEnergy(0.04, 2 * 0.05 * 0.02)), "A = FΔx = σΔS (ΔS = 2LΔx) — sirt energiyasi ortadi");
ok(P.sigmaAt("water", 80) < P.sigmaAt("water", 20) && near(P.sigmaAt("water", 80), 0.0728 - 60 * 1.5e-4), "qizdirilganda σ kamayadi: suv 80 °C da 63,8 mN/m");

// 2. Kapillyarlik
{ const h = P.capillaryH(0.0728, 1000, 0.5e-3); ok(near(h * 1000, 29.68, 1e-3), `suv, r = 0,5 mm: h = 2σ/(ρgr) = ${(h * 1000).toFixed(1)} mm`); }
ok(near(P.capillaryH(0.0728, 1000, 0.25e-3), 2 * P.capillaryH(0.0728, 1000, 0.5e-3)), "nay 2 marta ingichka — suv 2 marta baland ko‘tariladi (h ∝ 1/r)");
{ const L = P.LIQUIDS.mercury, h = P.capillaryH(L.sigma, L.rho, 0.5e-3, L.theta); ok(h < 0 && Math.abs(Math.abs(h * 1000) - 10.7) < 0.2, `simob ho‘llamaydi (θ = 140°): sath ${(h * 1000).toFixed(1)} mm ga pasayadi`); }
ok(P.wets(0) && !P.wets(140 * P.DEG), "ho‘llash sharti θ < 90°");
ok(near(P.slitH(0.0728, 1000, 0.5e-3), P.capillaryH(0.0728, 1000, 0.5e-3)), "plastinalar orasida (d) h = 2σ/(ρgd)");
ok(P.capillaryH(0.022, 790, 0.5e-3) < P.capillaryH(0.0728, 1000, 0.5e-3), "spirt suvdan pastroq ko‘tariladi");

// 3. Tomchilar usuli
{ const m = P.dropMass(0.0728, 2e-3); ok(Math.abs(m * 1e6 - 46.6) < 0.1, `suv tomchisi (d = 2 mm): m = πdσ/g = ${(m * 1e6).toFixed(1)} mg`);
  ok(near(P.sigmaFromDrops(50 * m, 50, 2e-3), 0.0728), "50 tomchi massasidan σ = Mg/(πdN) qaytariladi");
  ok(P.dropMass(0.022, 2e-3) < m, "spirt tomchilari mayda — bir xil hajmda ko‘proq tomchi"); }
ok(near(P.dropRadius(4 / 3 * Math.PI * 1e-9 * 1000, 1000), 1e-3), "tomchi radiusi hajmidan (1 mm)");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
