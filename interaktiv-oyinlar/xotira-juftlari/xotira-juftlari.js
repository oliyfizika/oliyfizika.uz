// ==========================================================================
// Xotira juftlari — yopiq kartalardan mos juftlarni topish (memory).
// Kartalar: kattalik ↔ birlik, olim ↔ kashfiyot yoki to‘plamdagi nom ↔ formula.
// Yakka rejim: yurishlar va vaqt; eng kam yurish shu brauzerda saqlanadi.
// Ikki kishi: juft topgan o‘yinchi yana yuradi, aks holda navbat o‘tadi.
// ==========================================================================

import { shuffle } from "../shared/game-sets.js";
import { mountSetPicker } from "../shared/set-library.js";
import { QUANTITIES, SCIENTISTS } from "../shared/units-data.js";

const BEST_KEY = "oliyfizika:xotira-juftlari:best";
const PREFS_KEY = "oliyfizika:xotira-juftlari:prefs";
const FLIP_BACK_MS = 1000;

const DECKS = {
  units: { title: "Kattalik va birlik", a: "Kattalik", b: "Birlik" },
  scientists: { title: "Olim va kashfiyot", a: "Olim", b: "Kashfiyot" },
  set: { title: "To‘plamdan", a: "Nomi", b: "Formula" },
};

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll("[data-view]");
const header = document.querySelector("[data-hide-on-play]");
function show(name) {
  views.forEach((v) => { v.hidden = v.dataset.view !== name; });
  header.hidden = name === "play";
}

let deck = "units";
let size = 6;
let players = 1;
let set = null;

let pairs = [];      // { a, b }
let cards = [];      // { pair, side, text, open, matched }
let opened = [];     // ochiq (hali juftlanmagan) karta indekslari
let lock = false;
let moves = 0;
let found = 0;
let turn = 0;
let scores = [0, 0];
let startedAt = 0;
let clockId = null;

// ------------------------------------------------------------------ juftlarni tayyorlash
function unitPairs() {
  const usedUnit = new Set();
  const usedName = new Set();
  const out = [];
  for (const q of shuffle(QUANTITIES)) {
    if (usedUnit.has(q.unit) || usedName.has(q.name)) continue;
    usedUnit.add(q.unit);
    usedName.add(q.name);
    out.push({ a: `${q.name} (${q.sym})`, b: q.unitName ? `${q.unit} — ${q.unitName}` : q.unit });
  }
  return out;
}

function setPairs(s) {
  const seenA = new Set();
  const seenQ = new Set();
  const out = [];
  for (const it of s?.items || []) {
    const a = String(it.a || "").trim();
    const q = String(it.q || "").trim();
    if (!a || !q || seenA.has(a.toLowerCase()) || seenQ.has(q.toLowerCase())) continue;
    seenA.add(a.toLowerCase());
    seenQ.add(q.toLowerCase());
    out.push({ a: q, b: a });
  }
  return out;
}

function deckPairs() {
  if (deck === "units") return unitPairs();
  if (deck === "scientists") return shuffle(SCIENTISTS).map(([a, b]) => ({ a, b }));
  return shuffle(setPairs(set));
}

// ------------------------------------------------------------------ sozlash
function readBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || "{}") || {}; } catch { return {}; }
}
const bestKey = () => `${deck === "set" ? `set:${set?.id}` : deck}:${size}`;

function describe() {
  document.querySelectorAll("#decks [data-deck]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.deck === deck)));
  document.querySelectorAll("#sizes [data-n]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.n) === size)));
  document.querySelectorAll("#players [data-p]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.p) === players)));
  $("pickerBox").hidden = deck !== "set";
  $("startStep").textContent = deck === "set" ? "3" : "2";
  $("names").hidden = players !== 2;
  $("rule").textContent = players === 2
    ? "Navbat bilan ikkitadan karta ochasiz. Juft topgan o‘yinchi ball oladi va yana yuradi. Ko‘p juft topgan g‘olib."
    : "Ikkita kartani oching. Ular bir-biriga mos kelsa, ochiq qoladi. Barcha juftlarni eng kam yurishda toping.";

  const available = deck === "set" ? setPairs(set).length : deck === "units" ? unitPairs().length : SCIENTISTS.length;
  $("chosen").innerHTML = "";
  const b = document.createElement("b");
  b.textContent = deck === "set" ? (set?.title || "To‘plam tanlanmagan") : DECKS[deck].title;
  const span = document.createElement("span");
  span.textContent = available < size
    ? `Bu to‘plamda faqat ${available} ta juft bor — kamida ${size} ta kerak.`
    : `${size} juft · ${size * 2} ta karta · ${players === 2 ? "ikki o‘yinchi" : "yakka o‘yin"}`;
  $("chosen").append(b, span);
  $("start").disabled = available < size;

  const best = players === 1 ? readBest()[bestKey()] : null;
  $("best").hidden = !best;
  if (best) $("best").textContent = `Eng yaxshi natijangiz: ${best} yurish`;
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ deck, size, players })); } catch { /* storage yopiq */ }
}
try {
  const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  if (DECKS[p.deck]) deck = p.deck;
  if ([6, 8, 10].includes(p.size)) size = p.size;
  if ([1, 2].includes(p.players)) players = p.players;
} catch { /* yo‘q */ }

