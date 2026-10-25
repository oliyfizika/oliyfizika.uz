// Gazlarda elektr toki va razryad turlari fizikasini tekshirish: node tools/simulations/tests/t_discharge.mjs
import * as P from "../../../assets/js/simulations/discharge-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));
const air = P.GASES.air;

// 1. Taunsend va Pashen
{ const m = P.paschenMin(air); ok(m.U > 250 && m.U < 400 && m.pd > 0.5 && m.pd < 1.2, `havo uchun Pashen minimumi ${m.U.toFixed(0)} V, pd = ${m.pd.toFixed(2)} Torr·cm`); }
ok(near(P.paschen(air, P.paschenMin(air).pd), P.paschenMin(air).U, 1e-9), "minimum nuqtada formula U_min = B·(pd)_min ni beradi");
{ const v = P.sparkVb(1); ok(v > 28e3 && v < 40e3, `1 cm havo oralig‘i ${(v / 1000).toFixed(1)} kV da teshiladi (~30 kV/cm)`); }
ok(P.sparkVb(0.2) < P.sparkVb(1) && P.sparkVb(1) / P.sparkVb(0.2) < 5, "oraliq 5 marta katta — teshilish kuchlanishi 5 martadan kam ortadi");
ok(P.paschen(air, 0.2) === Infinity, "Pashen minimumidan ancha chapda teshilish yo‘q (elektron to‘qnashmay o‘tadi)");
ok(P.paschen(P.GASES.ne, 200) < P.paschen(air, 200) / 2, "neon havodan ancha oson teshiladi (neon lampalar)");
{ const Ub = P.paschen(air, 760); ok(Number.isFinite(P.multiplication(air, 760, (Ub * 0.98), 1)) && !Number.isFinite(P.multiplication(air, 760, Ub * 1.02, 1)), "M → ∞ aynan Pashen kuchlanishida (Taunsend sharti γ(e^(αd) − 1) = 1)"); }
{ const x0 = 1.4 * P.paschenMin(air).pd; ok(near(P.tubeBreakdown(air, x0 / 40, 40), P.paschen(air, x0), 1e-9) && P.tubeBreakdown(air, 1e-4, 40) > 15e3, "trubka: chap tarmoq uzluksiz, 10⁻⁴ Torr da 15 kV yetmaydi"); }

// 2. Ionlash kamerasi
{ const q = P.IONIZERS.xray.q, d = 0.01, S = 0.01, a = P.chamber(0.1, d, S, q), b = P.chamber(0.2, d, S, q); ok(a.regime === "ohm" && near(b.I / a.I, 2, 1e-3), "kichik kuchlanishda Om qonuni: I ∝ U"); }
{ const q = P.IONIZERS.xray.q, c = P.chamber(5000, 0.01, 0.01, q); ok(c.regime === "sat" && near(c.I, P.E_CH * q * 0.01 * 0.01, 1e-3), "to‘yinish toki I_s = eqSd: barcha ionlar elektrodlarga yetadi"); }
{ const q = P.IONIZERS.flame.q, c1 = P.chamber(5000, 0.01, 0.01, q), c2 = P.chamber(5000, 0.01, 0.01, q / 100); ok(near(c1.Is / c2.Is, 100), "to‘yinish toki ionlagich quvvatiga proporsional"); }
{ const c = P.chamber(34000, 0.01, 0.01, 1e14); ok(c.regime === "town" && c.M > 10, `zarbli ionlanish: 34 kV da tok ${c.M.toFixed(0)} marta ko‘paydi`); }
ok(P.chamber(37000, 0.01, 0.01, 1e14).regime === "spark", "teshilish kuchlanishidan yuqorida — mustaqil razryad (uchqun)");
ok(P.chamber(100, 0.01, 0.01, 0).I === 0, "ionlagich yo‘q (q = 0) — havo izolyator");

// 3. Trubka
{ let p = 760; for (let k = 0; k < 400; k++) p = P.pumpStep(p, 0.1); ok(p < 2e-3 && p > P.P_ULT, `nasos 40 s da ${p.toExponential(1)} Torr gacha so‘radi`); }
{ const a = P.glowLayout(1, 40), b = P.glowLayout(0.1, 40); ok(near(b.dk / a.dk, 10) && !a.rays, "katod qorong‘i sohasi bosimga teskari proporsional"); }
ok(P.glowLayout(0.006, 40).rays && !P.glowLayout(0.05, 40).rays, "~10⁻² Torr da qorong‘i soha trubkani to‘ldiradi — katod nurlari");
ok(P.glowLayout(0.3, 40).striae > 0.9 && P.glowLayout(10, 40).striae === 0, "qatlamlar 0,1–1 Torr atrofida");
{ const Ub = P.tubeBreakdown(air, 2, 40); ok(P.tubeCurrent(Ub, Ub, 1e6) > 0 && P.tubeCurrent(0.3 * Ub, Ub, 1e6) === 0, "yonib turish kuchlanishi teshilishnikidan kichik (gisterezis)"); }

// 4. Uchqun, yoy, toj
ok(P.sparkRate(20e3, 10e3, 0.1) > P.sparkRate(12e3, 10e3, 0.1) && P.sparkRate(9e3, 10e3, 0.1) === 0, "kuchlanish ortsa, uchqunlar tez-tez chiqadi");
{ const a = P.ayrton(3, 5), b = P.ayrton(3, 10); ok(b < a, "yoyda tok ortsa, kuchlanish kamayadi (manfiy differensial qarshilik)"); }
{ const r = P.arcPoint(110, 5, 3); ok(r && near(r.U + r.I * 5, 110, 1e-9) && r.I > r.Iu, `110 V, R = 5 Ω, 3 mm: I = ${r.I.toFixed(1)} A, U = ${r.U.toFixed(1)} V (barqaror nuqta)`); }
ok(P.arcPoint(110, 5, 40) === null && P.arcMaxGap(110, 5) > 3 && P.arcMaxGap(110, 10) < P.arcMaxGap(110, 5), "elektrodlar uzoqlashsa yoy so‘nadi; ballast R katta bo‘lsa — tezroq");
{ const Ec = P.peek(1), Uc = P.coronaOnset(1, 1500); ok(Ec > 38 && Ec < 40 && near(P.wireField(Uc, 1, 1500), Ec, 1e-9), `Pik: r = 1 cm da E_k = ${Ec.toFixed(1)} kV/cm`); }
ok(P.coronaOnset(0.3, 1500) < P.coronaOnset(1.5, 1500), "ingichka simda toj kichikroq kuchlanishda boshlanadi");
ok(P.coronaOnset(1, 1500, 0.68) < P.coronaOnset(1, 1500, 1), "yomg‘irda (g‘adir-budur sirt) toj oson boshlanadi");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
