// ==========================================================================
// Formulani top — yakka o‘yinchi test o‘yini.
// Har bir o‘yinda savollar tartibi va variantlar o‘rni qaytadan aralashadi (buildRound).
// Rekord: shu brauzerda (localStorage) — natijalar hisobga yozilmaydi.
// ==========================================================================

import { icon } from "../../assets/js/ui/icons.js";
import { buildRound, playableCount, kindLabel } from "../shared/game-sets.js";
import { mountSetPicker } from "../shared/set-library.js";

const BEST_KEY = "oliyfizika:formulani-top:best";        // eng yaxshi foiz (katalog kartasi uchun)
const BEST_BY_SET = "oliyfizika:formulani-top:best-by-set";
const POINTS = 10;
const KEYS = ["A", "B", "C", "D", "E"];

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const show = (name) => views.forEach((v) => { v.hidden = v.dataset.view !== name; });

let set = null;
let round = [];
let index = 0;
let score = 0;
let correctCount = 0;
let answered = false;
let mistakes = [];
let timerId = null;
let timeLeft = 0;

// ------------------------------------------------------------------ rekordlar
function readBestMap() {
  try { return JSON.parse(localStorage.getItem(BEST_BY_SET) || "{}") || {}; } catch { return {}; }
}
function saveBest(setId, percent) {
  try {
    const map = readBestMap();
    map[setId] = Math.max(map[setId] || 0, percent);
    localStorage.setItem(BEST_BY_SET, JSON.stringify(map));
    const overall = Number(localStorage.getItem(BEST_KEY)) || 0;
    if (percent > overall) localStorage.setItem(BEST_KEY, String(percent));
  } catch { /* storage yopiq */ }
}

// ------------------------------------------------------------------ sozlash
function describe(s) {
  const n = playableCount(s);
  $("chosen").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = s.title;
  const span = document.createElement("span");
  span.textContent = `${s.topics.join(", ")} · ${kindLabel(s)}: ${n} ta`;
  $("chosen").append(b, span);
  $("start").disabled = n < 2;
  const best = readBestMap()[s.id];
  $("best").hidden = !best;
  if (best) $("best").textContent = `Shu to‘plamdagi eng yaxshi natijangiz: ${best} %`;
}

const picker = mountSetPicker($("picker"), {
  game: "formulani-top",
  mode: "mcq",
  onSelect: (s) => { set = s; describe(s); },
});
set = picker.selected;
if (set) describe(set);