const picker = mountSetPicker($("picker"), {
  game: "xotira-juftlari",
  mode: "mcq",
  countPlayable: (s) => setPairs(s).length,
  minPlayable: 6,
  unusableText: "kamida 6 ta juft kerak",
  onSelect: (s) => { set = s; describe(); },
});
set = picker.selected;

$("decks").addEventListener("click", (e) => {
  const b = e.target.closest("[data-deck]");
  if (!b) return;
  deck = b.dataset.deck;
  savePrefs();
  describe();
});
$("sizes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-n]");
  if (!b) return;
  size = Number(b.dataset.n);
  savePrefs();
  describe();
});
$("players").addEventListener("click", (e) => {
  const b = e.target.closest("[data-p]");
  if (!b) return;
  players = Number(b.dataset.p);
  savePrefs();
  describe();
});

// ------------------------------------------------------------------ o‘yin
const playerName = (i) => ($(`name${i + 1}`).value.trim() || `${i + 1}-o‘yinchi`);

function start() {
  if (deck === "set") set = picker.selected;
  pairs = deckPairs().slice(0, size);
  if (pairs.length < size) return;
  cards = shuffle(pairs.flatMap((p, i) => [
    { pair: i, side: "a", text: p.a, open: false, matched: false },
    { pair: i, side: "b", text: p.b, open: false, matched: false },
  ]));
  opened = []; lock = false; moves = 0; found = 0; turn = 0; scores = [0, 0];
  $("playTitle").textContent = deck === "set" ? set.title : DECKS[deck].title;
  $("total").textContent = String(size);
  $("found").textContent = "0";
  $("moves").textContent = "0";
  $("movesBox").hidden = players === 2;
  $("score").hidden = players !== 2;
  $("grid").dataset.size = String(size);
  $("status").textContent = "";
  buildGrid();
  drawScore();
  startedAt = Date.now();
  clearInterval(clockId);
  tick();
  clockId = setInterval(tick, 1000);
  show("play");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function tick() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  $("clock").textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function buildGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  const labels = deck === "set" ? { a: "Nomi", b: set.kind === "question" ? "Javob" : "Formula" } : DECKS[deck];
  cards.forEach((c, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xj-card";
    btn.dataset.side = c.side;
    btn.dataset.index = String(i);
    btn.setAttribute("aria-label", `${i + 1}-karta, yopiq`);
    btn.innerHTML = `
      <span class="xj-card__inner">
        <span class="xj-card__back" aria-hidden="true"><span>?</span></span>
        <span class="xj-card__face"><small></small><span class="xj-card__text"></span></span>
      </span>`;
    btn.querySelector("small").textContent = c.side === "a" ? labels.a : labels.b;
    btn.querySelector(".xj-card__text").textContent = c.text;
    btn.querySelector(".xj-card__text").dataset.len = c.text.length > 44 ? "long" : c.text.length > 22 ? "mid" : "short";
    btn.addEventListener("click", () => flip(i));
    li.append(btn);
    grid.append(li);
  });
}

function cardEl(i) { return $("grid").querySelector(`[data-index="${i}"]`); }

function paint(i) {
  const c = cards[i];
  const el = cardEl(i);
  el.dataset.open = String(c.open || c.matched);
  el.dataset.matched = String(c.matched);
  if (c.matched) el.dataset.owner = String(c.owner ?? 0);
  el.setAttribute("aria-label", c.open || c.matched ? `${c.text}${c.matched ? " — topilgan" : ""}` : `${i + 1}-karta, yopiq`);
  el.disabled = c.matched;
}

