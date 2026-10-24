// Termodinamika fizikasini tekshirish: node tools/simulations/tests/t_thermo.mjs
import * as P from "../../../assets/js/simulations/thermo-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

const he = { nu: 0.08, i: 3 }, air = { nu: 0.08, i: 5 };

// 1. Holat va ichki energiya
{ const s = P.stateVT(he, 2e-3, 300); ok(near(s.p * s.V, he.nu * P.R * 300), "pV = νRT");
  ok(near(P.energy(he, 300), 1.5 * 0.08 * 8.314 * 300) && near(P.energy(air, 300), 2.5 * 0.08 * 8.314 * 300), "U = (i/2)νRT: bir atomli 3/2, ikki atomli 5/2");
  ok(near(P.gammaOf(3), 5 / 3) && near(P.gammaOf(5), 1.4), "γ = 5/3 va 1,4"); }

// 2. Izojarayonlar: ish analitik va sonli integral bilan, 1-qonun
const s0 = P.stateVT(air, 2e-3, 300);
for (const [kind, to, name] of [["V", { T: 450 }, "izoxorik"], ["p", { V: 3e-3 }, "izobarik"], ["T", { V: 4e-3 }, "izotermik"], ["Q", { V: 1e-3 }, "adiabatik"]]) {
  const s1 = P.move(air, s0, kind, to), L = P.leg(air, s0, s1, kind), num = P.pathWork(P.legPath(air, L, 4000));
  ok(near(L.A, num, 1e-5), `${name}: A = ${L.A.toFixed(2)} J, sonli ∫p dV = ${num.toFixed(2)} J`);
  ok(near(L.Q, L.dU + L.A), `${name}: Q = ΔU + A (${L.Q.toFixed(1)} = ${L.dU.toFixed(1)} + ${L.A.toFixed(1)})`);
}
{ const s1 = P.move(air, s0, "V", { T: 450 }); ok(near(s1.p / s1.T, s0.p / s0.T), "izoxorik: p/T = const (Sharl)"); }
{ const s1 = P.move(air, s0, "p", { V: 3e-3 }), L = P.leg(air, s0, s1, "p");
  ok(near(s1.V / s1.T, s0.V / s0.T) && near(L.Q, air.nu * P.cp(5) * (s1.T - s0.T)), "izobarik: V/T = const, Q = νc_pΔT"); }
{ const s1 = P.move(air, s0, "T", { V: 4e-3 }), L = P.leg(air, s0, s1, "T");
  ok(near(L.dU, 0) && near(L.Q, L.A) && near(L.A, air.nu * P.R * 300 * Math.LN2), "izotermik: ΔU = 0, Q = A = νRT·ln2"); }
{ const s1 = P.move(air, s0, "Q", { V: 1e-3 }), L = P.leg(air, s0, s1, "Q");
  ok(near(s1.p * s1.V ** 1.4, s0.p * s0.V ** 1.4) && near(s1.T, 300 * 2 ** 0.4), "adiabatik: pV^γ = const, siqilganda T = 300·2^0,4 = 395,9 K");
  ok(L.Q === 0 && near(L.A, -L.dU) && L.A < 0, "adiabatik: Q = 0, A = −ΔU (siqishda gaz ustida ish bajariladi)");
  const back = P.move(air, s1, "Q", { T: 300 }); ok(near(back.V, 2e-3), "adiabatik: T bo‘yicha teskari hisob V ni qaytaradi"); }

