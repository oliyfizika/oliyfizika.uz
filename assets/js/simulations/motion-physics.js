// ==========================================================================
// Harakat grafiklari — fizika (DOM'siz, SI: m, s, m/s, m/s²).
// To'g'ri chiziqli harakat: tekis (x = x₀ + vt), tekis o'zgaruvchan (x = x₀ + v₀t + at²/2, ixtiyoriy tormoz —
// v = 0 da to'xtash), bo'lakli v(t) (zinapoya yoki siniq chiziq) — aniq integrallash.
// Yo'l s = ∫|v|dt, ko'chish Δx, o'rtacha tezlik s/t va o'rtacha ko'chish tezligi Δx/t, uchrashish vaqti.
// ==========================================================================

/** Tekis o'zgaruvchan harakat (a = 0 bo'lsa tekis). stop — tezlik nolga yetganda jism to'xtaydi (tormozlash). */
export function body({ x0 = 0, v0 = 0, a = 0, stop = false } = {}) {
  const ts = stop && a * v0 < 0 ? -v0 / a : Infinity;
  const raw = (t) => ({ x: x0 + v0 * t + 0.5 * a * t * t, v: v0 + a * t, a });
  const state = (t) => {
    if (t <= ts) { const r = raw(t); r.s = pathLin(v0, a, t); return r; }
    const r = raw(ts); return { x: r.x, v: 0, a: 0, s: pathLin(v0, a, ts) };
  };
  return { kind: "body", x0, v0, a, stop, ts, state };
}

/** v(t) = v0 + a·t uchun [0, t] dagi yo'l ∫|v|dt (ishora o'zgarsa bo'lib hisoblanadi). */
export function pathLin(v0, a, t) {
  if (t <= 0) return 0;
  const seg = (u0, T) => Math.abs(u0 * T + 0.5 * a * T * T);
  if (a !== 0) {
    const tz = -v0 / a;
    if (tz > 0 && tz < t) return seg(v0, tz) + seg(0, t - tz);
  }
  return seg(v0, t);
}

/**
 * Bo'lakli tezlik: nodes — tezliklar, dt — bo'lak davomiyligi.
 * shape "step": i-bo'lakda v = nodes[i] (nodes.length bo'lak);
 * shape "lin": tugunlar t = i·dt da, orasida chiziqli (nodes.length − 1 bo'lak).
 */
export function piecewise({ x0 = 0, nodes, dt = 2, shape = "lin" }) {
  const n = shape === "step" ? nodes.length : nodes.length - 1, T = n * dt;
  const segs = []; let x = x0, s = 0;
  for (let i = 0; i < n; i++) {
    const v0 = nodes[i], a = shape === "step" ? 0 : (nodes[i + 1] - nodes[i]) / dt;
    segs.push({ t0: i * dt, x0: x, s0: s, v0, a });
    x += v0 * dt + 0.5 * a * dt * dt; s += pathLin(v0, a, dt);
  }
  const state = (t) => {
    const tt = Math.min(Math.max(t, 0), T), i = Math.min(n - 1, Math.floor(tt / dt)), g = segs[i], u = tt - g.t0;
    return { x: g.x0 + g.v0 * u + 0.5 * g.a * u * u, v: g.v0 + g.a * u, a: g.a, s: g.s0 + pathLin(g.v0, g.a, u) };
  };
  return { kind: "pw", x0, nodes, dt, shape, T, segs, state };
}

/** O'rtacha tezlik (yo'l / vaqt) va o'rtacha ko'chish tezligi (Δx / vaqt). */
export function averages(m, t) {
  if (!(t > 0)) return { vs: 0, vx: 0 };
  const st = m.state(t);
  return { vs: st.s / t, vx: (st.x - m.state(0).x) / t };
}

/** f(t) = 0 ning [t0, t1] dagi birinchi ildizi (namuna + bisektsiya). */
function firstRoot(f, t0, t1, n = 400) {
  let a = t0, fa = f(a);
  if (Math.abs(fa) < 1e-12) return a;
  for (let k = 1; k <= n; k++) {
    const b = t0 + ((t1 - t0) * k) / n, fb = f(b);
    if (fa === 0) return a;
    if (fa * fb <= 0) {
      let lo = a, hi = b, flo = fa;
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
      return (lo + hi) / 2;
    }
    a = b; fa = fb;
  }
  return null;
}

/** Ikki jismning uchrashish vaqti (t > 0). Boshida bir joyda bo'lsa — keyingi uchrashuv. */
export function meetTime(A, B, tMax) {
  const f = (t) => A.state(t).x - B.state(t).x;
  const t0 = Math.abs(f(0)) < 1e-9 ? 1e-6 : 0;
  const t = firstRoot(f, t0, tMax);
  return t !== null && t > 1e-6 ? t : null;
}

/** Jism [lo, hi] oraliqdan chiqadigan vaqt (yo'l chetiga yetish). */
export function edgeTime(m, lo, hi, tMax, n = 400) {
  const out = (t) => { const x = m.state(t).x; return x < lo - 1e-9 || x > hi + 1e-9; };
  let a = 0;
  for (let k = 1; k <= n; k++) {
    const b = (tMax * k) / n;
    if (out(b)) { let l = a, h = b; for (let i = 0; i < 60; i++) { const mid = (l + h) / 2; if (out(mid)) h = mid; else l = mid; } return l; }
    a = b;
  }
  return null;
}

/** Trayektoriya bo'yicha x ning eng kichik va eng katta qiymati. */
export function xRange(m, T, n = 200) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= n; i++) { const x = m.state((T * i) / n).x; lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return [lo, hi];
}
