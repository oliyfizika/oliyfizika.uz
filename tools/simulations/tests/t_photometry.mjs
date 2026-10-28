// Fotometriya fizikasini tekshirish: node tools/simulations/tests/t_photometry.mjs
import * as P from "../../../assets/js/simulations/photometry-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const I = P.intensity(P.LAMPS.inc60);
ok(near(I, 56.5, 0.1), `60 W lampa: Φ = 710 lm, I = Φ/4π = ${I.toFixed(1)} cd`);
ok(near(P.illuminance(100, 1), 100, 1e-9) && near(P.illuminance(100, 2), 25, 1e-9), "masofa 2 marta ortsa, E 4 marta kamayadi");
ok(near(P.illuminance(100, 1, Math.PI / 3), 50, 1e-9) && P.illuminance(100, 1, Math.PI / 2) < 1e-9, "α = 60° da E ikki marta kam, 90° da nol");
{ let s = 0; const n = 400; for (let i = 0; i < n; i++) { const th = ((i + 0.5) / n) * Math.PI; s += P.illuminance(I, 2) * 2 * Math.PI * 4 * Math.sin(th) * (Math.PI / n); }
  ok(near(s, 710, 1), `r = 2 m sfera bo‘yicha oqim yig‘indisi ${s.toFixed(0)} lm = Φ₀`); }
ok(near(P.fluxOn(I, 0.5, 0, 0.01), P.solidAngle(0.5, 0, 0.01) * I, 1e-12), "Φ = IΩ = ES");
ok(near(P.efficacy(P.LAMPS.inc60), 11.8, 0.1) && near(P.efficacy(P.LAMPS.led9), 89.6, 0.1), "samaradorlik: cho‘g‘lanma ≈ 12 lm/W, LED ≈ 90 lm/W");
{ const fon = 12, pts = [0.3, 0.4, 0.5, 0.7, 1].map((r, i) => [1 / (r * r), P.luxmeter(P.illuminance(I, r), fon, [0.3, -0.5, 0.2, -0.1, 0.4][i]) - fon]);
  const Ifit = P.slope0(pts); ok(near(Ifit, I, 1.5), `E(1/r²) grafigi qiyaligidan I = ${Ifit.toFixed(1)} cd`); }
ok(near(P.illuminance(I, 0.45), 279, 1), `stol lampasi 45 sm da: ${P.illuminance(I, 0.45).toFixed(0)} lx`);

if (fail) { console.log(`\n${fail} ta xato`); process.exit(1); } else console.log("\nhammasi to‘g‘ri");
