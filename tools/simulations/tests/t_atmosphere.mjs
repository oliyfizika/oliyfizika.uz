// Atmosfera bosimi fizikasini tekshirish: node tools/simulations/tests/t_atmosphere.mjs
import * as P from "../../../assets/js/simulations/atmosphere-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. Torichelli
ok(near(P.columnHeight(P.P0, P.LIQUIDS.hg.rho) * 1000, 760, 0.5), `simob ustuni ${(P.columnHeight(P.P0, P.LIQUIDS.hg.rho) * 1000).toFixed(1)} mm`);
ok(near(P.columnHeight(P.P0, P.LIQUIDS.water.rho), 10.33, 0.01), `suv ustuni (Paskal) ${P.columnHeight(P.P0, P.LIQUIDS.water.rho).toFixed(2)} m`);
ok(near(760 * P.MMHG, P.P0, 1), "760 mm sim. ust. = 101 325 Pa");
{ const a = 40 * Math.PI / 180, t = P.tube(P.P0, P.LIQUIDS.hg.rho, 1, a);
  ok(!t.full && near(t.hv, 0.76, 0.001) && near(t.len, t.h / Math.cos(a), 1e-12), `nay 40° qiya: vertikal ${(t.hv * 1000).toFixed(0)} mm o‘zgarmaydi, nay bo‘ylab ${(t.len * 1000).toFixed(0)} mm`);
  const f = P.tube(P.P0, P.LIQUIDS.hg.rho, 1, 45 * Math.PI / 180 + 0.3);
  ok(f.full && f.pTop > 0, `nay juda qiya (tepasi ${(f.hv * 1000).toFixed(0)} mm < 760 mm): bo‘shliq yo‘qoladi, nay tepasiga ${(f.pTop / P.MMHG).toFixed(0)} mm sim. ust. bosim beradi`); }

// 2. Standart atmosfera
ok(near(P.isa(0).p, P.P0, 1e-6) && near(P.isa(0).rho, 1.225, 0.001), `h = 0: p = 101 325 Pa, ρ = ${P.isa(0).rho.toFixed(3)} kg/m³`);
ok(near(P.isa(1000).p, 89875, 30), `1 km: ${(P.isa(1000).p / 1000).toFixed(2)} kPa (jadvalda 89,88)`);
ok(near(P.isa(5000).p, 54020, 60), `5 km: ${(P.isa(5000).p / 1000).toFixed(2)} kPa (jadvalda 54,02)`);
ok(near(P.isa(8849).p, 31400, 600), `Everest 8849 m: ${(P.isa(8849).p / 1000).toFixed(1)} kPa (≈ 1/3 atm)`);
ok(near(P.isa(11000).p, 22632, 30) && near(P.isa(11000).T, 216.65, 0.01), `11 km: ${(P.isa(11000).p / 1000).toFixed(2)} kPa, ${(P.isa(11000).T - 273.15).toFixed(1)} °C`);
ok(near(P.isa(15000).p, 12045, 30), `15 km (izotermik qatlam): ${(P.isa(15000).p / 1000).toFixed(2)} kPa (jadvalda 12,04)`);
{ let mono = true; for (let h = 0; h < 15000; h += 50) if (P.isa(h + 50).p >= P.isa(h).p) mono = false; ok(mono, "bosim balandlik bilan monoton kamayadi"); }
ok(near(P.altitudeOf(P.isa(3456).p), 3456, 0.01), "balandlik ↔ bosim teskari funksiya");
ok(near(P.metersPerMmHg(), 11.1, 0.2), `Yer yaqinida 1 mm sim. ust. ≈ ${P.metersPerMmHg().toFixed(1)} m (darslikda ≈ 12 m)`);

// 3. Qaynash temperaturasi
ok(near(P.boilingPoint(P.P0), 100, 0.05), `dengiz sathida suv ${P.boilingPoint(P.P0).toFixed(2)} °C da qaynaydi`);
ok(near(P.boilingPoint(P.isa(8849).p), 70.5, 1.2), `Everestda ${P.boilingPoint(P.isa(8849).p).toFixed(1)} °C da qaynaydi (≈ 70 °C)`);
ok(near(P.bagRatio(P.isa(3000).p), 1.43, 0.02), `germetik paket 3000 m da ${P.bagRatio(P.isa(3000).p).toFixed(2)} marta kattalashadi`);

// 4. Magdeburg yarim sharlari
{ const Rd = 0.255, F = P.pullForce(0, Rd);
  ok(near(F / 1000, 20.7, 0.1), `d = 51 cm, to‘liq vakuum: F = ${(F / 1000).toFixed(1)} kN (≈ 2 t og‘irlik)`);
  ok(near(P.pullForce(0, 0.05), 796, 1), `d = 10 cm: F = ${P.pullForce(0, 0.05).toFixed(0)} N`);
  ok(P.pullForce(P.P0, Rd) === 0, "ichida havo bo‘lsa (jo‘mrak ochiq) kuch kerak emas");
  const V = P.sphereVolume(Rd), Vp = V / 20;
  ok(near(P.pumped(1, V, Vp), P.P0 * 20 / 21, 1e-6), "bir yurish: p = p₀·V/(V + Vn) (Boyl–Mariott)");
  ok(near(P.pumped(400, V, Vp, P.P0, 0.1 * P.P0), 0.1 * P.P0, 1), "ko‘p yurishdan keyin nasos chegarasiga yaqinlashadi");
  let mono = true; for (let n = 0; n < 50; n++) if (P.pumped(n + 1, V, Vp) >= P.pumped(n, V, Vp)) mono = false; ok(mono, "har yurishda bosim kamayadi"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
