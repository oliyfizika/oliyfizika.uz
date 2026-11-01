// ==========================================================================
// Formula qur — aralashtirilgan bo‘laklardan formulani yig‘ish.
// To‘plamlar Formulani top bilan umumiy (../shared/). Javob bo‘laklarga ajratiladi:
//   sonlar, harf + indeks/daraja (m₁, v², Eₖ), Δ + harf (Δt), funksiyalar (sin, cos, ln), amallar.
// Chap tomon (masalan, "F =") beriladi, o‘ng tomon yig‘iladi. O‘ng tomon juda qisqa bo‘lsa,
// butun formula yig‘iladi. Ko‘paytuvchilar tartibi (Gm₁m₂ = m₁m₂G) farq qilsa ham to‘g‘ri sanaladi.
// ==========================================================================

import { icon } from "../../assets/js/ui/icons.js";
import { shuffle } from "../shared/game-sets.js";
import { mountSetPicker } from "../shared/set-library.js";

const BEST_KEY = "oliyfizika:formula-qur:best";
const MAX_TOKENS = 14;
const POINTS = [10, 5];

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const header = document.querySelector("[data-hide-on-play]");
function show(name) {
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  header.hidden = name === "play";
}

// ------------------------------------------------------------------ bo‘laklarga ajratish
const MARKS = "₀-₉ₐₑₒₓₕₖₗₘₙₚₛₜ⁰-⁹¹²³⁻′";
const LETTER = "A-Za-z\\u00C0-\\u024Fα-ωΑ-Ωℰϑϕ";
const TOKEN_RE = new RegExp(
  `\\s+|(?:sin|cos|tg|ctg|ln|lg|const)[${MARKS}]*|\\d+(?:[.,]\\d+)?[${MARKS}]*|Δ?[${LETTER}][${MARKS}]*|.`,
  "gu",
);
const FUNC_RE = /^(sin|cos|tg|ctg|ln|lg)/;
const isFactor = (t) => !FUNC_RE.test(t) && new RegExp(`^(\\d|Δ?[${LETTER}])`, "u").test(t);

export function tokenize(text) {
  return (String(text || "").match(TOKEN_RE) || []).filter((t) => t.trim());
}

/** Ko‘paytuvchilar ketma-ketligini saralab, solishtirish uchun kanonik ko‘rinish. */
function canon(tokens) {
  const out = [];
  let run = [];
  const flush = () => { if (run.length) { out.push(...[...run].sort()); run = []; } };
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (isFactor(t)) { run.push(t); continue; }
    if (t === "·") continue;
    if (FUNC_RE.test(t) && isFactor(tokens[i + 1] || "")) { run.push(t + tokens[i + 1]); i += 1; continue; }
    flush();
    out.push(t);
  }
  flush();
  return out.join(" ");
}

/** Element → topshiriq ({ q, left, target, full, w }) yoki yaroqsiz bo‘lsa null. */
function makePuzzle(item) {
  const full = String(item?.a || "").trim();
  const tokens = tokenize(full);
  if (!tokens.length) return null;
  const eq = tokens.indexOf("=");
  let left = "";
  let target = tokens;
  if (eq > 0 && tokens.length - eq - 1 >= 3) {
    left = full.slice(0, full.indexOf("=")).trim();
    target = tokens.slice(eq + 1);
  }
  if (target.length < 2 || target.length > MAX_TOKENS) return null;
  return { q: item.q, left, target, full, w: item.w || [] };
}

const countPuzzles = (set) => set.items.filter((it) => makePuzzle(it)).length;

// ------------------------------------------------------------------ holat
let set = null;
let round = [];
let index = 0;
let score = 0;
let correctCount = 0;
let attempts = 0;
let done = false;
let bank = [];      // { id, t }
let placed = [];    // id lar
let mistakes = [];

// ------------------------------------------------------------------ sozlash
function describe(s) {
  const n = countPuzzles(s);
  $("chosen").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = s.title;
  const span = document.createElement("span");
  span.textContent = `${s.topics.join(", ")} · yig‘ish mumkin bo‘lgan formulalar: ${n} ta`;
  $("chosen").append(b, span);
  $("start").disabled = n < 1;
  let best = 0;
  try { best = JSON.parse(localStorage.getItem(`${BEST_KEY}-by-set`) || "{}")[s.id] || 0; } catch { /* yo‘q */ }
  $("best").hidden = !best;
  if (best) $("best").textContent = `Shu to‘plamdagi eng yaxshi natijangiz: ${best} %`;
}

