// ==========================================================================
// Arqon tortish — ikki jamoali bellashuv (OliyFizika 2.0).
//
// Qoidalar:
//   • ikkala jamoa bir xil savolni ko‘radi, lekin variantlar o‘rni har jamoada alohida aralashadi;
//   • birinchi to‘g‘ri javob — arqon bir qadam shu jamoa tomonga, +1 ball;
//   • noto‘g‘ri javob bergan jamoa shu savolda qayta javob bera olmaydi (tugmalarni ketma-ket bosib
//     chiqish orqali yutib bo‘lmaydi — eski versiyadagi xato);
//   • ikkalasi ham xato qilsa yoki vaqt tugasa — arqon qimirlamaydi, to‘g‘ri javob ko‘rsatiladi;
//   • g‘alaba: arqon belgilangan qadamga yetganda; savollar tugasa — arqon qaysi tomonda bo‘lsa.
// ==========================================================================

import { buildRound, shuffle, playableCount, kindLabel } from "../shared/game-sets.js";
import { mountSetPicker } from "../shared/set-library.js";

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const show = (name) => views.forEach((v) => { v.hidden = v.dataset.view !== name; });
const KEYS = { 1: ["1", "2", "3", "4"], 2: ["7", "8", "9", "0"] };
const ARC = 119.4;

const state = {
  set: null, round: [], index: 0, steps: 5, time: 20, position: 0,
  score: { 1: 0, 2: 0 }, names: { 1: "", 2: "" },
  q: null, opts: { 1: [], 2: [] }, locked: { 1: false, 2: false }, done: false, over: true,
  timer: null, left: 0, nextTimer: null,
};

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
}

const picker = mountSetPicker($("picker"), {
  game: "arqon-tortish",
  mode: "mcq",
  onSelect: (s) => { state.set = s; describe(s); },
});
state.set = picker.selected;
if (state.set) describe(state.set);

try {
  const saved = JSON.parse(localStorage.getItem("oliyfizika:arqon-tortish:names") || "null");
  if (saved?.[0]) $("name1").value = saved[0];
  if (saved?.[1]) $("name2").value = saved[1];
} catch { /* ignore */ }

// ------------------------------------------------------------------ o‘yin
function start() {
  state.set = picker.selected;
  if (!state.set) return;
  state.round = buildRound(state.set);
  if (state.round.length < 2) { alert("Bu to‘plamda test uchun yetarli savol yo‘q."); return; }
  state.steps = Number($("steps").value) || 5;
  state.time = Number($("time").value) || 20;
  state.names = { 1: $("name1").value.trim() || "Ko‘klar", 2: $("name2").value.trim() || "Yashillar" };
  try { localStorage.setItem("oliyfizika:arqon-tortish:names", JSON.stringify([state.names[1], state.names[2]])); } catch { /* ignore */ }
  state.index = 0;
  state.position = 0;
  state.score = { 1: 0, 2: 0 };
  state.over = false;
  [1, 2].forEach((t) => {
    $(`tname${t}`).textContent = state.names[t];
    $(`sideTitle${t}`).textContent = state.names[t];
    $(`score${t}`).textContent = "0";
  });
  $("ticks").innerHTML = "";
  for (let k = -state.steps + 1; k < state.steps; k += 1) {
    if (k === 0) continue;
    const tick = document.createElement("span");
    tick.style.left = `${50 + (k * 30) / state.steps}%`;
    $("ticks").append(tick);
  }
  $("winBox").hidden = true;
  moveRope(null);
  show("play");
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadQuestion();
}

function loadQuestion() {
  clearTimeout(state.nextTimer);
  if (state.index >= state.round.length) { finish(); return; }
  state.q = state.round[state.index];
  state.done = false;
  state.locked = { 1: false, 2: false };
  $("roundText").textContent = `${state.index + 1}-savol / ${state.round.length}`;
  setStatus("");
  [1, 2].forEach((team) => {
    // Har jamoaga variantlar o‘z tartibida
    state.opts[team] = shuffle(state.q.options);
    $(`q${team}`).textContent = state.q.q;
    $(`lock${team}`).hidden = true;
    const box = $(`opts${team}`);
    box.innerHTML = "";
    state.opts[team].forEach((text, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "at-opt";
      btn.innerHTML = `<kbd>${KEYS[team][i] ?? ""}</kbd><span></span>`;
      btn.querySelector("span").textContent = text;
      btn.addEventListener("click", () => answer(team, i));
      box.append(btn);
    });
  });
  startTimer();
}

