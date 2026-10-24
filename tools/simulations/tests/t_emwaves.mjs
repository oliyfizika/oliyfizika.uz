// EM to'lqinlar va radioaloqa fizikasini tekshirish: node tools/simulations/tests/t_emwaves.mjs
import * as P from "../../../assets/js/simulations/emwaves-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. To'lqin
ok(near(P.lambdaOf(100e6), 2.9979, 1e-4) && near(P.lambdaOf(1e6), 299.79, 1e-4), "λ = c/ν: 100 MHz → 3,0 m; 1 MHz → 300 m");
ok(near(1 / Math.sqrt(P.EPS0 * P.MU0), P.C, 1e-6), "c = 1/√(ε₀μ₀) = 3·10⁸ m/s (Maksvell)");
ok(near(P.lambdaOf(100e6, 9), P.lambdaOf(100e6) / 9) && near(P.speedIn(1.5), 2e8, 1e-3), "muhitda v = c/n, λ n marta qisqaradi");
{ const nu = 50e6, f1 = P.fields(0, 0, { E0: 10, nu }), f2 = P.fields(P.lambdaOf(nu), 0, { E0: 10, nu }), f3 = P.fields(0, 1 / nu / 2, { E0: 10, nu });
  ok(near(f1.E, 10) && near(f2.E, 10) && near(f3.E, -10), "E(x + λ) = E(x), E(t + T/2) = −E(t)");
  ok(near(f1.B, 10 / P.C), "B₀ = E₀/c"); }
ok(near(P.intensity(1), 1.327e-3, 1e-3), "intensivlik I = cε₀E₀²/2: E₀ = 1 V/m → 1,33 mW/m²");

// 2. Spektr
ok(P.bandOf(1e6).id === "radio" && P.bandOf(2.45e9).id === "micro" && P.bandOf(5.45e14).id === "vis" && P.bandOf(1e18).id === "xray", "spektr: 1 MHz radio, 2,45 GHz mikroto‘lqin, 550 nm ko‘rinadigan, 10¹⁸ Hz rentgen");
ok(P.radioBand(1e6).startsWith("o‘rta") && P.radioBand(100e6).startsWith("ultraqisqa"), "radio diapazonlari: O‘T 1 MHz, UQT 100 MHz");
ok(P.visibleColor(P.C / 650e-9) === "#dc2626" && P.visibleColor(P.C / 450e-9) === "#2563eb" && P.visibleColor(1e14) === null, "ko‘rinadigan yorug‘lik rangi: 650 nm qizil, 450 nm ko‘k");

// 3. Xossalari
{ const a = 40 * Math.PI / 180, b = P.refractAngle(1, 1.5, a); ok(near(Math.sin(a), 1.5 * Math.sin(b)), "Snellius: sinα = n sinβ"); }
ok(P.refractAngle(1.5, 1, 60 * Math.PI / 180) === null && P.reflectance(1.5, 1, 60 * Math.PI / 180) === 1, "to‘la ichki qaytish");
ok(near(P.reflectance(1, 1.5, 0), 0.04, 1e-9), "normal tushishda qaytish R = ((n−1)/(n+1))² = 4 %");
ok(near(P.receiverPower(0), 1) && near(P.receiverPower(Math.PI / 3), 0.25) && P.receiverPower(Math.PI / 2) < 1e-30, "qutblanish: cos²φ — 0° to‘liq, 60° chorak, 90° nol");

// 4. Radioaloqa
{ const L = 200e-6, f = 1e6, Cc = P.capFor(L, f); ok(near(P.resonance(L, Cc), f), `rezonans: L = 200 μH, 1 MHz uchun C = ${(Cc * 1e12).toFixed(1)} pF`); }
ok(near(P.response(1e6, 1e6, 50), 1) && near(P.response(1e6 * (1 + 1 / 100 + 1e-12), 1e6, 50), 1 / Math.SQRT2, 2e-2), "kontur javobi: rezonansda 1, Δf = f₀/Q chegarasida ≈ 0,707");
ok(P.response(1.3e6, 1e6, 50) < 0.05, "Q = 50 da 0,3 MHz uzoqdagi stansiya 5 % dan kam o‘tadi (tanlovchanlik)");
{ // AM: konvert m bo'yicha, detektor audio signalni tiklaydi
  const p = { f: 200e3, F: 2e3, m: 0.6 }, dt = 1 / (p.f * 40), N = Math.round(2 / p.F / dt), s = Array.from({ length: N }, (_, k) => P.amSignal(k * dt, p));
  ok(near(Math.max(...s), 1.6, 1e-2), "AM: maksimal amplituda A(1 + m) = 1,6");
  const out = P.detect(s, dt, P.detectorTau(p.f, p.F));
  let err = 0, cnt = 0; for (let k = Math.round(N / 2); k < N; k++) { err += Math.abs(out[k] - (1 + p.m * Math.cos(2 * Math.PI * p.F * k * dt))); cnt++; }
  ok(err / cnt < 0.04, `detektor: chiqish konvertni takrorlaydi (o‘rtacha xato ${(err / cnt).toFixed(3)})`); }
{ const p = { f: 100e6, F: 1e3, df: 75e3 }; let mx = 0; for (let k = 0; k < 2000; k++) mx = Math.max(mx, Math.abs(P.fmSignal(k * 1.3e-9, p)));
  ok(near(mx, 1, 1e-3) && near(P.fmFreq(0, p), 100.075e6) && near(P.fmFreq(0.5e-3, p), 99.925e6), "FM: amplituda o‘zgarmas, chastota f ± Δf oralig‘ida"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
