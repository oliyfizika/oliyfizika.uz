// Ipdagi to'lqin (leapfrog) barqarorligini tekshirish: node tools/simulations/tests/t_waves.mjs
import * as W from "../../../assets/js/simulations/waves-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };

// Brauzer kadrlari teng emas (dt ≈ 1/60 ± 40 %). Ip silliq qolishi kerak: katak o'lchamidagi egrilik
// garmonik to'lqinnikidan (A·k²·dx² ≈ 4·10⁻⁵) oshmasligi, amplituda manbanikidan oshmasligi shart.
function run({ speed = 1, jitter = true, seconds = 8, vSwitch = null } = {}) {
  const s = new W.StringWave({ L: 4, n: 400, v: 2, gamma: 0.02, right: "open" });
  const drive = (t) => 0.04 * Math.sin(TAU * t);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const frames = seconds * 60;
  for (let f = 0; f < frames; f++) { if (vSwitch && f === frames / 2) s.v = vSwitch; s.advance(speed * (jitter ? (0.6 + 0.8 * rnd()) / 60 : 1 / 60), drive); }
  let curv = 0, amp = 0;
  for (let i = 1; i < s.n; i++) { curv = Math.max(curv, Math.abs(s.u[i + 1] - 2 * s.u[i] + s.u[i - 1])); amp = Math.max(amp, Math.abs(s.u[i])); }
  return { curv, amp, t: s.t };
}
const TAU = Math.PI * 2;

{ const r = run(); ok(r.amp < 0.0405 && r.curv < 1e-4, `notekis kadrlar, Real tezlik: A = ${r.amp.toFixed(4)} m, egrilik ${r.curv.toExponential(1)} — tishli shovqin yo‘q`); }
{ const r = run({ speed: 0.25, seconds: 32 }); ok(r.amp < 0.0405 && r.curv < 1e-4, `notekis kadrlar, ×0,25: A = ${r.amp.toFixed(4)} m, egrilik ${r.curv.toExponential(1)} — barqaror`); }
{ const r = run({ vSwitch: 3 }); ok(r.amp < 0.0405 && r.curv < 1e-4, `tezlik v 2 → 3 m/s o‘zgartirilganda ham silliq (egrilik ${r.curv.toExponential(1)})`); }
{ const r = run({ jitter: false, seconds: 5 }); ok(Math.abs(r.t - 5) < 0.002, `vaqt hisobi: 5 s o‘tdi (t = ${r.t.toFixed(4)} s, qoldiq < 1 qadam)`); }

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