function startTimer() {
  clearInterval(state.timer);
  state.left = state.time;
  renderTimer();
  state.timer = setInterval(() => {
    state.left -= 1;
    renderTimer();
    if (state.left <= 0) {
      clearInterval(state.timer);
      resolve(null, "Vaqt tugadi!");
    }
  }, 1000);
}

function renderTimer() {
  $("timer").textContent = String(Math.max(0, state.left));
  $("timerArc").style.strokeDashoffset = String(ARC * (1 - Math.max(0, state.left) / state.time));
  $("timerBox").toggleAttribute("data-warn", state.left <= 5);
}

function answer(team, i) {
  if (state.done || state.over || state.locked[team]) return;
  const chosen = state.opts[team][i];
  const btn = $(`opts${team}`).children[i];
  if (chosen === state.q.a) {
    btn.dataset.state = "correct";
    resolve(team);
    return;
  }
  btn.dataset.state = "wrong";
  state.locked[team] = true;
  [...$(`opts${team}`).children].forEach((b) => { b.disabled = true; });
  $(`lock${team}`).hidden = false;
  $(`lock${team}`).textContent = "Xato javob";
  if (state.locked[1] && state.locked[2]) resolve(null, "Ikkala jamoa ham xato qildi.");
  else setStatus(`${state.names[team]} xato qildi — navbat ${state.names[team === 1 ? 2 : 1]}da!`, "bad");
}

/** Savol yakuni: winner — 1, 2 yoki null (hech kim). */
function resolve(winner, reason = "") {
  if (state.done) return;
  state.done = true;
  clearInterval(state.timer);
  [1, 2].forEach((team) => {
    [...$(`opts${team}`).children].forEach((b, i) => {
      b.disabled = true;
      if (state.opts[team][i] === state.q.a && (!winner || team === winner)) b.dataset.state = "correct";
    });
  });
  if (winner) {
    state.score[winner] += 1;
    $(`score${winner}`).textContent = String(state.score[winner]);
    state.position += winner === 1 ? -1 : 1;
    moveRope(winner);
    setStatus(`${state.names[winner]} arqonni tortdi! (+1)`, String(winner));
  } else {
    setStatus(`${reason} To‘g‘ri javob: ${state.q.a}`, "bad");
  }
  if (Math.abs(state.position) >= state.steps) {
    state.nextTimer = setTimeout(finish, 900);
    return;
  }
  state.index += 1;
  state.nextTimer = setTimeout(loadQuestion, winner ? 1400 : 2600);
}

function moveRope(winner) {
  const arena = $("arena");
  $("scene").style.setProperty("--shift", String(state.position / state.steps));
  arena.dataset.pull = winner ? String(winner) : "";
}

function setStatus(text, tone = "") {
  $("status").textContent = text;
  $("status").dataset.tone = tone;
}

function finish() {
  state.over = true;
  clearInterval(state.timer);
  clearTimeout(state.nextTimer);
  const p = state.position;
  const winner = p < 0 ? 1 : p > 0 ? 2 : state.score[1] > state.score[2] ? 1 : state.score[2] > state.score[1] ? 2 : 0;
  const byRope = Math.abs(p) >= state.steps;
  $("winTitle").textContent = winner ? `${state.names[winner]} g‘olib!` : "Durang!";
  $("winText").textContent = `${byRope ? "Arqon g‘alaba chizig‘iga yetdi." : "Savollar tugadi."} Hisob: ${state.names[1]} ${state.score[1]} — ${state.score[2]} ${state.names[2]}.`;
  $("winBox").hidden = false;
  $("again").focus();
}

function stop() {
  state.over = true;
  clearInterval(state.timer);
  clearTimeout(state.nextTimer);
  if (document.fullscreenElement) document.exitFullscreen?.();
  show("setup");
}

$("start").addEventListener("click", start);
$("again").addEventListener("click", start);
$("toSetup").addEventListener("click", stop);
$("stop").addEventListener("click", () => { if (confirm("O‘yinni to‘xtatasizmi?")) stop(); });
$("skip").addEventListener("click", () => { if (!state.done && !state.over) resolve(null, "Savol o‘tkazib yuborildi."); });
$("fullscreen").addEventListener("click", () => {
  const el = document.querySelector(".at");
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().catch(() => {});
});

document.addEventListener("keydown", (e) => {
  if (state.over || e.ctrlKey || e.metaKey || e.altKey || e.target.matches?.("input, textarea, select")) return;
  for (const team of [1, 2]) {
    const i = KEYS[team].indexOf(e.key);
    if (i >= 0 && i < state.opts[team].length) { e.preventDefault(); answer(team, i); return; }
  }
});