// ------------------------------------------------------------------ o‘yin
function start() {
  set = picker.selected;
  if (!set) return;
  const count = Number($("count").value) || Infinity;
  round = buildRound(set, count);
  if (round.length < 2) { alert("Bu to‘plamda test uchun yetarli savol yo‘q."); return; }
  index = 0; score = 0; correctCount = 0; mistakes = [];
  $("playTitle").textContent = set.title;
  $("playTopic").textContent = set.topics.join(" · ") || "Formulani top";
  $("qLabel").textContent = set.kind === "formula" ? "Formulani toping" : "Savol";
  $("score").textContent = "0";
  show("play");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  const q = round[index];
  answered = false;
  $("progressText").textContent = `${index + 1} / ${round.length}`;
  $("progressBar").parentElement.style.setProperty("--value", String((index / round.length) * 100));
  $("qText").textContent = q.q;
  $("feedback").textContent = "";
  $("feedback").removeAttribute("data-ok");
  $("next").hidden = true;
  const list = $("options");
  list.innerHTML = "";
  q.options.forEach((opt, i) => {
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
  $("card").style.animation = "none";
  void $("card").offsetWidth;
  $("card").style.animation = "";
  startTimer();
}

function startTimer() {
  clearInterval(timerId);
  const limit = Number($("time").value) || 0;
  $("timer").hidden = !limit;
  if (!limit) return;
  timeLeft = limit;
  $("timer").textContent = `⏱ ${timeLeft} s`;
  timerId = setInterval(() => {
    timeLeft -= 1;
    $("timer").textContent = `⏱ ${Math.max(0, timeLeft)} s`;
    if (timeLeft <= 0) { clearInterval(timerId); choose(-1); }
  }, 1000);
}

function choose(i) {
  if (answered) return;
  answered = true;
  clearInterval(timerId);
  const q = round[index];
  const buttons = [...$("options").querySelectorAll(".gm-opt")];
  buttons.forEach((b) => { b.disabled = true; });
  buttons[q.correct].dataset.state = "correct";
  const ok = i === q.correct;
  if (ok) {
    score += POINTS;
    correctCount += 1;
    $("score").textContent = String(score);
  } else {
    if (i >= 0) buttons[i].dataset.state = "wrong";
    mistakes.push({ q: q.q, a: q.a, chosen: i >= 0 ? q.options[i] : null });
  }
  $("feedback").dataset.ok = String(ok);
  $("feedback").innerHTML = `${icon(ok ? "checkCircle" : "alert")}<span></span>`;
  $("feedback").querySelector("span").textContent = ok ? `To‘g‘ri! +${POINTS} ball` : i < 0 ? `Vaqt tugadi. To‘g‘ri javob: ${q.a}` : `Noto‘g‘ri. To‘g‘ri javob: ${q.a}`;
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
  clearInterval(timerId);
  const total = round.length;
  const answeredCount = Math.min(total, index + (answered ? 1 : 0));
  const percent = Math.round((correctCount / total) * 100);
  saveBest(set.id, percent);
  const ring = $("ring");
  ring.style.setProperty("--p", String(percent));
  ring.dataset.level = percent >= 80 ? "high" : percent < 50 ? "low" : "mid";
  $("percent").textContent = `${percent} %`;
  $("resultTitle").textContent = percent === 100 ? "Ajoyib! Hammasi to‘g‘ri" : percent >= 80 ? "Zo‘r natija!" : percent >= 50 ? "Yaxshi, yana mashq qiling" : "Formulalarni takrorlab, qayta urinib ko‘ring";
  $("resultText").textContent = `${set.title}: ${total} ta savoldan ${correctCount} tasi to‘g‘ri, ${score} ball.${answeredCount < total ? ` (${total - answeredCount} ta savol javobsiz qoldi.)` : ""}`;
  const review = $("review");
  review.innerHTML = "";
  mistakes.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = "<b></b><span>To‘g‘ri javob: <span class=\"ok\"></span></span>";
    li.querySelector("b").textContent = m.q;
    li.querySelector(".ok").textContent = m.a;
    if (m.chosen) {
      const s = document.createElement("span");
      s.innerHTML = "Sizning javobingiz: <span class=\"bad\"></span>";
      s.querySelector(".bad").textContent = m.chosen;
      li.append(s);
    }
    review.append(li);
  });
  $("reviewBox").hidden = !mistakes.length;
  show("result");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("start").addEventListener("click", start);
$("next").addEventListener("click", next);
$("again").addEventListener("click", start);
$("change").addEventListener("click", () => { describe(set); show("setup"); });
$("quit").addEventListener("click", () => {
  if (!confirm("O‘yinni yakunlab, natijani ko‘rasizmi?")) return;
  round = round.slice(0, index + (answered ? 1 : 0));
  if (!round.length) { clearInterval(timerId); show("setup"); return; }
  finish();
});

document.addEventListener("keydown", (e) => {
  if ($("card").closest("[data-view]").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches?.("input, textarea, select")) return;
  const k = e.key.toUpperCase();
  const n = /^[1-5]$/.test(k) ? Number(k) - 1 : KEYS.indexOf(k);
  if (n >= 0 && n < (round[index]?.options.length || 0) && !answered) { e.preventDefault(); choose(n); }
  else if ((e.key === "Enter" || e.key === "ArrowRight") && answered && document.activeElement?.id !== "next") { e.preventDefault(); next(); }
});
