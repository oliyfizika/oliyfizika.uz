// Vodorod atomi elektron bulutlari fizikasini tekshirish: node tools/simulations/tests/t_orbitals.mjs
import * as P from "../../../assets/js/simulations/orbitals-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Lager va Lejandr: ma’lum yopiq ko‘rinishlar
const x = 0.37;
ok(near(P.laguerre(2, 1, x), (x * x - 6 * x + 6) / 2, 1e-12) && near(P.laguerre(1, 3, x), 4 - x, 1e-12), "umumlashgan Lager ko‘phadlari L₂¹, L₁³");
ok(near(P.legendre(2, 0, x), (3 * x * x - 1) / 2, 1e-12) && near(P.legendre(3, 0, x), (5 * x ** 3 - 3 * x) / 2, 1e-12)
  && near(P.legendre(2, 1, x), 3 * x * Math.sqrt(1 - x * x), 1e-12) && near(P.legendre(3, 3, x), 15 * (1 - x * x) ** 1.5, 1e-12),
  "biriktirilgan Lejandr funksiyalari P₂, P₃, P₂¹, P₃³");

// Radial funksiyalar: yopiq ko‘rinishlarga proporsional
const ratioConst = (f, g) => { const r = [0.3, 1.1, 2.7, 5.9].map((t) => f(t) / g(t)); return r.every((v) => near(v / r[0], 1, 1e-9)); };
ok(ratioConst((r) => P.radial(1, 0, r), (r) => Math.exp(-r)), "R₁₀ ∝ e^(−r)");
ok(ratioConst((r) => P.radial(2, 0, r), (r) => (2 - r) * Math.exp(-r / 2)), "R₂₀ ∝ (2 − r)e^(−r/2)");
ok(ratioConst((r) => P.radial(3, 1, r), (r) => r * (6 - r) * Math.exp(-r / 3)), "R₃₁ ∝ r(6 − r)e^(−r/3)");

// Tugunlar: radial n − l − 1 ta; 2s tuguni r = 2a₀, 3s tugunlari (3 ∓ √3)·3/2 a₀
for (let n = 1; n <= 4; n++) for (let l = 0; l < n; l++) ok(P.radialNodeRadii(n, l).length === n - l - 1, `${n}${P.LETTERS[l]}: radial tugunlar soni ${n - l - 1}`);
ok(near(P.radialNodeRadii(2, 0)[0], 2, 1e-6), "2s tuguni r = 2a₀");
{ const r = P.radialNodeRadii(3, 0); ok(near(r[0], (9 - 3 * Math.sqrt(3)) / 2, 1e-5) && near(r[1], (9 + 3 * Math.sqrt(3)) / 2, 1e-5), `3s tugunlari ${r.map((v) => v.toFixed(3)).join(", ")} a₀`); }

// Eng ehtimolli radius: 1s — a₀, 2p — 4a₀, 3d — 9a₀, 4f — 16a₀ (l = n − 1 ⇒ n²)
for (let n = 1; n <= 4; n++) ok(near(P.mostProbableR(n, n - 1), n * n, 0.02), `r_eht(${n}${P.LETTERS[n - 1]}) = ${P.mostProbableR(n, n - 1).toFixed(2)} a₀ ≈ ${n * n}`);

// Energiya va ⟨r⟩ formulalari
ok(near(P.quantities(1, 0, 0).E, -13.6057, 1e-4) && near(P.quantities(2, 1, 0).E, -3.4014, 1e-4), "Eₙ = −13,6 eV/n²");
ok(P.quantities(3, 2, 1, true).Lz === null && P.quantities(3, 2, -2, false).Lz === -2, "L_z: kompleks holatda mħ, real kombinatsiyada aniq emas");

