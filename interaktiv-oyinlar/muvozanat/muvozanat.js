// ==========================================================================
// Muvozanat — richag (kuch momenti) haqidagi bosqichli o‘yin.
// Richag o‘rtasida tayanch, har tomonda 5 tadan bo‘lim (bo‘lim = 0,5 m). Yuklar massasi kg da.
// Muvozanat sharti: Σ mᵢ·xᵢ = 0 (x — tayanchdan bo‘limlar soni, chap tomon manfiy).
// Topshiriq turlari: balance — barcha yuklarni joylab muvozanatlash; predict — og‘ish tomonini
// bashorat qilish; find — noma’lum quti massasini richag yordamida topish.
// ==========================================================================

import { icon } from "../../assets/js/ui/icons.js";

const PROGRESS_KEY = "oliyfizika:muvozanat:progress";
const G = 9.8;
const ARM = 0.5;            // bitta bo‘lim uzunligi, m
const CX = 360;             // tayanch (SVG)
const BEAM_Y = 200;
const STEP = 58;            // bo‘limlar orasidagi masofa (SVG)
const TILT = 11;            // og‘ganda burilish burchagi, °

// fixed: { bo‘lim: [massalar] }, tray: qo‘shiladigan yuklar, box: { pos, m } — noma’lum quti
const LEVELS = [
  { type: "balance", title: "Birinchi muvozanat", fixed: { "-2": [2] }, tray: [2] },
  { type: "balance", title: "Yengil, lekin uzoqda", fixed: { "-4": [1] }, tray: [2] },
  { type: "balance", title: "Og‘ir yuk", fixed: { "-3": [4] }, tray: [3] },
  { type: "balance", title: "Ikki yuk bir tomonda", fixed: { "-2": [3], "-4": [1] }, tray: [5] },
  { type: "balance", title: "Ikki yukni joylang", fixed: { "-5": [2] }, tray: [1, 3] },
  { type: "balance", title: "Ikki tomonda ham yuk", fixed: { "-1": [6], "3": [1] }, tray: [1, 2] },
  { type: "predict", title: "Bashorat: to‘rt yuk", fixed: { "-3": [2], "-1": [4], "2": [3], "4": [1] } },
  { type: "predict", title: "Bashorat: aldamchi richag", fixed: { "-4": [3], "5": [2], "1": [3] } },
  { type: "find", title: "Qutining massasi", box: { pos: -2, m: 6 }, tray: [1, 2, 4] },
  { type: "find", title: "Og‘irroq quti", box: { pos: -3, m: 5 }, tray: [2, 3, 5] },
  { type: "balance", title: "Chap tomonni og‘irlashtiring", fixed: { "2": [5], "-5": [1] }, tray: [1, 2] },
  { type: "predict", title: "Bashorat: besh yuk", fixed: { "-5": [1], "-2": [3], "1": [2], "3": [2], "4": [1] } },
  { type: "balance", title: "Uchta yuk", fixed: { "-5": [3], "-1": [2] }, tray: [2, 4, 1] },
  { type: "find", title: "O‘ngdagi quti", box: { pos: 4, m: 3 }, tray: [2, 5] },
];

const TYPE_TEXT = {
  balance: "Barcha yuklarni richagga joylab, uni muvozanatga keltiring. So‘ng tayanchlarni olib tashlang — “Qo‘yib yuborish”.",
  predict: "Tayanchlar olinsa, richag qaysi tomonga og‘adi? Kuch momentlarini hisoblab, javobni tanlang.",
  find: "Qutining massasi noma’lum. Yuklar yordamida richagni muvozanatga keltiring va qutining massasini hisoblang.",
};
const TYPE_LABEL = { balance: "Muvozanatlash", predict: "Bashorat", find: "Massani top" };

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const header = document.querySelector("[data-hide-on-play]");
function show(name) {
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  header.hidden = name === "play";
}
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, "").replace(".", ",");
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  if (text !== undefined) node.textContent = text;
  return node;
};

