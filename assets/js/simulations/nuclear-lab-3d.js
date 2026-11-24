// Yadro fizikasi — 360° 3D laboratoriya sahnasi (simulations/nuclear.html).
// Holat va fizika nuclear.js / nuclear-physics.js da o'zgarmaydi; bu yerda namuna, yadro modellari, reaktor zonasi va tutqichlar.
// Old tomon −z, stol usti y = 0. Keng ekranda o'ng yuqori burchakda ma'lumot paneli (2D) chiziladi.
import { createLab3D } from './lab-3d.js?v=20261124-n3';
import { alpha, arrowSolid } from './apparatus-3d.js?v=20261124-n3';
import { ball, glow, camRing, planeHit, cameraAxes, display, shell } from './devices-3d.js?v=20261124-n3';
import { clamp, fmt, sci } from './sim-kit.js';
import * as P from './nuclear-physics.js';

const TAU = Math.PI * 2;
const SMALL = '600 10px Inter, system-ui, sans-serif', MID = '600 11px Inter, system-ui, sans-serif', BOLD = '700 13px Inter, system-ui, sans-serif';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('');
const nuclide = (Z, A) => (Z === 0 ? 'n' : `${sup(A)}${P.symOf(Z)}`);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const frac = (v) => v - Math.floor(v);
const NUC = (c) => ({ p: c.dark ? '#f87171' : '#dc2626', n: c.dark ? '#94a3b8' : '#64748b', fuel: c.warning, u238: c.dark ? '#64748b' : '#94a3b8', big: c.dark ? '#fb923c' : '#ea580c', dead: c.dark ? '#3b4a63' : '#cbd5e1' });

/** Har tajribaning boshlang'ich kamerasi; hud — o'ng yuqorida panel bo'lsa sahna chapga suriladi. */
const VIEW = {
  decay: { begin: { target: [0.1, 0.75, 0], focal: 1.95 }, camera: { yaw: -0.45, pitch: 0.42, zoom: 1 }, hud: 0.6 },
  bind: { begin: { target: [-0.1, 0.8, 0], focal: 2.2 }, camera: { yaw: -0.3, pitch: 0.3, zoom: 1 }, hud: 0.6 },
  react: { begin: { target: [0, 0.85, 0.2], focal: 2.0 }, camera: { yaw: -0.25, pitch: 0.3, zoom: 1 }, hud: 0 },
  chain: { begin: { target: [0, 1.15, 0], focal: 1.95 }, camera: { yaw: -0.3, pitch: 0.2, zoom: 1 }, hud: 0 },
};
const DIMS = { 100: [5, 4, 5], 400: [10, 5, 8], 1600: [16, 10, 10] };
const SAMPLE = [-0.45, 0.1, 0]; // namuna markazi (x, z) va tag balandligi
const NUCLEUS = [-0.15, 1.0, 0.15], PILES = { p: [-2.05, 0, -0.45], n: [-1.3, 0, -0.45] };
const CORE_CELL = 3.4 / 24, CORE_BASE = 0.3; // zona katakchasi (eng katta zona 24 katak) va pastki cheti

/** Nuklonlar «to'pi»: i-nuklon radiusi ∛i ga proporsional, yo'nalishi R2 (kvazitasodifiy) ketma-ketlikdan — A ortganda eskilari joyida qoladi. */
export function clusterPoints(Z, A, center, rn) {
  const out = [];
  for (let i = 0; i < A; i++) {
    const r = rn * 1.2 * Math.cbrt(i), ph = TAU * frac(0.5 + i * 0.5698402910), ct = 1 - 2 * frac(0.5 + i * 0.7548776662), st = Math.sqrt(Math.max(0, 1 - ct * ct));
    out.push({ p: [center[0] + r * st * Math.cos(ph), center[1] + r * ct, center[2] + r * st * Math.sin(ph)], proton: Math.floor(((i + 1) * Z) / A) > Math.floor((i * Z) / A) });
  }
  return out;
}

