// ==========================================================================
// Baraban — jamoaviy viktorina (OliyFizika 2.0).
//
//   • savollar manbai: foydalanuvchining o‘z to‘plami yoki namunalar (../shared/);
//   • jamoalar soni 2–6, nomlarini o‘zgartirish mumkin;
//   • baraban aylanadi → tushgan savol ko‘rsatiladi → boshlovchi “To‘g‘ri / Noto‘g‘ri” ni bosadi;
//   • savol barabandan chiqadi, navbat keyingi jamoaga o‘tadi; savollar tugaganda — reyting.
// ==========================================================================

import { shuffle } from "../shared/game-sets.js";
import { mountSetPicker } from "../shared/set-library.js";

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const show = (name) => views.forEach((v) => { v.hidden = v.dataset.view !== name; });

const TEAM_COLORS = ["var(--of-blue-600)", "var(--of-green-600)", "var(--of-orange-500)", "var(--of-purple-500)", "var(--of-red-500)", "var(--of-blue-400)"];
const DEFAULT_NAMES = ["1-jamoa", "2-jamoa", "3-jamoa", "4-jamoa", "5-jamoa", "6-jamoa"];
const SECTOR_COLORS = ["var(--of-blue-500)", "var(--of-green-500)", "var(--of-orange-500)", "var(--of-purple-500)", "var(--of-blue-700)", "var(--of-green-700)"];
const SPIN_MS = 5000;
const NAMES_KEY = "oliyfizika:baraban:names";

const st = {
  set: null, teams: [], queue: [], turn: 0, rotation: 0, spinning: false, current: null, over: true, muted: false,
};

// ------------------------------------------------------------------ sozlash
let savedNames = [];
try { savedNames = JSON.parse(localStorage.getItem(NAMES_KEY) || "[]") || []; } catch { /* ignore */ }

function renderTeamInputs() {
  const n = Number($("teamCount").value);
  const box = $("teams");
  const current = [...box.querySelectorAll("input")].map((i) => i.value);
  box.innerHTML = '<span class="of-label">Jamoalar nomi</span>';
  for (let i = 0; i < n; i += 1) {
    const label = document.createElement("label");
    label.className = "gm-team-input";
    label.style.setProperty("--_c", TEAM_COLORS[i]);
    label.innerHTML = `<i></i><input class="of-input" maxlength="24" aria-label="${i + 1}-jamoa nomi">`;
    label.querySelector("input").value = current[i] || savedNames[i] || DEFAULT_NAMES[i];
    box.append(label);
  }
}
$("teamCount").addEventListener("change", renderTeamInputs);
if (savedNames.length >= 2 && savedNames.length <= 6) $("teamCount").value = String(savedNames.length);
renderTeamInputs();

function describe(s) {
  $("chosen").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = s.title;
  const span = document.createElement("span");
  const withOpts = s.items.filter((it) => it.a && (it.w?.length || 0) > 0).length;
  span.textContent = `${s.topics.join(", ")} · ${s.items.length} ta savol`;
  $("chosen").append(b, span);
  $("showOptions").disabled = !withOpts;
  if (!withOpts) $("showOptions").checked = false;
  $("start").disabled = !s.items.length;
}

const picker = mountSetPicker($("picker"), {
  game: "baraban",
  mode: "open",
  onSelect: (s) => { st.set = s; describe(s); },
});
st.set = picker.selected;
if (st.set) describe(st.set);

// ------------------------------------------------------------------ baraban (SVG)
function sectorPath(i, n) {
  if (n === 1) return "M0,-96 A96,96 0 1,1 -0.01,-96 Z";
  const a0 = ((i / n) * 360 - 90) * (Math.PI / 180);
  const a1 = (((i + 1) / n) * 360 - 90) * (Math.PI / 180);
  const large = 360 / n > 180 ? 1 : 0;
  const p = (a) => `${(96 * Math.cos(a)).toFixed(3)},${(96 * Math.sin(a)).toFixed(3)}`;
  return `M0,0 L${p(a0)} A96,96 0 ${large},1 ${p(a1)} Z`;
}

