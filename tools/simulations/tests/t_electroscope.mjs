// Elektroskop fizikasini tekshirish: node tools/simulations/tests/t_electroscope.mjs
import * as P from "../../../assets/js/simulations/electroscope-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const DEG = Math.PI / 180;

// 1. Ishqalash: zaryad saqlanadi, to'yinadi, ishora juftlikka bog'liq
for (const [id, pr] of Object.entries(P.PAIRS)) {
  let rod = 0, cloth = 0;
  for (let k = 0; k < 400; k++) { const dT = P.rubStep(cloth, 0.03, pr); cloth -= dT; if (!pr.metal) rod += dT; }
  if (!pr.metal) ok(near(rod + cloth, 0, 1e-12), `${id}: q_tayoqcha + q_mato = 0 (${rod.toFixed(2)} + ${cloth.toFixed(2)})`);
  ok(near(-cloth, pr.sign * pr.qmax, 1e-6), `${id}: to'yinish |q| → ${pr.qmax} nC, ishora ${pr.sign > 0 ? "+" : "−"} (tayoqcha)`);
}
// ds bo'yicha aditivlik (bitta 0,3 m = ikkita 0,15 m)
{ const pr = P.PAIRS.glass; const a = P.rubStep(0, 0.3, pr); const b1 = P.rubStep(0, 0.15, pr), b2 = P.rubStep(-b1, 0.15, pr);
  ok(near(a, b1 + b2, 1e-12), `ishqalash yo'lga bog'liq, bo'linishga emas: ${a.toFixed(4)} = ${(b1 + b2).toFixed(4)}`);
  ok(near(a, 36 * (1 - Math.exp(-1)), 1e-12), "0,3 m dan keyin q = qmax(1 − 1/e)"); }

// 2. Elektronlar soni
ok(near(P.electrons(1), 1e-9 / 1.602e-19, 1e-12), `1 nC = ${(P.electrons(1) / 1e9).toFixed(3)} mlrd elektron`);

// 3. Yaproqcha muvozanati: tgθ = F/(mg)
for (const q of [1, 3, 6, 10, 15]) {
  const th = P.leafAngle(q), F = P.leafForce(q, th), mg = P.SCOPE.m * P.G;
  ok(near(Math.tan(th), F / mg, 1e-6), `Q_yap = ${q} nC: θ = ${(th / DEG).toFixed(1)}°, tgθ = F/mg`);
}
ok(P.leafAngle(0) === 0, "zaryadsiz — θ = 0");
ok(near(P.leafAngle(-5), P.leafAngle(5)), "θ zaryad ishorasiga bog'liq emas");
ok(P.leafAngle(1e4) === P.SCOPE.thMax, "juda katta zaryadda korpus devori: θ = θmax");
{ const t1 = P.leafAngle(5, { m: 4e-6 }), t2 = P.leafAngle(5, { m: 16e-6 }); ok(t1 > t2, `yengil yaproqcha sezgirroq: ${(t1 / DEG).toFixed(1)}° > ${(t2 / DEG).toFixed(1)}°`); }
// kichik burchak: θ³ ≈ kq²/(16L²mg)
{ const q = 0.2, c = (P.K * (q * 1e-9) ** 2) / (16 * P.SCOPE.L ** 2 * P.SCOPE.m * P.G); ok(near(P.leafAngle(q), Math.cbrt(c), 1e-3), "kichik burchak: θ ≈ (kq²/16L²mg)^(1/3)"); }

// 4. Induksiya: neytral elektroskop — yaproqchalarda +, sharchada −, yig'indi 0
{ const ext = P.external([{ q: 30, D: 0.04 }]), d = P.distribute(0, ext);
  ok(ext > 0 && d.leaf > 0 && d.ball < 0 && near(d.leaf + d.ball, 0, 1e-12), `induksiya: Q_sh = ${d.ball.toFixed(2)}, Q_y = +${d.leaf.toFixed(2)}, jami 0`); }
ok(near(P.coupling(0.016, 0.016), 1), "sharcha sirtida bog'lanish = 1");
ok(P.coupling(0.016, 0.3) < 0.005, "uzoqdagi (30 cm) zaryad ta'siri ekranlanadi (< 0,5 %)");
ok(near(P.coupling(0.016, 0.01), 1), "D < R bo'lsa ham bog'lanish ≤ 1");
// Yerga ulash: φ = 0 ⇒ Q_yap = 0
{ const ext = P.external([{ q: 30, D: 0.05 }]), Q = P.groundedQ(ext); ok(near(P.distribute(Q, ext).leaf, 0, 1e-12), `yerga ulanganda yaproqchalar zaryadsiz, Q = ${Q.toFixed(2)} nC`);
  // Induksiya orqali zaryadlash: tayoqcha olib ketilgach Q qoladi va ishorasi qarama-qarshi
  const leafAfter = P.distribute(Q, 0).leaf; ok(leafAfter < 0, `induksiya orqali zaryadlash: musbat tayoqcha → elektroskop manfiy (${leafAfter.toFixed(2)} nC yaproqchalarda)`); }

// 5. Tegizish: yig'indi saqlanadi, takrorlansa tenglashadi
{ let q = -36, Q = 0; const tot = q + Q; for (let k = 0; k < 60; k++) ({ q, Q } = P.touch(q, Q));
  ok(near(q + Q, tot, 1e-12), "tegizishda q + Q saqlanadi"); ok(near(q, Q, 1e-6) && near(Q, -18, 1e-6), `ko'p marta tegizilsa zaryad teng bo'linadi: ${Q.toFixed(3)} nC`);
  const r = P.touch(-36, 0); ok(r.Q < 0 && r.Q > -18, `bitta tegishda zaryadning bir qismi o'tadi: ${r.Q.toFixed(2)} nC`); }

// 6. Ikki elektroskopni ulash
{ const [a, b] = P.share(16, 0); ok(near(a, 8) && near(b, 8), "16 + 0 → 8 va 8"); }
{ const [a, b] = P.share(12, -12); ok(near(a, 0) && near(b, 0), "+12 va −12 → neytral"); }
{ const [a, b] = P.share(20, -6); ok(near(a, 7) && near(b, 7), "20 va −6 → 7 va 7"); }
{ const e1 = 3, e2 = -1, [a, b] = P.share(10, 2, e1, e2); ok(near(a + b, 12) && near(a + e1, b + e2), "tashqi zaryad bilan: potensiallar teng, yig'indi saqlanadi"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to'g'ri");
process.exit(fail ? 1 : 0);