// ------------------------------------------------------------------ progress
function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") || {}; } catch { return {}; }
}
function saveStars(i, stars) {
  const p = readProgress();
  p[i] = Math.max(p[i] || 0, stars);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    // katalog kartasi uchun jami yulduzlar
    localStorage.setItem(`${PROGRESS_KEY.replace(":progress", "")}:stars`, String(Object.values(p).reduce((a, b) => a + b, 0)));
  } catch { /* storage yopiq */ }
}
const unlocked = (i, p = readProgress()) => i === 0 || (p[i - 1] || 0) > 0;
const starsHtml = (n) => [0, 1, 2].map((k) => `<span class="${k < n ? "on" : ""}">★</span>`).join("");

function renderLevels() {
  const p = readProgress();
  const list = $("levels");
  list.innerHTML = "";
  let total = 0;
  LEVELS.forEach((lvl, i) => {
    total += p[i] || 0;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gm-level";
    const open = unlocked(i, p);
    btn.disabled = !open;
    btn.dataset.done = String((p[i] || 0) > 0);
    btn.innerHTML = `<span class="gm-level__num">${i + 1}-bosqich · ${TYPE_LABEL[lvl.type]}</span>
      <span class="gm-level__title"></span>
      <span class="gm-stars">${open ? starsHtml(p[i] || 0) : `${icon("lock")} yopiq`}</span>`;
    btn.querySelector(".gm-level__title").textContent = lvl.title;
    btn.addEventListener("click", () => openLevel(i));
    li.append(btn);
    list.append(li);
  });
  $("totalStars").textContent = `${total} / ${LEVELS.length * 3} ★`;
}

// ------------------------------------------------------------------ holat
let li = 0;
let level = LEVELS[0];
let weights = [];      // { id, m, pos (null — lotokda), fixed, box }
let selected = null;   // tanlangan yuk id
let released = false;
let solved = false;
let tries = 0;
let balancedOnce = false;
let narrow = false;

const onBeam = () => weights.filter((w) => w.pos !== null);
const torque = (list = onBeam()) => list.reduce((s, w) => s + w.m * w.pos, 0);
const sideTorque = (sign) => onBeam().filter((w) => Math.sign(w.pos) === sign).reduce((s, w) => s + w.m * G * Math.abs(w.pos) * ARM, 0);

