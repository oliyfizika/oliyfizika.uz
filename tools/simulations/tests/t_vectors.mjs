// Vektorlar va kuchlarni qo'shish fizikasini tekshirish: node tools/simulations/tests/t_vectors.mjs
import * as P from "../../../assets/js/simulations/vectors-physics.js";

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fail++; };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

const a = P.vec(4, 3), b = P.vec(1, 3);
ok(near(P.mag(a), 5), "|a| = √(4² + 3²) = 5");
ok(near(P.dirDeg(a), 36.8699, 1e-5), "a ning yo‘nalishi 36,87°");
ok(near(P.dirDeg(P.vec(-1, -1)), 225), "III chorakdagi vektor: 225°");
{ const s = P.add(a, b); ok(s.x === 5 && s.y === 6, "a + b = (5; 6) — proyeksiyalar qo‘shiladi"); }
ok(near(P.mag(P.add(a, b)), P.sumMag(P.mag(a), P.mag(b), P.between(a, b))), "kosinuslar teoremasi koordinatalar bilan mos");
ok(near(P.mag(P.sub(a, b)), P.diffMag(P.mag(a), P.mag(b), P.between(a, b))), "|a − b| ham mos");
ok(near(P.sumMag(3, 2, 0), 5) && near(P.sumMag(3, 2, 180), 1), "bir yo‘nalishda 3 + 2 = 5, qarama-qarshi 3 − 2 = 1");
ok(near(P.sumMag(3, 4, 90), 5), "o‘zaro perpendikulyar 3 va 4 → 5 (Pifagor)");
ok(near(P.sumMag(4, 4, 120), 4), "teng kuchlar 120° ostida — natijaviy kuch ham shu kattalikda");
ok(near(P.mag(P.add(a, b)), P.mag(P.add(b, a))), "qo‘shish o‘rin almashtiriladi: a + b = b + a");
{ const k = P.scale(a, -1.5); ok(near(P.mag(k), 7.5) && near(P.dirDeg(k), P.dirDeg(a) + 180), "−1,5·a: moduli 1,5 marta katta, yo‘nalishi teskari"); }
{ const p = P.proj(5, 36.8699); ok(near(p.x, 4, 1e-5) && near(p.y, 3, 1e-5), "proyeksiyalar aₓ = a·cosα, a_y = a·sinα"); }
{ const fs = [P.polar(5, 90), P.polar(5, 210), P.polar(5, 330)]; ok(P.isBalanced(fs, 1e-9), "uchta teng kuch 120° dan — muvozanat (R = 0)"); }
{ const fs = [P.vec(3, 0), P.vec(0, 4)], R = P.resultant(fs); ok(near(P.mag(R), 5) && P.isBalanced([...fs, P.neg(R)]), "muvozanatlovchi kuch −R qo‘shilsa, yig‘indi nol"); }
{ // chiroq ikki simda: og'irlik 6 N, simlar gorizontga 30° → T = mg/(2 sin30°) = 6 N
  const W = P.vec(0, -6), T = 6 / (2 * Math.sin(30 * P.DEG)), fs = [W, P.polar(T, 30), P.polar(T, 150)];
  ok(P.isBalanced(fs, 1e-9) && near(T, 6), "ikki simdagi chiroq: T = mg/(2·sin30°) = 6 N (og‘irlik 6 N)"); }
ok(near(P.between(P.vec(1, 0), P.vec(0, 2)), 90) && near(P.between(P.vec(1, 0), P.vec(-1, 0)), 180), "vektorlar orasidagi burchak");

console.log(fail ? `\n${fail} ta xato` : "\nHammasi to‘g‘ri");
process.exit(fail ? 1 : 0);