// 3. Sikllar
for (const gas of [he, air]) {
  const c = P.cycle(gas, "karno", { T1: 600, T2: 300, r: 2 });
  ok(near(c.legs.reduce((s, L) => s + L.dU, 0), 0, 1e-9), `Karno (i = ${gas.i}): sikl bo‘yicha ΣΔU = 0`);
  ok(near(c.eta, 0.5, 1e-9) && near(c.etaC, 0.5), `Karno (i = ${gas.i}): η = A/Q₁ = ${c.eta.toFixed(4)} = 1 − T₂/T₁`);
  ok(near(c.A, c.Qin - c.Qout), "Karno: A = Q₁ − |Q₂|");
  ok(near(c.Qin, gas.nu * P.R * 600 * Math.LN2), "Karno: Q₁ = νRT₁·ln(V₂/V₁)");
}
{ const c = P.cycle(air, "otto", { T1: 2000, T2: 300, r: 8 });
  ok(near(c.eta, 1 - 8 ** -0.4, 1e-9), `Otto: η = 1 − ε^(1−γ) = ${c.eta.toFixed(4)} (ε = 8)`);
  ok(c.eta < c.etaC, `Otto: η = ${c.eta.toFixed(3)} < η_Karno = ${c.etaC.toFixed(3)} (o‘sha T₁, T₂ da)`); }
{ const c = P.cycle(air, "rect", { T1: 900, T2: 300, r: 2 }), [a, b, cc, d] = c.pts;
  ok(near(c.A, (a.p - d.p) * (b.V - a.V)), "to‘rtburchak: A = Δp·ΔV (yuza)");
  ok(near(b.T, 900) && near(d.T, 300) && c.eta < c.etaC, `to‘rtburchak: T_max = 900, T_min = 300 K, η = ${c.eta.toFixed(3)} < η_K = ${c.etaC.toFixed(3)}`); }
{ const c = P.cycle(air, "rev", { T1: 300, T2: 250, r: 2 });
  ok(c.A < 0 && near(c.cop, 250 / 50, 1e-9), `sovutgich: A < 0 (ish sarflanadi), ε_sov = Q₂/|A| = ${c.cop.toFixed(3)} = T₂/(T₁−T₂)`);
  ok(near(c.Qout, c.Qin - c.A), "sovutgich: isitkichga berilgan Q₁ = Q₂ + |A|"); }
{ const c = P.cycle(air, "karno", { T1: 600, T2: 300, r: 2 });
  const area = P.pathWork(c.legs.flatMap((L) => P.legPath(air, L, 3000)));
  ok(near(area, c.A, 1e-4), `Karno: sonli yuza ∮p dV = ${area.toFixed(3)} J = A`);
  ok(near(P.onCycle(air, c, 2).s.T, 300) && near(P.onCycle(air, c, 1.5).s.p * P.onCycle(air, c, 1.5).s.V ** 1.4, c.pts[1].p * c.pts[1].V ** 1.4), "sikl bo‘ylab harakat: holatlar jarayonga mos"); }
ok(P.maxRatio(air, "otto", 2000, 300) < (2000 / 300) ** 2.5 && P.maxRatio(air, "rect", 900, 300) < 3, "chegaraviy r: sikl buzilmaydi");

// 4. Dvigatel
{ const g = P.engineGeom({ eps: 9 });
  ok(near(P.crank(g, 0).V, g.Vc) && near(P.crank(g, Math.PI).V, g.Vmax), "krivoship: YuChN da V = V_c, PChN da V = V_c + V_d");
  ok(near(g.Vmax / g.Vc, 9) && near(g.Vd, Math.PI * 0.04 ** 2 * 0.08), "ε = V_max/V_c = 9; V_d = πD²S/4 = 0,402 L");
  const st = (deg) => P.engineState(g, 5, 2400, (deg * Math.PI) / 180);
  ok(st(90).stroke === 0 && st(270).stroke === 1 && st(450).stroke === 2 && st(630).stroke === 3, "taktlar: 0–180° so‘rish, 180–360° siqish, 360–540° ish yo‘li, 540–720° chiqarish");
  ok(near(st(359.999).T, 300 * 9 ** 0.4, 1e-4) && near(st(360.001).T, 2400, 1e-4), "siqish oxirida T = 300·9^0,4 = 722 K; yonishdan keyin T_max");
  ok(near(st(540 - 1e-6).p * st(540 - 1e-6).V ** 1.4, st(361).p * st(361).V ** 1.4, 1e-6), "ish yo‘li adiabatik: pV^γ = const");
  const pw = P.enginePower(g, 5, 2400, 3000);
  ok(near(pw.cyc.eta, 1 - 9 ** -0.4, 1e-9) && near(pw.P, pw.A * 25), `bir sikl ishi ${pw.A.toFixed(0)} J, 3000 ayl/min da P = A·n/2 = ${(pw.P / 1000).toFixed(2)} kW`);
  // indikator diagramma yuzasi (θ bo'yicha) = Otto ishi
  const pts = []; for (let k = 0; k <= 72000; k++) pts.push(P.engineState(g, 5, 2400, (k / 72000) * 4 * Math.PI - 1e-12));
  ok(near(P.pathWork(pts), pw.A, 2e-3), `indikator diagramma yuzasi ${P.pathWork(pts).toFixed(1)} J ≈ Otto ishi`); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
