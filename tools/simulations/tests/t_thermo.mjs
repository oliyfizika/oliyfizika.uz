// Termodinamika fizikasini tekshirish: node tools/simulations/tests/t_thermo.mjs
import * as P from "../../../assets/js/simulations/thermo-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const nu = 0.04, g1 = P.gas(3), g2 = P.gas(5);

ok(near(P.temp(100, 1, nu), 300.7, 1e-3), "pV = νRT: 100 kPa·1 L, ν = 0,04 mol → T ≈ 300,7 K");
ok(near(g1.gamma, 5 / 3) && near(g2.gamma, 1.4), "γ = 5/3 (bir atomli), 7/5 (ikki atomli)");

// 1. Jarayonlar
{ const r = P.process("p", { p: 100, V: 1 }, 2, nu, g1);
  ok(near(r.A, 100) && near(r.dU, 150) && near(r.Q, 250), `izobarik: A = pΔV = 100 J, ΔU = 3/2·pΔV = 150 J, Q = 250 J`); }
{ const r = P.process("V", { p: 100, V: 1 }, 150, nu, g2);
  ok(near(r.A, 0) && near(r.Q, r.dU) && near(r.dU, 2.5 * 50), "izoxorik: A = 0, Q = ΔU = 5/2·VΔp = 125 J"); }
{ const s1 = { p: 100, V: 1 }, r = P.process("T", s1, 3, nu, g1), T = P.temp(100, 1, nu);
  ok(near(r.A, P.A_isoT(nu, T, 1, 3), 1e-4) && near(r.dU, 0, 1e-6) && near(r.Q, r.A, 1e-4), `izotermik: A = νRT·ln3 = ${r.A.toFixed(2)} J = Q, ΔU = 0`); }
{ const s1 = { p: 100, V: 2 }, r = P.process("Q0", s1, 1, nu, g2);
  ok(near(r.s2.p * r.s2.V ** 1.4, 100 * 2 ** 1.4), "adiabata: pV^γ = const");
  ok(near(r.Q, 0, 1e-3) && near(r.A, P.A_adiab(100, 2, r.s2.p, 1, 1.4), 1e-4) && r.dU > 0, `adiabatik siqish: Q = 0, A = ${r.A.toFixed(2)} J < 0, gaz qiziydi`); }