function openLevel(i) {
  if (!unlocked(i)) return;
  li = i;
  level = LEVELS[i];
  let id = 0;
  weights = [];
  Object.entries(level.fixed || {}).forEach(([pos, ms]) => ms.forEach((m) => weights.push({ id: id++, m, pos: Number(pos), fixed: true })));
  if (level.box) weights.push({ id: id++, m: level.box.m, pos: level.box.pos, fixed: true, box: true });
  (level.tray || []).forEach((m) => weights.push({ id: id++, m, pos: null, fixed: false }));
  selected = null; released = false; solved = false; tries = 0; balancedOnce = false;
  $("lvlNum").textContent = `${i + 1}-bosqich · ${TYPE_LABEL[level.type]}`;
  $("lvlTitle").textContent = level.title;
  $("task").textContent = TYPE_TEXT[level.type];
  $("tries").textContent = "0";
  $("feedback").textContent = "";
  $("feedback").removeAttribute("data-ok");
  $("massInput").value = "";
  $("win").hidden = true;
  show("play");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ------------------------------------------------------------------ chizish
function blockHeight(m, box = false) { return box ? (narrow ? 50 : 44) : (narrow ? 32 : 16) + m * 7; } // quti balandligi massasini oshkor qilmasin

function render() {
  const isPredict = level.type === "predict";
  // Tor ekranda bo‘sh joylar kesiladi va yozuvlar kattaroq bo‘ladi.
  const svg = $("svg");
  narrow = svg.clientWidth > 0 && svg.clientWidth < 560;
  svg.setAttribute("viewBox", narrow ? "34 40 652 235" : "0 0 720 300");
  svg.classList.toggle("is-narrow", narrow);
  const beam = $("beam");
  beam.innerHTML = "";
  const angle = released ? Math.sign(torque()) * TILT : 0;
  beam.style.transform = `rotate(${angle}deg)`;

  // to‘sin
  beam.append(el("rect", { class: "mv-beam", x: CX - STEP * 5 - 26, y: BEAM_Y - 6, width: STEP * 10 + 52, height: 12, rx: 6 }));
  for (let p = -5; p <= 5; p += 1) {
    const x = CX + p * STEP;
    beam.append(el("line", { class: "mv-tick", x1: x, y1: BEAM_Y - 6, x2: x, y2: BEAM_Y + 6 }));
    if (p !== 0) beam.append(el("text", { class: "mv-num", x, y: BEAM_Y + 22, "text-anchor": "middle" }, String(Math.abs(p))));
  }
  beam.append(el("circle", { class: "mv-pin", cx: CX, cy: BEAM_Y, r: 6 }));

  // bo‘limlar (bosiladigan joylar)
  if (!released && !isPredict) {
    for (let p = -5; p <= 5; p += 1) {
      if (p === 0) continue;
      const slot = el("rect", {
        class: "mv-slot", x: CX + p * STEP - STEP / 2 + 3, y: 16, width: STEP - 6, height: BEAM_Y - 22, rx: 10,
        tabindex: 0, role: "button", "aria-label": `${p < 0 ? "Chap" : "O‘ng"} tomon, ${Math.abs(p)}-bo‘lim`, "data-pos": p,
      });
      if (selected !== null) slot.classList.add("is-ready");
      slot.addEventListener("click", () => placeSelected(p));
      slot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); placeSelected(p); } });
      beam.append(slot);
    }
  }

  // yuklar (bir bo‘limda ustma-ust)
  const stacks = {};
  onBeam().forEach((w) => { (stacks[w.pos] ||= []).push(w); });
  Object.entries(stacks).forEach(([pos, list]) => {
    let top = BEAM_Y - 6;
    list.forEach((w) => {
      const h = blockHeight(w.m, w.box);
      const width = narrow ? 52 : w.box ? 46 : 42;
      const x = CX + Number(pos) * STEP - width / 2;
      top -= h;
      const g = el("g", { class: `mv-weight${w.fixed ? " is-fixed" : ""}${w.box ? " is-box" : ""}` });
      g.append(el("rect", { x, y: top, width, height: h, rx: 6 }));
      g.append(el("text", { x: x + width / 2, y: top + h / 2 + (narrow ? 9 : 5), "text-anchor": "middle" }, w.box && !solved ? "?" : narrow ? fmt(w.m) : `${fmt(w.m)} kg`));
      if (!w.fixed && !released) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `${w.m} kg yukni qaytarish`);
        g.addEventListener("click", (e) => { e.stopPropagation(); returnWeight(w.id); });
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); returnWeight(w.id); } });
      }
      beam.append(g);
      top -= 2;
    });
  });

  // tayanchlar
  const sup = $("supports");
  sup.innerHTML = "";
  [-1, 1].forEach((s) => {
    const x = CX + s * (STEP * 5 - 4);
    sup.append(el("rect", { class: `mv-support${released ? " is-gone" : ""}`, x: x - 9, y: BEAM_Y + 6, width: 18, height: 262 - BEAM_Y - 6, rx: 3 }));
  });

  // lotok
  const tray = $("tray");
  tray.innerHTML = "";
  weights.filter((w) => w.pos === null).forEach((w) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mv-chip";
    btn.style.setProperty("--h", `${blockHeight(w.m) * 0.75}px`);
    btn.textContent = `${fmt(w.m)} kg`;
    btn.setAttribute("aria-pressed", String(selected === w.id));
    btn.disabled = released;
    btn.addEventListener("pointerdown", (e) => startDrag(e, w.id));
    btn.addEventListener("click", () => { if (!dragMoved) { selected = selected === w.id ? null : w.id; render(); } });
    li.append(btn);
    tray.append(li);
  });
  const trayEmpty = !weights.some((w) => w.pos === null);
  $("trayWrap").hidden = isPredict;
  $("tray").hidden = trayEmpty;
  $("trayHint").textContent = trayEmpty && !isPredict
    ? "Barcha yuklar richagda. Yukni bossangiz, u qaytadi."
    : "Yukni bosing, so‘ng richagdagi bo‘limni tanlang (yoki sudrab olib boring). Joylangan yukni bossangiz, u qaytadi.";

  // tugmalar
  $("predict").hidden = !isPredict || released;
  $("release").hidden = isPredict || released;
  $("reset").hidden = isPredict || released;
  $("again").hidden = !released || solved;
  $("find").hidden = !(level.type === "find" && balancedOnce && !solved);
  $("release").disabled = level.type === "balance" ? !trayEmpty : onBeam().every((w) => w.fixed);
  $("release").title = level.type === "balance" && !trayEmpty ? "Avval barcha yuklarni joylashtiring" : "";
  drawTorques();
}

