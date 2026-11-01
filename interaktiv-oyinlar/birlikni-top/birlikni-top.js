// ==========================================================================
// Birlikni top — fizik kattalikning SI birligini topish o‘yini.
//   Oson:  to‘rtta variantdan to‘g‘ri birlik (variantlar boshqa o‘lchamli kattaliklardan olinadi).
//   Qiyin: birlikni asosiy birliklardan (kg, m, s, A, K, mol) darajalar orqali yig‘ish.
// Ma’lumot: ../shared/units-data.js. Rekord shu brauzerda (localStorage) saqlanadi.
// ==========================================================================

import { icon } from "../../assets/js/ui/icons.js";
import { shuffle } from "../shared/game-sets.js";
import { QUANTITIES, BASE, BASE_NAMES, formatDims, sameDims } from "../shared/units-data.js";

const BEST_KEY = "oliyfizika:birlikni-top:best";
const PREFS_KEY = "oliyfizika:birlikni-top:prefs";
const POINTS = { easy: 10, hard: 20 };
const KEYS = ["A", "B", "C", "D"];
const MIN_EXP = -4;
const MAX_EXP = 4;
const GROUP_NAMES = { all: "Barcha bo‘limlar", mex: "Mexanika", mol: "Molekulyar fizika", el: "Elektr va magnetizm" };

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const header = document.querySelector("[data-hide-on-play]");
function show(name) {
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  header.hidden = name === "play";
}

let mode = "easy";
let group = "all";
let round = [];
let index = 0;
let score = 0;
let correctCount = 0;
let answered = false;
let mistakes = [];
let exps = [0, 0, 0, 0, 0, 0];
let options = [];
let correctIndex = 0;

// ------------------------------------------------------------------ yordamchilar
const unitLabel = (q) => (q.unitName ? `${q.unit} (${q.unitName})` : q.unit);
const isBase = (q) => q.hint === "asosiy kattalik";
const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };

function pool() {
  return QUANTITIES.filter((q) => (group === "all" || q.group === group) && !(mode === "hard" && isBase(q)));
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mode, group })); } catch { /* storage yopiq */ }
}
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    if (p.mode === "easy" || p.mode === "hard") mode = p.mode;
    if (GROUP_NAMES[p.group]) group = p.group;
  } catch { /* yo‘q */ }
}

// ------------------------------------------------------------------ sozlash
function describe() {
  document.querySelectorAll("#modes [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  document.querySelectorAll("#groups [data-g]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.g === group)));
  const n = pool().length;
  $("chosen").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = mode === "easy" ? "Oson daraja" : "Qiyin daraja";
  const span = document.createElement("span");
  span.textContent = `${GROUP_NAMES[group]} · ${n} ta kattalik · har bir to‘g‘ri javob ${POINTS[mode]} ball`;
  $("chosen").append(b, span);
  const best = readNum(`${BEST_KEY}:${mode}`);
  $("best").hidden = !best;
  if (best) $("best").textContent = `Shu darajadagi eng yaxshi natijangiz: ${best} %`;
}

$("modes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (!b) return;
  mode = b.dataset.mode;
  savePrefs();
  describe();
});
$("groups").addEventListener("click", (e) => {
  const b = e.target.closest("[data-g]");
  if (!b) return;
  group = b.dataset.g;
  savePrefs();
  describe();
});

