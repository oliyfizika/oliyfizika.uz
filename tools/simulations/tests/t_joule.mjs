// Tok ishi, quvvati va Joul–Lens qonuni fizikasini tekshirish: node tools/simulations/tests/t_joule.mjs
import * as P from "../../../assets/js/simulations/joule-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Joul–Lens
ok(near(P.heat(2, 5, 60), 1200), "Q = I²Rt = 2²·5·60 = 1200 J");
{ const h = P.heaters(12, 0, [4, 8], "series"); ok(near(h.I, 1) && near(h.parts[1].P / h.parts[0].P, 2), "ketma-ket: tok bir xil, Q ∝ R (8 Ω da 2 marta ko‘p)"); }
{ const h = P.heaters(12, 0, [4, 8], "parallel"); ok(near(h.parts[0].P / h.parts[1].P, 2) && near(h.I, 4.5), "parallel: kuchlanish bir xil, Q ∝ 1/R (4 Ω da 2 marta ko‘p)"); }
{ const h = P.heaters(12, 0.5, [5.5], "single"); ok(near(h.I, 2) && near(h.U, 11), "manba ichki qarshiligi: I = E/(R + r), U = IR"); }
{ const C = P.heatCapacity(0.2, 0.05), T = P.tempAt(300, 50, C, 0); ok(near(C, 886) && near(T - 20, 15000 / 886), "issiqliksiz: ΔT = Pt/C = 16,9 K"); }
{ const C = P.heatCapacity(0.2), T1 = P.tempAt(600, 40, C, 0.15), T0 = P.tempAt(600, 40, C, 0); ok(T1 < T0 && T1 > 20 + 0.9 * (T0 - 20), "yo‘qotish bor: kamroq isiydi, lekin 10 % dan kam"); }
{ const C = P.heatCapacity(0.2); let T = 20; for (let i = 0; i < 600; i++) T = P.stepTemp(T, 1, 40, C, 0.15); ok(near(T, P.tempAt(600, 40, C, 0.15), 1e-9), "qadamma-qadam hisob aniq yechim bilan bir xil"); }
{ const C = P.heatCapacity(0.2), Q = 40 * 600, dT = P.tempAt(600, 40, C, 0.15) - 20, eta = P.efficiency(C, dT, Q); ok(eta > 0.9 && eta < 1, `FIK η = cmΔT/(I²Rt) = ${(eta * 100).toFixed(1)} %`); }
ok(near(P.wireR(1, 0.5e-3), 5.60, 1e-3), "nixrom sim l = 1 m, d = 0,5 mm: R ≈ 5,6 Ω");

// 2. Lampa
{ const L = P.LAMPS.l100; ok(near(P.lampI(L, 220) * 220, 100), "nominal kuchlanishda P = 100 W"); ok(near(P.lampU(L, P.lampI(L, 150)), 150), "teskari funksiya to‘g‘ri"); }
{ const L = P.LAMPS.l60; ok(P.lampR(L, 220) > P.lampR(L, 50) && P.lampR(L, 220) / P.coldR(L) > 10, "qizigan tola qarshiligi sovuqdan ~12 marta katta"); ok(near(P.lampR(L, 0.1), P.coldR(L)) && P.lampR(L, 5) >= P.coldR(L), "kichik kuchlanishda R → R_sovuq (nolga tushmaydi)"); ok(near(P.lampU(L, P.lampI(L, 0.2)), 0.2) && near(P.lampU(L, P.lampI(L, 3)), 3), "teskari funksiya sovuq sohada ham to‘g‘ri"); }
{ const L = P.LAMPS.l60, half = P.lampI(L, 110) * 110 / 60; ok(half > 0.3 && half < 0.4, `kuchlanish yarmida quvvat ${(half * 100).toFixed(0)} % (Om qonunidagi 25 % emas)`); }
ok(Math.abs(P.filamentT(P.LAMPS.l40, 40) - 2700) < 1, "nominal tola temperaturasi 2700 K");
{ const s = P.seriesLamps([P.LAMPS.l40, P.LAMPS.l100], 220); ok(near(s.parts[0].U + s.parts[1].U, 220, 1e-6) && s.parts[0].P > s.parts[1].P, `ketma-ket 40 W va 100 W: 40 W yorqinroq (${s.parts[0].P.toFixed(1)} W > ${s.parts[1].P.toFixed(1)} W)`); }
{ const s = P.seriesLamps([P.LAMPS.l60, P.LAMPS.l60], 220); ok(near(s.parts[0].U, 110, 1e-6), "ikki bir xil lampa: kuchlanish teng bo‘linadi"); }
{ const p = P.parallelLamps([P.LAMPS.l40, P.LAMPS.l100], 220); ok(near(p.I, 140 / 220) && p.parts[1].P > p.parts[0].P, "parallel: 100 W yorqinroq, I = ΣP/U"); }
ok(P.brightness(2700) === 1 && P.brightness(800) === 0, "yorqinlik: nominalda 1, qizarmagan tolada 0");

// 3. Uy tarmog'i
ok(near(P.lineCurrent([2000, 1200]), 3200 / 220), "choynak + dazmol: I = 3200/220 = 14,5 A");
ok(P.meltTime(14, 10) === Infinity && near(P.meltTime(20, 10), 10), "10 A saqlagich: 14 A da erimaydi, 20 A da 10 s da eriydi");
ok(P.meltTime(40, 10) < P.meltTime(25, 10), "tok qancha katta bo‘lsa, shuncha tez eriydi");
ok(near(P.kWh(2000, 1800), 1), "2 kW choynak 30 min: 1 kVt·soat");
ok(near(P.lineLoss(10, 10, 1.5), 100 * 1.7e-8 * 20 / 1.5e-6), "uzaytirgich simida isrof I²R");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