const picker = mountSetPicker($("picker"), {
  game: "formula-qur",
  mode: "mcq",
  sampleFilter: (s) => s.kind === "formula",
  countPlayable: countPuzzles,
  minPlayable: 1,
  unusableText: "formula (=) bilan yozilgan javob kerak",
  onSelect: (s) => { set = s; describe(s); },
});
set = picker.selected;
if (set) describe(set);

// ------------------------------------------------------------------ o‘yin
function start() {
  set = picker.selected;
  if (!set) return;
  const puzzles = set.items.map(makePuzzle).filter(Boolean);
  if (!puzzles.length) { alert("Bu to‘plamda yig‘ish mumkin bo‘lgan formula yo‘q."); return; }
  const count = Number($("count").value) || Infinity;
  round = shuffle(puzzles).slice(0, count);
  index = 0; score = 0; correctCount = 0; mistakes = [];
  $("playTitle").textContent = set.title;
  $("playTopic").textContent = set.topics.join(" · ") || "Formula qur";
  $("score").textContent = "0";
  show("play");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function distractors(p, n) {
  if (!n) return [];
  const own = new Set(p.target);
  const pool = [];
  const add = (t) => { if (!own.has(t) && !pool.includes(t) && t !== "=") pool.push(t); };
  shuffle(p.w).forEach((w) => tokenize(w).forEach(add));
  if (pool.length < n) shuffle(set.items).slice(0, 6).forEach((it) => tokenize(it.a).forEach(add));
  return shuffle(pool).slice(0, n);
}

function render() {
  const p = round[index];
  attempts = 0;
  done = false;
  placed = [];
  const extra = distractors(p, Number($("extra").value) || 0);
  let pieces = shuffle([...p.target, ...extra]);
  // Bo‘laklar to‘g‘ri tartibda chiqib qolmasin.
  for (let k = 0; k < 4 && pieces.length > 2 && pieces.join(" ") === p.target.join(" "); k += 1) pieces = shuffle(pieces);
  bank = pieces.map((t, i) => ({ id: i, t }));
  $("progressText").textContent = `${index + 1} / ${round.length}`;
  $("progressBar").parentElement.style.setProperty("--value", String((index / round.length) * 100));
  $("qText").textContent = p.q;
  $("left").textContent = p.left ? `${p.left} =` : "";
  $("left").hidden = !p.left;
  $("feedback").textContent = "";
  $("feedback").removeAttribute("data-ok");
  $("next").hidden = true;
  $("tools").hidden = false;
  $("line").removeAttribute("data-state");
  draw();
  $("card").style.animation = "none";
  void $("card").offsetWidth;
  $("card").style.animation = "";
}

function chip(token, onClick, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fq-chip";
  btn.textContent = token.t;
  btn.setAttribute("aria-label", label);
  btn.disabled = done;
  btn.addEventListener("click", onClick);
  return btn;
}

function draw() {
  const answer = $("answer");
  answer.innerHTML = "";
  if (!placed.length) {
    const li = document.createElement("li");
    li.className = "fq-placeholder";
    li.textContent = "Bo‘laklarni shu yerga yig‘ing";
    answer.append(li);
  }
  placed.forEach((id, pos) => {
    const token = bank[id];
    const li = document.createElement("li");
    li.append(chip(token, () => { placed.splice(pos, 1); draw(); }, `${token.t} — olib tashlash`));
    answer.append(li);
  });
  const list = $("bank");
  list.innerHTML = "";
  bank.forEach((token) => {
    const li = document.createElement("li");
    const used = placed.includes(token.id);
    const btn = chip(token, () => { placed.push(token.id); draw(); }, `${token.t} — qo‘shish`);
    if (used) { btn.disabled = true; btn.dataset.used = "true"; btn.setAttribute("aria-hidden", "true"); }
    li.append(btn);
    list.append(li);
  });
  $("check").disabled = done || !placed.length;
  $("undo").disabled = done || !placed.length;
  $("clear").disabled = done || !placed.length;
}

function feedback(ok, text) {
  $("feedback").dataset.ok = String(ok);
  $("feedback").innerHTML = `${icon(ok ? "checkCircle" : "alert")}<span></span>`;
  $("feedback").querySelector("span").textContent = text;
}

function check() {
  if (done || !placed.length) return;
  const p = round[index];
  const built = placed.map((id) => bank[id].t);
  const ok = canon(built) === canon(p.target);
  attempts += 1;
  if (ok) {
    const pts = POINTS[attempts - 1] || 0;
    score += pts;
    correctCount += 1;
    $("score").textContent = String(score);
    feedback(true, `To‘g‘ri! ${p.full}. +${pts} ball`);
    $("line").dataset.state = "correct";
    finishPuzzle();
    return;
  }
  if (attempts < POINTS.length) {
    feedback(false, "Hali to‘g‘ri emas. Yana bir bor urinib ko‘ring — bo‘lakni bossangiz, u qaytib chiqadi.");
    $("line").dataset.state = "wrong";
    setTimeout(() => $("line").removeAttribute("data-state"), 600);
    return;
  }
  mistakes.push({ q: p.q, a: p.full, chosen: `${p.left ? `${p.left} = ` : ""}${built.join(" ")}` });
  feedback(false, `To‘g‘ri formula: ${p.full}`);
  $("line").dataset.state = "wrong";
  finishPuzzle();
}

function finishPuzzle() {
  done = true;
  draw();
  $("tools").hidden = true;
  $("progressBar").parentElement.style.setProperty("--value", String(((index + 1) / round.length) * 100));
  $("next").textContent = index + 1 < round.length ? "Keyingi formula" : "Natijani ko‘rish";
  $("next").hidden = false;
  $("next").focus({ preventScroll: true });
}

function next() {
  if (!done) return;
  index += 1;
  if (index < round.length) render();
  else finish();
}

function finish() {
  const total = round.length;
  const percent = Math.round((correctCount / total) * 100);
  try {
    const map = JSON.parse(localStorage.getItem(`${BEST_KEY}-by-set`) || "{}") || {};
    map[set.id] = Math.max(map[set.id] || 0, percent);
    localStorage.setItem(`${BEST_KEY}-by-set`, JSON.stringify(map));
    if (percent > (Number(localStorage.getItem(BEST_KEY)) || 0)) localStorage.setItem(BEST_KEY, String(percent));
  } catch { /* storage yopiq */ }
  const ring = $("ring");
  ring.style.setProperty("--p", String(percent));
  ring.dataset.level = percent >= 80 ? "high" : percent < 50 ? "low" : "mid";
  $("percent").textContent = `${percent} %`;
  $("resultTitle").textContent = percent === 100 ? "Ajoyib! Barcha formulalar to‘g‘ri" : percent >= 80 ? "Zo‘r natija!" : percent >= 50 ? "Yaxshi, yana mashq qiling" : "Formulalarni takrorlab, qayta urinib ko‘ring";
  $("resultText").textContent = `${set.title}: ${total} ta formuladan ${correctCount} tasi to‘g‘ri yig‘ildi, ${score} ball.`;
  const review = $("review");
  review.innerHTML = "";
  mistakes.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = "<b></b><span>To‘g‘ri formula: <span class=\"ok\"></span></span><span>Siz yig‘gan: <span class=\"bad\"></span></span>";
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
$("check").addEventListener("click", check);
$("undo").addEventListener("click", () => { placed.pop(); draw(); });
$("clear").addEventListener("click", () => { placed = []; draw(); });
$("next").addEventListener("click", next);
$("again").addEventListener("click", start);
$("change").addEventListener("click", () => { describe(set); show("setup"); });
$("quit").addEventListener("click", () => {
  if (!confirm("O‘yinni yakunlab, natijani ko‘rasizmi?")) return;
  round = round.slice(0, index + (done ? 1 : 0));
  if (!round.length) { describe(set); show("setup"); return; }
  finish();
});

document.addEventListener("keydown", (e) => {
  if ($("card").closest("[data-view]").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches?.("input, textarea, select")) return;
  if (e.key === "Backspace" && !done && placed.length) { e.preventDefault(); placed.pop(); draw(); return; }
  if (e.key !== "Enter" || e.target.matches?.("button")) return;
  e.preventDefault();
  if (done) next();
  else check();
});
