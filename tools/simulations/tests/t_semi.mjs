// Yarimo‘tkazgichlar fizikasini tekshirish: node tools/simulations/tests/t_semi.mjs
import * as P from "../../../assets/js/simulations/semi-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Metall va yarimo'tkazgich
ok(near(P.metalR(20), 10) && near(P.metalR(100), 10 * (1 + 4.3e-3 * 80)), "mis: R = R₂₀(1 + αΔt), 100 °C da 13,4 Ω");
ok(near(P.ntcR(25), 10000) && P.ntcR(100) < 0.1 * P.ntcR(20), `termorezistor: 25 °C da 10 kΩ, 100 °C da ${(P.ntcR(100) / 1000).toFixed(2)} kΩ (10 martadan ko‘p kamayadi)`);
{ const a = Math.log(P.ntcR(30)), b = Math.log(P.ntcR(80)), B = (a - b) / (1 / (30 + P.T0) - 1 / (80 + P.T0)); ok(near(B, P.NTC.B, 1e-9), "ln R ning 1/T ga bog‘liqligi to‘g‘ri chiziq, qiyaligi B"); }
ok(Math.abs(P.ntcEg() - 0.68) < 0.01, `aktivatsiya energiyasi E = 2kB = ${P.ntcEg().toFixed(3)} eV`);
{ let T = 20; for (let i = 0; i < 4000; i++) T = P.bathStep(T, 1, 0.3); const Teq = 20 + (0.55 * 800 * 0.3) / 3.6; ok(near(T, Teq, 1e-3), `plitka 30 %: muvozanat ${Teq.toFixed(1)} °C`); }
{ let T = 20; for (let i = 0; i < 4000; i++) T = P.bathStep(T, 1, 1); ok(T === 100, "plitka to‘liq quvvatda: suv qaynaydi (100 °C)"); }
ok(near(P.ldrR(0), 1e6, 1e-9) && Math.abs(P.ldrR(10) - 1 / (1e-6 + 1 / 2e4)) < 1e-6 && P.ldrR(1000) < 2000, "fotorezistor: qorong‘ida 1 MΩ, 10 lk da ~20 kΩ, 1000 lk da < 2 kΩ");
ok(near(P.illum(80, 0.2), 2000), "yoritilganlik E = I/r² = 80/0,04 = 2000 lk");

// 2. Zaryad tashuvchilar
const si = P.MATS.si, ge = P.MATS.ge;
ok(near(P.ni(si, 300), 1e16) && P.ni(si, 350) / P.ni(si, 300) > 20, `Si: nᵢ(300 K) = 10¹⁶ m⁻³, 350 K da ${(P.ni(si, 350) / 1e16).toFixed(0)} marta ko‘p`);
ok(P.ni(ge, 300) > 1000 * P.ni(si, 300), "Ge da nᵢ Si dagidan ~2000 marta katta (E_g kichik)");
{ const c = P.carriers(si, 300); ok(near(c.n, c.p) && near(c.n, 1e16), "xususiy: n = p = nᵢ"); }
{ const c = P.carriers(si, 300, 1e21); ok(near(c.n, 1e21, 1e-9) && near(c.n * c.p, 1e32, 1e-9), "n-tip: n ≈ N_d, n·p = nᵢ²"); }
{ const c = P.carriers(si, 300, 0, 1e22); ok(near(c.p, 1e22, 1e-9) && c.n < 1e11, "p-tip: p ≈ N_a, elektronlar juda kam"); }
{ const c = P.carriers(si, 300, 1e21, 1e21); ok(near(c.n, 1e16, 1e-9), "kompensatsiya: N_d = N_a bo‘lsa, xususiy kabi"); }
{ const c = P.carriers(si, 600, 1e19); ok(c.n > 5e19 && c.p > 0.5 * c.n, "yuqori temperaturada aralashmali yarimo‘tkazgich xususiyga aylanadi"); }
{ const s0 = P.conductivity(si, 300).sigma, s1 = P.conductivity(si, 300, 1e22).sigma; ok(near(s0, 1.602e-19 * 1e16 * (0.135 + 0.048), 1e-9) && s1 / s0 > 1e5, `σ: sof Si ${s0.toExponential(2)} S/m, fosfor qo‘shilsa ${(s1 / s0).toExponential(1)} marta ko‘p`); }
ok(P.conductivity(si, 350).sigma > 10 * P.conductivity(si, 300).sigma, "sof Si ning o‘tkazuvchanligi qizdirilganda tez ortadi");
ok(P.conductivity(si, 400, 1e23).sigma < P.conductivity(si, 300, 1e23).sigma, "kuchli legirlangan Si: metall kabi — qizdirganda σ kamayadi (μ kamayadi)");

