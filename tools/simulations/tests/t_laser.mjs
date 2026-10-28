// Lazer fizikasini tekshirish: node tools/simulations/tests/t_laser.mjs
import * as P from "../../../assets/js/simulations/laser-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

ok(near(P.photonEV(694.3), 1.786, 0.002) && near(P.photonEV(632.8), 1.959, 0.002), `foton energiyasi: rubin ${P.photonEV(694.3).toFixed(3)} eV, He–Ne ${P.photonEV(632.8).toFixed(3)} eV`);
ok(near(P.nmOfEV(P.photonEV(550)), 550, 1e-9), "λ ↔ E o‘zaro teskari");
ok(near(P.LASERS.hene.levels.E2 - P.LASERS.hene.levels.E1, P.photonEV(632.8), 0.01), "He–Ne: neon sathlari farqi 632,8 nm ga mos");
ok(P.interact("E1", 694.3) === "absorb21" && P.interact("E2", 694.3) === "stim" && P.interact("E1", 550) === "absorb31" && P.interact("E1", 620) === "pass" && P.interact("E2", 550) === "pass", "rezonans: yutilish, majburiy nurlanish, nasos, o‘tib ketish");

function run(o, T = 40) {
  const st = P.createCavity(o); let n = 0, ax = 0, inv = 0, up = 0, out0 = 0;
  for (let i = 0; i < T * 100; i++) { P.stepCavity(st, 0.01); if (i === (T - 15) * 100) out0 = st.nOut; if (i > (T - 15) * 100) { n++; ax += P.axial(st); const c = P.counts(st); inv += c.inversion ? 1 : 0; up += c.upper / c.N; } }
  return { out: (st.nOut - out0) / 15, ax: ax / n, inv: inv / n, up: up / n, st };
}
const off = run({ W: 0 }); ok(off.st.ph.length === 0 && P.counts(off.st).G === 80, "nasossiz barcha atomlar asosiy sathda, nurlanish yo‘q");
const weak = run({ W: 0.2, R: 0.8 }), ruby = run({ W: 1, R: 0.8 }), noMir = run({ W: 1, R: 0 }), hene = run({ scheme: 4, W: 0.2, R: 0.8 });
ok(weak.ax < 3 && weak.inv < 0.5, `3 sathli, Wτ = 0,6 < 1: inversiya yo‘q (${(weak.inv * 100).toFixed(0)} % vaqt), lazer nuri yo‘q`);
ok(near(P.upperFraction(0.2, 3), 0.375, 1e-9) && near(weak.up, P.upperFraction(0.2, 3), 0.12), `yuqori sath ulushi Wτ/(1 + Wτ): nazariya 0,375, model ${weak.up.toFixed(2)}`);
ok(ruby.ax > 40 && ruby.out > 8, `rubin, Wτ = 3, R = 80 %: rezonatorda ${ruby.ax.toFixed(0)} foton, chiqish ${ruby.out.toFixed(1)}`);
ok(noMir.ax < 5 && noMir.out < ruby.out / 2, `ko‘zgusiz: o‘q bo‘ylab ${noMir.ax.toFixed(1)} foton — generatsiya yo‘q`);
ok(hene.ax > 40 && hene.up < 0.25, `4 sathli sxema kuchsiz nasosda ham ishlaydi (Wτ = 0,6): ${hene.ax.toFixed(0)} foton`);
{ const st = P.createCavity({ W: 0 }); st.atoms.forEach((a) => (a.s = "U")); st.tau = 1e9; const a = st.atoms[25]; st.ph.push({ x: a.x - 0.02, y: a.y, dx: 1, dy: 0, last: -1, id: 99, ph: 1.234 });
  for (let i = 0; i < 40; i++) P.stepCavity(st, 0.01);
  ok(st.ph.length > 1 && st.ph.every((p) => p.id === 99 && p.ph === 1.234 && p.dx === 1 && p.dy === 0), `majburiy nurlanish: ${st.ph.length} ta foton — hammasi bir xil yo‘nalish va fazada`); }
{ const st = P.createCavity({ W: 0 }); const a = st.atoms[25]; st.ph.push({ x: a.x - 0.02, y: a.y, dx: 1, dy: 0, last: -1, id: 5, ph: 0 });
  for (let i = 0; i < 80 && st.ph.length; i++) P.stepCavity(st, 0.01);
  ok(st.ph.length === 0 && P.counts(st).U === 1, "asosiy holatdagi atomlar fotonni yutadi"); }

if (fail) { console.log(`\n${fail} ta xato`); process.exit(1); } else console.log("\nhammasi to‘g‘ri");