function drawTorques() {
  const box = $("torques");
  box.hidden = !released;
  if (!released) return;
  const left = sideTorque(-1);
  const right = sideTorque(1);
  const hideBox = level.type === "find" && !solved;
  const describeSide = (sign) => onBeam().filter((w) => Math.sign(w.pos) === sign)
    .map((w) => (w.box && !solved ? "m·g·" : `${fmt(w.m)}·9,8·`) + fmt(Math.abs(w.pos) * ARM)).join(" + ") || "0";
  const hasBox = (sign) => hideBox && onBeam().some((w) => w.box && Math.sign(w.pos) === sign);
  box.innerHTML = `
    <div><small>Chap tomon momenti</small><b></b><span></span></div>
    <div class="mv-torques__sign"></div>
    <div><small>O‘ng tomon momenti</small><b></b><span></span></div>`;
  const [l, r] = box.querySelectorAll("div:not(.mv-torques__sign)");
  l.querySelector("b").textContent = hasBox(-1) ? "?" : `${fmt(left)} N·m`;
  r.querySelector("b").textContent = hasBox(1) ? "?" : `${fmt(right)} N·m`;
  l.querySelector("span").textContent = describeSide(-1);
  r.querySelector("span").textContent = describeSide(1);
  const t = torque();
  box.querySelector(".mv-torques__sign").textContent = t === 0 ? "=" : t > 0 ? "<" : ">";
}

// ------------------------------------------------------------------ yuklarni joylash
function placeSelected(pos) {
  if (selected === null || released) return;
  const w = weights.find((x) => x.id === selected);
  if (!w) return;
  w.pos = pos;
  selected = weights.find((x) => x.pos === null)?.id ?? null;
  clearFeedback();
  render();
}
function returnWeight(id) {
  const w = weights.find((x) => x.id === id);
  if (!w || w.fixed || released) return;
  w.pos = null;
  selected = id;
  clearFeedback();
  render();
}
function clearFeedback() {
  $("feedback").textContent = "";
  $("feedback").removeAttribute("data-ok");
}

// Sudrab olib borish
let drag = null;
let dragMoved = false;
function slotFromPoint(clientX, clientY) {
  const svg = $("svg");
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  if (p.y < 0 || p.y > BEAM_Y + 30) return null;
  const pos = Math.round((p.x - CX) / STEP);
  return pos !== 0 && Math.abs(pos) <= 5 ? pos : null;
}
function startDrag(e, id) {
  if (released) return;
  dragMoved = false;
  drag = { id, x: e.clientX, y: e.clientY, ghost: null, target: e.currentTarget };
  e.currentTarget.setPointerCapture?.(e.pointerId);
  e.currentTarget.addEventListener("pointermove", moveDrag);
  e.currentTarget.addEventListener("pointerup", endDrag, { once: true });
  e.currentTarget.addEventListener("pointercancel", endDrag, { once: true });
}
function moveDrag(e) {
  if (!drag) return;
  if (!dragMoved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!dragMoved) {
    dragMoved = true;
    const w = weights.find((x) => x.id === drag.id);
    drag.ghost = document.createElement("div");
    drag.ghost.className = "mv-ghost";
    drag.ghost.textContent = `${fmt(w.m)} kg`;
    document.body.append(drag.ghost);
  }
  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;
  const pos = slotFromPoint(e.clientX, e.clientY);
  $("beam").querySelectorAll(".mv-slot").forEach((s) => s.classList.toggle("is-over", Number(s.dataset.pos) === pos));
}
function endDrag(e) {
  if (!drag) return;
  drag.target.removeEventListener("pointermove", moveDrag);
  if (dragMoved) {
    const pos = slotFromPoint(e.clientX, e.clientY);
    drag.ghost?.remove();
    if (pos !== null) { selected = drag.id; placeSelected(pos); }
    else render();
    setTimeout(() => { dragMoved = false; }, 0);
  }
  drag = null;
}

