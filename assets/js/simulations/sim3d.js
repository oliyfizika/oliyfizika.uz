// ==========================================================================
// OliyFizika.uz — simulyatsiya sahnasining 3D ko‘rinishi (sim3d)
//
// G‘oya: hisob-kitob, boshqaruv, grafik va 2D chizma o‘z holicha qoladi. 3D rejimda:
//   • mavjud 2D kanvas (nurlar, burchaklar, o‘lcham chiziqlari, yorliqlar) shaffof «nur tekisligi» sifatida
//     sahnaga qo‘yiladi (tik turgan yoki stol ustida yotgan tekislik);
//   • jismlar (lampa, shar, ekran, linza, prizma, ko‘zgu…) shu tekislikda haqiqiy hajmli modellar bilan almashtiriladi
//     — simulyatsiya `frame(g)` ichida ularni har kadrda e’lon qiladi (kalit bo‘yicha keshlanadi);
//   • sichqoncha/barmoq nur tekisligiga proyeksiyalanib, 2D kanvasga sun’iy pointer hodisasi sifatida uzatiladi —
//     shuning uchun sudrab boshqarish kodi o‘zgarmaydi. Bo‘sh joydan sudrash — kamerani aylantirish.
//
// Ishlatilishi:
//   let r3 = null;
//   const stage = createStage(canvas, draw, …);        // draw ichida: if (r3?.on) — jismlarni chizmaslik
//   r3 = attach3D(stage, { view: () => ({ key, plane, az, el }), frame: (g) => { g.sphere("ball", {...}); } });
//
// Koordinatalar: `frame` ichida hamma narsa 2D kanvas pikselida beriladi: [px, py, d] — d tekislikdan
// tashqariga (kuzatuvchi tomonga; yotgan tekislikda — yuqoriga) masofa, o‘lchamlar ham pikselda.
// three.js — assets/vendor/three (r160), faqat 3D yoqilganda yuklanadi; WebGL bo‘lmasa 2D qoladi.
// ==========================================================================

import { readColors, clamp } from "./sim-kit.js";

const PREF_KEY = "of-sim-view";
const getPref = () => { try { return localStorage.getItem(PREF_KEY) === "2d" ? "2d" : "3d"; } catch { return "3d"; } };
const setPref = (v) => { try { localStorage.setItem(PREF_KEY, v); } catch { /* maxfiy rejim */ } };

const ICON_RESET = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
const FAKE_POINTER = 9731; // 2D kanvasdagi setPointerCapture «ushlab qolmasin» (try/catch ichida xato beradi)