// 3. Diod
const d = P.DIODES.si;
ok(near(P.diodeI(d, d.U10, 300), 0.01, 1e-6), "Si diod: U10 = 0,78 V da 10 mA");
ok(P.diodeI(d, 0.4) < 1e-5 && P.diodeI(d, 0.9) > 0.05, "to‘g‘ri yo‘nalish: 0,4 V gacha tok μA tartibida, 0,9 V da > 50 mA");
ok(P.diodeI(d, -10) < 0 && Math.abs(P.diodeI(d, -10)) < 1e-8, "Si teskari tok nA tartibida");
ok(Math.abs(P.diodeI(P.DIODES.ge, -10)) > 1e-6 && Math.abs(P.diodeI(P.DIODES.ge, -10)) < 1e-4, "Ge teskari tok μA tartibida");
ok(Math.abs(P.diodeI(P.DIODES.ge, -5, 313)) > 3.5 * Math.abs(P.diodeI(P.DIODES.ge, -5, 293)) * 0.9, "Ge teskari toki 20 K da ~4 marta ortadi");
ok(near(P.diodeI(d, 0), 0, 1e-9) || Math.abs(P.diodeI(d, 0)) < 1e-15, "U = 0 da tok 0");
{ const U1 = P.diodeCircuit(d, 5, 100, 293).U, U2 = P.diodeCircuit(d, 5, 100, 343).U; ok(U1 - U2 > 0.08 && U1 - U2 < 0.12, `qizdirilganda to‘g‘ri kuchlanish kamayadi (−2 mV/K): ΔU = ${((U1 - U2) * 1000).toFixed(0)} mV`); }
{ const r = P.diodeCircuit(d, 5, 100); ok(near(r.I, (5 - r.U) / 100, 1e-6) && r.U > 0.7 && r.U < 0.9, `zanjir: E = 5 V, R = 100 Ω → U = ${r.U.toFixed(3)} V, I = ${(r.I * 1000).toFixed(1)} mA`); }
{ const r = P.diodeCircuit(d, -20, 100); ok(Math.abs(r.U + 20) < 1e-4, "teskari ulanganda deyarli butun kuchlanish diodga tushadi"); }
ok(P.diffR(d, 0.75) < 15 && P.staticR(d, 0.75) > P.diffR(d, 0.75), "differensial qarshilik statikdan kichik");
{ const r = P.diodeCircuit(P.DIODES.red, 5, 300); ok(r.U > 1.8 && r.U < 2.0, `qizil LED: 5 V, 300 Ω → ${r.U.toFixed(2)} V`); }
ok(Math.abs(P.photonEV(630) - 1.968) < 0.01, "λ = 630 nm foton energiyasi 1,97 eV ≈ qizil LED kuchlanishi");
ok(P.depletion(d, -10) > 3 && P.depletion(d, 0.6) < 0.5 && near(P.depletion(d, 0), 1), "kambag‘allashgan qatlam: teskarida kengayadi, to‘g‘rida torayadi");

// To'g'rilagich
{ const r = P.rectifier({ Um: 17, R: 100, C: 0, bridge: false, drop: 0 , Rsrc: 1e-6 }); ok(near(r.Uavg, P.avgHalf(17), 0.01), `yarim davr (ideal): U_o‘rt = Um/π = ${r.Uavg.toFixed(2)} V`); }
{ const r = P.rectifier({ Um: 17, R: 100, C: 0, bridge: true, drop: 0, Rsrc: 1e-6 }); ok(near(r.Uavg, P.avgFull(17), 0.01), `to‘liq davr (ideal): U_o‘rt = 2Um/π = ${r.Uavg.toFixed(2)} V`); }
{ const r = P.rectifier({ Um: 17, R: 100, C: 0, bridge: false }); ok(r.Umin >= 0 && Math.abs(r.Umax - (17 - 0.7) * 100 / 101) < 0.01, "yarim davr: manfiy yarim to‘lqin kesiladi, cho‘qqi Um − 0,7 V"); }
{ const r = P.rectifier({ Um: 17, R: 100, C: 1e-3, bridge: true }), est = P.rippleEst(r.Umax, 50, 100, 1e-3, true); ok(r.ripple < 0.2 * r.Umax && Math.abs(r.ripple - est) / est < 0.35, `ko‘prik + 1000 μF: pulsatsiya ${r.ripple.toFixed(2)} V (taxmin ${est.toFixed(2)} V)`); }
{ const a = P.rectifier({ Um: 17, R: 100, C: 1e-3, bridge: false }), b = P.rectifier({ Um: 17, R: 100, C: 1e-3, bridge: true }); ok(b.ripple < 0.7 * a.ripple, "to‘liq davrda pulsatsiya yarim davrdagidan kichik"); }

// Tranzistor
{ const t = P.transistor(4, 2000, 6, 40); ok(near(t.Ib, 1.675e-3) && t.sat, "baza toki 1,7 mA: kollektor toki to‘yingan (lampa to‘liq yonadi)"); }
{ const t = P.transistor(1, 10000, 6, 40); ok(near(t.Ic, P.TRANSISTOR.beta * 3.5e-5) && !t.sat && near(t.gain, P.TRANSISTOR.beta), "kuchaytirish rejimi: I_K = βI_B"); }
{ const t = P.transistor(0.5, 10000, 6, 40); ok(t.cut && t.Ic === 0 && near(t.Uce, 6), "U_B < 0,65 V: tranzistor yopiq, I_K = 0"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
