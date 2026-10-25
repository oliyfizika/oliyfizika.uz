// Statika fizikasini tekshirish: node tools/simulations/tests/t_statics.mjs
import * as P from "../../../assets/js/simulations/statics-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1e-30, Math.abs(b));

// 1. Massa markazi
{ const p = P.polyProps([[0, 0], [10, 0], [10, 4], [0, 4]]); ok(near(p.A, 40) && near(p.cx, 5) && near(p.cy, 2) && near(p.J - p.A * (25 + 4), (40 * (100 + 16)) / 12), "to‘g‘ri to‘rtburchak: yuz, markaz, J = m(a² + b²)/12"); }
{ const p = P.plateProps(P.SHAPES.tri); ok(near(p.cx, (0 + 9 + 26) / 3) && near(p.cy, 16), "uchburchak: massa markazi medianalar kesishgan nuqtada"); }
{ const p = P.plateProps(P.SHAPES.L); const A = 10 * 15 + 24 * 9, cx = (150 * 5 + 216 * 12) / A, cy = (150 * 7.5 + 216 * 19.5) / A; ok(near(p.A, A) && near(p.cx, cx) && near(p.cy, cy), `L shakl: ikki to‘rtburchakka bo‘lib hisoblash, C(${p.cx.toFixed(2)}; ${p.cy.toFixed(2)}) cm`); }
{ const p = P.plateProps(P.SHAPES.disk), A1 = Math.PI * 12.5 ** 2, A2 = Math.PI * 25, cx = (13 * A1 - 17.5 * A2) / (A1 - A2); ok(Math.abs(p.cx - cx) < 0.02 && p.cx < 13 && p.cy > 13, "teshikli disk: massa markazi teshikdan uzoqlashadi"); }
{ const p = P.plateProps(P.SHAPES.arch), R = 13, r = 7, yc = 14 - (4 * (R ** 3 - r ** 3)) / (3 * Math.PI * (R * R - r * r)); ok(Math.abs(p.cy - yc) < 0.05 && near(p.cx, 13, 1e-6) && !P.inside(P.SHAPES.arch, p.cx, p.cy), `yarim halqa: massa markazi jism tashqarisida (y = ${p.cy.toFixed(2)} cm)`); }
for (const [id, sh] of Object.entries(P.SHAPES)) {
  const pp = P.plateProps(sh);
  const ends = sh.holes.map((h) => { const st = { th: P.hangEq(pp, h) + 0.6, w: 0 }; for (let i = 0; i < 600; i++) P.plateStep(st, pp, h, 0.05); return { h, th: st.th }; });
  const lines = ends.map(({ h, th }) => ({ p: h, d: [Math.sin(th), Math.cos(th)] }));
  const X = P.lineX(lines[0], lines[1]), X2 = P.lineX(lines[1], lines[2]);
  ok(X && Math.hypot(X[0] - pp.cx, X[1] - pp.cy) < 0.05 && Math.hypot(X2[0] - pp.cx, X2[1] - pp.cy) < 0.05, `${sh.name}: osilgan plastinka to‘xtaydi, shovun chiziqlari massa markazida kesishadi`);
}
{ const pp = P.plateProps(P.SHAPES.L), h = P.SHAPES.L.holes[0], d = Math.hypot(pp.cx - h[0], pp.cy - h[1]), T = (2 * Math.PI) / P.hangOmega(pp, h); ok(near(T, 2 * Math.PI * Math.sqrt((pp.Jc / pp.A + d * d) / (980 * d))), `fizik mayatnik davri T = ${T.toFixed(3)} s`); }

// 2. Ag'darilish
{ const b = 0.1, h = 0.3; ok(near(P.tipCrit(b, h), Math.atan(1 / 3)) && near(P.tipCrit(b, h, 0.25), Math.atan(2 / 3)), `quti 10×30 cm: α_kr = ${(P.tipCrit(b, h) * 180 / Math.PI).toFixed(1)}°, og‘ir asos bilan ${(P.tipCrit(b, h, 0.25) * 180 / Math.PI).toFixed(1)}°`); }
{ const b = 0.1, h = 0.3, ac = P.tipCrit(b, h); ok(Math.abs(P.tipTorque(1, b, h, 0.5, ac)) < 1e-12 && P.tipTorque(1, b, h, 0.5, ac - 0.01) > 0 && P.tipTorque(1, b, h, 0.5, ac + 0.01) < 0, "α_kr da massa markazi tayanch qirrasi ustida: moment nolga teng"); }
{ const b = 0.1, h = 0.3, ac = P.tipCrit(b, h); let mx = 0, am = 0; for (let a = 0; a < 1.5; a += 0.001) { const y = P.tipHeight(b, h, 0.5, a); if (y > mx) { mx = y; am = a; } } ok(Math.abs(am - ac) < 0.002, "massa markazi balandligi α_kr da eng katta (turg‘unlik chegarasi)"); }
{ const box = { m: 1, b: 0.1, h: 0.3, f: 0.5 }, ac = P.tipCrit(0.1, 0.3); const s1 = { a: ac - 0.03, w: 0 }, s2 = { a: ac + 0.03, w: 0 }; for (let i = 0; i < 400; i++) { P.tipStep(s1, box, 0.01); P.tipStep(s2, box, 0.01); } ok(s1.a === 0 && s2.a === Math.PI / 2, "α_kr dan kichik — qaytadi, katta — ag‘dariladi"); }