// ------------------------------------------------------------------ tekshirish
function feedback(ok, text) {
  $("feedback").dataset.ok = String(ok);
  $("feedback").innerHTML = `${icon(ok ? "checkCircle" : "alert")}<span></span>`;
  $("feedback").querySelector("span").textContent = text;
}

function release() {
  if (released) return;
  tries += 1;
  $("tries").textContent = String(tries);
  released = true;
  selected = null;
  render();
  const t = torque();
  if (t !== 0) {
    feedback(false, `Richag ${t > 0 ? "o‘ngga" : "chapga"} og‘di: ${t > 0 ? "o‘ng" : "chap"} tomonning kuch momenti katta. Tayanchlarni qaytarib, yuklarni siljiting.`);
    return;
  }
  if (level.type === "balance") { win(); return; }
  balancedOnce = true;
  feedback(true, "Richag muvozanatda! Endi momentlar tengligidan qutining massasini hisoblang.");
  render();
  $("massInput").focus();
}

function guess(dir) {
  tries += 1;
  $("tries").textContent = String(tries);
  released = true;
  render();
  const t = Math.sign(torque());
  const names = { "-1": "chapga og‘adi", 0: "muvozanatda qoladi", 1: "o‘ngga og‘adi" };
  if (dir === t) {
    setTimeout(win, 700);
    feedback(true, `To‘g‘ri — richag ${names[t]}.`);
  } else {
    feedback(false, `Noto‘g‘ri: richag ${names[t]}. Momentlarni solishtiring va qayta urinib ko‘ring.`);
  }
}

function checkMass(e) {
  e.preventDefault();
  const v = Number(String($("massInput").value).replace(",", ".").trim());
  if (!Number.isFinite(v) || v <= 0) { feedback(false, "Massani kg da son bilan kiriting."); return; }
  if (Math.abs(v - level.box.m) < 0.05) { solved = true; render(); win(); return; }
  tries += 1;
  $("tries").textContent = String(tries);
  feedback(false, `${fmt(v)} kg emas. Muvozanatda m·l (quti) = Σ mᵢ·lᵢ (yuklar). Qayta hisoblang.`);
}

function win() {
  solved = true;
  render();
  const stars = tries <= 1 ? 3 : tries === 2 ? 2 : 1;
  saveStars(li, stars);
  $("winStars").innerHTML = starsHtml(stars);
  $("winTitle").textContent = level.type === "predict" ? "To‘g‘ri bashorat!" : level.type === "find" ? `Quti massasi ${fmt(level.box.m)} kg!` : "Muvozanat!";
  const l = sideTorque(-1);
  const r = sideTorque(1);
  $("winText").textContent = `Chap: ${fmt(l)} N·m, o‘ng: ${fmt(r)} N·m. Urinishlar: ${Math.max(1, tries)}.`;
  $("nextLvl").textContent = li + 1 < LEVELS.length ? "Keyingi bosqich" : "Barcha bosqichlar";
  setTimeout(() => { $("win").hidden = false; $("nextLvl").focus({ preventScroll: true }); }, 500);
}

$("release").addEventListener("click", release);
$("again").addEventListener("click", () => {
  released = false;
  if (level.type === "predict") { clearFeedback(); }
  render();
});
$("reset").addEventListener("click", () => {
  weights.forEach((w) => { if (!w.fixed) w.pos = null; });
  selected = null;
  clearFeedback();
  render();
});
$("predict").addEventListener("click", (e) => {
  const b = e.target.closest("[data-guess]");
  if (b) guess(Number(b.dataset.guess));
});
$("find").addEventListener("submit", checkMass);
$("retry").addEventListener("click", () => openLevel(li));
$("nextLvl").addEventListener("click", () => {
  if (li + 1 < LEVELS.length) openLevel(li + 1);
  else { renderLevels(); show("setup"); }
});
$("toLevels").addEventListener("click", () => { renderLevels(); show("setup"); });

let lastNarrow = null;
new ResizeObserver(() => {
  const svg = $("svg");
  const n = svg.clientWidth > 0 && svg.clientWidth < 560;
  if (n !== lastNarrow && !$("svg").closest("[data-view]").hidden) { lastNarrow = n; render(); }
}).observe($("svg"));

renderLevels();
