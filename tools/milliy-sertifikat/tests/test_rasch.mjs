// Rasch moduli (milliy-sertifikat/mock-testlar/js/rasch.js) — sintetik ma'lumotlar bilan testlar.
//   node tools/milliy-sertifikat/tests/test_rasch.mjs        (exit 1 — FAIL)
import { estimateRasch, scoreSession, toScaledScores, levelOf, percentOf, sectionBreakdown, estimateAbility } from "../../../milliy-sertifikat/mock-testlar/js/rasch.js";

let fails = 0;
const ok = (name, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };

// Deterministik PRNG (mulberry32) + normal taqsimot
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normal = (r) => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
const corr = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
function simulate(N, L, seed, thetaMean = 0) {
  const r = rng(seed);
  const th = Array.from({ length: N }, () => thetaMean + normal(r));
  const b = Array.from({ length: L }, () => -2.5 + 5 * r());
  const mb = b.reduce((s, v) => s + v, 0) / L;
  const bc = b.map((v) => v - mb);
  const X = th.map((t) => bc.map((bi) => (r() < 1 / (1 + Math.exp(-(t - bi))) ? 1 : 0)));
  return { th, b: bc, X };
}

// 1) Levels — egasi bergan jadval
const table = [[75, "A+"], [70.07, "A+"], [70, "A+"], [69.9, "A"], [65, "A"], [64.9, "B+"], [60, "B+"], [59.9, "B"], [55, "B"], [54.9, "C+"], [50, "C+"], [49.9, "C"], [46, "C"], [45.99, null], [0, null]];
table.forEach(([s, want]) => ok(`daraja ${s} → ${want}`, levelOf(s) === want, String(levelOf(s))));
ok("foiz 70,07 → 100", percentOf(70.07) === 100);
ok("foiz 65 → 92,86", percentOf(65) === 92.86, String(percentOf(65)));
ok("foiz 0 → 0", percentOf(0) === 0);

// 2) Parametrlarni qayta tiklash (N=600, L=55)
const S = simulate(600, 55, 42);
const t0 = Date.now();
const m = estimateRasch(S.X);
const ms = Date.now() - t0;
ok("JMLE yaqinlashdi", m.converged, `${m.iterations} iteratsiya, ${ms} ms`);
const est = m.b.map((v, i) => [v, S.b[i]]).filter(([v]) => v !== null);
const rmseB = Math.sqrt(est.reduce((s, [a, t]) => s + (a - t) ** 2, 0) / est.length);
ok("band qiyinligi: r > 0,98", corr(est.map((e) => e[0]), est.map((e) => e[1])) > 0.98, corr(est.map((e) => e[0]), est.map((e) => e[1])).toFixed(4));
ok("band qiyinligi: RMSE < 0,2 logit", rmseB < 0.2, rmseB.toFixed(3));
const rTh = corr(m.theta, S.th);
ok("qobiliyat: r > 0,9", rTh > 0.9, rTh.toFixed(4));
ok("ishonchlilik 0,8–1", m.reliability > 0.8 && m.reliability <= 1, m.reliability?.toFixed(3));
ok("bandlar o‘rtachasi ≈ 0 (bias tuzatishdan keyin ham)", Math.abs(m.b.reduce((s, v) => s + v, 0) / 55) < 1e-6);

// 3) Rasch xossasi: bir xil xom ball → bir xil θ; xom ball oshsa θ oshadi (qat'iy monoton)
const res = scoreSession(S.X);
const byRaw = new Map();
res.persons.forEach((p) => { if (!byRaw.has(p.raw)) byRaw.set(p.raw, new Set()); byRaw.get(p.raw).add(p.theta); });
ok("bir xil xom ball → bir xil θ", [...byRaw.values()].every((s) => s.size === 1));
const raws = [...byRaw.keys()].sort((a, b) => a - b);
const ths = raws.map((r) => [...byRaw.get(r)][0]);
ok("θ xom ball bo‘yicha qat’iy o‘sadi", ths.every((v, i) => i === 0 || v > ths[i - 1]));
const scs = res.persons.map((p) => p.score);
ok("ballar [0; 75] oralig‘ida", scs.every((s) => s >= 0 && s <= 75));
const mean = scs.reduce((s, v) => s + v, 0) / scs.length;
ok("T-ball o‘rtachasi ≈ 50", Math.abs(mean - 50) < 0.5, mean.toFixed(2));
ok("daraja = levelOf(ball)", res.persons.every((p) => p.level === levelOf(p.score)));