function flip(i) {
  const c = cards[i];
  if (lock || c.open || c.matched) return;
  c.open = true;
  opened.push(i);
  paint(i);
  if (opened.length < 2) return;

  moves += 1;
  $("moves").textContent = String(moves);
  const [x, y] = opened;
  if (cards[x].pair === cards[y].pair) {
    [x, y].forEach((k) => { cards[k].matched = true; cards[k].open = false; cards[k].owner = turn; paint(k); });
    opened = [];
    found += 1;
    scores[turn] += 1;
    $("found").textContent = String(found);
    $("status").textContent = players === 2 ? `${playerName(turn)} juft topdi va yana yuradi.` : "Juft topildi!";
    drawScore();
    if (found === pairs.length) setTimeout(finish, 650);
    return;
  }
  lock = true;
  [x, y].forEach((k) => { cardEl(k).dataset.wrong = "true"; });
  $("status").textContent = players === 2 ? `Mos emas. Navbat: ${playerName(1 - turn)}.` : "Mos emas — kartalar yopiladi.";
  setTimeout(() => {
    [x, y].forEach((k) => { cards[k].open = false; delete cardEl(k).dataset.wrong; paint(k); });
    opened = [];
    lock = false;
    if (players === 2) { turn = 1 - turn; drawScore(); }
  }, FLIP_BACK_MS);
}

function drawScore() {
  if (players !== 2) return;
  const box = $("score");
  box.innerHTML = "";
  [0, 1].forEach((p) => {
    const div = document.createElement("div");
    div.className = "xj-player";
    div.dataset.p = String(p);
    div.dataset.active = String(p === turn);
    div.innerHTML = "<i></i><span></span><b></b>";
    div.querySelector("span").textContent = playerName(p);
    div.querySelector("b").textContent = String(scores[p]);
    box.append(div);
  });
}

function finish() {
  clearInterval(clockId);
  const secs = Math.round((Date.now() - startedAt) / 1000);
  const time = secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} daq ${secs % 60} s`;
  const ring = $("ring");
  ring.style.setProperty("--p", "100");
  if (players === 1) {
    const perfect = pairs.length;
    const ratio = Math.max(0, Math.min(100, Math.round((perfect / moves) * 100)));
    ring.style.setProperty("--p", String(ratio));
    ring.dataset.level = ratio >= 60 ? "high" : ratio < 35 ? "low" : "mid";
    $("resultBig").textContent = String(moves);
    $("resultSmall").textContent = "yurish";
    const map = readBest();
    const prev = map[bestKey()];
    const record = !prev || moves < prev;
    if (record) {
      map[bestKey()] = moves;
      try { localStorage.setItem(BEST_KEY, JSON.stringify(map)); } catch { /* storage yopiq */ }
    }
    $("resultTitle").textContent = record && prev ? "Yangi rekord!" : moves <= perfect * 1.5 ? "Ajoyib xotira!" : "Barcha juftlar topildi!";
    $("resultText").textContent = `${pairs.length} juftni ${moves} yurishda va ${time}da topdingiz.${prev && !record ? ` Rekordingiz: ${prev} yurish.` : ""}`;
  } else {
    ring.dataset.level = "high";
    const [a, b] = scores;
    $("resultBig").textContent = `${a}:${b}`;
    $("resultSmall").textContent = "hisob";
    $("resultTitle").textContent = a === b ? "Durang!" : `G‘olib: ${playerName(a > b ? 0 : 1)}`;
    $("resultText").textContent = `${playerName(0)} — ${a} juft, ${playerName(1)} — ${b} juft. O‘yin ${time} davom etdi.`;
  }
  const review = $("review");
  review.innerHTML = "";
  pairs.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = "<b></b><span class=\"ok\"></span>";
    li.querySelector("b").textContent = p.a;
    li.querySelector(".ok").textContent = p.b;
    review.append(li);
  });
  show("result");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("start").addEventListener("click", start);
$("again").addEventListener("click", start);
$("change").addEventListener("click", () => { describe(); show("setup"); });
$("quit").addEventListener("click", () => {
  if (!confirm("O‘yinni to‘xtatasizmi?")) return;
  clearInterval(clockId);
  describe();
  show("setup");
});

describe();