// 2. Sikllar
{ const T1 = 500, T2 = 300, c = P.cycle(P.carnotNodes(T1, T2, 0.8, 2, nu, g1), P.CARNOT_TYPES, nu, g1);
  ok(near(c.eta, P.etaCarnot(T1, T2), 1e-4), `Karno: η = ${(c.eta * 100).toFixed(3)} % = 1 − T₂/T₁ = 40 %`);
  ok(near(c.dU, 0, 1e-6) && near(c.Q1 - c.Q2, c.A, 1e-6), "sikl: ΔU = 0, Q₁ − Q₂ = A");
  ok(near(c.Q1, P.A_isoT(nu, T1, 0.8, 1.6), 1e-4), "Karno: Q₁ = νRT₁·ln(V₂/V₁)");
  const rev = P.carnotNodes(T1, T2, 0.8, 2, nu, g1).reverse(), cr = P.cycle(rev, ["T", "Q0", "T", "Q0"], nu, g1);
  ok(near(cr.A, -c.A, 1e-4) && near(cr.Q1 / -cr.A, P.copFridge(T1, T2), 1e-4), `teskari Karno (sovitgich): sovuqdan olingan issiqlik / ish = ${(cr.Q1 / -cr.A).toFixed(4)} = T₂/(T₁ − T₂) = 1,5`); }
{ const c = P.cycle(P.ottoNodes(1, 8, 100, 300, nu, g2), P.OTTO_TYPES, nu, g2);
  ok(near(c.eta, P.etaOtto(8, 1.4), 1e-4), `Otto: η = ${(c.eta * 100).toFixed(2)} % = 1 − ε^(1−γ)`); }
{ const nodes = P.dieselNodes(1, 18, 100, 300, nu, g2), rho = nodes[2].V / nodes[1].V, c = P.cycle(nodes, P.DIESEL_TYPES, nu, g2);
  ok(near(c.eta, P.etaDiesel(18, rho, 1.4), 1e-4), `Dizel: η = ${(c.eta * 100).toFixed(2)} % (ρ = ${rho.toFixed(2)}) formulaga teng`); }
{ const quad = [{ V: 1, p: 100 }, { V: 3, p: 100 }, { V: 3, p: 250 }, { V: 1, p: 200 }].reverse(), c = P.cycle(quad, ["line", "line", "line", "line"], nu, g1);
  ok(near(Math.abs(c.A), Math.abs(P.shoelace(quad)), 1e-6), `ixtiyoriy sikl: A = sikl yuzasi = ${Math.abs(c.A).toFixed(1)} J`);
  ok(c.A > 0 && near(c.dU, 0, 1e-6), "soat strelkasi bo'yicha aylanish — A > 0, ΔU = 0"); }
{ // Karnodan katta FIK bo'lmaydi
  const quad = [{ V: 1, p: 200 }, { V: 3, p: 150 }, { V: 3, p: 100 }, { V: 1, p: 120 }], c = P.cycle(quad, ["line", "line", "line", "line"], nu, g1);
  let Tmax = 0, Tmin = Infinity; c.legs.forEach((l) => l.pts.forEach((q) => { Tmax = Math.max(Tmax, q.T); Tmin = Math.min(Tmin, q.T); }));
  ok(c.eta < P.etaCarnot(Tmax, Tmin), `ixtiyoriy sikl: η = ${(c.eta * 100).toFixed(1)} % < Karno ${(P.etaCarnot(Tmax, Tmin) * 100).toFixed(1)} %`); }
{ const S = P.cycle(P.carnotNodes(500, 300, 0.8, 2, nu, g1), P.CARNOT_TYPES, nu, g1).legs[1].pts.map((q) => P.entropy(q.T, q.V, nu, g1));
  ok(Math.max(...S) - Math.min(...S) < 1e-9, "adiabatada entropiya o'zgarmaydi"); }

// 3. Dvigatel
{ const e = P.engine({ eps: 10, fuel: "benzin", Q1: 900 });
  ok(near(e.eta, P.etaOtto(10, 1.4), 1e-4), `benzinli dvigatel ε = 10: η = ${(e.eta * 100).toFixed(1)} %`);
  ok(near(e.volume(0), e.Vc, 1e-9) && near(e.volume(Math.PI), e.V1, 1e-9), "θ = 0 da V = V_c, θ = π da V = V_c + V_d");
  ok(near(e.state(Math.PI * 1.5).p, 100 * (e.V1 / e.volume(Math.PI * 1.5)) ** 1.4), "siqish takti adiabatik");
  ok(near(e.state(2 * Math.PI + 1e-9).p, e.nodes[2].p, 1e-4), `uchqundan keyin p = ${(e.nodes[2].p / 100).toFixed(0)} bar`);
  ok(near(e.state(3 * Math.PI - 1e-9).p, e.nodes[3].p, 1e-4) && near(e.state(0.5).p, 100), "ishchi yo'l oxirida p₄, so'rishda p₀"); }
{ const d = P.engine({ eps: 20, fuel: "dizel", Q1: 900 }), b = P.engine({ eps: 10, fuel: "benzin", Q1: 900 });
  ok(d.eta > b.eta, `dizel (ε = 20) FIKi ${(d.eta * 100).toFixed(1)} % > benzinli ${(b.eta * 100).toFixed(1)} %`);
  ok(near(d.state(2 * Math.PI + 0.05).p, d.nodes[1].p, 1e-6), "dizel: yonish boshida bosim o'zgarmas"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to'g'ri");
process.exit(fail ? 1 : 0);
