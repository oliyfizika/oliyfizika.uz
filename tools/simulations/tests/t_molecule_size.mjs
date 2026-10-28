// Molekula o'lchami fizikasini tekshirish: node tools/simulations/tests/t_molecule_size.mjs
import * as P from "../../../assets/js/simulations/molecule-size-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const V0 = 1 / 50, V = P.acidVolume(1, V0, 1000), S = P.spotArea(V);
ok(near(V, 2e-5, 1e-12), `1 tomchi (0,02 ml), 1 : 1000 eritma: kislota hajmi ${V.toExponential(2)} ml`);
ok(near(S, 166.7, 0.1), `dog‘ yuzi S = ${S.toFixed(1)} sm² (diametri ≈ ${(2 * Math.sqrt(S / Math.PI)).toFixed(1)} sm)`);
ok(near(P.thickness(V, S), P.D0, 1e-9), "d = V/S monoqatlam qalinligini qaytaradi");
{ const sh = P.spotShape(S, 3); let a = 0; const n = 20000; for (let i = 0; i < n; i++) { const r = sh.r((i / n) * 2 * Math.PI); a += 0.5 * r * r * (2 * Math.PI / n); }
  ok(near(a, S, S * 1e-3), `notekis dog‘ chegarasi bo‘yicha yuz ${a.toFixed(1)} sm² = S`); }
for (const seed of [1, 2, 5]) { const sh = P.spotShape(S, seed), g = P.gridCount(sh, 20.3, 15.4);
  ok(near(g.S, S, S * 0.05), `kataklar bilan sanash (seed ${seed}): ${g.full} to‘liq + ${g.part} chala → ${g.S.toFixed(0)} sm² (haqiqiy ${S.toFixed(0)})`); }
{ const pts = [1, 2, 3].map((n) => { const v = P.acidVolume(n, V0, 1000); return [v, P.gridCount(P.spotShape(P.spotArea(v), n), 20, 15).S]; });
  const d = 1e7 / P.fitThroughOrigin(pts); ok(near(d, P.D0, 0.08), `S(V) grafigi qiyaligidan d = ${d.toFixed(2)} nm`); }
ok(P.spotArea(P.acidVolume(1, V0, 500)) < P.TRAY.w * P.TRAY.h, "1 : 500 eritmaning bir tomchisi vannaga sig‘adi");

if (fail) { console.log(`\n${fail} ta xato`); process.exit(1); } else console.log("\nhammasi to‘g‘ri");