function renderWheel() {
  const svg = $("wheelSvg");
  const n = st.queue.length;
  $("wheel").toggleAttribute("data-many", n > 16);
  if (!n) { svg.innerHTML = '<circle r="96" fill="var(--of-surface-sunken)"/>'; return; }
  let html = "";
  st.queue.forEach((q, i) => {
    let color = SECTOR_COLORS[i % SECTOR_COLORS.length];
    if (i === n - 1 && n > 1 && n % SECTOR_COLORS.length === 1) color = SECTOR_COLORS[2]; // qo‘shni sektorlar bir xil bo‘lmasin
    const mid = (((i + 0.5) / n) * 360);
    html += `<path d="${sectorPath(i, n)}" fill="${color}" stroke="var(--of-surface)" stroke-width="1.2"/>`;
    html += `<text transform="rotate(${mid.toFixed(2)}) translate(0,-72) rotate(${(-mid).toFixed(2)})" text-anchor="middle" dominant-baseline="central">${q.no}</text>`;
  });
  html += '<circle r="96" fill="none" stroke="rgb(255 255 255 / .5)" stroke-width="1"/>';
  svg.innerHTML = html;
}

// ------------------------------------------------------------------ ovoz
let audio = null;
function tickSound() {
  if (st.muted) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t0 = audio.currentTime;
    // Sekinlashib boruvchi «tiq-tiq»: oraliqlar asta-sekin uzayadi
    let t = 0;
    let gap = 0.05;
    while (t < SPIN_MS / 1000 - 0.3) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.value = 900 + Math.random() * 200;
      gain.gain.setValueAtTime(0.0001, t0 + t);
      gain.gain.exponentialRampToValueAtTime(0.05, t0 + t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.04);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0 + t);
      osc.stop(t0 + t + 0.05);
      t += gap;
      gap *= 1.07;
    }
  } catch { /* ovozsiz davom etamiz */ }
}