// Monte-Karlo tanlanma: ⟨r⟩, ⟨r²⟩, burchak momentlari analitik qiymatga mos
const stats = (n, l, m, real, N = 120000) => {
  const s = P.sample(n, l, m, real, N, P.rng(12345 + 97 * n + 13 * l + m));
  let r1 = 0, r2 = 0, z2 = 0, x2 = 0, y2 = 0, pos = 0;
  for (let i = 0; i < s.count; i++) {
    const X = s.xyz[3 * i], Y = s.xyz[3 * i + 1], Z = s.xyz[3 * i + 2], rr = Math.hypot(X, Y, Z);
    r1 += rr; r2 += rr * rr; z2 += (Z / rr) ** 2; x2 += (X / rr) ** 2; y2 += (Y / rr) ** 2; if (s.sign[i] > 0) pos++;
  }
  const c = s.count; return { c, r: r1 / c, r2: r2 / c, z2: z2 / c, x2: x2 / c, y2: y2 / c, pos: pos / c };
};
for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 2], [4, 3], [4, 0]]) {
  const q = P.quantities(n, l, 0), s = stats(n, l, 0, false);
  ok(s.c === 120000 && near(s.r / q.rMean, 1, 0.012), `${n}${P.LETTERS[l]}: ⟨r⟩ = ${s.r.toFixed(2)} a₀ (nazariya ${q.rMean})`);
  ok(near(s.r2 / q.r2Mean, 1, 0.025), `${n}${P.LETTERS[l]}: ⟨r²⟩ = ${s.r2.toFixed(1)} a₀² (nazariya ${q.r2Mean})`);
}
{ const s = stats(2, 1, 0, false); ok(near(s.z2, 3 / 5, 0.01), `2p_z: ⟨cos²θ⟩ = ${s.z2.toFixed(3)} (nazariya 3/5)`); }
{ const s = stats(2, 1, 1, false); ok(near(s.z2, 1 / 5, 0.01) && near(s.x2, s.y2, 0.01), `2p, m = +1 (kompleks): ⟨cos²θ⟩ = ${s.z2.toFixed(3)} (1/5), x–y simmetrik halqa`); }
{ const s = stats(2, 1, 1, true); ok(near(s.x2, 3 / 5, 0.01) && near(s.y2, 1 / 5, 0.01), `2pₓ (real): ⟨x²/r²⟩ = ${s.x2.toFixed(3)} (3/5), ⟨y²/r²⟩ = ${s.y2.toFixed(3)} (1/5)`); }
{ const s = stats(3, 2, -2, true); ok(near(s.z2, 1 / 7, 0.01) && near(s.x2, s.y2, 0.01), `3d_xy: ⟨cos²θ⟩ = ${s.z2.toFixed(3)} (1/7)`); }
{ const s = stats(2, 1, 0, false); ok(near(s.pos, 0.5, 0.01), `2p_z: ψ > 0 va ψ < 0 bo‘laklari teng (${(s.pos * 100).toFixed(1)} %)`); }
{ // 2p_z ishorasi: z > 0 da ψ > 0
  const s = P.sample(2, 1, 0, false, 2000, P.rng(7)); let bad = 0;
  for (let i = 0; i < s.count; i++) if (Math.sign(s.xyz[3 * i + 2]) !== s.sign[i]) bad++;
  ok(bad === 0, "2p_z: z > 0 bo‘lagi musbat, z < 0 — manfiy");
}
{ // 2s: tugundan ichkarida (r < 2) ishora musbat, tashqarida manfiy
  const s = P.sample(2, 0, 0, false, 4000, P.rng(9)); let bad = 0;
  for (let i = 0; i < s.count; i++) { const rr = Math.hypot(s.xyz[3 * i], s.xyz[3 * i + 1], s.xyz[3 * i + 2]); if ((rr < 2 ? 1 : -1) !== s.sign[i]) bad++; }
  ok(bad === 0, "2s: ichki qobiq ψ > 0, tashqi ψ < 0");
}
ok(P.valid(3, 2, -2) && !P.valid(2, 2, 0) && !P.valid(3, 1, 2) && !P.valid(5, 0, 0), "kvant sonlari cheklovlari");
ok(P.orbitalName(3, 2, 2, true).sub === "x²−y²" && P.orbitalName(4, 3, -2, true).sub === "xyz" && P.orbitalName(2, 1, 1, false).sub === "", "real orbital nomlari");

console.log(fail ? `\n${fail} ta tekshiruv o‘tmadi` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