// ------------------------------------------------------------------ o‘yin
function start() {
  const count = Number($("count").value) || Infinity;
  round = shuffle(pool()).slice(0, count);
  index = 0; score = 0; correctCount = 0; mistakes = [];
  $("playTitle").textContent = `${mode === "easy" ? "Oson" : "Qiyin"} · ${GROUP_NAMES[group]}`;
  $("score").textContent = "0";
  $("options").hidden = mode !== "easy";
  $("build").hidden = mode !== "hard";
  $("kbd").innerHTML = mode === "easy"
    ? "<kbd>1</kbd>–<kbd>4</kbd> javob, <kbd>Enter</kbd> keyingisi"
    : "<kbd>Enter</kbd> tekshirish va keyingisi";
  show("play");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function makeOptions(q) {
  // Variantlar: o‘lchami ham, yozilishi ham boshqa bo‘lgan birliklar; avval shu bo‘limdan.
  const seen = new Set([q.unit]);
  const others = [];
  const candidates = [
    ...shuffle(QUANTITIES.filter((o) => o.group === q.group)),
    ...shuffle(QUANTITIES.filter((o) => o.group !== q.group)),
  ];
  for (const o of candidates) {
    if (others.length === 3) break;
    if (seen.has(o.unit) || sameDims(o.dims, q.dims)) continue;
    seen.add(o.unit);
    others.push(o.unit);
  }
  options = shuffle([q.unit, ...others]);
  correctIndex = options.indexOf(q.unit);
}

function render() {
  const q = round[index];
  answered = false;
  $("progressText").textContent = `${index + 1} / ${round.length}`;
  $("progressBar").parentElement.style.setProperty("--value", String((index / round.length) * 100));
  $("qName").textContent = q.name;
  $("qSym").textContent = q.sym;
  $("qHint").textContent = isBase(q) ? "SI ning asosiy kattaligi" : `Formula: ${q.hint}`;
  $("qLabel").textContent = mode === "easy" ? "SI birligini toping" : "Birlikni asosiy birliklardan yig‘ing";
  $("feedback").textContent = "";
  $("feedback").removeAttribute("data-ok");
  $("next").hidden = true;

  if (mode === "easy") {
    makeOptions(q);
    const list = $("options");
    list.innerHTML = "";
    options.forEach((opt, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gm-opt";
      btn.innerHTML = `<span class="gm-opt__key">${KEYS[i]}</span><span class="gm-opt__text"></span>`;
      btn.querySelector(".gm-opt__text").textContent = opt;
      btn.addEventListener("click", () => choose(i));
      li.append(btn);
      list.append(li);
    });
  } else {
    exps = [0, 0, 0, 0, 0, 0];
    renderSteppers();
    $("check").hidden = false;
    $("clear").hidden = false;
  }
  $("card").style.animation = "none";
  void $("card").offsetWidth;
  $("card").style.animation = "";
}

// ---- qiyin daraja: darajalar
function renderSteppers() {
  const box = $("steppers");
  box.innerHTML = "";
  BASE.forEach((unit, i) => {
    const row = document.createElement("div");
    row.className = "bt-step";
    row.dataset.on = String(exps[i] !== 0);
    row.innerHTML = `
      <span class="bt-step__unit" title="${BASE_NAMES[i]}">${unit}</span>
      <div class="bt-step__ctl">
        <button type="button" class="of-icon-btn" data-d="-1" aria-label="${BASE_NAMES[i]} darajasini kamaytirish">−</button>
        <output aria-label="${BASE_NAMES[i]} darajasi">${exps[i]}</output>
        <button type="button" class="of-icon-btn" data-d="1" aria-label="${BASE_NAMES[i]} darajasini oshirish">+</button>
      </div>`;
    row.querySelectorAll("[data-d]").forEach((b) => {
      b.disabled = answered || (Number(b.dataset.d) < 0 ? exps[i] <= MIN_EXP : exps[i] >= MAX_EXP);
      b.addEventListener("click", () => {
        exps[i] = Math.max(MIN_EXP, Math.min(MAX_EXP, exps[i] + Number(b.dataset.d)));
        renderSteppers();
        box.querySelectorAll(".bt-step")[i].querySelector(`[data-d="${b.dataset.d}"]`)?.focus();
      });
    });
    box.append(row);
  });
  $("live").textContent = formatDims(exps);
}

function check() {
  if (answered) return;
  const q = round[index];
  const ok = sameDims(exps, q.dims);
  answered = true;
  renderSteppers();
  $("check").hidden = true;
  $("clear").hidden = true;
  settle(ok, formatDims(exps));
}

// ---- oson daraja: variant tanlash
function choose(i) {
  if (answered) return;
  answered = true;
  const buttons = [...$("options").querySelectorAll(".gm-opt")];
  buttons.forEach((b) => { b.disabled = true; });
  buttons[correctIndex].dataset.state = "correct";
  const ok = i === correctIndex;
  if (!ok) buttons[i].dataset.state = "wrong";
  settle(ok, options[i]);
}

function settle(ok, chosen) {
  const q = round[index];
  const dims = formatDims(q.dims);
  const full = q.unit === dims ? unitLabel(q) : `${unitLabel(q)} = ${dims}`;
  if (ok) {
    score += POINTS[mode];
    correctCount += 1;
    $("score").textContent = String(score);
  } else {
    mistakes.push({ q: `${q.name} (${q.sym})`, a: full, chosen });
  }
  $("feedback").dataset.ok = String(ok);
  $("feedback").innerHTML = `${icon(ok ? "checkCircle" : "alert")}<span></span>`;
  $("feedback").querySelector("span").textContent = ok ? `To‘g‘ri! ${full}. +${POINTS[mode]} ball` : `Noto‘g‘ri. To‘g‘ri javob: ${full}`;
  $("progressBar").parentElement.style.setProperty("--value", String(((index + 1) / round.length) * 100));
  $("next").textContent = index + 1 < round.length ? "Keyingi savol" : "Natijani ko‘rish";
  $("next").hidden = false;
  $("next").focus({ preventScroll: true });
}

function next() {
  if (!answered) return;
  index += 1;
  if (index < round.length) render();
  else finish();
}

function finish() {
  const total = round.length;
  const percent = Math.round((correctCount / total) * 100);
  try {
    const key = `${BEST_KEY}:${mode}`;
    if (percent > readNum(key)) localStorage.setItem(key, String(percent));
    if (percent > readNum(BEST_KEY)) localStorage.setItem(BEST_KEY, String(percent));
  } catch { /* storage yopiq */ }
  const ring = $("ring");
  ring.style.setProperty("--p", String(percent));
  ring.dataset.level = percent >= 80 ? "high" : percent < 50 ? "low" : "mid";
  $("percent").textContent = `${percent} %`;
  $("resultTitle").textContent = percent === 100 ? "Ajoyib! Hammasi to‘g‘ri" : percent >= 80 ? "Zo‘r natija!" : percent >= 50 ? "Yaxshi, yana mashq qiling" : "Birliklarni takrorlab, qayta urinib ko‘ring";
  $("resultText").textContent = `${total} ta savoldan ${correctCount} tasi to‘g‘ri, ${score} ball.`;
  const review = $("review");
  review.innerHTML = "";
  mistakes.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = "<b></b><span>To‘g‘ri javob: <span class=\"ok\"></span></span><span>Sizning javobingiz: <span class=\"bad\"></span></span>";
    li.querySelector("b").textContent = m.q;
    li.querySelector(".ok").textContent = m.a;
    li.querySelector(".bad").textContent = m.chosen;
    review.append(li);
  });
  $("reviewBox").hidden = !mistakes.length;
  show("result");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("start").addEventListener("click", start);
$("next").addEventListener("click", next);
$("check").addEventListener("click", check);
$("clear").addEventListener("click", () => { exps = [0, 0, 0, 0, 0, 0]; renderSteppers(); });
$("again").addEventListener("click", start);
$("change").addEventListener("click", () => { describe(); show("setup"); });
$("quit").addEventListener("click", () => {
  if (!confirm("O‘yinni yakunlab, natijani ko‘rasizmi?")) return;
  round = round.slice(0, index + (answered ? 1 : 0));
  if (!round.length) { describe(); show("setup"); return; }
  finish();
});

document.addEventListener("keydown", (e) => {
  if ($("card").closest("[data-view]").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches?.("input, textarea, select")) return;
  const onButton = e.target.matches?.("button");
  if (mode === "easy" && !answered) {
    const k = e.key.toUpperCase();
    const n = /^[1-4]$/.test(k) ? Number(k) - 1 : KEYS.indexOf(k);
    if (n >= 0 && n < options.length) { e.preventDefault(); choose(n); }
    return;
  }
  if (e.key !== "Enter" || onButton) return;
  e.preventDefault();
  if (answered) next();
  else if (mode === "hard") check();
});

loadPrefs();
describe();
