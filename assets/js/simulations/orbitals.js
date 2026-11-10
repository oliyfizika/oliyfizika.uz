// ==========================================================================
// Vodorod atomi: elektron bulutlari — 3D simulyatsiya (simulations/orbitals.html)
// three.js (assets/vendor/three) nuqtali bulut: har nuqta |ψₙₗₘ|² taqsimotidan tanlangan.
// Kompleks holatlar (ψₙₗₘ, L_z = mħ) va real orbitallar (pₓ, d_xy, …); ψ ishorasi rang bilan.
// Sahnada: aylantirish, yaqinlashtirish, surish (OrbitControls); masshtab halqalari, radial tugun sferalari, kesim.
// Fizika: orbitals-physics.js (Node’da tekshiriladi: tools/simulations/tests/t_orbitals.mjs).
// ==========================================================================

import * as THREE from "../../vendor/three/three.module.min.js";
import { OrbitControls } from "../../vendor/three/OrbitControls.js";
import { bindRange, prefersReducedMotion, clamp, fmt, fullscreenHeight } from "./sim-kit.js";
import { readouts, u } from "./labkit.js";
import * as P from "./orbitals-physics.js";

const $ = (s) => document.querySelector(s);
const st = { n: 1, l: 0, m: 0, real: false, pts: 40000, fit: true, scale: true, nodes: false, cut: false, spin: false };
let presetId = null;
const reduce = prefersReducedMotion();
const sgn = (m) => (m > 0 ? "+" : m < 0 ? "−" : "");
const mText = (m) => `${sgn(m)}${Math.abs(m)}`;

/* ------------------------------------------------------------------ Ranglar (dizayn tokenlaridan) */

const probe = document.createElement("canvas").getContext("2d");
function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  probe.fillStyle = fallback; probe.fillStyle = v; // har qanday CSS rangni #rrggbb ga keltiradi
  return new THREE.Color(probe.fillStyle);
}
let C = {};
function readTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  C = {
    dark,
    bg: cssColor("--of-surface", dark ? "#131a28" : "#ffffff"),
    pos: cssColor("--of-warning", "#f97316"),
    neg: cssColor("--of-primary", "#2563eb"),
    ring: cssColor("--of-border-strong", "#94a3b8"),
    axis: cssColor("--of-text-3", "#64748b"),
    label: cssColor("--of-text-2", "#475569"),
    node: cssColor("--of-success", "#16a34a"),
    nucleus: cssColor("--of-danger", "#dc2626"),
  };
}
readTheme();

/* ------------------------------------------------------------------ Sahna */

const canvas = $("#stage"), wrap = canvas.parentElement;
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
} catch (e) {
  $("[data-fallback]").hidden = false; canvas.hidden = true; console.warn(e);
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1.6, 0.05, 5000);
const DIR_HOME = new THREE.Vector3(0.6, 0.38, 0.8).normalize(); // fizik (x, y, z) → three (x, z, −y)
const DIR_TOP = new THREE.Vector3(0, 1, 0.0001).normalize();
const DIR_SIDE = new THREE.Vector3(0, 0, 1);
let controls = null;
let dirty = true;
if (renderer) {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.localClippingEnabled = true;
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduce; controls.dampingFactor = 0.08;
  controls.minDistance = 2; controls.maxDistance = 600;
  controls.autoRotateSpeed = 1.2;
  controls.addEventListener("change", () => { dirty = true; });
  controls.addEventListener("start", () => { camAnim = null; });
}

// Yadro (masshtabsiz)
const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: C.nucleus }));
scene.add(nucleus);

