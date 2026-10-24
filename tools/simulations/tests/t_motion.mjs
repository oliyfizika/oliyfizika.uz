// Harakat grafiklari fizikasini tekshirish: node tools/simulations/tests/t_motion.mjs
import * as P from "../../../assets/js/simulations/motion-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// 1. Tekis harakat
{ const m = P.body({ x0: 10, v0: 5 }); const s = m.state(4);
  ok(near(s.x, 30) && near(s.v, 5) && near(s.a, 0), "tekis: x = x₀ + vt = 10 + 5·4 = 30 m");
  ok(near(s.s, 20), "tekis: yo'l s = v·t = 20 m"); }
{ const m = P.body({ x0: 120, v0: -6 }); ok(near(m.state(5).x, 90) && near(m.state(5).s, 30), "orqaga: x = 90 m, yo'l 30 m (musbat)"); }

// 2. Tekis tezlanuvchan
{ const m = P.body({ v0: 0, a: 2 }); const s = m.state(10);
  ok(near(s.x, 100) && near(s.v, 20), "joyidan a = 2: 10 s da x = at²/2 = 100 m, v = 20 m/s");
  ok(near(s.v * s.v, 2 * 2 * s.x), "v² = 2ax"); }
{ const m = P.body({ v0: 15, a: -3, stop: true });
  ok(near(m.ts, 5), "tormoz: to'xtash vaqti t = v₀/|a| = 5 s");
  ok(near(m.state(8).x, 37.5) && m.state(8).v === 0, "tormoz: to'xtash yo'li v₀²/2|a| = 37,5 m, keyin v = 0"); }
{ const m = P.body({ v0: 10, a: -2 }); // tormozsiz: orqaga qaytadi
  ok(near(m.state(10).x, 0) && near(m.state(10).s, 50), "qaytuvchi harakat: 10 s da Δx = 0, yo'l 50 m"); }

// 3. Bo'lakli v(t): zinapoya va siniq chiziq
{ const m = P.piecewise({ nodes: [12, 12, 12, 4, 4], dt: 2, shape: "step" });
  ok(near(m.state(10).x, 88) && near(m.T, 10), "zinapoya: 3·2·12 + 2·2·4 = 88 m");
  const av = P.averages(m, 10); ok(near(av.vs, 8.8), "o'rtacha tezlik = 88/10 = 8,8 m/s, tezliklar o'rtachasi (12 + 4)/2 = 8 emas"); }
{ const m = P.piecewise({ nodes: [0, 10, 10, 10, 10, 0], dt: 2, shape: "lin" });
  ok(near(m.state(10).x, 80), "trapetsiya: yuza = (10 + 6)/2·10 = 80 m");
  ok(near(m.state(1).a, 5) && near(m.state(9).a, -5), "tezlanish bo'laklarda: +5 va −5 m/s²"); }
{ const m = P.piecewise({ nodes: [10, 10, 0, -10, -10], dt: 2, shape: "step" });
  const av = P.averages(m, 10); ok(near(m.state(10).x, 0) && near(m.state(10).s, 80), "borib-qaytish: Δx = 0, yo'l 80 m");
  ok(near(av.vx, 0) && near(av.vs, 8), "o'rtacha ko'chish tezligi 0, o'rtacha tezlik 8 m/s"); }
{ const m = P.piecewise({ nodes: [8, -8], dt: 4, shape: "lin" }); // v nolni t = 2 da kesadi
  ok(near(m.state(4).x, 0) && near(m.state(4).s, 16), "chiziqli bo'lakda ishora o'zgarishi: Δx = 0, yo'l 2·(8·2/2) = 16 m"); }
// Uzluksizlik: bo'laklar chegarasida x uzluksiz
{ const m = P.piecewise({ nodes: [3, -5, 7, 1, 9, 2], dt: 2, shape: "lin" });
  let okc = true; for (let i = 1; i < 5; i++) okc &&= near(m.state(2 * i - 1e-9).x, m.state(2 * i).x, 1e-6);
  ok(okc, "bo'laklar chegarasida x(t) uzluksiz");
  // x(t) ni sonli integral bilan tekshirish
  let xi = 0; const N = 20000; for (let k = 0; k < N; k++) xi += m.state((k + 0.5) * 10 / N).v * 10 / N;
  ok(near(xi, m.state(10).x, 1e-5), `x(10) = ∫v dt = ${xi.toFixed(4)} m`); }

// 4. Uchrashish
{ const A = P.body({ x0: 0, v0: 10 }), B = P.body({ x0: 120, v0: -5 });
  const t = P.meetTime(A, B, 10); ok(near(t, 8) && near(A.state(t).x, 80), "qarama-qarshi: t = 120/15 = 8 s, x = 80 m"); }
{ const A = P.body({ x0: 0, v0: 12 }), B = P.body({ x0: 40, v0: 6 });
  const t = P.meetTime(A, B, 10); ok(near(t, 40 / 6) && near(A.state(t).x, 80), "quvib yetish: t = 40/6 ≈ 6,67 s, x = 80 m"); }
{ const A = P.body({ v0: 8 }), B = P.body({ a: 2 });
  const t = P.meetTime(A, B, 10); ok(near(t, 8) && near(B.state(t).x, 64), "tekis va tezlanuvchan: boshidan keyin t = 2v/a = 8 s, x = 64 m"); }
ok(P.meetTime(P.body({ v0: 5 }), P.body({ x0: 10, v0: 5 }), 10) === null, "parallel — uchrashmaydi");

// 5. Yo'l chetiga yetish
{ const m = P.body({ v0: 0, a: 4 }); const t = P.edgeTime(m, -10, 160, 10); ok(near(t, Math.sqrt(80), 1e-6), `x = 160 ga t = √(2·160/4) = ${t.toFixed(3)} s`); }
ok(P.edgeTime(P.body({ x0: 10, v0: 5 }), -10, 160, 10) === null, "oraliqdan chiqmaydi — null");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to'g'ri");
process.exit(fail ? 1 : 0);
