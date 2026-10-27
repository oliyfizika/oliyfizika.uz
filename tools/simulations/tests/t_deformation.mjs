// Deformatsiya fizikasini tekshirish: node tools/simulations/tests/t_deformation.mjs
import * as P from "../../../assets/js/simulations/deformation-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const M = P.MATERIALS, MPa = 1e6;

// 1. Guk qonuni
for (const k of ["steel", "copper", "alu"]) { const m = M[k], e = (0.5 * m.sp) / m.E; ok(near(P.sigmaMono(m, e), 0.5 * m.sp, 1), `${m.name}: proporsionallik chegarasigacha σ = Eε`); }
{ const S = P.area(0.8e-3), k = P.stiffness(200e9, S, 2); ok(near(S * 1e6, 0.5027, 0.001) && near(k / 1000, 50.27, 0.05), `po‘lat sim d = 0,8 mm, l = 2 m: S = ${(S * 1e6).toFixed(3)} mm², k = ${(k / 1000).toFixed(1)} kN/m`);
  const F = 5 * P.G, dl = F / k; ok(near(dl * 1000, 0.976, 0.005), `5 kg yuk: Δl = ${(dl * 1000).toFixed(3)} mm`); }

// 2. Diagramma uzluksiz va mantiqiy
for (const k of Object.keys(M)) {
  const m = M[k]; let jump = 0, prev = 0, maxS = 0, eMax = 0;
  for (let i = 1; i <= 20000; i++) { const e = (m.ef * i) / 20000, s = P.sigmaMono(m, e); jump = Math.max(jump, Math.abs(s - prev)); prev = s; if (s > maxS) { maxS = s; eMax = e; } }
  ok(jump <= m.E * (m.ef / 20000) * 1.001, `${m.name}: σ(ε) uzluksiz, qiyalik hech qayerda E dan oshmaydi`);
  ok(near(maxS, m.su, 0.002 * m.su), `${m.name}: eng katta kuchlanish = σₘ = ${(maxS / MPa).toFixed(0)} MPa (ε = ${(eMax * 100).toFixed(2)} %)`);
}
{ const m = M.steel, y = P.yieldStrength(m); ok(near(y, m.sy, 3 * MPa), `po‘lat: σ₀,₂ = ${(y / MPa).toFixed(0)} MPa (oquvchanlik maydonchasi ${m.sy / MPa})`);
  ok(near(P.sigmaMono(m, 0.005), P.sigmaMono(m, 0.012), 1 * MPa), "po‘lat: oquvchanlik maydonchasida σ deyarli o‘zgarmaydi"); }
{ const y = P.yieldStrength(M.copper); ok(y > M.copper.sp && y < 0.6 * M.copper.su, `mis: σ₀,₂ = ${(y / MPa).toFixed(0)} MPa (aniq maydoncha yo‘q)`); }
ok(P.yieldStrength(M.iron) === null && M.iron.ef < 0.01, "cho‘yan mo‘rt: oquvchanlik yo‘q, ε < 1 % da uziladi");

// 3. Yuksizlantirish va qoldiq deformatsiya
{ const m = M.steel, s = P.createSample(); P.strainTo(s, m, 0.0008); const sg = P.strainTo(s, m, 0);
  ok(sg === 0 && P.residual(s) === 0, "elastik sohada yuk olinsa namuna to‘liq tiklanadi"); }
{ const m = M.steel, s = P.createSample(), e1 = 0.05, s1 = P.strainTo(s, m, e1);
  ok(near(P.residual(s), e1 - s1 / m.E, 1e-12) && P.residual(s) > 0.048, `ε = 5 % dan yuksizlantirilsa qoldiq deformatsiya ${(P.residual(s) * 100).toFixed(2)} %`);
  const mid = P.strainTo(s, m, P.residual(s) + 0.5 * s1 / m.E); ok(near(mid, 0.5 * s1, 1), "yuksizlantirish chizig‘i qiyaligi E ga teng");
  ok(P.strainTo(s, m, e1) === s1, "qayta yuklashda o‘sha nuqtaga qaytadi");
  ok(s1 > m.sy, `naklyop: yangi elastiklik chegarasi ${(s1 / MPa).toFixed(0)} MPa > ${m.sy / MPa} MPa`); }
{ const m = M.steel, s = P.createSample(); P.strainTo(s, m, 0.3); ok(s.broken && P.stressAt(s, m, 0.3) === 0, "ε > εᵤ: namuna uziladi"); }

// 4. Kuch bilan yuklash
{ const m = M.steel, s = P.createSample(), e = P.strainFor(s, m, 100 * MPa); ok(near(e, 100 * MPa / m.E, 1e-12), "yuk bilan: σ = 100 MPa → ε = σ/E");
  const e2 = P.strainFor(s, m, 300 * MPa); ok(near(P.sigmaMono(m, e2), 300 * MPa, 0.01 * MPa) && e2 > 0.015, `σ = 300 MPa: plastik, ε = ${(e2 * 100).toFixed(2)} %`);
  const e3 = P.strainFor(s, m, 0); ok(near(e3, P.residual(s), 1e-12) && e3 > 0.01, "yuk olinganda qoldiq uzayish qoladi");
  P.strainFor(s, m, 450 * MPa); ok(s.broken, "σ > σₘ bo‘lsa sim uziladi"); }
{ const m = M.copper, s = P.createSample(), S = P.area(0.8e-3); P.strainFor(s, m, (3 * P.G) / S); const r = P.strainFor(s, m, 0);
  ok(r > 0, `mis sim 0,8 mm ga 3 kg osilsa qoldiq uzayish ${(r * 2000).toFixed(2)} mm (l = 2 m)`); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
