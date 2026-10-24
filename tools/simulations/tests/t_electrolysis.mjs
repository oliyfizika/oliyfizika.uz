// Elektroliz fizikasini tekshirish: node tools/simulations/tests/t_electrolysis.mjs
import * as P from "../../../assets/js/simulations/electrolysis-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Elektrokimyoviy ekvivalentlar (jadval qiymatlari, mg/C)
for (const [s, tab] of [["Cu", 0.3294], ["Ag", 1.118], ["Ni", 0.3041], ["Zn", 0.3388], ["H2", 0.01045], ["O2", 0.0829]]) {
  ok(near(P.kOf(s) * 1e6, tab, 2e-3), `k(${s}) = ${(P.kOf(s) * 1e6).toFixed(4)} mg/C (jadvalda ${tab})`);
}
ok(near(P.F, P.E * P.NA, 1e-6), "F = e·N_A = 96 485 C/mol");

// 2. 1-qonun: m = kIt
ok(near(P.massOf("Cu", 1 * 3600) * 1000, 1.186, 1e-3), "Cu: 1 A · 1 soat → 1,186 g");
ok(near(P.massOf("Ag", 2 * 600) / P.massOf("Ag", 1 * 1200), 1), "m faqat q = It ga bog‘liq: 2 A·10 min = 1 A·20 min");
ok(near(P.massOf("Cu", 2000) / P.massOf("Cu", 1000), 2), "m ∝ q (2 marta zaryad — 2 marta massa)");

// 3. 2-qonun: k ∝ M/n, bir xil q da massalar nisbati
{ const q = 5000, r = P.massOf("Ag", q) / P.massOf("Cu", q);
  ok(near(r, (107.868 / 1) / (63.546 / 2), 1e-9), `ketma-ket vannalarda m(Ag)/m(Cu) = (M/n)Ag/(M/n)Cu = ${r.toFixed(4)}`);
  ok(near(P.faradayFrom("Cu", q, P.massOf("Cu", q)), P.F) && near(P.faradayFrom("Ag", q, P.massOf("Ag", q)), P.F), "o‘lchangan m dan F = qM/(nm) = 96 485 C/mol"); }

// 4. Gazlar: 1 A·soat da H₂ ≈ 0,418 L (n.sh.), suv elektrolizida V(H₂) = 2V(O₂)
ok(near(P.gasVolume("H2", 3600, 273.15) * 1000, 0.418, 2e-3), `1 A·soat → H₂ ${(P.gasVolume("H2", 3600, 273.15) * 1000).toFixed(4)} L (0 °C, 1 atm)`);
ok(near(P.gasVolume("H2", 1234) / P.gasVolume("O2", 1234), 2), "suv elektrolizi: V(H₂) : V(O₂) = 2 : 1");

// 5. O'tkazuvchanlik (taxminiy, adabiyot qiymatlari ±12 %)
for (const [key, c, ref] of [["nacl", 0.1, 1.067], ["nacl", 1, 8.58], ["h2so4", 0.5, 20.0]]) {
  const s = P.sigma(key, c, 25); ok(Math.abs(s - ref) / ref < 0.12, `σ(${key}, ${c} M) = ${s.toFixed(3)} S/m (adabiyotda ≈ ${ref})`);
}
ok(P.sigma("water", 0, 25) < 1e-5 && P.sigma("sugar", 0.5, 25) < 1e-5, "distillangan suv va shakar eritmasi deyarli tok o‘tkazmaydi");
ok(P.sigma("nacl", 0.5, 50) > P.sigma("nacl", 0.5, 25) && P.metalR(10, 80) > P.metalR(10, 20), "qizdirilganda elektrolit qarshiligi kamayadi, metallniki ortadi");

// 6. Zanjir
{ const r = P.circuit({ key: "nacl", c: 0.5, t: 25, d: 0.05, S: 2e-3, U: 12, Rext: 12 });
  ok(near(r.I, (12 - 2.2) / (r.R + 12)) && r.I > 0.3, `NaCl 0,5 M, U = 12 V, lampa 12 Ω: I = ${r.I.toFixed(3)} A (lampa yonadi)`);
  ok(P.circuit({ key: "nacl", c: 0.5, t: 25, d: 0.05, S: 2e-3, U: 2, Rext: 12 }).I === 0, "U < E_p (2,2 V) — elektroliz boshlanmaydi, tok yo‘q");
  const w = P.circuit({ key: "water", c: 0, t: 25, d: 0.05, S: 2e-3, U: 12, Rext: 12 }); ok(w.I < 1e-4, `distillangan suv: I = ${(w.I * 1e6).toFixed(1)} μA`);
  ok(near(P.cellR("cuso4", 0.5, 25, 0.1, 2e-3), 2 * P.cellR("cuso4", 0.5, 25, 0.05, 2e-3)), "R ∝ d (elektrodlar orasi 2 marta — qarshilik 2 marta)"); }

// 7. Qalinlik
ok(near(P.thickness("Cu", 3600, 1.6e-3) * 1e6, (1.186e-3 / (8960 * 1.6e-3)) * 1e6, 1e-3), "qatlam qalinligi h = m/(ρS)");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