// ------------------------------------------------------------------ o‘yin
function start() {
  st.set = picker.selected;
  if (!st.set?.items.length) return;
  const names = [...$("teams").querySelectorAll("input")].map((inp, i) => inp.value.trim() || DEFAULT_NAMES[i]);
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch { /* ignore */ }
  st.teams = names.map((name, i) => ({ name, score: 0, color: TEAM_COLORS[i] }));
  const count = Number($("count").value) || Infinity;
  const showOpts = $("showOptions").checked;
  st.queue = shuffle(st.set.items).slice(0, count).map((it, i) => ({
    no: i + 1,
    q: it.q,
    a: it.a || "",
    pts: it.pts || 1,
    options: showOpts && it.a && it.w?.length ? shuffle([it.a, ...it.w.slice(0, 3)]) : null,
  }));
  st.turn = 0;
  st.current = null;
  st.over = false;
  st.spinning = false;
  $("playTitle").textContent = st.set.title;
  $("playTopic").textContent = st.set.topics.join(" · ") || "Baraban";
  $("qCard").hidden = true;
  $("winBox").hidden = true;
  renderWheel();
  renderScores();
  show("play");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderScores() {
  const list = $("scores");
  list.innerHTML = "";
  st.teams.forEach((team, i) => {
    const li = document.createElement("li");
    li.className = "bb-score";
    li.style.setProperty("--_c", team.color);
    li.toggleAttribute("data-active", i === st.turn && !st.over);
    li.innerHTML = "<span></span><b></b>";
    li.querySelector("span").textContent = team.name;
    li.querySelector("b").textContent = String(team.score);
    list.append(li);
  });
  const team = st.teams[st.turn];
  $("turn").textContent = team?.name || "—";
  $("turnCard").style.setProperty("--_c", team?.color || "");
  $("left").textContent = String(st.queue.length);
  const busy = st.spinning || Boolean(st.current) || st.over || !st.queue.length;
  $("spin").disabled = busy;
  $("spinBtn").disabled = busy;
}

function spin() {
  if (st.spinning || st.current || st.over || !st.queue.length) return;
  st.spinning = true;
  renderScores();
  const n = st.queue.length;
  const pick = Math.floor(Math.random() * n);
  const sector = 360 / n;
  // Sektor ichida tasodifiy nuqta (chegaraga tushmasin) — ko‘rsatkich tepada (0°)
  const target = pick * sector + sector * (0.2 + Math.random() * 0.6);
  const current = ((st.rotation % 360) + 360) % 360;
  let delta = (360 - target) - current;
  delta = ((delta % 360) + 360) % 360;
  st.rotation += 360 * (4 + Math.floor(Math.random() * 2)) + delta;
  $("wheel").style.transform = `rotate(${st.rotation}deg)`;
  tickSound();
  setTimeout(() => {
    st.spinning = false;
    st.current = st.queue[pick];
    showQuestion();
  }, SPIN_MS + 150);
}

function showQuestion() {
  const q = st.current;
  $("qNum").textContent = `${q.no}-savol`;
  $("qPts").textContent = `${q.pts} ball`;
  $("qText").textContent = q.q;
  const opts = $("qOpts");
  opts.innerHTML = "";
  opts.hidden = !q.options;
  (q.options || []).forEach((o) => {
    const li = document.createElement("li");
    li.textContent = o;
    if (o === q.a) li.dataset.answer = "1";
    opts.append(li);
  });
  $("qAnswer").hidden = true;
  $("qAnswer").textContent = q.a ? `Javob: ${q.a}` : "";
  $("reveal").hidden = !q.a;
  $("qCard").hidden = false;
  renderScores();
  $("qCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function reveal() {
  const q = st.current;
  if (!q?.a) return;
  $("qAnswer").hidden = false;
  $("qOpts").querySelectorAll("[data-answer]").forEach((li) => li.setAttribute("data-correct", ""));
  $("reveal").hidden = true;
}

function judge(ok) {
  const q = st.current;
  if (!q) return;
  if (ok) st.teams[st.turn].score += q.pts;
  st.queue = st.queue.filter((x) => x !== q);
  st.current = null;
  $("qCard").hidden = true;
  if (!st.queue.length) { finish(); return; }
  st.turn = (st.turn + 1) % st.teams.length;
  renderWheel();
  renderScores();
}

function finish() {
  st.over = true;
  st.current = null;
  renderWheel();
  renderScores();
  const ranking = [...st.teams].sort((a, b) => b.score - a.score);
  const top = ranking.filter((t) => t.score === ranking[0].score);
  $("winTitle").textContent = top.length > 1 ? "Durang!" : `${ranking[0].name} g‘olib!`;
  const list = $("final");
  list.innerHTML = "";
  ranking.forEach((t, i) => {
    const li = document.createElement("li");
    li.innerHTML = "<span></span><b></b>";
    li.querySelector("span").textContent = `${i + 1}. ${t.name}`;
    li.querySelector("b").textContent = `${t.score} ball`;
    list.append(li);
  });
  $("winBox").hidden = false;
  $("again").focus();
}

$("start").addEventListener("click", start);
$("spin").addEventListener("click", spin);
$("spinBtn").addEventListener("click", spin);
$("reveal").addEventListener("click", reveal);
$("correct").addEventListener("click", () => judge(true));
$("wrong").addEventListener("click", () => judge(false));
$("again").addEventListener("click", start);
$("toSetup").addEventListener("click", () => { st.over = true; show("setup"); });
$("stop").addEventListener("click", () => { if (!st.over && confirm("O‘yinni hozir yakunlab, natijani ko‘rasizmi?")) finish(); });
$("mute").addEventListener("click", () => {
  st.muted = !st.muted;
  $("mute").setAttribute("aria-pressed", String(st.muted));
  $("mute").textContent = st.muted ? "Ovoz: o‘chirilgan" : "Ovoz: yoqilgan";
});