// 3. Sharcha
{ const st = { x: 6, v: 0 }; for (let i = 0; i < 3000; i++) P.ballStep(st, "bowl", 0.01); ok(Math.abs(st.x) < 0.05, "botiq sirt: sharcha pastki nuqtaga qaytadi (turg‘un muvozanat)"); }
{ const st = { x: 0.3, v: 0 }; for (let i = 0; i < 3000; i++) P.ballStep(st, "dome", 0.01); ok(Math.abs(st.x) > 15, "qavariq sirt: biroz siljitilsa, dumalab tushib ketadi (turg‘unmas)"); }
{ const st = { x: 4, v: 0 }; for (let i = 0; i < 300; i++) P.ballStep(st, "flat", 0.01); ok(near(st.x, 4), "tekis sirt: har qanday nuqtada muvozanatda (befarq)"); }
{ const w0 = Math.sqrt((5 / 7) * 980 / P.SURF_R), st = { x: 2, v: 0 }; let t = 0, prev = 2, tc = []; for (let i = 0; i < 4000; i++) { P.ballStep(st, "bowl", 0.001, 0); t += 0.001; if (prev > 0 && st.x <= 0) tc.push(t); prev = st.x; } const T = tc[1] - tc[0]; ok(Math.abs(T - (2 * Math.PI) / w0) < 0.01, `botiqdagi sharcha tebranish davri 2π√(7R/5g) = ${((2 * Math.PI) / w0).toFixed(3)} s`); }

// 4. Richag
{ const m = P.leverMoments([{ x: -0.15, m: 0.2 }, { x: 0.1, m: 0.3 }]); ok(Math.abs(m.net) < 1e-12 && near(m.cw, 0.3 * 9.8 * 0.1), "moment qoidasi: 2 yuk × 15 cm = 3 yuk × 10 cm"); }
{ const m = P.leverMoments([{ x: -0.2, m: 0.3 }]), F = P.dynForce(m.net, 0.1, 0, 0); ok(near(F, -0.3 * 9.8 * 2) && F < 0, "chapda 3 yuk 20 cm da, dinamometr o‘ngda 10 cm da: pastga 5,88 N"); }
{ const m = P.leverMoments([{ x: -0.2, m: 0.3 }]), F0 = P.dynForce(m.net, -0.3, 0, 0), F60 = P.dynForce(m.net, -0.3, 0, Math.PI / 3); ok(F0 > 0 && near(F0, 1.96) && near(F60, 2 * F0), "dinamometr qiya tortsa yelka l·cosφ: 60° da kuch 2 marta katta"); }
{ const loads = [{ x: 0, m: 0 }], m = P.leverMoments([], -0.05); ok(near(m.net, P.LEVER.mBar * 9.8 * 0.05), "tayanch siljitilsa richagning o‘z og‘irligi moment beradi"); }
{ const loads = [{ x: -0.15, m: 0.2 }, { x: 0.1, m: 0.3 }]; ok(near(P.pivotN(loads), (0.5 + P.LEVER.mBar) * 9.8), "tayanch reaksiyasi barcha og‘irliklar yig‘indisiga teng"); }
{ const m = P.leverMoments([{ x: 0.2, m: 0.1 }], 0.1); ok(Math.abs(m.net) < 1e-12, "tayanch 10 cm siljigan: richag og‘irligini tayanchdan 10 cm dagi bitta 100 g yuk muvozanatlaydi"); }
{ const loads = [{ x: -0.15, m: 0.2 }, { x: 0.1, m: 0.3 }], st = { b: 0.1, w: 0 }; for (let i = 0; i < 2000; i++) P.leverStep(st, loads, 0, 0.01); ok(Math.abs(st.b) < 1e-3, "muvozanatdagi richag gorizontal holatga qaytadi"); }
{ const loads = [{ x: -0.15, m: 0.2 }, { x: 0.15, m: 0.3 }], st = { b: 0, w: 0 }; for (let i = 0; i < 300; i++) P.leverStep(st, loads, 0, 0.01); ok(near(st.b, P.LEVER_STOP), "momentlar teng bo‘lmasa richag tirgakkacha buriladi"); }

// 5. Oddiy mexanizmlar
for (const [kind, o] of [["fixed", {}], ["movable", {}], ["tackle", { n: 4 }], ["tackle", { n: 6 }], ["axle", { R: 0.3 }]]) {
  const r = P.mechForce(kind, 2, { ...o, ideal: true }), q = P.mechForce(kind, 2, o);
  ok(near(r.F * r.k, r.W) && near(r.eta, 1) && q.F > r.F && q.eta < 1 && q.eta > 0.6, `${kind}${o.n || ""}: ideal holda F·s = mgh (oltin qoida), real FIK ${(q.eta * 100).toFixed(0)} %`);
}
ok(near(P.mechForce("movable", 2, { ideal: true }).F, 9.8) && near(P.mechForce("fixed", 2, { ideal: true }).F, 19.6), "qo‘zg‘aluvchan blok kuchdan 2 marta yutuq beradi, qo‘zg‘almas — faqat yo‘nalishni o‘zgartiradi");
ok(near(P.mechForce("axle", 10, { R: 0.3, ideal: true }).F, 98 / 6), "chig‘ir: F = mg·r/R (r = 5 cm, R = 30 cm → 6 marta)");
{ const e = 0.95, q = P.mechForce("tackle", 2, { n: 4 }); ok(near(q.F, (2 * 9.8 + 0.2 * 9.8) / (e + e ** 2 + e ** 3 + e ** 4)), "polispast: har g‘ildirakda taranglik η marta kamayadi"); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