// 4) Ekstremal holatlar: 0 va maksimal ball, hamma to'g'ri/xato band
const E = simulate(80, 20, 7);
E.X[0] = E.X[0].map(() => 0);
E.X[1] = E.X[1].map(() => 1);
E.X.forEach((row) => { row[3] = 1; row[4] = 0; });
const me = estimateRasch(E.X);
ok("hamma to‘g‘ri band → all-correct, b=null", me.itemStatus[3] === "all-correct" && me.b[3] === null);
ok("hamma xato band → all-wrong, b=null", me.itemStatus[4] === "all-wrong" && me.b[4] === null);
ok("0 ball → min, θ chekli va eng past", me.personExtreme[0] === "min" && Number.isFinite(me.theta[0]) && me.theta[0] === Math.min(...me.theta));
ok("maksimal → max, θ chekli va eng yuqori", me.personExtreme[1] === "max" && Number.isFinite(me.theta[1]) && me.theta[1] === Math.max(...me.theta));
ok("barcha θ chekli", me.theta.every(Number.isFinite));

// 5) Kichik va degenerat to'plamlar
const tiny = [[1, 0, 1], [0, 0, 1], [1, 1, 1]];
const mt = estimateRasch(tiny);
ok("3 ishtirokchi: θ chekli va tartibli", mt.theta.every(Number.isFinite) && mt.theta[2] > mt.theta[0] && mt.theta[0] > mt.theta[1]);
const same = toScaledScores([0.3, 0.3, 0.3]);
ok("hamma θ bir xil → hamma 50", same.every((s) => s === 50));
ok("bitta ishtirokchi → 50", toScaledScores([1.2])[0] === 50);
let threw = false; try { estimateRasch([]); } catch { threw = true; }
ok("bo‘sh matritsa → xato", threw);
const allSame = estimateRasch([[1, 0], [1, 0], [1, 0]]);
ok("hamma band ekstremal → xatosiz", allSame.estimatedItems === 0 && allSame.theta.every(Number.isFinite));

// 6) estimateAbility: ma'lum qiyinliklar bilan teskari tekshiruv — kutilgan ball = r
const bs = [-1.5, -0.5, 0, 0.7, 1.4, 2];
const ab = estimateAbility(3, bs);
const expScore = bs.reduce((s, b) => s + 1 / (1 + Math.exp(-(ab.theta - b))), 0);
ok("estimateAbility: Σp = r", Math.abs(expScore - 3) < 1e-6, expScore.toFixed(6));

// 7) Bo'limlar taqsimoti: yig'indi = umumiy ball, yechilmagan bo'lim = 0
const sec = sectionBreakdown(70.07, [1, 1, 0, 1, 0, 1], [-1, 0.5, 1, 2, null, 0], ["mex", "mex", "mol", "elek", "opt", "opt"], ["mex", "mol", "elek", "opt", "amaliy"]);
const sum = Math.round(sec.reduce((s, x) => s + x.score, 0) * 1000) / 1000;
ok("bo‘limlar yig‘indisi = 70,07", sum === 70.07, String(sum));
ok("yechilmagan bo‘lim = 0", sec.find((s) => s.id === "mol").score === 0 && sec.find((s) => s.id === "amaliy").score === 0);
ok("qiyinroq band ko‘proq hissa", sec.find((s) => s.id === "elek").score > sec.find((s) => s.id === "opt").score);

// 8) Barqarorlik: 2000 ishtirokchi × 55 band tez ishlaydi
const big = simulate(2000, 55, 99, 0.5);
const t1 = Date.now();
const mb = estimateRasch(big.X);
ok("2000×55 < 5 s va yaqinlashadi", mb.converged && Date.now() - t1 < 5000, `${Date.now() - t1} ms`);

console.log(fails ? `\n${fails} ta FAIL` : "\nHammasi PASS");
process.exit(fails ? 1 : 0);
