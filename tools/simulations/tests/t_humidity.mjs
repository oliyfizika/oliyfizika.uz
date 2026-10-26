// Havo namligi fizikasini tekshirish: node tools/simulations/tests/t_humidity.mjs
import * as P from "../../../assets/js/simulations/humidity-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. To'yingan bug' (jadval qiymatlari: 0 °C 611 Pa, 20 °C 2,34 kPa, 100 °C 101,3 kPa; ρₛ(20 °C) = 17,3 g/m³)
ok(near(P.pSat(0), 611, 1), `pₛ(0 °C) = ${P.pSat(0).toFixed(0)} Pa`);
ok(near(P.pSat(20), 2339, 3), `pₛ(20 °C) = ${P.pSat(20).toFixed(0)} Pa (jadvalda 2339)`);
ok(near(P.pSat(30), 4246, 10), `pₛ(30 °C) = ${P.pSat(30).toFixed(0)} Pa (jadvalda 4246)`);
ok(near(P.pSat(100), 101325, 300), `pₛ(100 °C) = ${(P.pSat(100) / 1000).toFixed(1)} kPa — normal bosimda qaynaydi`);
ok(near(P.rhoSat(20), 17.3, 0.05) && near(P.rhoSat(10), 9.4, 0.05) && near(P.rhoSat(0), 4.85, 0.05), `ρₛ: 0 °C ${P.rhoSat(0).toFixed(2)}, 10 °C ${P.rhoSat(10).toFixed(2)}, 20 °C ${P.rhoSat(20).toFixed(2)} g/m³`);
ok(P.pSatIce(-10) < P.pSatWater(-10) && near(P.pSat(-10), 260, 2), `−10 °C: muz ustida ${P.pSatIce(-10).toFixed(0)} Pa < o‘ta sovigan suv ustida ${P.pSatWater(-10).toFixed(0)} Pa`);
{ let mono = true; for (let t = -30; t < 60; t += 0.5) if (P.pSat(t + 0.5) <= P.pSat(t)) mono = false; ok(mono, "pₛ(t) temperatura bilan monoton o‘sadi"); }

// 2. Nisbiy namlik va shudring nuqtasi
{ const p = 0.5 * P.pSat(20); ok(near(P.phiOf(p, 20), 0.5, 1e-12), "φ = p/pₛ"); ok(near(P.dewPoint(p), 9.3, 0.1), `20 °C, φ = 50 % → t_d = ${P.dewPoint(p).toFixed(2)} °C (jadvalda 9,3)`); }
for (const t of [-15, -3, 4, 17, 35]) ok(near(P.dewPoint(P.pSat(t)), t, 1e-9), `shudring nuqtasi teskari funksiya: t_d(pₛ(${t})) = ${t}`);
ok(near(P.rhoOf(P.pOf(12.3, 25), 25), 12.3, 1e-12), "ρ ↔ p o‘tkazish");

// 3. Yopiq hajm: suv miqdori saqlanadi
{ const s = P.airState(25, 10); ok(s.cond === 0 && near(s.phi, 10 / P.rhoSat(25), 1e-12), `25 °C, 10 g/m³: φ = ${(s.phi * 100).toFixed(1)} %, tomchi yo‘q`);
  const c = P.airState(5, 10); ok(near(c.rho, P.rhoSat(5), 1e-12) && near(c.cond, 10 - P.rhoSat(5), 1e-12) && near(c.phi, 1, 1e-12), `5 °C gacha sovitilsa: ρ = ρₛ = ${c.rho.toFixed(2)}, ${c.cond.toFixed(2)} g/m³ tomchiga aylanadi`);
  ok(near(P.airState(25, 10).td, P.airState(25.0, 10).td, 1e-12) && P.airState(5, 10).td < P.airState(25, 10).td, "kondensatsiyadan keyin shudring nuqtasi pasayadi"); }

// 4. Psixrometr
{ const tw = P.wetBulb(20, 0.5); ok(tw < 20 && near(P.phiFromPsy(20, tw), 0.5, 1e-9), `20 °C, φ = 50 %: ho‘l termometr ${tw.toFixed(2)} °C, teskari hisob mos`);
  ok(near(20 - tw, 6.1, 0.4), `Δt = ${(20 - tw).toFixed(2)} °C (psixrometrik jadvalda ≈ 6 °C)`); }
ok(near(P.wetBulb(22, 1), 22, 1e-6), "φ = 100 % da termometrlar bir xil ko‘rsatadi");
ok(P.wetBulb(30, 0.3) < P.wetBulb(30, 0.6), "havo qancha quruq bo‘lsa, ho‘l termometr shuncha ko‘p soviydi");
{ const T = P.psyTable([20], [0, 1, 2, 3, 4, 5, 6]); const row = T[0]; ok(row[0] === 100 && row[1] >= 90 && row[1] <= 92 && row[3] >= 72 && row[3] <= 75 && row[6] >= 49 && row[6] <= 52, `jadval qatori t = 20 °C: ${row.join(", ")} % (darslik jadvali: 100, 91, 83, 74, 66, 58, 51)`); }

// 5. Atmosfera
ok(near(P.dayTemp(5, 8, 22), 8, 1e-9) && near(P.dayTemp(15, 8, 22), 22, 1e-9) && near(P.dayTemp(29, 8, 22), 8, 1e-9), "sutkalik temperatura: min 5:00, max 15:00, 24 soat davriy");
{ let cont = true; for (let h = 0; h < 24; h += 0.01) if (Math.abs(P.dayTemp(h + 0.01, 8, 22) - P.dayTemp(h, 8, 22)) > 0.05) cont = false; ok(cont, "sutkalik egri chiziq uzluksiz"); }
ok(near(P.cloudBase(20, 12), 976, 5), `bulut asosi: t − t_d = 8 °C → h ≈ ${P.cloudBase(20, 12).toFixed(0)} m (≈ 122 m/°C)`);
{ const Wt = P.rhoSat(10); const night = P.phenomenon(6, Wt, false), day = P.phenomenon(20, Wt, false), windy = P.phenomenon(6, Wt, true), cold = P.phenomenon(-4, P.rhoSat(-2), true);
  ok(night.dew && night.fog && !day.dew && !day.fog, "shamolsiz kechada shudring va tuman, kunduzi — yo‘q");
  ok(windy.dew && !windy.fog, "shamolda tuman tarqaladi, shudring qoladi");
  ok(cold.frost && !cold.dew, "t < 0 da shudring o‘rniga qirov"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