export function createNuclearLab() {
  const lab = createLab3D();
  let mode = 'decay', picks = [], nucleons = [], center = NUCLEUS, rodAt = null, coreMap = null, grid = null;
  lab.reset = () => Object.assign(lab.camera, VIEW[mode].camera);
  lab.reset();

  /* ---------------------------------------------------------------- 1) Yemirilish */
  function lattice(N0) {
    const [nx, ny, nz] = DIMS[N0] || [Math.ceil(Math.cbrt(N0)), Math.ceil(Math.cbrt(N0)), Math.ceil(Math.cbrt(N0))], s = 1.9 / nx;
    const W = nx * s, D = nz * s, y0 = SAMPLE[1] + 0.08;
    return { nx, ny, nz, s, W, H: ny * s, D, y0, at: (i) => [SAMPLE[0] - W / 2 + ((i % nx) + 0.5) * s, y0 + (Math.floor(i / (nx * nz)) + 0.5) * s, SAMPLE[2] - D / 2 + ((Math.floor(i / nx) % nz) + 0.5) * s] };
  }
  function box3(x0, y0, z0, x1, y1, z1, color, width = 1) {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) lab.line(v[a], v[b], color, width);
  }
  function decayScene(d, narrow) {
    const c = lab.colors, col = NUC(c), I = d.iso, L = (grid = lattice(d.N0)), r = L.s * 0.36, seg = d.N0 > 400 ? 3 : d.N0 > 100 ? 4 : 6;
    lab.box(SAMPLE[0] - L.W / 2 - 0.12, 0, SAMPLE[2] - L.D / 2 - 0.12, L.W + 0.24, 0.08, L.D + 0.24, c.text3);
    box3(SAMPLE[0] - L.W / 2 - 0.03, L.y0, SAMPLE[2] - L.D / 2 - 0.03, SAMPLE[0] + L.W / 2 + 0.03, L.y0 + L.H + 0.03, SAMPLE[2] + L.D / 2 + 0.03, c.borderStrong, 1);
    picks = new Array(d.N0);
    for (let i = 0; i < d.N0; i++) {
      const p = L.at(i), alive = d.decayedAt[i] === Infinity;
      ball(lab, p, alive ? r : r * 0.55, alive ? col.fuel : col.dead, seg);
      picks[i] = { ...lab.project(p), alive };
    }
    picks.rpx = screenRadius([SAMPLE[0], L.y0 + L.H / 2, SAMPLE[2]], r);
    // yemirilish chaqnashlari: α — qizil, β⁻ — ko'k zarra, γ — to'lqin chiziq
    for (const f of d.flashes) {
      const p = L.at(f.i), u = f.age / 0.8, el = (frac(f.i * 0.618034) - 0.5) * 1.2, dir = [Math.cos(el) * Math.cos(f.a), Math.sin(el), Math.cos(el) * Math.sin(f.a)], dist = 0.08 + 1.1 * u;
      camRing(lab, p, r + 0.03 + 0.12 * u, alpha(c.text, 1 - u), 1.4, 14);
      if (I.type === 'α') ball(lab, add(p, dir, dist), 0.045, c.danger, 3);
      else if (I.type === 'β⁻') ball(lab, add(p, dir, dist), 0.026, c.primary, 3);
      else {
        const side = Math.abs(dir[1]) < 0.9 ? [-dir[2], 0, dir[0]] : [1, 0, 0], pts = [];
        for (let k = 0; k <= 12; k++) pts.push(add(add(p, dir, (k / 12) * dist), side, Math.sin(k * 1.6) * 0.035));
        for (let k = 1; k < pts.length; k++) lab.line(pts[k - 1], pts[k], alpha(c.special, 1 - u * 0.7), 1.8);
      }
    }
    if (d.sel !== null && d.sel < d.N0) {
      const p = L.at(d.sel), t = d.decayedAt[d.sel];
      camRing(lab, p, r + 0.05, c.primary, 2.4, 20);
      lab.label(t === Infinity ? `${I.sym}: hali yemirilmagan` : `${I.daughter}: t = ${sci(t, 3)} ${I.unit} da yemirildi`, [p[0], p[1] + r + 0.16, p[2]], c.text);
    }
    if (narrow) lab.label(`qoldi: N = ${d.N} / ${d.N0}`, [SAMPLE[0], L.y0 + L.H + 0.25, SAMPLE[2]], c.text);
    // Geyger–Myuller hisoblagichi: zond namunaga qaratilgan, displeyda yemirilganlar soni
    const gx = 1.75, gz = -0.55, recent = d.flashes.some((f) => f.age < 0.08);
    display(lab, [gx, 0, gz], { w: 0.72, h: 0.38, d: 0.3, text: String(d.N0 - d.N), title: 'Geyger–Myuller hisoblagichi' });
    ball(lab, [gx + 0.28, 0.33, gz - 0.005], 0.025, recent ? c.danger : alpha(c.danger, 0.3), 3);
    const tip = [SAMPLE[0] + L.W / 2 + 0.22, L.y0 + L.H * 0.5, SAMPLE[2]], back = [tip[0] + 0.42, tip[1], tip[2]];
    lab.rod(tip, back, 0.055, c.text2, 16); lab.rod([tip[0] - 0.015, tip[1], tip[2]], tip, 0.058, c.text3, 16);
    lab.rod([back[0] - 0.1, 0, back[2]], [back[0] - 0.1, back[1] - 0.05, back[2]], 0.018, c.text3, 8);
    lab.box(back[0] - 0.22, 0, back[2] - 0.12, 0.24, 0.03, 0.24, c.text3);
    const cable = [back, [back[0] + 0.25, back[1], back[2]], [gx, 0.6, gz + 0.3], [gx, 0.38, gz + 0.15]];
    for (let k = 1; k < cable.length; k++) lab.rod(cable[k - 1], cable[k], 0.012, c.text, 6);
  }
  function decayHud(ctx, st, d) {
    const c = st.colors, I = d.iso, PW = 268, x0 = st.w - PW - 12, y0 = 12, ix = x0 + 14, iw = PW - 28, R = 26;
    panelBg(ctx, c, x0, y0, PW, 196);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = c.text; ctx.font = '700 15px Inter, system-ui, sans-serif'; ctx.fillText(`${I.name} (${I.sym})`, ix, y0 + 12);
    ctx.font = MID; ctx.fillStyle = c.text2; ctx.fillText(`${I.type}-yemirilish, T½ = ${sci(I.half, 4)} ${I.unit}`, ix, y0 + 34);
    ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.fillStyle = c.text; ctx.fillText(I.eq, ix, y0 + 53);
    // soat: o'tgan yarim yemirilish davrlari
    const cx = ix + R + 2, cy = y0 + 82 + R, nT = d.t / I.half;
    ctx.strokeStyle = c.border; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * (nT % 1 || (nT > 0 && nT % 1 === 0 ? 1 : 0))); ctx.stroke();
    ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${fmt(nT, 2)}`, cx, cy - 5);
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText('T½ o‘tdi', cx, cy + 10);
    ctx.textAlign = 'left'; ctx.fillStyle = c.text2; ctx.font = MID;
    ctx.fillText(`t = ${sci(d.t, 3)} ${I.unit}`, cx + R + 14, cy - 17);
    ctx.fillText(`qoldi: N = ${d.N} / ${d.N0}`, cx + R + 14, cy);
    ctx.fillText(`nazariy: ${fmt(d.theory, 1)}`, cx + R + 14, cy + 17);
    // ulush ustuni
    const by = cy + R + 14, bw = iw, fr = d.N / d.N0;
    ctx.fillStyle = c.bg; ctx.fillRect(ix, by, bw, 12); ctx.fillStyle = c.warning; ctx.fillRect(ix, by, bw * fr, 12);
    ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.strokeRect(ix + 0.5, by + 0.5, bw, 12);
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textBaseline = 'top'; ctx.fillText(`${I.sym} (to‘q sariq) — ${fmt(fr * 100, 1)} %; ${I.daughter} (kulrang)`, ix, by + 16);
  }

  /* ---------------------------------------------------------------- 2) Bog'lanish energiyasi */
  function pile(type, [x, y, z], color) {
    const c = lab.colors;
    lab.rod([x, y, z], [x, y + 0.04, z], 0.34, shell(c), 28);
    const rn = 0.085, pts = [[0, 0], ...Array.from({ length: 6 }, (_, k) => [0.17 * Math.cos((k * TAU) / 6), 0.17 * Math.sin((k * TAU) / 6)])];
    for (const [dx, dz] of pts) ball(lab, [x + dx, y + 0.04 + rn, z + dz], rn, color, 5);
    for (let k = 0; k < 3; k++) ball(lab, [x + 0.085 * Math.cos((k * TAU) / 3 + 0.5), y + 0.04 + rn * 2.55, z + 0.085 * Math.sin((k * TAU) / 3 + 0.5)], rn, color, 5);
    lab.label(type === 'p' ? 'protonlar' : 'neytronlar', [x + (type === 'p' ? -0.22 : 0.22), y + 0.02, z - 0.48], c.text2); // yozuvlar tashqariga — tor ekranda ustma-ust tushmasin
    lab.handle(`pile:${type}`, [x, y + 0.15, z], 0.3);
  }
  function buildScene(b, narrow) {
    const c = lab.colors, col = NUC(c), A = b.Z + b.N, rn = A > 36 ? 0.085 : A > 12 ? 0.1 : 0.12;
    pile('p', PILES.p, col.p); pile('n', PILES.n, col.n);
    center = NUCLEUS;
    const pts = clusterPoints(b.Z, A, center, rn), R = pts.length ? Math.max(...pts.map((q) => Math.hypot(...q.p.map((v, i) => v - center[i])))) + rn : rn;
    // yadro ostidagi tagcha va ingichka ushlagich (model "havoda" turmasin)
    lab.rod([center[0], 0, center[2]], [center[0], 0.04, center[2]], 0.22, c.text3, 20);
    lab.rod([center[0], 0.04, center[2]], [center[0], center[1] - R, center[2]], 0.012, c.text3, 8);
    nucleons = pts.map((q) => { ball(lab, q.p, rn, q.proton ? col.p : col.n, 5); return { ...lab.project(q.p), proton: q.proton }; });
    nucleons.rpx = screenRadius(center, rn);
    // yadro chegarasi (shtrix aylana) va tutqich: bosib sudrasangiz eng yaqin nuklon olinadi
    const { right, up } = cameraAxes(lab), rr = R + 0.14;
    for (let k = 0; k < 40; k += 2) { const a0 = (k * TAU) / 40, a1 = ((k + 1) * TAU) / 40; lab.line(add(add(center, right, rr * Math.cos(a0)), up, rr * Math.sin(a0)), add(add(center, right, rr * Math.cos(a1)), up, rr * Math.sin(a1)), c.borderStrong, 1); }
    if (A) lab.handle('nucleus', center, R);
    nucleons.R = R;
    if (b.ghost?.at) ball(lab, b.ghost.at, rn + 0.01, b.ghost.type === 'p' ? col.p : col.n, 5);
    if (narrow) {
      const s = P.stability(b.Z, A);
      lab.label(nuclide(b.Z, A), [center[0], center[1] + R + 0.5, center[2]], c.text);
      lab.label(s.stable ? 'barqaror' : `radioaktiv: ${s.decay}`, [center[0], center[1] + R + 0.14, center[2]], s.stable ? c.success : c.danger);
    }
  }
  function buildHud(ctx, st, b) {
    const c = st.colors, Z = b.Z, A = b.Z + b.N, s = P.stability(Z, A), bb = P.binding(Z, A), PW = 262, x0 = st.w - PW - 12, y0 = 12, ix = x0 + 14;
    panelBg(ctx, c, x0, y0, PW, 186);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.text; ctx.font = '700 40px Inter, system-ui, sans-serif';
    const symW = ctx.measureText(P.SYM[Z]).width;
    ctx.fillText(P.SYM[Z], ix + 30, y0 + 60);
    ctx.font = '700 16px Inter, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(String(A), ix + 26, y0 + 36); ctx.fillText(String(Z), ix + 26, y0 + 62);
    ctx.textAlign = 'left'; ctx.font = MID; ctx.fillStyle = c.text2; ctx.fillText(`${P.NAME[Z]}, A = ${A}`, ix + 34 + symW + 8, y0 + 40);
    ctx.fillStyle = s.stable ? c.success : c.danger; ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillText(s.stable ? `barqaror${s.exact ? '' : ' (taxminan)'}` : `radioaktiv: ${s.decay}${s.exact ? '' : ' (taxminan)'}`, ix + 34 + symW + 8, y0 + 58);
    const rows = [['E_b', `${fmt(bb.B, 2)} MeV${bb.real ? '' : ' (formula)'}`], ['E_b/A', `${fmt(A > 1 ? bb.B / A : 0, 3)} MeV`], ['Δm', `${fmt(P.massDefect(bb.B), 5)} u`]];
    ctx.font = MID; rows.forEach(([k, v], i) => { ctx.fillStyle = c.text3; ctx.fillText(k, ix, y0 + 94 + i * 20); ctx.fillStyle = c.text; ctx.fillText(v, ix + 46, y0 + 94 + i * 20); });
    const bw = PW - 28, by = y0 + 94 + rows.length * 20 - 6;
    ctx.fillStyle = c.bg; ctx.fillRect(ix, by, bw, 10); ctx.fillStyle = c.primary; ctx.fillRect(ix, by, bw * clamp((A > 1 ? bb.B / A : 0) / 8.8, 0, 1), 10);
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textBaseline = 'top'; ctx.fillText('⁵⁶Fe / ⁶²Ni darajasiga nisbatan (8,8 MeV)', ix, by + 14);
  }
  function reactScene(rx, narrow) {
    const c = lab.colors, col = NUC(c), R = P.REACTIONS[rx], parts = [...R.inp.map((q) => ({ q, side: 0 })), ...R.out.map((q) => ({ q, side: 1 }))];
    const size = ([, A]) => (A <= 4 ? 0.09 * (A === 1 ? 1 : 1.9) : clamp(0.06 * Math.cbrt(A), 0.18, 0.4));
    const widths = parts.map((p) => 2 * size(p.q) + 0.22), total = widths.reduce((a, b) => a + b, 0) + 0.55, y = 0.62;
    let x = -total / 2;
    const rows = [-Infinity, -Infinity]; // E_b yozuvlari: ikki qator, qo'shni yozuvlar ekranda ustma-ust tushmasin
    lab.box(-total / 2 - 0.1, 0, -0.3, total + 0.2, 0.06, 0.6, c.text3);
    parts.forEach((p, i) => {
      if (i === R.inp.length) { arrowSolid(lab, [x + 0.07, y, 0], [x + 0.48, y, 0], c.text2, 0.018); x += 0.55; }
      const [Z, A] = p.q, rad = size(p.q), cx = x + widths[i] / 2, at = [cx, y, 0];
      if (A <= 4) for (const q of clusterPoints(Z, A, at, 0.09)) ball(lab, q.p, 0.09, q.proton ? col.p : col.n, 5);
      else ball(lab, at, rad, col.big, 10);
      lab.rod([cx, 0.06, 0], [cx, y - rad, 0], 0.012, c.text3, 6);
      lab.label(nuclide(Z, A), [cx, y + rad + 0.16, 0], c.text);
      if (Z > 0 && !narrow) {
        const z = [-0.42, -1.0].find((zz, r) => { const sx = lab.project([cx, 0.07, zz]).x; if (sx - rows[r] < 72) return false; rows[r] = sx; return true; });
        if (z != null) lab.label(`E_b = ${fmt(P.binding(Z, A).B, 1)}`, [cx, 0.07, z], c.text3);
      }
      const next = parts[i + 1];
      if (next && next.side === p.side) lab.label('+', [x + widths[i], y, 0], c.text2);
      x += widths[i];
    });
    // orqadagi doska: ΣE_b boshida (kulrang) va oxirida (ko'k) ustunlari, farqi — Q (to'q sariq)
    const sIn = R.inp.reduce((s, [Z, A]) => s + P.binding(Z, A).B, 0), sOut = R.out.reduce((s, [Z, A]) => s + P.binding(Z, A).B, 0), Q = sOut - sIn;
    const bx = -2.35, sc = 4.7 / Math.max(sOut, sIn, 1), zb = 0.85, y1 = 1.66, y2 = 1.3, bz = zb - 0.06;
    for (const sx of [-2.45, 2.45]) lab.rod([sx, 0, zb + 0.03], [sx, 1.02, zb + 0.03], 0.025, c.text3, 8);
    lab.box(-2.6, 1.02, zb, 5.2, 0.86, 0.05, shell(c));
    lab.box(bx, y1 - 0.06, bz, sIn * sc, 0.12, 0.06, c.text3);
    lab.box(bx, y2 - 0.06, bz, sIn * sc, 0.12, 0.06, c.primary);
    if (Q > 0) lab.box(bx + sIn * sc, y2 - 0.07, bz - 0.01, Q * sc, 0.14, 0.07, c.warning);
    lab.label(`ΣE_b boshida: ${fmt(sIn, 1)} MeV`, [bx + 0.95, y1 + 0.15, bz], c.text);
    lab.label(`ΣE_b oxirida: ${fmt(sOut, 1)} MeV`, [bx + 0.95, y2 + 0.15, bz], c.text);
    lab.label(`Q = ${fmt(Q, 2)} MeV ajraladi`, [clamp(bx + (sIn + Q / 2) * sc, -1.4, 1.5), y2 - 0.17, bz], c.warning);
  }

  /* ---------------------------------------------------------------- 3) Zanjir reaksiya */
  function chainScene(ch) {
    const c = lab.colors, col = NUC(c), co = ch.core, cell = CORE_CELL, W = co.w * cell, H = co.h * cell, x0 = -W / 2, top = CORE_BASE + H;
    const X = (x) => x0 + x * cell, Y = (y) => top - y * cell, rr = Math.max(0.022, cell * 0.26);
    coreMap = { x0, top, cell, w: co.w, h: co.h };
    // zona: orqa devor (moderator), ostidagi tag va sterjenlar mexanizmi
    lab.box(x0 - 0.1, CORE_BASE - 0.1, 0.05, W + 0.2, H + 0.2, 0.08, c.dark ? '#16314a' : '#dbeafe');
    lab.box(x0 - 0.25, 0, -0.25, W + 0.5, CORE_BASE - 0.1, 0.5, c.text3);
    for (const q of co.nuclei) {
      const p = [X(q.x), Y(q.y), 0];
      if (!q.done) ball(lab, p, rr, q.kind === 235 ? col.fuel : col.u238, 3);
      else if (q.cap) camRing(lab, p, rr, c.special, 1.3, 10);
      else for (const s of [-1, 1]) ball(lab, [p[0] + s * rr * 0.5, p[1], p[2]], rr * 0.5, alpha(col.big, 0.45), 3);
    }
    const dz = ch.depth * H, barY = top + 0.32;
    for (const r of co.rods) lab.box(X(r.x) - cell / 2, top - dz, -0.05, cell, barY - (top - dz), 0.1, c.dark ? '#475569' : '#334155');
    if (co.rods.length) {
      lab.box(X(co.rods[0].x) - cell, barY, -0.07, X(co.rods[co.rods.length - 1].x) - X(co.rods[0].x) + 2 * cell, 0.06, 0.14, c.text3);
      const mid = co.rods[Math.floor((co.rods.length - 1) / 2)], hx = X(mid.x);
      ball(lab, [hx, top - dz, -0.08], 0.05, c.primary, 4);
      lab.handle('rod', [hx, top - dz, -0.08], 0.16);
      rodAt = (d) => [hx, top - d * H, -0.08];
    } else rodAt = null;
    // neytron manbai (bosilsa neytronlar uchadi)
    const gy = Y(co.h / 2);
    lab.rod([x0 - 0.5, gy, 0], [x0 - 0.14, gy, 0], 0.07, c.dark ? '#1e3a8a' : '#bfdbfe', 16);
    lab.rod([x0 - 0.5, 0, 0], [x0 - 0.5, gy - 0.07, 0], 0.016, c.text3, 8);
    lab.label('n', [x0 - 0.32, gy + 0.16, 0], c.primary);
    lab.handle('gun', [x0 - 0.32, gy, 0], 0.18);
    // chaqnashlar: bo'linish — sariq, ²³⁸U tutishi — binafsha halqa, sterjen yutishi — ×
    for (const f of ch.flashes) {
      const p = [X(f.x), Y(f.y), -0.02], u = f.age / 0.6;
      if (f.type === 'fission') glow(lab, p, rr + 0.05 + 0.14 * u, [250, 204, 21], 0.95 * (1 - u), 4, 16);
      else if (f.type === 'cap') camRing(lab, p, rr + 0.06 * u, alpha(c.special, 1 - u), 1.8, 12);
      else { const k = 0.035; lab.line([p[0] - k, p[1] - k, p[2]], [p[0] + k, p[1] + k, p[2]], alpha(c.text3, 1 - u), 1.5); lab.line([p[0] + k, p[1] - k, p[2]], [p[0] - k, p[1] + k, p[2]], alpha(c.text3, 1 - u), 1.5); }
    }
    const ns = co.neutrons, step = Math.max(1, Math.ceil(ns.length / 500));
    for (let i = 0; i < ns.length; i += step) ball(lab, [X(ns[i].x), Y(ns[i].y), -0.03], 0.028, c.primary, 3);
    // izohlar
    [[col.fuel, '²³⁵U'], [col.u238, '²³⁸U'], [c.primary, 'neytron']].forEach(([cc, name], i) => {
      const x = -1.2 + i * 1.0; ball(lab, [x - 0.18, 0.05, -0.75], 0.045, cc, 4); lab.label(name, [x + 0.12, 0.05, -0.75], c.text2);
    });
  }

  /** Sahnadagi r radiusli shar ekranda necha piksel (kameraga qaragan yo'nalishda). */
  function screenRadius(p, r) {
    const a = lab.project(p), b = lab.project(add(p, cameraAxes(lab).right, r));
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  /** Ekran nuqtasi ostidagi eng oldingi shar (o'z radiusi ichida), bo'lmasa yaqin atrofdagisi. */
  function pickFront(list, x, y, R, small = () => false) {
    let best = null, bd = Infinity, near = null, nd = Infinity;
    list.forEach((q, i) => {
      const dd = Math.hypot(q.x - x, q.y - y), rad = small(q) ? R * 0.55 : R;
      if (dd <= rad && q.d < bd) { bd = q.d; best = i; }
      if (dd < nd) { nd = dd; near = i; }
    });
    return best ?? (nd <= R + 6 ? near : null);
  }

  function panelBg(ctx, c, x, y, w, h) {
    ctx.save(); ctx.globalAlpha = 0.94; ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  /**
   * f.mode: 'decay' | 'bind' | 'chain'; f.decay — { N0, decayedAt, N, iso, flashes, sel, t, theory }, f.bind — { view, Z, N, rx, ghost },
   * f.chain — { core, flashes, depth }.
   */
  const viewKey = (f) => (f.mode === 'bind' && f.bind.view === 'react' ? 'react' : f.mode);
  function draw(ctx, stage, f) {
    const view = VIEW[viewKey(f)] || VIEW.decay, wide = stage.w >= 640, t = view.begin.target;
    lab.begin(ctx, stage, { target: wide && view.hud ? [t[0] + view.hud, t[1], t[2]] : t, focal: view.begin.focal });
    if (f.mode === 'decay') {
      decayScene(f.decay, !wide);
      lab.finish(`3D laboratoriya · t = ${fmt(f.decay.t / f.decay.iso.half, 2)} T½`, 'Namuna — shartli model: har shar bitta yadro · Geyger–Myuller hisoblagichi yemirilishlarni sanaydi');
      if (wide) decayHud(ctx, stage, f.decay);
    } else if (f.mode === 'bind') {
      if (f.bind.view === 'react') {
        reactScene(f.bind.rx, !wide);
        lab.finish('3D laboratoriya', 'Yadrolar o‘lchami shartli (r ∝ ∛A) · ustunlar uzunligi — bog‘lanish energiyasi');
      } else {
        buildScene(f.bind, !wide);
        lab.finish('3D laboratoriya', 'Qizil — proton, kulrang — neytron · nuklonlar joylashuvi shartli');
        if (wide) buildHud(ctx, stage, f.bind);
      }
    } else {
      chainScene(f.chain);
      lab.finish(f.chain.core.t, 'Reaktor zonasi kesimi: tekislikdagi model · sterjenlar neytronlarni yutadi');
    }
  }

  return {
    lab, draw,
    /** Rejim ('decay' | 'bind' | 'react' | 'chain') almashganda kamera shu tajribaga mos ko'rinishga qaytadi. */
    setMode(m) { if (VIEW[m] && m !== mode) { mode = m; lab.reset(); } },
    /** Yemirilish: i-yadroning sahnadagi joyi (oxirgi chizilgan namunada). */
    nucleusPoint: (i) => (grid ? grid.at(i) : [0, 0, 0]),
    /** Yemirilish: ekrandagi nuqta ostidagi (eng oldingi) yadro indeksi yoki null. */
    pickNucleus(x, y) { return pickFront(picks, x, y, Math.max(4, picks.rpx || 0), (q) => !q.alive); },
    /** Yadro yasash: ekrandagi nuqta ostidagi nuklon turi ('p' | 'n') yoki null. */
    nucleonAt(x, y) { const i = pickFront(nucleons, x, y, Math.max(4, nucleons.rpx || 0)); return i === null ? null : nucleons[i].proton ? 'p' : 'n'; },
    /** Sudralayotgan nuklon: kursor ostidagi, yadro markazidan o'tuvchi va kameraga qaragan tekislikdagi nuqta. */
    ghostAt(p) { const { right, up } = cameraAxes(lab), st = planeHit(lab, p, center, right, up); return st ? add(add(center, right, st[0]), up, st[1]) : null; },
    /** Ghost yadro ichida (qo'shiladi)mi. */
    insideNucleus(q) { return !!q && Math.hypot(...q.map((v, i) => v - center[i])) <= (nucleons.R || 0.1) + 0.35; },
    /** Sterjenlar tutqichi: d = 0…1 (tushirilganlik) → sahna nuqtasi (lab.nearest uchun). */
    rodPoint: (d) => (rodAt ? rodAt(d) : [0, 0, 0]),
    /** Zanjir reaksiya: ekran nuqtasi → zona katakchalaridagi (x, y) yoki null. */
    corePoint(p) {
      if (!coreMap) return null;
      const st = planeHit(lab, p, [coreMap.x0, coreMap.top, 0], [coreMap.cell, 0, 0], [0, -coreMap.cell, 0]);
      return st && st[0] > 0 && st[1] > 0 && st[0] < coreMap.w && st[1] < coreMap.h ? { x: st[0], y: st[1] } : null;
    },
  };
}
