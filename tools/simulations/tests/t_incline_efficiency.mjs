// Qiya tekislik FIKi fizikasini tekshirish: node tools/simulations/tests/t_incline_efficiency.mjs
import * as P from "../../../assets/js/simulations/incline-efficiency-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const D = Math.PI / 180;

{ const w = P.works(100, 30 * D, 0, 2); ok(near(w.At, w.Af, 1e-9) && near(w.F, 50, 1e-9) && near(w.l, 4, 1e-9), "ishqalanishsiz: F·l = P·h (oltin qoida), 30° da F = P/2, l = 2h"); }
for (const a of [10, 30, 60]) { const w = P.works(20, a * D, 0.3, 1); ok(near(w.At, w.Af + w.Aq, 1e-9), `${a}°: A_t = A_f + A_q (energiya saqlanadi)`); }
ok(near(P.efficiency(30 * D, 0.3), 1 / (1 + 0.3 * Math.sqrt(3)), 1e-12), `η(30°, μ = 0,3) = ${(P.efficiency(30 * D, 0.3) * 100).toFixed(1)} %`);
ok(near(P.efficiency(90 * D, 0.5), 1, 1e-12) && P.efficiency(0, 0.3) === 0, "η(90°) = 1, η(0°) = 0");
ok(P.efficiency(20 * D, 0) === 1, "ishqalanish bo‘lmasa η = 100 %");
{ let mono = true; for (let a = 1; a < 89; a++) if (P.efficiency((a + 1) * D, 0.3) <= P.efficiency(a * D, 0.3)) mono = false; ok(mono, "qiyalik ortishi bilan FIK ortadi"); }
{ const w = P.works(1.96, P.angleOf(0.2, 0.8), 0.3, 0.2); ok(near(w.l, 0.8, 1e-9), `lab: l = 0,8 m, h = 0,2 m → F = ${w.F.toFixed(2)} N, η = ${(w.Af / w.At * 100).toFixed(0)} %`); }
ok(P.holds(15 * D, 0.3) && !P.holds(20 * D, 0.3), "μ = 0,3: 15° da sirpanmaydi, 20° da sirpanadi (tg α ≤ μ)");
ok(P.efficiency(Math.atan(0.3), 0.3) === 0.5 || near(P.efficiency(Math.atan(0.3), 0.3), 0.5, 1e-12), "o‘z-o‘zidan tormozlanish chegarasida η = 50 %");
ok(near(P.gain(10, 30 * D, 0), 2, 1e-12), "30° ishqalanishsiz: kuchdan 2 marta yutuq");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