export function attach3D(stage, { frame, view = () => ({}) } = {}) {
  const canvas2d = stage.canvas;
  const wrap = canvas2d.parentElement;
  const section = wrap.closest(".sim-stage") || wrap.parentElement;
  const r3 = { on: false, w: 0, h: 0 };
  let want = getPref() === "3d";
  let T = null, renderer = null, scene, camera, root, sheet, sheetTex = null, table, tableMat, gl = null, hemi, sun;
  let texW = 0, texH = 0, failed = false, loading = false, rafId = 0, hud = null, hudUsed = false;
  const cam = { az: -0.5, el: 0.3, key: null, plane: "v", homeAz: -0.5, homeEl: 0.3, zoom: 1 };
  const cache = new Map();
  const mats = new Map();
  const geo = {};

  /* ---------------------------------------------------------------- UI */

  const seg = document.createElement("div");
  seg.className = "of-segment sim3d-switch";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Sahna ko‘rinishi");
  seg.innerHTML = '<button type="button" data-view3d="3d" title="Hajmli ko‘rinish">3D</button><button type="button" data-view3d="2d" title="Yassi sxema">2D</button>';
  const bar = section.querySelector(".sim-modebar");
  if (bar) bar.appendChild(seg); else { seg.classList.add("sim3d-switch--float"); wrap.appendChild(seg); }
  const syncSeg = () => seg.querySelectorAll("[data-view3d]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.view3d === "3d") === want)));
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view3d]");
    if (!b) return;
    const next = b.dataset.view3d === "3d";
    if (next === want && (r3.on || !next)) return;
    want = next; setPref(want ? "3d" : "2d"); syncSeg();
    if (want) enable(); else disable();
  });
  syncSeg();

  const tools = document.createElement("div");
  tools.className = "sim3d-tools";
  tools.hidden = true;
  tools.innerHTML = `<button type="button" class="sim3d-tool" data-3d-reset aria-label="Ko‘rinishni tiklash" title="Ko‘rinishni tiklash">${ICON_RESET}</button>`;
  wrap.appendChild(tools);
  tools.querySelector("[data-3d-reset]").addEventListener("click", () => { cam.az = cam.homeAz; cam.el = cam.homeEl; cam.zoom = 1; requestRender(); });

  /* ---------------------------------------------------------------- Yoqish / o‘chirish */

  const base = stage.render;
  stage.render = () => { base(); if (r3.on) sync(); };

  async function enable() {
    if (failed || loading) return;
    if (!T) {
      loading = true;
      try { T = await import("../../vendor/three/three.module.min.js"); init(); }
      catch (err) { failed = true; console.warn("3D ko‘rinish ishga tushmadi:", err); }
      loading = false;
      if (failed) { want = false; syncSeg(); seg.hidden = true; return; }
      if (!want) return;
    }
    r3.on = true;
    wrap.classList.add("is-3d");
    gl.hidden = false; tools.hidden = false;
    cam.key = null;
    stage.render();
  }
  function disable() {
    if (!r3.on) return;
    r3.on = false;
    wrap.classList.remove("is-3d");
    if (gl) gl.hidden = true;
    if (hud) hud.hidden = true;
    tools.hidden = true;
    stage.render();
  }

  function init() {
    gl = document.createElement("canvas");
    gl.className = "sim3d-canvas";
    gl.setAttribute("role", "img");
    gl.setAttribute("aria-label", (canvas2d.getAttribute("aria-label") || "Tajriba sahnasi") + " — 3D ko‘rinish");
    gl.hidden = true;
    wrap.insertBefore(gl, tools);
    hud = document.createElement("canvas");
    hud.className = "sim3d-hud";
    hud.setAttribute("aria-hidden", "true");
    hud.hidden = true;
    wrap.insertBefore(hud, tools);
    renderer = new T.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, premultipliedAlpha: true });
    renderer.setClearColor(0x000000, 0);
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(26, 1.6, 10, 20000);
    hemi = new T.HemisphereLight(0xffffff, 0x94a3b8, 1.15);
    sun = new T.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-0.5, 1.2, 0.9);
    scene.add(hemi, sun);
    root = new T.Group();
    scene.add(root);
    sheet = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
    sheet.renderOrder = 5;
    root.add(sheet);
    tableMat = new T.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95, metalness: 0 });
    table = new T.Mesh(new T.BoxGeometry(1, 1, 1), tableMat);
    scene.add(table);
    geo.sphere = new T.SphereGeometry(1, 40, 28);
    geo.box = new T.BoxGeometry(1, 1, 1);
    geo.cyl = new T.CylinderGeometry(1, 1, 1, 40, 1);
    geo.cylOpen = new T.CylinderGeometry(1, 1, 1, 40, 1, true);
    geo.cone = new T.ConeGeometry(1, 1, 40, 1, true);
    geo.plane = new T.PlaneGeometry(1, 1);
    bindPointer();
    gl.addEventListener("webglcontextlost", (e) => { e.preventDefault(); failed = true; want = false; syncSeg(); disable(); seg.hidden = true; });
  }

  /* ---------------------------------------------------------------- Materiallar */

  function mat(color, o = {}) {
    const key = `${color}|${o.opacity ?? 1}|${o.emissive ?? 0}|${o.glass ? 1 : 0}|${o.rough ?? ""}|${o.metal ?? ""}|${o.flat ? 1 : 0}|${o.side ?? ""}|${o.add ? 1 : 0}`;
    let m = mats.get(key);
    if (m) return m;
    const opacity = o.opacity ?? 1;
    const common = { color: new T.Color(color), transparent: opacity < 1 || !!o.add, opacity, side: o.side === "double" || o.glass ? T.DoubleSide : T.FrontSide };
    if (opacity < 1 || o.add) common.depthWrite = false;
    if (o.add) common.blending = T.AdditiveBlending;
    if (o.flat) m = new T.MeshBasicMaterial({ ...common, toneMapped: false });
    else {
      m = new T.MeshStandardMaterial({ ...common, roughness: o.rough ?? (o.glass ? 0.08 : 0.6), metalness: o.metal ?? 0 });
      if (o.emissive) { m.emissive = new T.Color(color); m.emissiveIntensity = o.emissive; }
    }
    mats.set(key, m);
    return m;
  }

  function disposeObj(obj) {
    obj.traverse((n) => {
      if (n.geometry && !Object.values(geo).includes(n.geometry)) n.geometry.dispose();
      const ms = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
      ms.forEach((m) => { if (m.userData.own) { m.map?.dispose(); m.dispose(); } });
    });
  }

  function use(key, sig, make) {
    let c = cache.get(key);
    if (!c || c.sig !== sig) {
      if (c) { root.remove(c.obj); disposeObj(c.obj); }
      c = { obj: make(), sig };
      root.add(c.obj);
      cache.set(key, c);
    }
    c.used = true;
    return c.obj;
  }

  /* ---------------------------------------------------------------- Quruvchi (g) */

  const loc = (p, out) => (out || new T.Vector3()).set(p[0] - r3.w / 2, r3.h / 2 - p[1], p[2] || 0);
  const setRot = (o, rot) => { if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); else o.rotation.set(0, 0, 0); };

  const g = {
    get w() { return r3.w; },
    get h() { return r3.h; },
    get colors() { return stage.colors; },
    get plane() { return cam.plane; },
    /** Stol sathi (tik tekislikda): kanvas pikselidagi «py» qiymati. */
    get floor() { return r3.h + lift(); },
    /** Sahna ustidagi yassi qatlam (2D kontekst, CSS pikselda) — «Yerdan ko‘rinish» kabi qo‘shimcha oynachalar uchun. */
    get hud() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), c2 = hud.getContext("2d");
      if (!hudUsed) {
        hudUsed = true;
        if (hud.width !== Math.round(r3.w * dpr) || hud.height !== Math.round(r3.h * dpr)) { hud.width = Math.round(r3.w * dpr); hud.height = Math.round(r3.h * dpr); }
        c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, r3.w, r3.h);
      }
      return c2;
    },
    T: () => T,
    mat,
    loc,
    use,
    sphere(key, { at, r, color = "#94a3b8", opacity = 1, emissive = 0, rough, metal, scale }) {
      const o = use(key, "sphere", () => new T.Mesh(geo.sphere, mat(color, { opacity, emissive, rough, metal })));
      o.material = mat(color, { opacity, emissive, rough, metal });
      loc(at, o.position);
      if (scale) o.scale.set(r * scale[0], r * scale[1], r * scale[2]); else o.scale.setScalar(r);
      return o;
    },
    box(key, { at, size, color = "#64748b", opacity = 1, rot, emissive = 0, rough, metal, flat }) {
      const o = use(key, "box", () => new T.Mesh(geo.box, mat(color, { opacity })));
      o.material = mat(color, { opacity, emissive, rough, metal, flat });
      loc(at, o.position); o.scale.set(Math.max(size[0], 0.01), Math.max(size[1], 0.01), Math.max(size[2], 0.01)); setRot(o, rot);
      return o;
    },
    /** Silindr: axis — "x" | "y" | "z" (tekislik o‘qlari; z — tekislikdan tashqariga). */
    cyl(key, { at, r, len, axis = "z", color = "#64748b", opacity = 1, emissive = 0, rough, metal, open = false, r2 }) {
      const sig = r2 != null ? `cyl|${(r2 / r).toFixed(3)}|${open}` : `cyl|${open}`;
      const o = use(key, sig, () => new T.Mesh(r2 != null ? new T.CylinderGeometry(r2 / r, 1, 1, 40, 1, open) : open ? geo.cylOpen : geo.cyl, mat(color, { opacity })));
      o.material = mat(color, { opacity, emissive, rough, metal, side: open ? "double" : undefined });
      loc(at, o.position); o.scale.set(r, Math.max(len, 0.01), r);
      o.rotation.set(axis === "z" ? Math.PI / 2 : 0, 0, axis === "x" ? -Math.PI / 2 : 0);
      return o;
    },
    /** Ikki nuqta orasidagi ingichka tayoqcha (nur, sim, sterjen). a, b — [px, py, d]. */
    rod(key, a, b, { r = 1.2, color = "#f59e0b", opacity = 1, emissive = 0, flat = false } = {}) {
      const o = use(key, "rod", () => new T.Mesh(geo.cyl, mat(color, { opacity })));
      o.material = mat(color, { opacity, emissive, flat });
      const A = loc(a), B = loc(b), d = B.clone().sub(A), len = d.length();
      o.position.copy(A).addScaledVector(d, 0.5);
      o.scale.set(r, Math.max(len, 0.01), r);
      o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), len > 1e-6 ? d.multiplyScalar(1 / len) : new T.Vector3(0, 1, 0));
      return o;
    },
    /** Konus: uchi `apex`, asos markazi `base`, asos radiusi r (ochiq, shaffof yorug‘lik/soya konuslari uchun). */
    cone(key, apex, basePt, { r, color = "#fde047", opacity = 0.2, add = false } = {}) {
      const o = use(key, "cone", () => new T.Mesh(geo.cone, mat(color, { opacity, flat: true, side: "double", add })));
      o.material = mat(color, { opacity, flat: true, side: "double", add });
      const A = loc(apex), B = loc(basePt), d = A.clone().sub(B), len = d.length();
      o.position.copy(B).addScaledVector(d, 0.5);
      o.scale.set(r, Math.max(len, 0.01), r);
      o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), len > 1e-6 ? d.multiplyScalar(1 / len) : new T.Vector3(0, 1, 0));
      o.renderOrder = 3;
      return o;
    },
    /** Kesik konus (ikki uchi turli radiusli nur dastasi). */
    frustum(key, a, b, { ra, rb, color = "#fde047", opacity = 0.2, add = false } = {}) {
      const ratio = (ra / Math.max(rb, 1e-6)).toFixed(3);
      const o = use(key, `fr|${ratio}`, () => new T.Mesh(new T.CylinderGeometry(Number(ratio), 1, 1, 40, 1, true), mat(color, { opacity, flat: true, side: "double", add })));
      o.material = mat(color, { opacity, flat: true, side: "double", add });
      const A = loc(a), B = loc(b), d = A.clone().sub(B), len = d.length();
      o.position.copy(B).addScaledVector(d, 0.5);
      o.scale.set(rb, Math.max(len, 0.01), rb);
      o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), len > 1e-6 ? d.multiplyScalar(1 / len) : new T.Vector3(0, 1, 0));
      o.renderOrder = 3;
      return o;
    },
    /**
     * Ekran/taxta: tekislikka tik turadigan yupqa panel. at — markazi; size = [tekislik bo‘ylab uzunlik, d bo‘ylab kenglik].
     * dir: "y" — panel kanvasning y o‘qi bo‘ylab (normal x bo‘ylab; chapdan qaraladi), "x" — x o‘qi bo‘ylab (normal y).
     * paint(ctx, cw, ch) — panel yuzasiga chizadi (sig o‘zgarganda); ctx x → d (kuzatuvchi tomonga), y → pastga.
     */
    panel(key, { at, size, dir = "y", color = "#f8fafc", paint, sig = "", res = [128, 128], thick = 3, back = "#64748b", emissive = 0, angle = 0 }) {
      const grp = use(key, `panel|${paint ? res.join("x") : "plain"}`, () => {
        const G = new T.Group();
        const body = new T.Mesh(geo.box, mat(back));
        body.name = "body";
        G.add(body);
        const face = new T.Mesh(geo.plane, mat(color));
        face.name = "face";
        if (paint) {
          const cv = document.createElement("canvas"); cv.width = res[0]; cv.height = res[1];
          const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
          const m = new T.MeshBasicMaterial({ map: tex, toneMapped: false }); m.userData.own = true;
          face.material = m; face.userData.cv = cv; face.userData.sig = null;
        }
        G.add(face);
        return G;
      });
      const body = grp.getObjectByName("body"), face = grp.getObjectByName("face");
      loc(at, grp.position);
      body.material = mat(back);
      body.scale.set(thick, size[0], size[1]);
      body.position.set(thick / 2 + 0.3, 0, 0);
      face.scale.set(size[1], size[0], 1);
      face.rotation.set(0, -Math.PI / 2, 0);
      grp.rotation.set(0, 0, (dir === "x" ? -Math.PI / 2 : 0) + angle);
      if (paint) {
        if (face.userData.sig !== sig) {
          const cv = face.userData.cv, c2 = cv.getContext("2d");
          c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cv.width, cv.height);
          paint(c2, cv.width, cv.height);
          face.material.map.needsUpdate = true; face.userData.sig = sig;
        }
      } else face.material = mat(color, { emissive });
      return grp;
    },
    /** Linza: optik o‘q — tekislikning x o‘qi. H — diametr, t — markazdagi qalinlik, edge — chetidagi qalinlik. */
    lens(key, { at, H, t, edge = 2, color = "#7dd3fc", opacity = 0.42, rim = true, axis = "x" }) {
      const sig = `lens|${H.toFixed(1)}|${t.toFixed(1)}|${edge.toFixed(1)}|${rim}`;
      const grp = use(key, sig, () => {
        const G = new T.Group(), R = H / 2, N = 18, pts = [];
        for (let i = 0; i <= N; i++) { const r = (R * i) / N; pts.push(new T.Vector2(r, edge / 2 + (t / 2 - edge / 2) * (1 - (r / R) ** 2))); }
        for (let i = N; i >= 0; i--) { const r = (R * i) / N; pts.push(new T.Vector2(r, -(edge / 2 + (t / 2 - edge / 2) * (1 - (r / R) ** 2)))); }
        const glass = new T.Mesh(new T.LatheGeometry(pts, 48), mat(color, { opacity, glass: true }));
        glass.renderOrder = 4;
        G.add(glass);
        if (rim) { const ring = new T.Mesh(new T.TorusGeometry(R + 1.5, 2, 10, 48), mat("#475569", { metal: 0.4, rough: 0.5 })); ring.rotation.x = Math.PI / 2; G.add(ring); }
        return G;
      });
      loc(at, grp.position);
      grp.rotation.set(0, 0, axis === "x" ? Math.PI / 2 : 0);
      return grp;
    },
    /** Tekislikdagi ko‘pburchakni d bo‘ylab «qalinlashtirish»: prizma, plastinka, yarim silindr, ko‘zgu… pts — [[px, py], …]. */
    extrude(key, { pts, depth, color = "#7dd3fc", opacity = 1, glass = false, z = 0, emissive = 0, rough, metal }) {
      const sig = `ex|${depth.toFixed(1)}|${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(";")}`;
      const o = use(key, sig, () => {
        const sh = new T.Shape();
        pts.forEach((p, i) => { const x = p[0] - r3.w / 2, y = r3.h / 2 - p[1]; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); });
        sh.closePath();
        const gm = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 });
        gm.translate(0, 0, -depth / 2);
        const m = new T.Mesh(gm, mat(color, { opacity, glass }));
        if (glass || opacity < 1) m.renderOrder = 4;
        return m;
      });
      o.material = mat(color, { opacity, glass, emissive, rough, metal });
      o.position.set(0, 0, z);
      return o;
    },
    /** Yorug‘lik halosi (sprite). */
    glow(key, { at, r, color = "#fde047", opacity = 0.9 }) {
      const o = use(key, `glow|${color}`, () => {
        const cv = document.createElement("canvas"); cv.width = cv.height = 96;
        const c2 = cv.getContext("2d"), gr = c2.createRadialGradient(48, 48, 0, 48, 48, 48);
        gr.addColorStop(0, color); gr.addColorStop(0.35, color + "aa"); gr.addColorStop(1, color + "00");
        c2.fillStyle = gr; c2.fillRect(0, 0, 96, 96);
        const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
        const m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }); m.userData.own = true;
        const s = new T.Sprite(m); s.renderOrder = 6;
        return s;
      });
      loc(at, o.position); o.scale.set(2 * r, 2 * r, 1); o.material.opacity = opacity;
      return o;
    },
    /** Shtativ: (px, py) nuqtadan stolgacha sterjen va taglik (faqat tik tekislikda). */
    stand(key, { x, top, d = 0, r = 2.2, base = 16, color = "#475569" }) {
      if (cam.plane !== "v") return null;
      const fl = g.floor;
      if (top >= fl - 2) return null;
      g.rod(key + ":rod", [x, top, d], [x, fl - 2, d], { r, color });
      g.cyl(key + ":base", { at: [x, fl - 2, d], r: base, len: 4, axis: "y", color, metal: 0.3, rough: 0.6 });
      return true;
    },
    /** Optik skamya relsi (tik tekislikda, stol ustida). */
    rail(key, { x0, x1, d = 0, color = "#64748b" }) {
      if (cam.plane !== "v") return null;
      const fl = g.floor;
      return g.box(key, { at: [(x0 + x1) / 2, fl - 4, d], size: [Math.abs(x1 - x0), 5, 14], color, metal: 0.5, rough: 0.45 });
    },
    /** Ixtiyoriy obyekt: make(THREE) → Object3D; sig o‘zgarsa qayta quriladi. Qaytgan obyektni o‘zingiz joylashtirasiz. */
    custom(key, sig, make) { return use(key, sig, () => make(T)); },
  };

  /* ---------------------------------------------------------------- Sinxronlash va chizish */

  const lift = () => Math.round(r3.h * 0.07);
  function target(out) { return cam.plane === "v" ? out.set(0, r3.h * 0.5 + lift() * 0.4, 0) : out.set(0, 0, 0); }
  function placeCamera() {
    const h = r3.h, fov = (camera.fov * Math.PI) / 180;
    const dist = ((h / 2) / Math.tan(fov / 2)) * (cam.plane === "v" ? 1.04 : 0.9) / cam.zoom;
    const t = target(new T.Vector3());
    camera.position.set(t.x + dist * Math.sin(cam.az) * Math.cos(cam.el), t.y + dist * Math.sin(cam.el), t.z + dist * Math.cos(cam.az) * Math.cos(cam.el));
    camera.near = dist / 50; camera.far = dist * 8;
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    scene.updateMatrixWorld(true);
  }
  function applyTheme(v) {
    const c = stage.colors, amb = v.ambient ?? 1;
    tableMat.color.set(c.dark ? "#1e293b" : "#e2e8f0");
    hemi.intensity = (c.dark ? 0.85 : 1.15) * amb;
    hemi.groundColor.set(c.dark ? "#0f172a" : "#94a3b8");
    sun.intensity = (c.dark ? 1.25 : 1.7) * (v.sun ?? 1);
    if (v.light) sun.position.set(v.light[0], v.light[1], v.light[2]); else sun.position.set(-0.5, 1.2, 0.9);
    gl.style.background = v.bg || "";
  }
  function sync() {
    const w = stage.w, h = stage.h;
    if (!w || !h) return;
    r3.w = w; r3.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (gl.width !== Math.round(w * dpr) || gl.height !== Math.round(h * dpr)) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
    if (texW !== canvas2d.width || texH !== canvas2d.height) {
      sheetTex?.dispose();
      sheetTex = new T.CanvasTexture(canvas2d);
      sheetTex.colorSpace = T.SRGBColorSpace;
      sheetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      sheetTex.generateMipmaps = false; sheetTex.minFilter = T.LinearFilter;
      sheet.material.map = sheetTex; sheet.material.needsUpdate = true;
      texW = canvas2d.width; texH = canvas2d.height;
    }
    sheetTex.needsUpdate = true;
    sheet.scale.set(w, h, 1);

    const v = view() || {};
    const plane = v.plane === "h" ? "h" : "v", key = `${v.key ?? ""}|${plane}`;
    if (key !== cam.key) {
      cam.key = key; cam.plane = plane;
      cam.homeAz = v.az ?? (plane === "v" ? -0.5 : -0.35);
      cam.homeEl = v.el ?? (plane === "v" ? 0.28 : 0.82);
      cam.az = cam.homeAz; cam.el = cam.homeEl; cam.zoom = 1;
    }
    if (plane === "v") {
      root.rotation.set(0, 0, 0); root.position.set(0, h / 2 + lift(), 0);
      table.scale.set(w * 1.1, 10, h * 1.05); table.position.set(0, -5, 0);
    } else {
      root.rotation.set(-Math.PI / 2, 0, 0); root.position.set(0, 1.5, 0);
      table.scale.set(w * 1.06, 10, h * 1.06); table.position.set(0, -5.2, 0);
    }
    table.visible = v.table !== false;
    applyTheme(v);

    for (const c of cache.values()) c.used = false;
    hudUsed = false;
    try { frame?.(g); } catch (err) { console.error(err); }
    for (const c of cache.values()) c.obj.visible = c.used;
    hud.hidden = !hudUsed;
    draw3d();
  }
  function draw3d() { placeCamera(); renderer.render(scene, camera); }
  function requestRender() { if (!r3.on || rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; if (r3.on) draw3d(); }); }

  /* ---------------------------------------------------------------- Ko‘rsatkich: sudrash yoki aylantirish */

  function bindPointer() {
    const ray = new T.Raycaster(), ndc = new T.Vector2(), hit = new T.Vector3(), plane = new T.Plane(), n = new T.Vector3(), p0 = new T.Vector3();
    let mode = null, last = null, pid = null;
    /** Ko‘rsatkich → 2D kanvas pikseli (nur tekisligi bilan kesishuv). */
    function toSheet(e) {
      const r = gl.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      sheet.getWorldPosition(p0);
      n.set(0, 0, 1).transformDirection(sheet.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(n, p0);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      root.worldToLocal(hit);
      return { px: hit.x + r3.w / 2, py: r3.h / 2 - hit.y };
    }
    function forward(type, e, s) {
      const r = canvas2d.getBoundingClientRect();
      canvas2d.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: FAKE_POINTER, pointerType: e.pointerType, isPrimary: true,
        clientX: r.left + s.px, clientY: r.top + s.py, button: e.button, buttons: e.buttons, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey,
      }));
    }
    const inside = (s) => s && s.px > -r3.w * 0.5 && s.px < r3.w * 1.5 && s.py > -r3.h * 0.5 && s.py < r3.h * 1.5;
    gl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const s = toSheet(e);
      pid = e.pointerId;
      try { gl.setPointerCapture(pid); } catch { /* */ }
      if (inside(s)) {
        forward("pointerdown", e, s);
        if (canvas2d.dataset.dragging === "true") { mode = "drag"; gl.dataset.dragging = "true"; return; }
        forward("pointerup", e, s);
      }
      mode = "orbit"; last = { x: e.clientX, y: e.clientY }; gl.dataset.orbit = "true";
    });
    gl.addEventListener("pointermove", (e) => {
      if (mode === "drag") { const s = toSheet(e); if (s) forward("pointermove", e, s); return; }
      if (mode === "orbit") {
        const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
        const v = cam.plane === "v";
        cam.az = clamp(cam.az - dx * 0.006, v ? -1.3 : -1.5, v ? 1.3 : 1.5);
        cam.el = clamp(cam.el + dy * 0.005, v ? -0.02 : 0.22, v ? 1.15 : 1.5);
        requestRender();
        return;
      }
      const s = toSheet(e);
      if (inside(s)) { forward("pointermove", e, s); gl.style.cursor = canvas2d.style.cursor || ""; }
    });
    const end = (e) => {
      if (mode === "drag") { const s = toSheet(e) || { px: 0, py: 0 }; forward(e.type === "pointercancel" ? "pointercancel" : "pointerup", e, s); }
      mode = null; gl.dataset.dragging = "false"; gl.dataset.orbit = "false";
      try { gl.releasePointerCapture(pid); } catch { /* */ }
    };
    gl.addEventListener("pointerup", end);
    gl.addEventListener("pointercancel", end);
    gl.addEventListener("dblclick", () => { cam.az = cam.homeAz; cam.el = cam.homeEl; cam.zoom = 1; requestRender(); });
    gl.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey && !section.classList.contains("is-fs")) return;
      e.preventDefault();
      cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.0015), 0.7, 2.6);
      requestRender();
    }, { passive: false });
  }

  r3.enable = enable;
  r3.disable = disable;
  r3.render = requestRender;
  if (want) enable();
  return r3;
}

export { readColors };
