// Maxsus nisbiylik fizikasini tekshirish: node tools/simulations/tests/t_relativity.mjs
import * as P from "../../../assets/js/simulations/relativity-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. Lorens omili
ok(near(P.gamma(0.6), 1.25, 1e-12) && near(P.gamma(0.8), 5 / 3, 1e-12), "γ(0,6c) = 1,25; γ(0,8c) = 5/3");
ok(near(P.gamma(0.99), 7.0888, 1e-4) && near(P.gamma(0.995), 10.0125, 1e-4), `γ(0,99c) = ${P.gamma(0.99).toFixed(4)}, γ(0,995c) = ${P.gamma(0.995).toFixed(4)}`);
ok(near(P.gamma(1e-4), 1, 1e-8), "kichik tezlikda γ ≈ 1 (klassik mexanika)");
for (const b of [0.1, 0.5, 0.9, 0.999]) ok(near(P.betaOf(P.gamma(b)), b, 1e-9), `β(γ(${b})) = ${b}`);

// 2. Yorug'lik soati: Pifagor — (cΔt/2)² = d² + (vΔt/2)²
{ const d = 3, b = 0.8, L = P.lightClock(d, b);
  ok(near(L.t0, 2.0014e-8, 1e-11), `d = 3 m: o‘z tiki Δt₀ = 2d/c = ${(L.t0 * 1e9).toFixed(2)} ns`);
  ok(near(L.t / L.t0, 5 / 3, 1e-12), "Yerdan qaralganda tik γ marta uzun");
  ok(near((L.path / 2) ** 2, d * d + (L.shift / 2) ** 2, 1e-9), "Yorug‘lik yo‘li: (cΔt/2)² = d² + (vΔt/2)² (c ikkala sanoq tizimida bir xil)"); }
ok(near(P.contracted(100, 0.6), 80, 1e-12), "L₀ = 100 m, v = 0,6c → L = 80 m");

// 3. Myuonlar (Frisch–Smith: 1907 m, v = 0,995c)
{ const r = P.muonSurvival(1907, 0.995), cl = P.muonSurvival(1907, 0.995, false);
  ok(near(r.t * 1e6, 6.39, 0.02), `uchish vaqti (Yer soati) ${(r.t * 1e6).toFixed(2)} µs`);
  ok(near(r.t0 * 1e6, 0.638, 0.005), `myuonning o‘z vaqti ${(r.t0 * 1e6).toFixed(3)} µs`);
  ok(cl.frac < 0.06 && near(r.frac, 0.75, 0.02), `yetib kelganlar: klassik ${(cl.frac * 100).toFixed(1)} %, nisbiylik ${(r.frac * 100).toFixed(1)} % (tajribada ≈ 72 %)`);
  ok(near(r.hOwn, 190.5, 0.5), `myuon sanoq tizimida tog‘ balandligi ${r.hOwn.toFixed(0)} m — uzunlik qisqarishi bilan bir xil natija`);
  ok(near(2 ** (-(r.hOwn / (0.995 * P.C)) / P.MUON.T_HALF), r.frac, 1e-12), "ikkala sanoq tizimida yemirilish ulushi bir xil"); }

// 4. Tezliklarni qo'shish
ok(near(P.addVel(0.5, 0.5), 0.8, 1e-12), "0,5c + 0,5c = 0,8c");
ok(near(P.addVel(0.8, 0.8), 0.97561, 1e-5), `0,8c + 0,8c = ${P.addVel(0.8, 0.8).toFixed(5)}c`);
ok(near(P.addVel(0.6, 1), 1, 1e-12) && near(P.addVel(0.99, 1), 1, 1e-12), "u' = c bo‘lsa u = c (ikkinchi postulat)");
ok(near(P.addVel(1e-6, 2e-6), 3e-6, 1e-15), "kichik tezliklarda Galiley qonuni");
{ let below = true; for (let v = 0; v < 1; v += 0.05) for (let u = 0; u < 1; u += 0.05) if (P.addVel(v, u) >= 1) below = false; ok(below, "u < c bo‘lsa yig‘indi doim c dan kichik"); }
ok(near(P.subVel(P.addVel(0.7, 0.4), 0.7), 0.4, 1e-12), "teskari almashtirish");

// 5. Massa va energiya
{ const e = P.PARTICLES.e.E0;
  ok(near(P.restEnergy(P.PARTICLES.e.m) / P.MEV, e, 1e-4), `elektron m₀c² = ${(P.restEnergy(P.PARTICLES.e.m) / P.MEV).toFixed(4)} MeV`);
  ok(near(P.restEnergy(P.PARTICLES.p.m) / P.MEV, P.PARTICLES.p.E0, 0.01), "proton m₀c² = 938,3 MeV");
  ok(near(P.restEnergy(0.001), 8.988e13, 1e10), "1 g massa → 9·10¹³ J");
  const s = P.particle(e, e); ok(near(s.g, 2, 1e-12) && near(s.b, Math.sqrt(3) / 2, 1e-12), "K = m₀c² → γ = 2, v = 0,866c, m = 2m₀");
  ok(near(P.particle(1e-6, e).b, P.particle(1e-6, e).bCl, 1e-8), "kichik energiyada klassik formula to‘g‘ri");
  ok(P.particle(2, e).bCl > 1 && P.particle(2, e).b < 1, "2 MeV: klassik v > c (ma’nosiz), relyativistik v < c");
  ok(near(P.kinOf(P.particle(3.3, e).b, e), 3.3, 1e-9), "K(β(K)) = K");
  const t = P.particle(5, 938.27); ok(near(t.E * t.E, t.pc * t.pc + 938.27 * 938.27, 1e-6), "E² = (pc)² + (m₀c²)²"); }

// 6. Bertozzi (1964): 8,4 m, uchish vaqtlari ·10⁻⁸ s: 0,5 MeV 3,23; 1 — 3,08; 1,5 — 2,92; 4,5 — 2,84; 15 — 2,80
{ const data = [[0.5, 3.23], [1, 3.08], [1.5, 2.92], [4.5, 2.84], [15, 2.8]];
  const th = data.map(([K]) => P.tof(8.4, P.particle(K, P.PARTICLES.e.E0).b) * 1e8);
  ok(data.every(([, t], i) => near(th[i], t, 0.11)), `uchish vaqtlari: ${th.map((v) => v.toFixed(2)).join(", ")} ·10⁻⁸ s (tajriba: 3,23; 3,08; 2,92; 2,84; 2,80 — o‘lchash xatosi ±3 %)`);
  ok(P.tof(8.4, 1) * 1e8 > 2.8 - 1e-3, `yorug‘lik 8,4 m ni ${(P.tof(8.4, 1) * 1e8).toFixed(3)}·10⁻⁸ s da o‘tadi — chegaraviy vaqt`); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
