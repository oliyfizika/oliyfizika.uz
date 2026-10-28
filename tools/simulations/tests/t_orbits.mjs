// Orbitalar fizikasini tekshirish: node tools/simulations/tests/t_orbits.mjs
import * as P from "../../../assets/js/simulations/orbits-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const E = P.PLANETS.earth;

ok(near(P.v1(E), 7.91, 0.01) && near(P.v2(E), 11.19, 0.01), `Yer: v₁ = ${P.v1(E).toFixed(2)} km/s, v₂ = ${P.v2(E).toFixed(2)} km/s`);
ok(near(P.gSurf(E), 9.82, 0.02) && near(Math.sqrt(P.gSurf(E) / 1000 * E.R), P.v1(E), 1e-9), "v₁ = √(gR)");
ok(near(P.v1(P.PLANETS.moon), 1.68, 0.01) && near(P.v2(P.PLANETS.mars), 5.03, 0.02) && near(P.v2(P.PLANETS.jupiter), 60.2, 0.2), `Oy v₁ = ${P.v1(P.PLANETS.moon).toFixed(2)}, Mars v₂ = ${P.v2(P.PLANETS.mars).toFixed(2)}, Yupiter v₂ = ${P.v2(P.PLANETS.jupiter).toFixed(1)} km/s`);
ok(near(P.period(E, 420) / 60, 92.8, 0.5), `XKS (420 km): T = ${(P.period(E, 420) / 60).toFixed(1)} min`);
ok(near(P.altitudeForPeriod(E, E.day), 35790, 10), `geostatsionar orbita: h = ${P.altitudeForPeriod(E, E.day).toFixed(0)} km`);
ok(near(P.v1(E, 35786), 3.07, 0.01), `geostatsionar orbitada v = ${P.v1(E, 35786).toFixed(2)} km/s`);

ok(P.launch(E, 7, 0).type === "fall" && P.launch(E, P.v1(E), 0).type === "circle" && P.launch(E, 9, 0).type === "ellipse" && P.launch(E, P.v2(E), 0).type === "para" && P.launch(E, 12, 0).type === "hyper", "orbita turlari: tushadi / aylana / ellips / parabola / giperbola");
{ const L = P.launch(E, 9, 0), a = (L.rp + L.ra) / 2, s = { x: 0, y: E.R, vx: 9, vy: 0 }; let rmax = 0; const T = P.periodA(E, a), n = Math.round(T / 5);
  for (let i = 0; i < n; i++) { P.step(s, E.GM, T / n); rmax = Math.max(rmax, Math.hypot(s.x, s.y)); }
  ok(near(rmax, L.ra, 5), `v = 9 km/s: apogey ${(L.ra - E.R).toFixed(0)} km (integratsiya ${(rmax - E.R).toFixed(0)} km)`);
  ok(near(s.x, 0, 2) && near(s.y, E.R, 2), "elliptik orbitada bir davrdan keyin otilgan nuqtaga qaytadi"); }
{ const s = { x: 0, y: E.R, vx: P.v1(E), vy: 0 }, e0 = P.energy(s, E.GM), T = P.period(E, 0), n = Math.round(T / 4); let dr = 0;
  for (let i = 0; i < n; i++) { P.step(s, E.GM, T / n); dr = Math.max(dr, Math.abs(Math.hypot(s.x, s.y) - E.R)); }
  ok(dr < 0.01 && near(P.energy(s, E.GM), e0, 1e-9), `v₁ bilan doiraviy orbita: radius o‘zgarishi ${dr.toExponential(1)} km, energiya saqlanadi`); }
{ const f = P.flight(E, 3, 100); ok(f.landed && f.arc > 430 && f.arc < 560, `100 km li tog‘dan v = 3 km/s: ${f.arc.toFixed(0)} km uzoqlikka tushadi (${(f.t / 60).toFixed(1)} min)`);
  const f2 = P.flight(E, 7, 100); ok(f2.landed && f2.arc > f.arc * 4, `v = 7 km/s: ${f2.arc.toFixed(0)} km uzoqlikka tushadi`); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