// Masshtab halqalari, o‘qlar, yozuvlar
const scaleGroup = new THREE.Group(); scene.add(scaleGroup);
const RINGS = [1, 2, 5, 10, 20, 40];
let labelSprites = [];
function textSprite(txt, color, h) {
  const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
  cv.width = 256; cv.height = 64;
  ctx.font = "600 34px Inter, system-ui, sans-serif"; ctx.fillStyle = `#${color.getHexString()}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, 128, 32);
  const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.userData.h = h; sp.scale.set(h * 4, h, 1); return sp;
}
function disposeGroup(g) {
  g.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  g.clear();
}
let scaleR = 40; // joriy bulut o‘lchami (yozuvlar balandligi shunga moslanadi)
function buildScale() {
  disposeGroup(scaleGroup); labelSprites = [];
  const visibleRings = RINGS.filter((R) => R <= scaleR * 1.6 && R >= scaleR * 0.18);
  visibleRings.forEach((R) => {
    const pts = [];
    for (let i = 0; i <= 160; i++) { const t = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(t), 0, R * Math.sin(t))); }
    scaleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.ring, transparent: true, opacity: C.dark ? 0.75 : 0.9 })));
    const lab = textSprite(`${R} a₀`, C.label, 1); lab.userData.anchor = new THREE.Vector3(R, 0, 0); labelSprites.push(lab); scaleGroup.add(lab);
  });
  const A = Math.max(...visibleRings, 2) * 1.12;
  [[new THREE.Vector3(1, 0, 0), "x"], [new THREE.Vector3(0, 1, 0), "z"], [new THREE.Vector3(0, 0, -1), "y"]].forEach(([d, name]) => {
    const g = new THREE.BufferGeometry().setFromPoints([d.clone().multiplyScalar(-A), d.clone().multiplyScalar(A)]);
    scaleGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: C.axis, transparent: true, opacity: 0.7 })));
    const s = textSprite(name, C.label, 1.3); s.userData.anchor = d.clone().multiplyScalar(A * 1.06); s.userData.center = true; labelSprites.push(s); scaleGroup.add(s);
  });
  scaleGroup.visible = st.scale;
  sizeLabels();
}
// Yozuvlar ekranda taxminan bir xil o‘lchamda bo‘lsin (kamera masofasiga mos)
function sizeLabels() {
  const d = camera.position.length(), h = d * 0.032;
  labelSprites.forEach((s) => {
    const k = s.userData.h * h; s.scale.set(k * 4, k, 1);
    s.position.copy(s.userData.anchor);
    if (!s.userData.center) s.position.add(new THREE.Vector3(k * 1.9, k * 0.55, 0));
  });
  nucleus.scale.setScalar(Math.max(0.06, d * 0.006));
}

// Radial tugun sferalari
const nodeGroup = new THREE.Group(); scene.add(nodeGroup);
function buildNodes() {
  disposeGroup(nodeGroup);
  P.radialNodeRadii(st.n, st.l).forEach((r) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshBasicMaterial({ color: C.node, wireframe: true, transparent: true, opacity: C.dark ? 0.22 : 0.3, depthWrite: false, clippingPlanes: st.cut ? [clipPlane] : [] }));
    nodeGroup.add(mesh);
  });
  nodeGroup.visible = st.nodes;
}

/* ------------------------------------------------------------------ Bulut (almashganda silliq o‘tish) */

const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0); // kamera tomondagi yarmini (fizik y < 0) kesadi
let clouds = []; // { obj, sign, from, to, t0 }
const FADE = reduce ? 1 : 900;
const isNarrow = () => wrap.clientWidth < 560;
function pointSize() { return isNarrow() ? 1.8 : 2.2; }
function opacity() { return C.dark ? 0.5 : 0.55; }
function colorize(sign, count) {
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { const c = sign[i] > 0 ? C.pos : C.neg; col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b; }
  return col;
}
function cloudMaterial() {
  return new THREE.PointsMaterial({
    size: pointSize(), sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, blending: C.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    clippingPlanes: st.cut ? [clipPlane] : [],
  });
}
let seed = 1;
function makeCloud() {
  const s = P.sample(st.n, st.l, st.m, st.real, st.pts, P.rng(seed++ * 7919));
  const pos = new Float32Array(s.count * 3);
  for (let i = 0; i < s.count; i++) { pos[3 * i] = s.xyz[3 * i]; pos[3 * i + 1] = s.xyz[3 * i + 2]; pos[3 * i + 2] = -s.xyz[3 * i + 1]; } // fizik z — yuqoriga
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colorize(s.sign, s.count), 3));
  const p = new THREE.Points(g, cloudMaterial());
  scene.add(p);
  const now = performance.now();
  clouds.forEach((c) => { c.from = c.obj.material.opacity; c.to = 0; c.t0 = now; });
  clouds.push({ obj: p, sign: s.sign, count: s.count, from: 0, to: opacity(), t0: now });
  dirty = true;
}
function stepFades(now) {
  let active = false;
  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i], t = Math.min(1, (now - c.t0) / FADE);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    c.obj.material.opacity = c.from + (c.to - c.from) * e;
    if (t < 1) active = true;
    else if (c.to === 0) { scene.remove(c.obj); c.obj.geometry.dispose(); c.obj.material.dispose(); clouds.splice(i, 1); }
  }
  return active;
}

/* ------------------------------------------------------------------ Kamera */

let camAnim = null; // { d0, d1, t0 }
const extent = () => P.radialCDF(st.n, st.l, 1500); // 95 % ehtimollik radiusi
function r95() { const { cdf, dr } = extent(); let i = 0; while (i < cdf.length - 1 && cdf[i] < 0.95) i++; return i * dr; }
function fitDistance() { return clamp((r95() / Math.sin(((camera.fov / 2) * Math.PI) / 180)) * 1.08, 4, 500); }
const FIXED_D = 150; // «bir xil masshtab»: 4s bulutigacha sig‘adi
function targetDistance() { return st.fit ? fitDistance() : FIXED_D; }
function goTo(dir, d = targetDistance()) {
  camAnim = null;
  if (controls) controls.target.set(0, 0, 0);
  camera.position.copy(dir).multiplyScalar(d); camera.lookAt(0, 0, 0);
  controls?.update(); sizeLabels(); dirty = true;
}
function zoomTo(d1) {
  const d0 = camera.position.length();
  if (reduce || Math.abs(d1 - d0) < 0.01 * d0) { camera.position.setLength(d1); controls?.update(); sizeLabels(); dirty = true; return; }
  camAnim = { d0, d1, t0: performance.now() };
}
function stepCam(now) {
  if (!camAnim) return false;
  const t = Math.min(1, (now - camAnim.t0) / 900), e = 1 - (1 - t) ** 3;
  const d = camAnim.d0 * (camAnim.d1 / camAnim.d0) ** e; // logarifmik — masshtab silliq o‘zgaradi
  camera.position.sub(controls.target).setLength(d).add(controls.target);
  if (t >= 1) camAnim = null;
  sizeLabels(); return true;
}

/* ------------------------------------------------------------------ O‘lcham va kadr */

function resize() {
  if (!renderer) return;
  const w = Math.max(260, Math.floor(wrap.clientWidth));
  const vh = window.innerHeight || 800;
  const normal = Math.round(w < 560 ? clamp(w * 0.95, 300, 440) : clamp(Math.min(w * 0.62, vh * 0.62), 340, 560));
  const h = fullscreenHeight(canvas, w, normal) || normal;
  canvas.style.height = `${h}px`;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  clouds.forEach((c) => { c.obj.material.size = pointSize(); });
  dirty = true;
}
new ResizeObserver(resize).observe(wrap);
window.addEventListener("resize", resize);

function frame(now) {
  requestAnimationFrame(frame);
  if (!renderer || document.hidden) return;
  const a = stepFades(now), b = stepCam(now);
  const c = controls.update(); // damping / avto aylanish
  if (a || b || c || dirty || controls.autoRotate) {
    if (c || controls.autoRotate) sizeLabels();
    renderer.setClearColor(C.bg, 1);
    renderer.render(scene, camera);
    dirty = false;
  }
}

function onTheme() {
  readTheme();
  nucleus.material.color.copy(C.nucleus);
  clouds.forEach((c) => {
    c.obj.geometry.setAttribute("color", new THREE.BufferAttribute(colorize(c.sign, c.count), 3));
    c.obj.material.blending = C.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (c.to > 0) { c.to = opacity(); if (performance.now() - c.t0 >= FADE) c.obj.material.opacity = c.to; }
    c.obj.material.needsUpdate = true;
  });
  buildScale(); buildNodes(); dirty = true;
}
new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
document.addEventListener("of:themechange", onTheme);

/* ------------------------------------------------------------------ Boshqaruv: kvant sonlari */

const seg = { n: $('[data-seg="n"]'), l: $('[data-seg="l"]'), m: $('[data-seg="m"]') };
seg.n.innerHTML = [1, 2, 3, 4].map((n) => `<button type="button" data-v="${n}" aria-pressed="false">${n}</button>`).join("");
seg.l.innerHTML = [0, 1, 2, 3].map((l) => `<button type="button" data-v="${l}" aria-pressed="false">${l} (${P.LETTERS[l]})</button>`).join("");
seg.m.innerHTML = [-3, -2, -1, 0, 1, 2, 3].map((m) => `<button type="button" data-v="${m}" aria-pressed="false">${mText(m)}</button>`).join("");
seg.n.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const n = +b.dataset.v, l = Math.min(st.l, n - 1); setState({ n, l, m: clamp(st.m, -l, l) }); });
seg.l.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; const l = +b.dataset.v; setState({ l, m: clamp(st.m, -l, l) }); });
seg.m.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; setState({ m: +b.dataset.v }); });
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => setState({ real: b.dataset.modeValue === "real" })));

const ptsCtl = bindRange($("#pPts"), $("#pPtsOut"), (v) => v.toLocaleString("ru-RU").replace(/\s/g, " "), () => {});
$("#pPts").addEventListener("change", () => setState({ pts: ptsCtl.value }, { keepPreset: true }));

document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => {
  const k = cb.dataset.toggle; st[k] = cb.checked;
  if (k === "scale") scaleGroup.visible = st.scale;
  if (k === "nodes") nodeGroup.visible = st.nodes;
  if (k === "spin" && controls) controls.autoRotate = st.spin && !reduce;
  if (k === "cut") { clouds.forEach((c) => { c.obj.material.clippingPlanes = st.cut ? [clipPlane] : []; c.obj.material.needsUpdate = true; }); buildNodes(); }
  if (k === "fit") { scaleR = st.fit ? r95() : 40; buildScale(); zoomTo(targetDistance()); }
  dirty = true; refresh();
}));
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => goTo({ home: DIR_HOME, top: DIR_TOP, side: DIR_SIDE }[b.dataset.view])));

function syncUI() {
  for (const k of ["n", "l", "m"]) seg[k].querySelectorAll("button").forEach((b) => {
    const v = +b.dataset.v;
    b.setAttribute("aria-pressed", String(v === st[k]));
    b.disabled = k === "l" ? v > st.n - 1 : k === "m" ? Math.abs(v) > st.l : false;
  });
  $('[data-out="n"]').textContent = `n = ${st.n}`;
  $('[data-out="l"]').textContent = `l = ${st.l} (${P.LETTERS[st.l]})`;
  $('[data-out="m"]').textContent = `mₗ = ${mText(st.m)}`;
  $("[data-qn-hint]").textContent = `n = ${st.n} da l = ${st.n > 1 ? `0…${st.n - 1}` : "0"}, l = ${st.l} da mₗ = ${st.l ? `−${st.l}…+${st.l}` : "0"} bo‘lishi mumkin.`;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.modeValue === "real") === st.real)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = !!st[cb.dataset.toggle]; });
  ptsCtl.set(st.pts);
}

/* ------------------------------------------------------------------ Natijalar, izoh, formula */

const setRO = readouts($("[data-readouts]"));
function nameHTML() { const o = P.orbitalName(st.n, st.l, st.m, st.real); return o.sub ? `${o.base}<sub>${o.sub}</sub>` : o.base; }
function updateReadouts() {
  const q = P.quantities(st.n, st.l, st.m, st.real), rmp = P.mostProbableR(st.n, st.l);
  setRO("r1", "Energiya E<sub>n</sub>", u(fmt(q.E, 2), "eV"), `ionlash energiyasi ${fmt(q.ionization, 2)} eV`);
  setRO("r2", "Impuls momenti L", q.L2 ? u(`√${q.L2} ≈ ${fmt(q.L, 2)}`, "ħ") : u("0", "ħ"), q.L2 ? `l(l + 1) = ${q.L2}` : "s-holatda aylanma harakat yo‘q");
  setRO("r3", "Proyeksiya L<sub>z</sub>", q.Lz === null ? "aniq emas" : u(q.Lz === 0 ? "0" : mText(q.Lz), "ħ"), q.Lz === null ? `+${Math.abs(st.m)}ħ va −${Math.abs(st.m)}ħ aralashmasi` : "z o‘qiga proyeksiya mₗħ", q.Lz === null ? "orange" : "");
  setRO("r4", "O‘rtacha radius ⟨r⟩", u(fmt(q.rMean, 1), "a₀"), `≈ ${fmt(q.rMean * P.A0_NM, 3)} nm; eng ehtimolli r = ${fmt(rmp, 2)} a₀`);
  setRO("r5", "Tugunlar", `${q.radialNodes} + ${q.angularNodes}`, `radial (sfera) + burchak; jami n − 1 = ${st.n - 1}`);
  setRO("r6", "Aynish", u(String(q.degeneracy), "ta orbital"), `bir xil Eₙ; spin bilan 2n² = ${2 * q.degeneracy} ta holat`);
}
function updateHud() {
  $("[data-hud-name]").innerHTML = nameHTML();
  $("[data-hud-qn]").textContent = `n = ${st.n}, l = ${st.l}, mₗ = ${st.real && st.m !== 0 ? `±${Math.abs(st.m)}` : mText(st.m)}`;
}
function updateFormula() {
  const html = `<small>Energiya</small> E${"₀₁₂₃₄"[st.n]} = −13,6 eV/${st.n}² = ${fmt(-P.RY_EV / (st.n * st.n), 2)} eV`;
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function updateStatus() {
  const el = $("[data-status]"), t = `${clouds.length ? clouds.at(-1).count.toLocaleString("ru-RU").replace(/\s/g, " ") : 0} nuqta`;
  if (el.textContent !== t) el.textContent = t;
  el.dataset.tone = "purple";
}
const SHAPE = {
  0: "sfera shaklida (s-orbital): burchakka bog‘liq emas, ehtimollik hamma yo‘nalishda bir xil",
  1: "ikki bo‘lakli «gantel» (p-orbital)",
  2: "to‘rt bo‘lakli «beda bargi» yoki halqali gantel (d-orbital)",
  3: "murakkab ko‘p bo‘lakli (f-orbital)",
};
let lastEx = "";
function updateExplain() {
  const q = P.quantities(st.n, st.l, st.m, st.real), nr = P.radialNodeRadii(st.n, st.l), p = [];
  p.push(`<p><b>${nameHTML()}</b> holat: bulut ${SHAPE[st.l]}. Energiya faqat n ga bog‘liq: E<sub>${st.n}</sub> = ${fmt(q.E, 2)} eV, bu sathda ${q.degeneracy} ta orbital bir xil energiyaga ega.</p>`);
  if (nr.length) p.push(`<p><b>Radial tugunlar</b> (${nr.length} ta): r = ${nr.map((r) => fmt(r, 2)).join("; ")} a₀ radiusli sferalarda ψ = 0 — u yerda nuqta yo‘q. Tugundan o‘tganda ψ ishorasi o‘zgaradi (rang almashadi). «Radial tugunlar» va «Yarmini kesib» kalitlarini yoqib ko‘ring.</p>`);
  else p.push(`<p>Radial tugun yo‘q (n − l − 1 = 0): bulut bitta qatlamdan iborat. ${st.l === st.n - 1 ? `l = n − 1 bo‘lganda eng ehtimolli radius Bor orbitasiga teng: r = n²a₀ = ${st.n * st.n} a₀.` : ""}</p>`);
  if (st.l > 0) {
    if (!st.real && st.m !== 0) p.push(`<p><b>Kompleks holat</b>, mₗ = ${mText(st.m)}: ψ ∝ e<sup>i${st.m < 0 ? "−" : ""}${Math.abs(st.m) === 1 ? "" : Math.abs(st.m)}φ</sup>, shuning uchun |ψ|² z o‘qi atrofida simmetrik — bulut «halqa» (tor) shaklida. Elektron z o‘qi atrofida aylanma harakatga ega: L<sub>z</sub> = ${mText(st.m)}ħ. mₗ = ${mText(-st.m)} holatning buluti xuddi shunday, faqat aylanish yo‘nalishi teskari.</p>`);
    else if (st.real && st.m !== 0) p.push(`<p><b>Real orbital</b> — ikki kompleks holatning yig‘indisi yoki ayirmasi: ψ = (ψ<sub>+${Math.abs(st.m)}</sub> ± ψ<sub>−${Math.abs(st.m)}</sub>)/√2. Bunday holatda L<sub>z</sub> aniq qiymatga ega emas (o‘lchansa +${Math.abs(st.m)}ħ yoki −${Math.abs(st.m)}ħ chiqadi), lekin bulut aniq yo‘nalgan bo‘laklardan iborat. Kimyoda bog‘lanishlar shu orbitallar bilan tushuntiriladi.</p>`);
    else p.push(`<p>mₗ = 0: L<sub>z</sub> = 0, bulut z o‘qi atrofida simmetrik va z o‘qi bo‘ylab cho‘zilgan. Burchak tugunlari — ${st.l} ta tekislik yoki konus (θ bo‘yicha).</p>`);
  }
  p.push(`<p>O‘rtacha masofa ⟨r⟩ = ${fmt(q.rMean, 1)} a₀ ≈ ${fmt(q.rMean * 0.0529177, 3)} nm. Bulutning aniq chegarasi yo‘q: rasmda nuqtalarning ~95 % i r ≈ ${fmt(r95(), 1)} a₀ ichida.</p>`);
  const html = p.join(""); if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
function refresh() { syncUI(); updateReadouts(); updateHud(); updateFormula(); updateStatus(); updateExplain(); }

/* ------------------------------------------------------------------ Holatni o‘zgartirish */

function setState(patch, { keepPreset = false } = {}) {
  let changed = false;
  for (const k in patch) if (st[k] !== patch[k]) { st[k] = patch[k]; changed = true; }
  if (!P.valid(st.n, st.l, st.m)) { st.l = Math.min(st.l, st.n - 1); st.m = clamp(st.m, -st.l, st.l); }
  if (changed) {
    if (!keepPreset) customized();
    rebuild();
  }
  refresh();
}
function rebuild() {
  makeCloud(); buildNodes();
  scaleR = st.fit ? r95() : 40; buildScale();
  if (st.fit) zoomTo(targetDistance());
}

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  s1: { title: "1s — asosiy holat", n: 1, l: 0, m: 0, real: false, lesson: "Vodorod atomining asosiy holati. Bulut sferik, eng zich joyi yadro atrofida; eng ehtimolli masofa r = a₀ (Bor radiusi), o‘rtachasi esa 1,5 a₀. Elektron «orbita» bo‘ylab aylanmaydi: L = 0." },
  s2: { title: "2s — radial tugun", n: 2, l: 0, m: 0, real: false, nodes: true, cut: true, lesson: "2s bulut ikki qatlamdan iborat: ichki kichik shar va tashqi qobiq. Ular orasida r = 2a₀ da sferik tugun — u yerda elektron hech qachon topilmaydi. Rang almashishi ψ ishorasi o‘zgarganini ko‘rsatadi." },
  s3: { title: "3s — ikki tugun", n: 3, l: 0, m: 0, real: false, nodes: true, cut: true, lesson: "3s holatda n − l − 1 = 2 ta radial tugun: uchta ichma-ich qatlam. Bulutning asosiy qismi tashqi qatlamda, lekin ichki qatlamlar elektronni yadroga yaqin olib keladi." },
  pz: { title: "2p_z", n: 2, l: 1, m: 0, real: false, lesson: "2p_z (mₗ = 0): z o‘qi bo‘ylab ikki bo‘lak, xy tekisligi — burchak tuguni. Yuqori bo‘lakda ψ > 0, pastkisida ψ < 0. Kimyodagi p_z orbital xuddi shu holat." },
  px: { title: "2pₓ (real)", n: 2, l: 1, m: 1, real: true, lesson: "2pₓ orbital mₗ = +1 va −1 holatlarning kombinatsiyasi: bo‘laklar x o‘qi bo‘ylab. 2p_z va 2p_y bilan birga uchta o‘zaro perpendikulyar gantel hosil bo‘ladi. «Yuqoridan» ko‘rinishda solishtiring." },
  p1: { title: "2p, mₗ = +1 (halqa)", n: 2, l: 1, m: 1, real: false, lesson: "Kompleks holat mₗ = +1: |ψ|² φ ga bog‘liq emas — bulut z o‘qi atrofidagi halqa (bublik). Elektron z o‘qi atrofida L_z = +ħ impuls momenti bilan «aylanadi». Real orbitallar rejimiga o‘tib, shu holat qanday pₓ ga aylanishini ko‘ring." },
  dz2: { title: "3d_z²", n: 3, l: 2, m: 0, real: false, lesson: "3d_z²: z o‘qi bo‘ylab ikki bo‘lak va ekvator atrofida halqa. Burchak tugunlari — ikkita konus (cos²θ = 1/3, θ ≈ 54,7° va 125,3°). Halqada ψ ishorasi bo‘laklarga teskari." },
  dxy: { title: "3d_xy (real)", n: 3, l: 2, m: -2, real: true, lesson: "3d_xy — to‘rt bo‘lakli «beda bargi», bo‘laklar x va y o‘qlari orasida. Qarama-qarshi bo‘laklarning ishorasi bir xil, qo‘shnilariniki — teskari. Tugun tekisliklari: xz va yz." },
  dx2: { title: "3d_x²−y² (real)", n: 3, l: 2, m: 2, real: true, lesson: "3d_x²−y²: bo‘laklar x va y o‘qlari bo‘ylab. 3d_xy dan faqat 45° burilganligi bilan farq qiladi — ikkalasi ham mₗ = ±2 holatlardan tuzilgan." },
  d2: { title: "3d, mₗ = +2 (halqa)", n: 3, l: 2, m: 2, real: false, lesson: "Kompleks holat mₗ = +2: bulut ekvator tekisligidagi yassi halqa, L_z = +2ħ. |mₗ| = l bo‘lganda impuls momenti z o‘qiga eng ko‘p «yo‘nalgan»: ammo L_z = 2ħ < L = √6 ħ — vektor hech qachon o‘q bo‘ylab to‘liq yo‘nalmaydi." },
  fz3: { title: "4f_z³", n: 4, l: 3, m: 0, real: false, lesson: "4f_z³: z o‘qi bo‘ylab ikki bo‘lak va ikki halqa, uchta burchak tuguni (xy tekisligi va ikki konus). 4f holatda radial tugun yo‘q, eng ehtimolli r = 16a₀." },
  fxyz: { title: "4f_xyz (real)", n: 4, l: 3, m: -2, real: true, lesson: "4f_xyz: kubning sakkiz burchagi tomon yo‘nalgan sakkiz bo‘lak, uchta tugun tekisligi xy, yz va xz. Qo‘shni bo‘laklarning ishorasi teskari." },
  s4: { title: "4s — eng katta bulut", n: 4, l: 0, m: 0, real: false, fit: false, lesson: "4s: uchta radial tugun, o‘rtacha radius 24a₀ ≈ 1,3 nm — asosiy holatdagidan 16 marta katta. Kamera moslashuvi o‘chirilgan: n ni 1…4 ga almashtirib, bulut o‘lchami ~n² ga ortishini bir xil masshtabda ko‘ring." },
};
const GROUPS = [["s-orbitallar", ["s1", "s2", "s3", "s4"]], ["p-orbitallar", ["pz", "px", "p1"]], ["d-orbitallar", ["dz2", "dxy", "dx2", "d2"]], ["f-orbitallar", ["fz3", "fxyz"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title.replace(/_(\S+)/, "<sub>$1</sub>")}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (e) => { const b = e.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function loadPreset(id, first = false) {
  const p = PRESETS[id];
  Object.assign(st, { n: p.n, l: p.l, m: p.m, real: p.real, nodes: !!p.nodes, cut: !!p.cut, fit: p.fit !== false });
  scaleGroup.visible = st.scale; nodeGroup.visible = st.nodes;
  clouds.forEach((c) => { c.obj.material.clippingPlanes = st.cut ? [clipPlane] : []; c.obj.material.needsUpdate = true; });
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  rebuild();
  if (first || !st.fit) goTo(first ? DIR_HOME : camera.position.clone().normalize());
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

$("[data-mode-hint]").textContent = "Bulutni sichqoncha bilan aylantiring, g‘ildirak bilan yaqinlashtiring";
resize();
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "s1", true);
requestAnimationFrame(frame);
document.fonts?.ready.then(() => { buildScale(); dirty = true; });
